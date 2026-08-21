import { readFileSync } from "node:fs";
import process from "node:process";
import {
  lintText,
  mergeConfig,
  DEFAULT_CONFIG,
  RULE_IDS,
  type ConfigOverrides,
  type LintConfig,
} from "./lint.js";

const CONFIG_FILE_NAME = ".commitlintrc.json";

function readSource(source: string): string {
  // Reading fd 0 works for both a real pipe and a redirected file, and
  // matches how commit-msg hooks pass "-" style stdin to other tools.
  if (source === "-") {
    return readFileSync(0, "utf8");
  }
  return readFileSync(source, "utf8");
}

// Config is read from the current directory, the same place a tool like
// tsc or eslint would look for its own rc file.
function loadConfig(): LintConfig {
  let raw: string;
  try {
    raw = readFileSync(CONFIG_FILE_NAME, "utf8");
  } catch {
    return DEFAULT_CONFIG;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${CONFIG_FILE_NAME}: invalid JSON: ${message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${CONFIG_FILE_NAME}: expected a JSON object`);
  }

  const overrides = parsed as ConfigOverrides;
  if (overrides.rules) {
    for (const [ruleId, severity] of Object.entries(overrides.rules)) {
      if (!(RULE_IDS as readonly string[]).includes(ruleId)) {
        throw new Error(`${CONFIG_FILE_NAME}: unknown rule "${ruleId}"`);
      }
      if (severity !== "error" && severity !== "warning" && severity !== "off") {
        throw new Error(`${CONFIG_FILE_NAME}: rule "${ruleId}" has invalid severity "${String(severity)}"`);
      }
    }
  }

  return mergeConfig(overrides);
}

function main(): number {
  let config: LintConfig;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  const args = process.argv.slice(2);
  const sources = args.length > 0 ? args : ["-"];
  let hasError = false;

  for (const source of sources) {
    const label = source === "-" ? "<stdin>" : source;
    let text: string;
    try {
      text = readSource(source);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${label}: could not read source: ${message}`);
      hasError = true;
      continue;
    }

    for (const finding of lintText(text, config)) {
      if (finding.severity === "error") hasError = true;
      console.log(
        `${label}:${finding.line}:${finding.column}: ${finding.severity} ${finding.message} (${finding.ruleId})`,
      );
    }
  }

  return hasError ? 1 : 0;
}

process.exit(main());
