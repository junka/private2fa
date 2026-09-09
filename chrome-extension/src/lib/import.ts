import { URI, TOTP } from "otpauth";
import type { VaultAccount, VaultData } from "./types";

/** otpauth:// URL 解析与导入 */

export function parseOtpauthUrl(url: string): VaultAccount {
  const parsed = URI.parse(url.trim());
  if (!(parsed instanceof TOTP)) throw new Error("仅支持 TOTP（time-based）");

  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    groupId: null,
    issuer: parsed.issuer ?? "",
    label: parsed.label ?? "",
    secret: parsed.secret.base32, // base32
    algorithm: (parsed.algorithm ?? "SHA1") as VaultAccount["algorithm"],
    digits: parsed.digits,
    period: parsed.period,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertAccount(
  vault: VaultData,
  account: VaultAccount
): VaultData {
  const idx = vault.accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) {
    vault.accounts[idx] = { ...account, updatedAt: Date.now(), createdAt: vault.accounts[idx].createdAt };
  } else {
    vault.accounts.push(account);
  }
  bumpVersion(vault);
  return vault;
}

export function removeAccount(vault: VaultData, id: string): VaultData {
  vault.accounts = vault.accounts.filter((a) => a.id !== id);
  bumpVersion(vault);
  return vault;
}

export function addGroup(vault: VaultData, name: string): VaultData {
  vault.groups.push({ id: crypto.randomUUID(), name, order: vault.groups.length });
  bumpVersion(vault);
  return vault;
}

export function removeGroup(vault: VaultData, id: string): VaultData {
  vault.groups = vault.groups.filter((g) => g.id !== id);
  vault.accounts.forEach((a) => {
    if (a.groupId === id) a.groupId = null;
  });
  bumpVersion(vault);
  return vault;
}

export function setAccountGroup(vault: VaultData, accountId: string, groupId: string | null): VaultData {
  const a = vault.accounts.find((x) => x.id === accountId);
  if (a) {
    a.groupId = groupId;
    a.updatedAt = Date.now();
    bumpVersion(vault);
  }
  return vault;
}

export function bumpVersion(vault: VaultData): VaultData {
  vault.version += 1;
  vault.updatedAt = Date.now();
  return vault;
}