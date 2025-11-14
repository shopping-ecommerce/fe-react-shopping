import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {},                 // sẽ dùng file JSON sinh ra
    fallbackLng: "vi",
    ns: ["common"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
      format: (value, format, lng) => {
        if (format === "currency") {
          const currency = lng === "zh" ? "CNY" : lng === "en" ? "USD" : "VND";
          return new Intl.NumberFormat(lng || "vi-VN", {
            style: "currency",
            currency,
            maximumFractionDigits: 0
          }).format(Number(value) || 0);
        }
        return value;
      },
    },
    react: { useSuspense: false },
  });

i18n.on("languageChanged", (lng) => {
  document.documentElement.setAttribute("lang", lng);
  document.documentElement.setAttribute("dir", i18n.dir(lng));
});

export default i18n;
