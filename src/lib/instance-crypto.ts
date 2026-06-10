/**
 * Licencing / content protection — clés RSA par instance + chiffrement AES-256
 *
 * H5P et PDF  : AES-256-GCM (chiffrement complet en mémoire)
 * Vidéo native : AES-256-CTR (permet les Range requests)
 *
 * Format fichier GCM : [16 bytes IV][16 bytes auth tag][données chiffrées]
 * Format fichier CTR : [16 bytes IV][données chiffrées]
 */

import {
  generateKeyPairSync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  privateDecrypt,
  publicEncrypt,
  createSign,
  createVerify,
  constants,
} from "crypto";
import { readFile, createReadStream } from "fs";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { stat } from "fs/promises";

const GCM_IV_LEN = 16;
const GCM_TAG_LEN = 16;
const CTR_IV_LEN = 16;

// Chiffre la clé privée RSA avec NEXTAUTH_SECRET (AES-256-GCM)
function encryptPrivateKey(pem: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET manquant");
  const key = Buffer.from(secret).subarray(0, 32).toString().padEnd(32, "0").slice(0, 32);
  const keyBuf = Buffer.from(key, "utf-8");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(pem, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptPrivateKey(encoded: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET manquant");
  const key = Buffer.from(secret).subarray(0, 32).toString().padEnd(32, "0").slice(0, 32);
  const keyBuf = Buffer.from(key, "utf-8");
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const data = buf.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", keyBuf, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf-8");
}

// Cache en mémoire pour éviter des appels DB répétés
let cachedKeys: { publicKey: string; privateKey: string } | null = null;
let initPromise: Promise<void> | null = null;

export async function initInstanceKeys(): Promise<void> {
  const existing = await prisma.instanceConfig.findFirst();
  if (existing) return;

  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  await prisma.instanceConfig.create({
    data: {
      instanceId: randomUUID(),
      publicKey,
      privateKey: encryptPrivateKey(privateKey),
    },
  });
}

async function getInstanceKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (cachedKeys) return cachedKeys;
  // Auto-initialise si aucune clé n'existe encore
  if (!initPromise) initPromise = initInstanceKeys();
  await initPromise;
  const config = await prisma.instanceConfig.findFirst();
  if (!config) throw new Error("Impossible d'initialiser les clés d'instance");
  cachedKeys = {
    publicKey: config.publicKey,
    privateKey: decryptPrivateKey(config.privateKey),
  };
  return cachedKeys;
}

// --- AES-256-GCM (H5P, PDF) ---

export async function encryptBuffer(data: Buffer): Promise<{ encrypted: Buffer; encryptedKey: string }> {
  const { publicKey } = await getInstanceKeys();
  const aesKey = randomBytes(32);
  const iv = randomBytes(GCM_IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Concatène iv + tag + données chiffrées
  const payload = Buffer.concat([iv, tag, encrypted]);
  // Chiffre la clé AES avec RSA-OAEP
  const encryptedKey = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    aesKey
  ).toString("base64");
  return { encrypted: payload, encryptedKey };
}

export async function decryptBuffer(payload: Buffer, encryptedKey: string): Promise<Buffer> {
  const { privateKey } = await getInstanceKeys();
  const aesKey = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(encryptedKey, "base64")
  );
  const iv = payload.subarray(0, GCM_IV_LEN);
  const tag = payload.subarray(GCM_IV_LEN, GCM_IV_LEN + GCM_TAG_LEN);
  const data = payload.subarray(GCM_IV_LEN + GCM_TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// --- AES-256-CTR (vidéos — supporte Range requests) ---

export async function encryptVideoBuffer(data: Buffer): Promise<{ encrypted: Buffer; encryptedKey: string }> {
  const { publicKey } = await getInstanceKeys();
  const aesKey = randomBytes(32);
  const iv = randomBytes(CTR_IV_LEN);
  const cipher = createCipheriv("aes-256-ctr", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  // Format : iv (16) + données chiffrées
  const payload = Buffer.concat([iv, encrypted]);
  const encryptedKey = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    aesKey
  ).toString("base64");
  return { encrypted: payload, encryptedKey };
}

/**
 * Déchiffre une plage d'octets d'une vidéo CTR.
 * fileSize = taille du fichier chiffré (iv + données)
 * start/end = offsets dans les données ORIGINALES (non chiffrées)
 */
export async function decryptVideoRange(
  filePath: string,
  encryptedKey: string,
  plainStart: number,
  plainEnd: number
): Promise<{ stream: Readable; chunkSize: number }> {
  const { privateKey } = await getInstanceKeys();
  const aesKey = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(encryptedKey, "base64")
  );

  // AES-CTR : les blocs sont de 16 bytes, alignés sur l'offset dans les données claires
  const blockSize = 16;
  const blockStart = Math.floor(plainStart / blockSize);
  const byteStart = blockStart * blockSize; // offset aligné dans les données chiffrées
  const skip = plainStart - byteStart;      // bytes à sauter au début du premier bloc

  // Dans le fichier chiffré : les données commencent après CTR_IV_LEN bytes (IV)
  const fileOffset = CTR_IV_LEN + byteStart;
  const fileEnd = CTR_IV_LEN + plainEnd;     // inclus

  // Lire l'IV depuis le début du fichier
  const ivBuf = await readFileRange(filePath, 0, CTR_IV_LEN - 1);

  // Calculer le counter initial pour le bloc blockStart
  // AES-CTR: counter = IV interprété comme un entier big-endian + blockStart
  const ivBigInt = BigInt("0x" + ivBuf.toString("hex"));
  const counterBigInt = (ivBigInt + BigInt(blockStart)) & BigInt("0xffffffffffffffffffffffffffffffff");
  const counterHex = counterBigInt.toString(16).padStart(32, "0");
  const counterBuf = Buffer.from(counterHex, "hex");

  const decipher = createDecipheriv("aes-256-ctr", aesKey, counterBuf);

  const chunkSize = plainEnd - plainStart + 1;
  const fileStream = createReadStream(filePath, { start: fileOffset, end: fileEnd });

  // Déchiffrer et découper le flux
  let emitted = 0;
  const out = new Readable({ read() {} });
  let headerSkipped = false;

  decipher.on("data", (chunk: Buffer) => {
    if (!headerSkipped) {
      if (skip > 0 && chunk.length > skip) {
        chunk = chunk.subarray(skip);
      } else if (skip > 0) {
        headerSkipped = false;
        return;
      }
      headerSkipped = true;
    }
    const remaining = chunkSize - emitted;
    if (remaining <= 0) return;
    const toSend = chunk.subarray(0, Math.min(chunk.length, remaining));
    out.push(toSend);
    emitted += toSend.length;
    if (emitted >= chunkSize) out.push(null);
  });

  decipher.on("end", () => { if (!out.destroyed) out.push(null); });
  decipher.on("error", (e) => out.destroy(e));

  fileStream.pipe(decipher);

  return { stream: out, chunkSize };
}

function readFileRange(filePath: string, start: number, end: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath, { start, end });
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function getEncryptedVideoPlainSize(filePath: string): Promise<number> {
  const s = await stat(filePath);
  return s.size - CTR_IV_LEN;
}

// --- Manifest signé (non-répudiation) ---

export interface ContentManifest {
  courseId: string;
  contentHash: string;
  createdBy: string | null;
  createdAt: string;
  instanceId: string;
}

export async function signManifest(data: ContentManifest): Promise<string> {
  const { privateKey } = await getInstanceKeys();
  const config = await prisma.instanceConfig.findFirst();
  const payload = JSON.stringify({ ...data, instanceId: config!.instanceId });
  const sign = createSign("RSA-PSS");
  sign.update(payload);
  const signature = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64");
  return JSON.stringify({ payload, signature });
}

export async function verifyManifest(signed: string): Promise<{ valid: boolean; data: ContentManifest | null }> {
  try {
    const { payload, signature } = JSON.parse(signed) as { payload: string; signature: string };
    const { publicKey } = await getInstanceKeys();
    const verify = createVerify("RSA-PSS");
    verify.update(payload);
    const valid = verify.verify(
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64")
    );
    return { valid, data: valid ? JSON.parse(payload) : null };
  } catch {
    return { valid: false, data: null };
  }
}
