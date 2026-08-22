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

interface ParsedArgs {
  format: "text" | "json";
  sources: string[];
}

// Only one flag exists so far, so hand-rolled parsing is simpler than
// pulling in an args library for it.
function parseArgs(argv: string[]): ParsedArgs {
  const sources: string[] = [];
  let format = "text";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--format") {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error("--format requires a value (text or json)");
      }
      format = value;
    } else if (arg.startsWith("--format=")) {
      format = arg.slice("--format=".length);
    } else {
      sources.push(arg);
    }
  }

  if (format !== "text" && format !== "json") {
    throw new Error(`unknown format "${format}", expected "text" or "json"`);
  }

  return { format, sources };
}

interface SourceResult {
  source: string;
  readError: string | null;
  findings: ReturnType<typeof lintText>;
}

function lintSource(source: string, config: LintConfig): SourceResult {
  const label = source === "-" ? "<stdin>" : source;
  let text: string;
  try {
    text = readSource(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { source: label, readError: message, findings: [] };
  }
  return { source: label, readError: null, findings: lintText(text, config) };
}

function main(): number {
  let config: LintConfig;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  const sources = parsed.sources.length > 0 ? parsed.sources : ["-"];
  const results = sources.map((source) => lintSource(source, config));
  const hasError = results.some(
    (result) => result.readError !== null || result.findings.some((finding) => finding.severity === "error"),
  );

  if (parsed.format === "json") {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) {
      if (result.readError !== null) {
        console.error(`${result.source}: could not read source: ${result.readError}`);
        continue;
      }
      for (const finding of result.findings) {
        console.log(
          `${result.source}:${finding.line}:${finding.column}: ${finding.severity} ${finding.message} (${finding.ruleId})`,
        );
      }
    }
  }

  return hasError ? 1 : 0;
}

process.exit(main());
