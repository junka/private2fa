"use client";

import { useI18n } from "@/app/lib/i18n";

const SECTIONS = [
  { title: "pCollectTitle", items: ["pCollectL1", "pCollectL2", "pCollectL3", "pCollectL4"] },
  { title: "pUseTitle", items: ["pUseL1", "pUseL2", "pUseL3"] },
  { title: "pStorageTitle", items: ["pStorageL1", "pStorageL2", "pStorageL3"] },
  { title: "pThirdTitle", items: ["pThirdL1", "pThirdL2", "pThirdL3"] },
  { title: "pRightsTitle", items: ["pRightsL1", "pRightsL2", "pRightsL3"] },
  { title: "pContactTitle", items: ["pContactL1"] },
];

export default function PrivacyPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">{t("privacyTitle")}</h1>
      <p className="mb-6 text-sm text-gray-400">{t("privacyUpdated")}</p>
      <p className="mb-8 text-gray-600 dark:text-neutral-300">{t("privacyIntro")}</p>
      {SECTIONS.map((s) => (
        <section key={s.title} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{t(s.title)}</h2>
          <ul className="space-y-2">
            {s.items.map((it) => (
              <li key={it} className="text-sm leading-relaxed text-gray-600 dark:text-neutral-300">
                {t(it)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}