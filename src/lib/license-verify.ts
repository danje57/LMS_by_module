/**
 * Vérification des licences LMS.
 * La clé publique master est embarquée ici — elle correspond à la clé privée
 * du CLI lms-license-cli (jamais commitée, jamais dans le LMS).
 */

import { createVerify, createCipheriv, createDecipheriv, randomBytes, constants } from "crypto";
import { initInstanceKeys } from "@/lib/instance-crypto";
import { prisma } from "@/lib/prisma";

const MASTER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2uA8CsTiqtQmbYmn8URo
BpK8irDFqZ57CCuoUsVfCTXhefWRtq0u7mo/0UWCFHF1jqKtrtS1aXTJ5FwjPuao
onw5bSSbIDXXTANo2D8iKX/vqrZbcV887ikERFRnHLG+FlvWK1O+KwuAdMv+GVkl
YCm/UhK2ISi1eB+KwwbXavSjlpzqrA3w/Y7Nz+oWwLDJmQUmKQnXVxotqWP8Zb2A
CWQ4bP3XtS3xxHa6uoTxeeJRsXJ0O60QNE4Pn14XCIwSiY3MO6VLk5fjYL3hfWlt
yeN5OZZt/NUJoGGC7kZTVreOQAgFsXtBQ8FNIkY42TPKWpcZEDfY2LvgmMbeOXed
ZwIDAQAB
-----END PUBLIC KEY-----`;

export interface LicensePayload {
  licenseId:           string;
  company:             string;
  email:               string;
  issuedAt:            string;
  expiresAt:           string | null;
  contentKey:          string;          // hex 32 bytes
  previousWrappedKey?: string;          // présent lors d'un renouvellement
}

export interface LicenseVerifyResult {
  valid:    boolean;
  expired:  boolean;
  payload:  LicensePayload | null;
  error?:   string;
}

// Vérifie la signature du token et retourne le payload
export function verifyLicenseToken(token: string): LicenseVerifyResult {
  try {
    const [b64, sig] = token.replace(/\s+/g, "").split(".");
    if (!b64 || !sig) return { valid: false, expired: false, payload: null, error: "Format invalide" };

    const verify = createVerify("SHA256");
    verify.update(b64);
    const ok = verify.verify(
      { key: MASTER_PUBLIC_KEY, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST },
      Buffer.from(sig, "base64url")
    );
    if (!ok) return { valid: false, expired: false, payload: null, error: "Signature invalide" };

    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf-8")) as LicensePayload;

    const expired = payload.expiresAt ? new Date(payload.expiresAt) < new Date() : false;
    return { valid: true, expired, payload };
  } catch (e) {
    return { valid: false, expired: false, payload: null, error: String(e) };
  }
}

// Chiffre le contentKey (hex) pour stockage en base avec NEXTAUTH_SECRET
function encryptContentKey(contentKeyHex: string): string {
  const secret = (process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET) ?? "";
  const key    = Buffer.from(secret.padEnd(32, "0").slice(0, 32), "utf-8");
  const iv     = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(contentKeyHex, "utf-8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptContentKey(encoded: string): string {
  const secret = (process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET) ?? "";
  const key    = Buffer.from(secret.padEnd(32, "0").slice(0, 32), "utf-8");
  const buf    = Buffer.from(encoded, "base64");
  const iv     = buf.subarray(0, 16);
  const tag    = buf.subarray(16, 32);
  const enc    = buf.subarray(32);
  const dec    = createDecipheriv("aes-256-gcm", key, iv);
  dec.setAuthTag(tag);
  return dec.update(enc).toString("utf-8") + dec.final("utf-8");
}

// Chiffre une clé AES (fileKey) avec le contentKey de la licence
export function encryptWithContentKey(fileKeyHex: string, contentKeyHex: string): string {
  const ck  = Buffer.from(contentKeyHex, "hex");
  const iv  = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", ck, iv);
  const enc    = Buffer.concat([cipher.update(fileKeyHex, "utf-8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptWithContentKey(encoded: string, contentKeyHex: string): string {
  const ck  = Buffer.from(contentKeyHex, "hex");
  const buf = Buffer.from(encoded, "base64");
  const iv  = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const enc = buf.subarray(32);
  const dec = createDecipheriv("aes-256-gcm", ck, iv);
  dec.setAuthTag(tag);
  return dec.update(enc).toString("utf-8") + dec.final("utf-8");
}

// Retourne toutes les clés de contenu possibles (courante + chaîne historique)
// Utilisé par recover-keys pour tenter chaque clé jusqu'à déchiffrement réussi
export async function resolveAllContentKeys(): Promise<string[]> {
  const config = await prisma.instanceConfig.findFirst();
  if (!config?.contentKey) return [];

  const currentContentKey = decryptContentKey(config.contentKey);
  const keys: string[] = [currentContentKey];

  const history = await prisma.licenseHistory.findMany({
    orderBy: { replacedAt: "desc" },
  });

  let walkKey = currentContentKey;
  for (const entry of history) {
    if (!entry.previousWrappedKey) continue;
    try {
      const buf = Buffer.from(entry.previousWrappedKey, "base64");
      const iv  = buf.subarray(0, 16);
      const tag = buf.subarray(16, 32);
      const enc = buf.subarray(32);
      const ck  = Buffer.from(walkKey, "hex");
      const dec = createDecipheriv("aes-256-gcm", ck, iv);
      dec.setAuthTag(tag);
      const prevKey = dec.update(enc).toString("hex") + dec.final("hex");
      keys.push(prevKey);
      walkKey = prevKey;
    } catch {
      continue;  // entrée dupliquée ou hors-chaîne, on continue
    }
  }

  return keys;
}

// Remonte la chaîne de clés jusqu'au licenseId cible
export async function resolveContentKey(targetLicenseId: string): Promise<string | null> {
  const config = await prisma.instanceConfig.findFirst();
  if (!config?.contentKey || !config.licenseId) return null;

  const currentContentKey = decryptContentKey(config.contentKey);

  const history = await prisma.licenseHistory.findMany({
    orderBy: { replacedAt: "desc" },
  });

  let currentKey = currentContentKey;
  for (const entry of history) {
    if (!entry.previousWrappedKey) continue;
    const buf = Buffer.from(entry.previousWrappedKey, "base64");
    const iv  = buf.subarray(0, 16);
    const tag = buf.subarray(16, 32);
    const enc = buf.subarray(32);
    const ck  = Buffer.from(currentKey, "hex");
    const dec = createDecipheriv("aes-256-gcm", ck, iv);
    dec.setAuthTag(tag);
    const prevKey = dec.update(enc).toString("hex") + dec.final("hex");
    currentKey = prevKey;
    if (entry.licenseId === targetLicenseId) return currentKey;
  }

  // Fallback : aucun historique ne matche, mais licenseId correspond → clé courante
  if (config.licenseId === targetLicenseId) return currentContentKey;
  return null;
}

// Génère licenseEncryptedKey + contentLicenseId pour le double envelope upload
export async function buildLicenseEnvelope(fileKeyHex: string): Promise<{ licenseEncryptedKey: string; contentLicenseId: string } | null> {
  const config = await prisma.instanceConfig.findFirst();
  if (!config?.contentKey || !config.licenseId) return null;
  const ck = decryptContentKey(config.contentKey);
  return {
    licenseEncryptedKey: encryptWithContentKey(fileKeyHex, ck),
    contentLicenseId:    config.licenseId,
  };
}

// Lit la licence courante en base
export async function getCurrentLicense() {
  const config = await prisma.instanceConfig.findFirst();
  if (!config?.licenseKey) return null;
  return {
    licenseId:        config.licenseId,
    company:          config.company,
    email:            config.email,
    licenseExpiresAt: config.licenseExpiresAt,
    renewalInProgress: config.renewalInProgress,
    token:            config.licenseKey,
  };
}

// Active une licence sur l'instance (première activation ou renouvellement)
export async function activateLicense(token: string): Promise<{ ok: boolean; error?: string; expiresAt?: string | null }> {
  const result = verifyLicenseToken(token);
  if (!result.valid) return { ok: false, error: result.error ?? "Token invalide" };
  // On accepte les tokens expirés pour la recovery (re-dériver les clés)
  // mais on ne les active pas comme licence courante
  if (result.expired) return { ok: false, error: "Cette licence est expirée. Utilisez un renouvellement." };

  const { payload } = result;
  if (!payload) return { ok: false, error: "Payload vide" };

  // Auto-initialise les clés RSA si c'est la première activation
  await initInstanceKeys();
  const config = await prisma.instanceConfig.findFirst();
  if (!config) return { ok: false, error: "Instance non initialisée" };

  // Archiver la clé précédente dans LicenseHistory (renouvellement ET réinstallation)
  // Sur réinstall : config.licenseId est null mais payload.previousWrappedKey porte la chaîne
  if (payload.previousWrappedKey) {
    await prisma.licenseHistory.create({
      data: {
        licenseId:          config.licenseId ?? payload.licenseId,
        company:            config.company ?? payload.company ?? "",
        email:              config.email ?? payload.email ?? "",
        expiresAt:          config.licenseExpiresAt,
        previousWrappedKey: payload.previousWrappedKey,
      },
    });
  }

  await prisma.instanceConfig.update({
    where: { id: config.id },
    data: {
      licenseKey:        token,
      licenseId:         payload.licenseId,
      company:           payload.company,
      email:             payload.email,
      licenseExpiresAt:  payload.expiresAt ? new Date(payload.expiresAt) : null,
      contentKey:        encryptContentKey(payload.contentKey),
      renewalInProgress: false,
    },
  });

  return { ok: true, expiresAt: payload.expiresAt ?? null };
}
