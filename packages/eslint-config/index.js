const { FlatCompat } = require("@eslint/eslintrc");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: ["lib/**", "dist/**", "node_modules/**"],
  },
];
