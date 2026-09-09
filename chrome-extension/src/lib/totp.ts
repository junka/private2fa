import { TOTP } from "otpauth";
import type { VaultAccount } from "./types";

/** TOTP 出码（复用 otpauth，本地计算，零网络） */

function totpFor(a: VaultAccount): TOTP {
  return new TOTP({
    issuer: a.issuer || undefined,
    label: a.label || undefined,
    algorithm: a.algorithm,
    digits: a.digits,
    period: a.period,
    secret: a.secret,
  });
}

export function generateCode(a: VaultAccount): string {
  return totpFor(a).generate();
}

export function secondsLeft(a: VaultAccount): number {
  return a.period - (Math.floor(Date.now() / 1000) % a.period);
}