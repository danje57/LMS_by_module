#!/usr/bin/env node
/**
 * LMS License CLI — usage interne uniquement
 * Génère et gère les licences clients.
 *
 * Commandes :
 *   node index.js setup                        — génère la paire de clés master
 *   node index.js issue  --company "X" --email "y@z.com" [--expires 2027-12-31]
 *   node index.js renew  --license-id "uuid"   [--expires 2027-12-31]
 *   node index.js list
 *   node index.js info   --license-id "uuid"
 */

import { generateKeyPairSync, createSign, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR   = join(__dirname, "keys");
const CLIENTS_DB = join(__dirname, "clients.json");
const PRIV_KEY   = join(KEYS_DIR, "master-private.pem");
const PUB_KEY    = join(KEYS_DIR, "master-public.pem");

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadClients() {
  if (!existsSync(CLIENTS_DB)) return { clients: [] };
  return JSON.parse(readFileSync(CLIENTS_DB, "utf-8"));
}

function saveClients(db) {
  writeFileSync(CLIENTS_DB, JSON.stringify(db, null, 2), "utf-8");
}

function requireKeys() {
  if (!existsSync(PRIV_KEY) || !existsSync(PUB_KEY)) {
    console.error("❌  Clés master introuvables. Lancez d'abord : node index.js setup");
    process.exit(1);
  }
  return {
    privateKey: readFileSync(PRIV_KEY, "utf-8"),
    publicKey:  readFileSync(PUB_KEY,  "utf-8"),
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const cmd  = args[0];
  const opts = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    opts[key] = args[i + 1];
  }
  return { cmd, opts };
}

// Chiffre le contentKey pour stockage dans clients.json (AES-256-GCM)
// On utilise une passphrase locale pour protéger le fichier clients.json
function encryptContentKey(contentKeyHex, passphrase) {
  const key = Buffer.from(passphrase.padEnd(32, "0").slice(0, 32), "utf-8");
  const iv  = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(contentKeyHex, "utf-8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptContentKey(encoded, passphrase) {
  const key = Buffer.from(passphrase.padEnd(32, "0").slice(0, 32), "utf-8");
  const buf  = Buffer.from(encoded, "base64");
  const iv   = buf.subarray(0, 16);
  const tag  = buf.subarray(16, 32);
  const enc  = buf.subarray(32);
  const dec  = createDecipheriv("aes-256-gcm", key, iv);
  dec.setAuthTag(tag);
  return dec.update(enc) + dec.final("utf-8");
}

// Génère un token de licence signé RSA-PSS
function generateToken(payload, privateKey) {
  const json = JSON.stringify(payload);
  const b64  = Buffer.from(json).toString("base64url");
  const sign = createSign("RSA-PSS");
  sign.update(b64);
  const sig = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${b64}.${sig}`;
}

// ── Commandes ─────────────────────────────────────────────────────────────────

function cmdSetup() {
  if (existsSync(PRIV_KEY)) {
    console.log("⚠️  Les clés master existent déjà. Supprimez keys/ pour regénérer.");
    return;
  }
  mkdirSync(KEYS_DIR, { recursive: true });
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding:  { type: "spki",   format: "pem" },
    privateKeyEncoding: { type: "pkcs8",  format: "pem" },
  });
  writeFileSync(PRIV_KEY, privateKey, { mode: 0o600 });
  writeFileSync(PUB_KEY,  publicKey);
  console.log("✅  Paire de clés master générée dans keys/");
  console.log("");
  console.log("📋  Copiez la clé publique ci-dessous dans src/lib/license-verify.ts du LMS :");
  console.log("");
  console.log(publicKey);
}

function cmdIssue(opts) {
  const { company, email, expires } = opts;
  if (!company || !email) {
    console.error("Usage : node index.js issue --company \"Acme\" --email admin@acme.com [--expires 2027-12-31]");
    process.exit(1);
  }

  const { privateKey } = requireKeys();
  const db = loadClients();

  // Vérifier si ce client existe déjà
  const existing = db.clients.find(c => c.email === email && c.company === company);
  if (existing) {
    console.error(`❌  Ce client existe déjà (licenseId: ${existing.licenseId}). Utilisez 'renew' pour renouveler.`);
    process.exit(1);
  }

  const licenseId  = randomBytes(16).toString("hex");
  const contentKey = randomBytes(32).toString("hex");
  const issuedAt   = new Date().toISOString();
  const expiresAt  = expires ? new Date(expires).toISOString() : null;

  const payload = { licenseId, company, email, issuedAt, expiresAt, contentKey };
  const token   = generateToken(payload, privateKey);

  // Stocker le client (contentKey chiffré avec une clé dérivée du licenseId pour sécurité locale)
  const passphrase = licenseId.slice(0, 32);
  db.clients.push({
    licenseId,
    company,
    email,
    issuedAt,
    licenses: [{
      token,
      issuedAt,
      expiresAt,
      contentKeyEnc: encryptContentKey(contentKey, passphrase),
    }],
  });
  saveClients(db);

  console.log("✅  Licence générée pour", company, "/", email);
  console.log("   licenseId :", licenseId);
  console.log("   Expire le :", expiresAt ?? "jamais");
  console.log("");
  console.log("🔑  TOKEN À TRANSMETTRE AU CLIENT :");
  console.log("");
  console.log(token);
  console.log("");
}

function cmdRenew(opts) {
  const { licenseId, expires } = opts;
  if (!licenseId) {
    console.error("Usage : node index.js renew --license-id <uuid> [--expires 2027-12-31]");
    process.exit(1);
  }

  const { privateKey } = requireKeys();
  const db = loadClients();
  const client = db.clients.find(c => c.licenseId === licenseId);
  if (!client) {
    console.error("❌  Client introuvable pour licenseId :", licenseId);
    process.exit(1);
  }

  // Récupérer l'ancien contentKey
  const passphrase = licenseId.slice(0, 32);
  const lastLicense = client.licenses[client.licenses.length - 1];
  const oldContentKey = decryptContentKey(lastLicense.contentKeyEnc, passphrase);

  const newContentKey = randomBytes(32).toString("hex");
  const issuedAt  = new Date().toISOString();
  const expiresAt = expires ? new Date(expires).toISOString() : null;

  // Calculer previousWrappedKey = AES(oldContentKey, newContentKey)
  const newKeyBuf = Buffer.from(newContentKey, "hex");
  const oldKeyBuf = Buffer.from(oldContentKey, "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", newKeyBuf, iv);
  const wrapped = Buffer.concat([cipher.update(oldKeyBuf), cipher.final()]);
  const wrapTag = cipher.getAuthTag();
  const previousWrappedKey = Buffer.concat([iv, wrapTag, wrapped]).toString("base64");

  const payload = {
    licenseId,
    company:          client.company,
    email:            client.email,
    issuedAt,
    expiresAt,
    contentKey:       newContentKey,
    previousWrappedKey,
  };
  const token = generateToken(payload, privateKey);

  client.licenses.push({
    token,
    issuedAt,
    expiresAt,
    contentKeyEnc: encryptContentKey(newContentKey, passphrase),
    previousWrappedKey,
  });
  saveClients(db);

  console.log("✅  Renouvellement généré pour", client.company, "/", client.email);
  console.log("   licenseId :", licenseId);
  console.log("   Expire le :", expiresAt ?? "jamais");
  console.log("");
  console.log("🔑  TOKEN À TRANSMETTRE AU CLIENT :");
  console.log("");
  console.log(token);
  console.log("");
  console.log("ℹ️  Le client devra entrer ce token dans Paramètres > Licence.");
  console.log("   Un backup automatique sera effectué avant migration.");
}

function cmdList() {
  const db = loadClients();
  if (!db.clients.length) { console.log("Aucun client."); return; }
  console.log(`${db.clients.length} client(s) :\n`);
  for (const c of db.clients) {
    const last = c.licenses[c.licenses.length - 1];
    const exp  = last.expiresAt ? new Date(last.expiresAt).toLocaleDateString("fr-FR") : "∞";
    console.log(`  ${c.licenseId}  ${c.company} <${c.email}>  — expire: ${exp}  (${c.licenses.length} licence(s))`);
  }
}

function cmdInfo(opts) {
  const { licenseId } = opts;
  if (!licenseId) { console.error("Usage : node index.js info --license-id <uuid>"); process.exit(1); }
  const db = loadClients();
  const client = db.clients.find(c => c.licenseId === licenseId);
  if (!client) { console.error("❌  Client introuvable"); process.exit(1); }
  console.log(JSON.stringify(client, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { cmd, opts } = parseArgs();
switch (cmd) {
  case "setup":  cmdSetup();       break;
  case "issue":  cmdIssue(opts);   break;
  case "renew":  cmdRenew(opts);   break;
  case "list":   cmdList();        break;
  case "info":   cmdInfo(opts);    break;
  default:
    console.log("Commandes disponibles : setup | issue | renew | list | info");
    console.log("Ex: node index.js issue --company \"Acme\" --email admin@acme.com --expires 2027-12-31");
}
