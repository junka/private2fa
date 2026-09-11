import { describe, expect, it } from "vitest";
import {
  decryptVault,
  emptyVault,
  encryptVault,
  type VaultData,
} from "../app/lib/vault-crypto";

/** 与扩展共享的 E2EE 信封：往返 + 鉴权失败 + 结构校验 */
describe("vault-crypto", () => {
  const vault: VaultData = {
    version: 1,
    updatedAt: 1720000000000,
    groups: [{ id: "g1", name: "工作", order: 0 }],
    accounts: [
      {
        id: "a1",
        groupId: "g1",
        issuer: "GitHub",
        label: "junka",
        secret: "JBSWY3DPEHPK3PXP",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        createdAt: 1720000000000,
        updatedAt: 1720000000000,
      },
    ],
  };

  it("加密后可解密还原出完全一致的数据", async () => {
    const env = await encryptVault(vault, "master-password");
    const out = await decryptVault(env, "master-password");
    expect(out).toEqual(vault);
  });

  it("同一明文两次加密产生不同密文（随机 salt / iv）", async () => {
    const e1 = await encryptVault(vault, "p");
    const e2 = await encryptVault(vault, "p");
    expect(e1.kdf.salt).not.toBe(e2.kdf.salt);
    expect(e1.cipher.iv).not.toBe(e2.cipher.iv);
    expect(e1.cipher.ct).not.toBe(e2.cipher.ct);
  });

  it("错误密码解密失败", async () => {
    const env = await encryptVault(vault, "right");
    await expect(decryptVault(env, "wrong")).rejects.toThrow();
  });

  it("篡改密文后无法解密（GCM 认证失败）", async () => {
    const env = await encryptVault(vault, "p");
    // 交换尾字节破坏 AES-GCM 认证标签
    env.cipher.ct = env.cipher.ct.slice(-2) + env.cipher.ct.slice(0, -2);
    await expect(decryptVault(env, "p")).rejects.toThrow();
  });

  it("emptyVault 生成结构正确的空保险箱", () => {
    const v = emptyVault();
    expect(v.version).toBe(1);
    expect(v.accounts).toEqual([]);
    expect(v.groups).toEqual([]);
  });
});