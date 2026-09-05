"use client";

import { useEffect, useState } from "react";
import { TOTP } from "otpauth";
import type { VaultAccount, VaultData } from "@/app/lib/vault-crypto";
import { parseOtpauthLines, upsertAccounts, removeAccount, emptyVault } from "@/app/lib/vault-edit";
import { useI18n } from "@/app/lib/i18n";

/** OTP 展示 + 管理组件：账号登录即可查看/添加/删除（服务端用账号密钥解密，无主密码）。 */

function codeFor(a: VaultAccount): { code: string; left: number } {
  const totp = new TOTP({
    issuer: a.issuer || undefined,
    label: a.label || undefined,
    algorithm: a.algorithm,
    digits: a.digits,
    period: a.period,
    secret: a.secret,
  });
  return {
    code: totp.generate(),
    left: a.period - (Math.floor(Date.now() / 1000) % a.period),
  };
}

export function VaultDisplay() {
  const { t } = useI18n();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addText, setAddText] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/vault");
      if (res.status === 401) {
        setMsg(t("auth401"));
        return;
      }
      if (res.status === 404) {
        setVault(null);
        setMsg(t("noData"));
        return;
      }
      if (!res.ok) {
        setMsg(t("readFailed", { n: res.status }));
        return;
      }
      const body = (await res.json()) as { legacy?: boolean; vault: VaultData };
      if (body.legacy) {
        setMsg(t("legacy"));
        return;
      }
      setVault(body.vault);
    } catch {
      setMsg(t("networkErr"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // 每秒刷新验证码倒计时（仅在展示列表时）
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!vault) return;
    const tmr = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault]);
  void tick;

  async function copy(a: VaultAccount) {
    try {
      await navigator.clipboard.writeText(codeFor(a).code);
      setMsg(t("copied", { name: a.issuer || a.label }));
    } catch {
      setMsg(t("copyFailed"));
    }
  }

  /** 把更新后的明文推送到云端（服务端账号密钥加密落库；409=冲突时提示刷新） */
  async function saveVault(next: VaultData) {
    setBusy(true);
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault: next,
          meta: { version: next.version, updatedAt: next.updatedAt },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { meta?: { version?: number } };
      if (res.status === 409) {
        setMsg(t("conflict", { n: data.meta?.version ?? "?" }));
        return;
      }
      if (!res.ok) {
        setMsg(t("saveFailed", { n: res.status }));
        return;
      }
      setVault(next);
      setMsg(t("savedMsg"));
    } catch {
      setMsg(t("networkErr"));
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const { accounts, failed } = parseOtpauthLines(addText);
    if (accounts.length === 0) {
      setMsg(failed.length ? t("parseFailed", { n: failed.length }) : t("inputRequired"));
      return;
    }
    const next = vault ? structuredClone(vault) : emptyVault();
    upsertAccounts(next, accounts);
    await saveVault(next);
    setAddText("");
    if (failed.length) setMsg(t("imported", { n: accounts.length, m: failed.length }));
  }

  async function handleRemove(id: string) {
    if (!vault || !window.confirm(t("deleteConfirm"))) return;
    const next = structuredClone(vault);
    removeAccount(next, id);
    await saveVault(next);
  }

  const empty = !vault || vault.accounts.length === 0;

  return (
    <div className="mt-6 w-full max-w-xl space-y-4">
      {/* 添加密钥：始终可见（首次加载慢也不遮住添加入口） */}
      <div className="rounded-lg border border-gray-300 p-4 dark:border-neutral-700">
        <h2 className="mb-2 text-lg font-semibold">{t("addTitle")}</h2>
        <p className="mb-2 text-sm text-gray-500">
          {t("addDesc")}{" "}
          <code className="text-xs">otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP&issuer=GitHub</code>
        </p>
        <textarea
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          placeholder={"otpauth://totp/...\notpauth://totp/..."}
          rows={3}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800"
        />
        <button
          onClick={handleAdd}
          disabled={busy || !addText.trim()}
          className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? t("saving") : t("import")}
        </button>
      </div>

      {/* 列表 / 空态 / 加载占位 */}
      {loading ? (
        <div className="rounded-lg border border-gray-300 p-6 text-center dark:border-neutral-700">
          <p className="text-gray-400">{t("loadingCodes")}</p>
        </div>
      ) : empty ? (
        <div className="rounded-lg border border-gray-300 p-6 text-center dark:border-neutral-700">
          <p className="text-gray-500">{vault ? t("noKeys") : t("noData")}</p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {t("listMeta", {
                n: vault!.accounts.length,
                g: vault!.groups.length,
                v: vault!.version,
              })}
            </p>
            <button onClick={() => void load()} className="text-sm text-indigo-600 hover:underline">
              {t("refresh")}
            </button>
          </div>
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-300 dark:divide-neutral-700 dark:border-neutral-700">
            {vault!.accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">
                    {a.issuer || a.label || t("unnamed")}
                    {a.issuer && a.label && a.issuer !== a.label && (
                      <span className="ml-2 text-sm text-gray-400">{a.label}</span>
                    )}
                  </p>
                  <code className="font-mono text-lg tracking-widest text-indigo-600">{codeFor(a).code}</code>
                  <span className="ml-2 text-xs text-gray-400">{codeFor(a).left}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copy(a)}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
                  >
                    {t("copy")}
                  </button>
                  <button
                    onClick={() => handleRemove(a.id)}
                    disabled={busy}
                    className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:hover:bg-red-950"
                  >
                    {t("delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {msg && <p className="text-sm text-gray-500">{msg}</p>}
    </div>
  );
}