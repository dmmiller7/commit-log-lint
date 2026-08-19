// Rules for a single commit message. "Body" starts at line 3 (line 1 is the
// subject, line 2 is expected to be blank) but each rule is defensive about
// messages that don't follow that shape, since real history is messy.

export type Severity = "error" | "warning";

export interface Finding {
  line: number;
  column: number;
  ruleId: string;
  severity: Severity;
  message: string;
}

const MAX_SUBJECT_LENGTH = 72;
const MAX_BODY_LINE_LENGTH = 100;

type Rule = (lines: string[]) => Finding[];

function checkSubjectLength(lines: string[]): Finding[] {
  const subject = lines[0] ?? "";
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return [
      {
        line: 1,
        column: MAX_SUBJECT_LENGTH + 1,
        ruleId: "subject-length",
        severity: "warning",
        message: `subject line is ${subject.length} characters, keep it under ${MAX_SUBJECT_LENGTH}`,
      },
    ];
  }
  return [];
}

function checkSubjectPeriod(lines: string[]): Finding[] {
  const subject = lines[0] ?? "";
  if (subject.endsWith(".")) {
    return [
      {
        line: 1,
        column: subject.length,
        ruleId: "subject-trailing-period",
        severity: "warning",
        message: "subject line should not end with a period",
      },
    ];
  }
  return [];
}

function checkSubjectCapitalized(lines: string[]): Finding[] {
  const subject = lines[0] ?? "";
  const firstLetter = subject.match(/[a-zA-Z]/);
  if (firstLetter && firstLetter[0] === firstLetter[0].toLowerCase() && firstLetter[0] !== firstLetter[0].toUpperCase()) {
    return [
      {
        line: 1,
        column: (firstLetter.index ?? 0) + 1,
        ruleId: "subject-not-capitalized",
        severity: "warning",
        message: "subject line should start with a capital letter",
      },
    ];
  }
  return [];
}

function checkWipMarker(lines: string[]): Finding[] {
  const subject = lines[0] ?? "";
  if (/^(wip|fixup!|squash!)\b/i.test(subject.trim())) {
    return [
      {
        line: 1,
        column: 1,
        ruleId: "wip-marker",
        severity: "error",
        message: "commit looks unfinished (wip/fixup/squash marker in subject)",
      },
    ];
  }
  return [];
}

function checkBlankLineAfterSubject(lines: string[]): Finding[] {
  if (lines.length > 1 && lines[1].trim() !== "") {
    return [
      {
        line: 2,
        column: 1,
        ruleId: "missing-blank-line",
        severity: "error",
        message: "second line must be blank to separate subject from body",
      },
    ];
  }
  return [];
}

function checkTrailingWhitespace(lines: string[]): Finding[] {
  const findings: Finding[] = [];
  lines.forEach((line, index) => {
    const match = line.match(/[ \t]+$/);
    if (match && match.index !== undefined) {
      findings.push({
        line: index + 1,
        column: match.index + 1,
        ruleId: "trailing-whitespace",
        severity: "warning",
        message: "line has trailing whitespace",
      });
    }
  });
  return findings;
}

function checkBodyLineLength(lines: string[]): Finding[] {
  const findings: Finding[] = [];
  for (let index = 2; index < lines.length; index++) {
    const line = lines[index];
    // A single long token (URL, path) can't be wrapped, so don't flag it.
    if (line.length > MAX_BODY_LINE_LENGTH && line.includes(" ")) {
      findings.push({
        line: index + 1,
        column: MAX_BODY_LINE_LENGTH + 1,
        ruleId: "body-line-length",
        severity: "warning",
        message: `body line is ${line.length} characters, keep it under ${MAX_BODY_LINE_LENGTH}`,
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

export function lintText(text: string): Finding[] {
  // A trailing newline is normal (most commit message sources end with one)
  // and shouldn't produce a phantom empty final line.
  const normalized = text.endsWith("\n") ? text.slice(0, -1) : text;
  const lines = normalized.length === 0 ? [] : normalized.split("\n");
  const findings = rules.flatMap((rule) => rule(lines));
  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  return findings;
}
