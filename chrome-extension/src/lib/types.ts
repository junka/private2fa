/** 数据模型：Vault 明文结构（加密前的 JSON） */

export type OtpAlgorithm = "SHA1" | "SHA256" | "SHA512";

export interface VaultAccount {
  id: string;
  groupId: string | null; // null = 未分组
  issuer: string;
  label: string; // 账户标签（如用户名/邮箱）
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

/** 加密前的完整明文保险库（也是 L2/L3 同步的语义单元） */
export interface VaultData {
  version: number; // 单调递增，跨层冲突仲裁依据
  updatedAt: number;
  groups: VaultGroup[];
  accounts: VaultAccount[];
}

/** 加密信封：L1/L2/L3 存储的统一形态（密文，服务端/Google 不可读） */
export interface Envelope {
  v: 1;
  kdf: { algo: "PBKDF2-SHA256"; iterations: number; salt: string };
  cipher: { algo: "AES-GCM"; iv: string; ct: string };
}

/** 非敏感元信息：明文存储，供跨层版本比较（不含密钥内容） */
export interface VaultMeta {
  version: number;
  updatedAt: number;
}

export interface Settings {
  serverUrl: string; // L3 后端地址
  autoLockMinutes: number; // 0 = 不自动锁定
  syncChrome: boolean; // L2 chrome.storage.sync 镜像开关
  syncCloud: boolean; // L3 自建后端同步开关
  deviceToken: string | null; // L3 设备令牌
  deviceTokenName: string | null;
}