import { URI, TOTP } from "otpauth";
import type { VaultAccount, VaultData } from "./vault-crypto";

/** Web 端保险箱编辑助手：otpauth 解析、新增/删除、版本自增（与 Chrome 插件 import.ts 语义一致） */

export function parseOtpauthLine(url: string): VaultAccount {
  const parsed = URI.parse(url.trim());
  if (!(parsed instanceof TOTP)) throw new Error("仅支持 TOTP（time-based）");
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    groupId: null,
    issuer: parsed.issuer ?? "",
    label: parsed.label ?? "",
    secret: parsed.secret.base32,
    algorithm: (parsed.algorithm ?? "SHA1") as VaultAccount["algorithm"],
    digits: parsed.digits,
    period: parsed.period,
    createdAt: now,
    updatedAt: now,
  };
}

/** 解析多行输入，逐行尝试，返回新增账户（跳过空行）与失败行 */
export function parseOtpauthLines(text: string): {
  accounts: VaultAccount[];
  failed: string[];
} {
  const accounts: VaultAccount[] = [];
  const failed: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      accounts.push(parseOtpauthLine(t));
    } catch {
      failed.push(t);
    }
  }
  return { accounts, failed };
}

export function bumpVersion(vault: VaultData): VaultData {
  vault.version += 1;
  vault.updatedAt = Date.now();
  return vault;
}

export function upsertAccounts(vault: VaultData, accounts: VaultAccount[]): VaultData {
  vault.accounts.push(...accounts);
  bumpVersion(vault);
  return vault;
}

export function removeAccount(vault: VaultData, id: string): VaultData {
  vault.accounts = vault.accounts.filter((a) => a.id !== id);
  bumpVersion(vault);
  return vault;
}

export { emptyVault } from "./vault-crypto";