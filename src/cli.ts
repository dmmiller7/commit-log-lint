import { readFileSync } from "node:fs";
import process from "node:process";
import { lintText } from "./lint.js";

function readSource(source: string): string {
  // Reading fd 0 works for both a real pipe and a redirected file, and
  // matches how commit-msg hooks pass "-" style stdin to other tools.
  if (source === "-") {
    return readFileSync(0, "utf8");
  }
  return readFileSync(source, "utf8");
}

function main(): number {
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

    for (const finding of lintText(text)) {
      if (finding.severity === "error") hasError = true;
      console.log(
        `${label}:${finding.line}:${finding.column}: ${finding.severity} ${finding.message} (${finding.ruleId})`,
      );
    }
  }

  return hasError ? 1 : 0;
}

process.exit(main());
