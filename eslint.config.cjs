module.exports = [
  {
    files: ["tests/**/*.{js,cjs,mjs}", "tools/**/*.{js,cjs,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { require: "readonly", module: "readonly", __dirname: "readonly", process: "readonly", console: "readonly", global: "readonly" }
    },
    rules: {
      "no-unused-vars": "warn"
    }
  }
];
