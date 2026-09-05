/** Web 端保险箱明文/密文结构与 E2EE 原语（与 Chrome 插件字节级一致，可互相解密） */

export type OtpAlgorithm = "SHA1" | "SHA256" | "SHA512";

export interface VaultAccount {
  id: string;
  groupId: string | null;
  issuer: string;
  label: string;
  secret: string; // base32
  algorithm: OtpAlgorithm;
  digits: number;
  period: number;
  createdAt: number;
  updatedAt: number;
}

export interface VaultGroup {
  id: string;
  name: string;
  order: number;
}

export interface VaultData {
  version: number;
  updatedAt: number;
  groups: VaultGroup[];
  accounts: VaultAccount[];
}

export interface Envelope {
  v: 1;
  kdf: { algo: "PBKDF2-SHA256"; iterations: number; salt: string };
  cipher: { algo: "AES-GCM"; iv: string; ct: string };
}

const ITERATIONS = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  extractable = false
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"]
  );
}

export async function encryptVault(vault: VaultData, password: string): Promise<Envelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = enc.encode(JSON.stringify(vault));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);
  return {
    v: 1,
    kdf: { algo: "PBKDF2-SHA256", iterations: ITERATIONS, salt: toB64(salt) },
    cipher: { algo: "AES-GCM", iv: toB64(iv), ct: toB64(new Uint8Array(ct)) },
  };
}

export async function decryptVault(envelope: Envelope, password: string): Promise<VaultData> {
  const key = await deriveKey(password, fromB64(envelope.kdf.salt));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(envelope.cipher.iv) },
    key,
    fromB64(envelope.cipher.ct)
  );
  const vault = JSON.parse(dec.decode(pt)) as VaultData;
  if (!isVault(vault)) throw new Error("解密结果结构非法");
  return vault;
}

function isVault(v: unknown): v is VaultData {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as VaultData).version === "number" &&
    Array.isArray((v as VaultData).accounts) &&
    Array.isArray((v as VaultData).groups)
  );
}

export function emptyVault(): VaultData {
  return { version: 1, updatedAt: Date.now(), groups: [], accounts: [] };
}