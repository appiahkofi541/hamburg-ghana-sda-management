"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { type Language } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-navy">
      <Languages className="h-4 w-4 text-churchblue" />
      <span className="hidden sm:inline">{t("common.language")}</span>
      <select
        aria-label={t("common.language")}
        className="bg-transparent text-xs font-bold outline-none"
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        <option value="en">EN</option>
        <option value="de">DE</option>
      </select>
    </label>
  );
}
