// Rules for a single commit message. "Body" starts at line 3 (line 1 is the
// subject, line 2 is expected to be blank) but each rule is defensive about
// messages that don't follow that shape, since real history is messy.

export type Severity = "error" | "warning";
export type RuleSeverity = Severity | "off";

export interface Finding {
  line: number;
  column: number;
  ruleId: string;
  severity: Severity;
  message: string;
}

export const RULE_IDS = [
  "subject-length",
  "subject-trailing-period",
  "subject-not-capitalized",
  "wip-marker",
  "missing-blank-line",
  "trailing-whitespace",
  "body-line-length",
] as const;

export interface LintConfig {
  maxSubjectLength: number;
  maxBodyLineLength: number;
  rules: Record<string, RuleSeverity>;
}

export const DEFAULT_CONFIG: LintConfig = {
  maxSubjectLength: 72,
  maxBodyLineLength: 100,
  rules: {
    "subject-length": "warning",
    "subject-trailing-period": "warning",
    "subject-not-capitalized": "warning",
    "wip-marker": "error",
    "missing-blank-line": "error",
    "trailing-whitespace": "warning",
    "body-line-length": "warning",
  },
};

// What a user's config file provides: any subset of the defaults, plus
// only the rule severities they want to change.
export interface ConfigOverrides {
  maxSubjectLength?: number;
  maxBodyLineLength?: number;
  rules?: Record<string, RuleSeverity>;
}

export function mergeConfig(overrides: ConfigOverrides): LintConfig {
  return {
    maxSubjectLength: overrides.maxSubjectLength ?? DEFAULT_CONFIG.maxSubjectLength,
    maxBodyLineLength: overrides.maxBodyLineLength ?? DEFAULT_CONFIG.maxBodyLineLength,
    rules: { ...DEFAULT_CONFIG.rules, ...overrides.rules },
  };
}

type Rule = (lines: string[], config: LintConfig) => Finding[];

function checkSubjectLength(lines: string[], config: LintConfig): Finding[] {
  const severity = config.rules["subject-length"];
  if (severity === "off") return [];
  const subject = lines[0] ?? "";
  if (subject.length > config.maxSubjectLength) {
    return [
      {
        line: 1,
        column: config.maxSubjectLength + 1,
        ruleId: "subject-length",
        severity,
        message: `subject line is ${subject.length} characters, keep it under ${config.maxSubjectLength}`,
      },
    ];
  }
  return [];
}

function checkSubjectPeriod(lines: string[], config: LintConfig): Finding[] {
  const severity = config.rules["subject-trailing-period"];
  if (severity === "off") return [];
  const subject = lines[0] ?? "";
  if (subject.endsWith(".")) {
    return [
      {
        line: 1,
        column: subject.length,
        ruleId: "subject-trailing-period",
        severity,
        message: "subject line should not end with a period",
      },
    ];
  }
  return [];
}

function checkSubjectCapitalized(lines: string[], config: LintConfig): Finding[] {
  const severity = config.rules["subject-not-capitalized"];
  if (severity === "off") return [];
  const subject = lines[0] ?? "";
  const firstLetter = subject.match(/[a-zA-Z]/);
  if (firstLetter && firstLetter[0] === firstLetter[0].toLowerCase() && firstLetter[0] !== firstLetter[0].toUpperCase()) {
    return [
      {
        line: 1,
        column: (firstLetter.index ?? 0) + 1,
        ruleId: "subject-not-capitalized",
        severity,
        message: "subject line should start with a capital letter",
      },
    ];
  }
  return [];
}

function checkWipMarker(lines: string[], config: LintConfig): Finding[] {
  const severity = config.rules["wip-marker"];
  if (severity === "off") return [];
  const subject = lines[0] ?? "";
  if (/^(wip|fixup!|squash!)\b/i.test(subject.trim())) {
    return [
      {
        line: 1,
        column: 1,
        ruleId: "wip-marker",
        severity,
        message: "commit looks unfinished (wip/fixup/squash marker in subject)",
      },
    ];
  }
  return [];
}

function checkBlankLineAfterSubject(lines: string[], config: LintConfig): Finding[] {
  const severity = config.rules["missing-blank-line"];
  if (severity === "off") return [];
  if (lines.length > 1 && lines[1].trim() !== "") {
    return [
      {
        line: 2,
        column: 1,
        ruleId: "missing-blank-line",
        severity,
        message: "second line must be blank to separate subject from body",
      },
    ];
  }
  return [];
}

function checkTrailingWhitespace(lines: string[], config: LintConfig): Finding[] {
  const severity = config.rules["trailing-whitespace"];
  if (severity === "off") return [];
  const findings: Finding[] = [];
  lines.forEach((line, index) => {
    const match = line.match(/[ \t]+$/);
    if (match && match.index !== undefined) {
      findings.push({
        line: index + 1,
        column: match.index + 1,
        ruleId: "trailing-whitespace",
        severity,
        message: "line has trailing whitespace",
      });
    }
  });
  return findings;
}

function checkBodyLineLength(lines: string[], config: LintConfig): Finding[] {
  const severity = config.rules["body-line-length"];
  if (severity === "off") return [];
  const findings: Finding[] = [];
  for (let index = 2; index < lines.length; index++) {
    const line = lines[index];
    // A single long token (URL, path) can't be wrapped, so don't flag it.
    if (line.length > config.maxBodyLineLength && line.includes(" ")) {
      findings.push({
        line: index + 1,
        column: config.maxBodyLineLength + 1,
        ruleId: "body-line-length",
        severity,
        message: `body line is ${line.length} characters, keep it under ${config.maxBodyLineLength}`,
      });
    }
  }
  return findings;
}

const rules: Rule[] = [
  checkSubjectLength,
  checkSubjectPeriod,
  checkSubjectCapitalized,
  checkWipMarker,
  checkBlankLineAfterSubject,
  checkTrailingWhitespace,
  checkBodyLineLength,
];

export function lintText(text: string, config: LintConfig = DEFAULT_CONFIG): Finding[] {
  // A trailing newline is normal (most commit message sources end with one)
  // and shouldn't produce a phantom empty final line.
  const normalized = text.endsWith("\n") ? text.slice(0, -1) : text;
  const lines = normalized.length === 0 ? [] : normalized.split("\n");
  const findings = rules.flatMap((rule) => rule(lines, config));
  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  return findings;
}
