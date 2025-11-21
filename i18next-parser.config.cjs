// i18next-parser.config.cjs
module.exports = {
  locales: ["vi", "zh", "en"],
  output: "public/locales/$LOCALE/$NAMESPACE.json",
  input: ["src/**/*.{js,jsx}"],
  defaultNamespace: "common",
  defaultValue: (lng, ns, key) => key, // dùng chính câu gốc làm default
  keySeparator: false,
  namespaceSeparator: false,
  createOldCatalogs: false,
  func: { list: ["t", "tt"], extensions: [".js", ".jsx"] },
  trans: { component: "Trans", i18nKey: "i18nKey", extensions: [".js", ".jsx"] },
  lexers: { js: ["JavascriptLexer"], jsx: ["JsxLexer"] },
};
