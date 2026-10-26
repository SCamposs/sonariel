import i18n, { tr } from "./index";
import sources from "./system-patterns.json";

type Message = { namespace: string; key: string; values: Record<string, string> };
type Pattern = { namespace: string; key: string; regex: RegExp; parameters: string[]; specificity: number };
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = new Map<string, Omit<Message, "values">>();
const patterns: Pattern[] = [];
function register(namespace: string, key: string, text: string) {
  const parameters: string[] = [];
  let regex = "^", start = 0, specificity = 0;
  for (const match of text.matchAll(/\{\{([^}]+)\}\}/g)) {
    const literal = text.slice(start, match.index);
    regex += escape(literal) + "([\\s\\S]*?)";
    specificity += literal.length;
    parameters.push(match[1]); start = match.index! + match[0].length;
  }
  if (!parameters.length) { exact.set(text, { namespace, key }); return; }
  regex += escape(text.slice(start)) + "$";
  patterns.push({ namespace, key, parameters, regex: new RegExp(regex), specificity });
}
// Match only core-origin messages and UI notifications at explicit presentation
// boundaries. Never apply this to project names, prompts, paths or model metadata.
for (const locale of ["pt-BR", "en"]) {
  for (const [namespace, entries] of Object.entries(i18n.options.resources?.[locale] ?? {})) {
    for (const [key, text] of Object.entries(entries)) {
      if (typeof text === "string" && key !== "technicalDetail") register(namespace, key, text);
    }
  }
}
for (const { key, source } of sources) register("system", key, source);
patterns.sort((a, b) => b.specificity - a.specificity);

export function identifySystemMessage(raw: string): Message | null {
  const value = raw.replace(/^(?:Error|ValueError|RuntimeError):\s*/, "");
  const found = exact.get(value);
  if (found) return { ...found, values: {} };
  for (const pattern of patterns) {
    const match = pattern.regex.exec(value);
    if (match) return { namespace: pattern.namespace, key: pattern.key,
      values: Object.fromEntries(pattern.parameters.map((name, index) => [name, match[index + 1]])) };
  }
  return null;
}

/** Unknown engine/OS diagnostics retain their verbatim technical detail. */
export function systemMessage(raw: string | null | undefined): string {
  if (!raw) return "";
  const found = identifySystemMessage(raw);
  return found ? tr(found.namespace, found.key, found.values)
    : tr("system", "technicalDetail", { detail: raw });
}
