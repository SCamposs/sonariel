import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { afterEach, expect, it } from "vitest";
import i18n, { formatDate, formatNumber, tr } from "./index";

afterEach(async () => { await i18n.changeLanguage("pt-BR"); });
const directory = resolve("src/i18n/locales");
const catalogs = Object.fromEntries(["en", "pt-BR"].map(locale => [locale,
  Object.fromEntries(readdirSync(resolve(directory, locale)).map(name => [name.replace(".json", ""),
    JSON.parse(readFileSync(resolve(directory, locale, name), "utf8")) as Record<string, string>])),
]));
const placeholders = (value: string) => [...value.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]).sort();

it("ships matching, non-empty keys and interpolation parameters in every namespace", () => {
  expect(Object.keys(catalogs.en).sort()).toEqual(Object.keys(catalogs["pt-BR"]).sort());
  for (const namespace of Object.keys(catalogs.en)) {
    expect(Object.keys(catalogs.en[namespace]).sort()).toEqual(Object.keys(catalogs["pt-BR"][namespace]).sort());
    for (const [key, value] of Object.entries(catalogs.en[namespace])) {
      expect(value.trim(), `${namespace}.${key}`).not.toBe("");
      expect(placeholders(value), `${namespace}.${key}`).toEqual(placeholders(catalogs["pt-BR"][namespace][key]));
    }
  }
});
it("resolves every literal translation call used in production code", () => {
  for (const entry of readdirSync(resolve("src"), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || entry.name.includes(".test.")) continue;
    const file = resolve(entry.parentPath, entry.name);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "tr") {
        const [namespace, key] = node.arguments;
        if (namespace && key && ts.isStringLiteral(namespace) && ts.isStringLiteral(key)) {
          expect(catalogs.en[namespace.text]?.[key.text], `${file}: ${namespace.text}.${key.text}`).toBeDefined();
          expect(i18n.exists(key.text, { ns: namespace.text }), `${namespace.text}.${key.text}`).toBe(true);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
it("falls back to bundled English without requesting a translation service", async () => {
  i18n.addResource("en", "settings", "testEnglishFallback", "English fallback");
  await i18n.changeLanguage("pt-BR");
  expect(tr("settings", "testEnglishFallback")).toBe("English fallback");
  delete i18n.getResourceBundle("en", "settings").testEnglishFallback;
});
it("formats display values by locale without changing stored numbers", async () => {
  const value = 1234.5;
  await i18n.changeLanguage("en");
  expect(formatNumber(value)).toBe("1,234.5");
  const enDate = formatDate(1700000000);
  await i18n.changeLanguage("pt-BR");
  expect(formatNumber(value)).toBe("1.234,5");
  expect(formatDate(1700000000)).not.toBe(enDate);
  expect(value).toBe(1234.5);
  expect(formatNumber(undefined)).toBe("—");
});
