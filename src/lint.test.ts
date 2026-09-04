import { test } from "node:test";
import assert from "node:assert/strict";
import { lintText, mergeConfig, splitLogStream, DEFAULT_CONFIG, type LintConfig } from "./lint.js";

function only(config: LintConfig, ruleId: string): LintConfig {
  const rules: LintConfig["rules"] = {};
  for (const id of Object.keys(DEFAULT_CONFIG.rules)) {
    rules[id] = id === ruleId ? DEFAULT_CONFIG.rules[id] : "off";
  }
  return { ...config, rules };
}

test("subject-length: flags a subject past the limit", () => {
  const config = only(mergeConfig({ maxSubjectLength: 10 }), "subject-length");
  const findings = lintText("This subject is way too long", config);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "subject-length");
  assert.equal(findings[0].line, 1);
  assert.equal(findings[0].column, 11);
});

test("subject-length: allows a subject at exactly the limit", () => {
  const config = only(mergeConfig({ maxSubjectLength: 10 }), "subject-length");
  const findings = lintText("0123456789", config);
  assert.equal(findings.length, 0);
});

test("subject-trailing-period: flags a subject ending with a period", () => {
  const config = only(DEFAULT_CONFIG, "subject-trailing-period");
  const findings = lintText("Fix the bug.", config);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "subject-trailing-period");
  assert.equal(findings[0].column, 12);
});

test("subject-trailing-period: allows a subject without one", () => {
  const config = only(DEFAULT_CONFIG, "subject-trailing-period");
  const findings = lintText("Fix the bug", config);
  assert.equal(findings.length, 0);
});

test("subject-not-capitalized: flags a lowercase first letter", () => {
  const config = only(DEFAULT_CONFIG, "subject-not-capitalized");
  const findings = lintText("fix the bug", config);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "subject-not-capitalized");
  assert.equal(findings[0].column, 1);
});

test("subject-not-capitalized: ignores a subject with no letters", () => {
  const config = only(DEFAULT_CONFIG, "subject-not-capitalized");
  const findings = lintText("123: fix", config);
  assert.equal(findings.length, 0);
});

test("subject-not-capitalized: skips leading punctuation to find the first letter", () => {
  const config = only(DEFAULT_CONFIG, "subject-not-capitalized");
  const findings = lintText("[wip] fix the bug", config);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].column, 2);
});

test("subject-imperative-mood: flags a gerund first word", () => {
  const config = only(DEFAULT_CONFIG, "subject-imperative-mood");
  const findings = lintText("Adding a new option", config);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "subject-imperative-mood");
  assert.equal(findings[0].column, 1);
});

test("subject-imperative-mood: flags a past-tense first word", () => {
  const config = only(DEFAULT_CONFIG, "subject-imperative-mood");
  const findings = lintText("Fixed the parser", config);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "subject-imperative-mood");
});

test("subject-imperative-mood: allows an imperative first word", () => {
  const config = only(DEFAULT_CONFIG, "subject-imperative-mood");
  const findings = lintText("Fix the parser", config);
  assert.equal(findings.length, 0);
});

test("subject-imperative-mood: skips leading punctuation to find the first word", () => {
  const config = only(DEFAULT_CONFIG, "subject-imperative-mood");
  const findings = lintText("[core] Adding a new option", config);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].column, 7);
});

test("wip-marker: flags wip, fixup!, and squash! subjects", () => {
  const config = only(DEFAULT_CONFIG, "wip-marker");
  for (const subject of ["wip: still working", "fixup! earlier commit", "squash! earlier commit", "WIP"]) {
    const findings = lintText(subject, config);
    assert.equal(findings.length, 1, `expected a finding for "${subject}"`);
    assert.equal(findings[0].ruleId, "wip-marker");
  }
});

test("wip-marker: does not flag a subject that merely contains the word", () => {
  const config = only(DEFAULT_CONFIG, "wip-marker");
  const findings = lintText("Rework the wip tracking module", config);
  assert.equal(findings.length, 0);
});

test("missing-blank-line: flags a non-blank second line", () => {
  const config = only(DEFAULT_CONFIG, "missing-blank-line");
  const findings = lintText("Subject line\nBody starts immediately", config);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "missing-blank-line");
  assert.equal(findings[0].line, 2);
});

test("missing-blank-line: allows a proper blank separator", () => {
  const config = only(DEFAULT_CONFIG, "missing-blank-line");
  const findings = lintText("Subject line\n\nBody text", config);
  assert.equal(findings.length, 0);
});

test("missing-blank-line: allows a subject-only message", () => {
  const config = only(DEFAULT_CONFIG, "missing-blank-line");
  const findings = lintText("Subject line only", config);
  assert.equal(findings.length, 0);
});

test("trailing-whitespace: flags trailing spaces and tabs on any line", () => {
  const config = only(DEFAULT_CONFIG, "trailing-whitespace");
  const findings = lintText("Subject  \n\nBody line\t", config);
  assert.equal(findings.length, 2);
  assert.equal(findings[0].line, 1);
  assert.equal(findings[0].column, 8);
  assert.equal(findings[1].line, 3);
  assert.equal(findings[1].column, 9);
});

test("trailing-whitespace: allows clean lines", () => {
  const config = only(DEFAULT_CONFIG, "trailing-whitespace");
  const findings = lintText("Subject\n\nBody line", config);
  assert.equal(findings.length, 0);
});

test("body-line-length: flags a long wrapped body line", () => {
  const config = only(mergeConfig({ maxBodyLineLength: 20 }), "body-line-length");
  const findings = lintText("Subject\n\nThis body line is much longer than the limit", config);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "body-line-length");
  assert.equal(findings[0].line, 3);
});

test("body-line-length: does not flag an unwrappable single-token line", () => {
  const config = only(mergeConfig({ maxBodyLineLength: 20 }), "body-line-length");
  const findings = lintText(
    "Subject\n\nhttps://example.com/a/very/long/path/that/cannot/be/wrapped",
    config,
  );
  assert.equal(findings.length, 0);
});

test("body-line-length: ignores the subject and blank separator lines", () => {
  const config = only(mergeConfig({ maxBodyLineLength: 5 }), "body-line-length");
  const findings = lintText("A subject line well past five chars\n\nshort", config);
  assert.equal(findings.length, 0);
});

test("lintText: strips exactly one trailing newline before splitting", () => {
  const config = only(DEFAULT_CONFIG, "trailing-whitespace");
  const findings = lintText("Subject\n\nBody\n", config);
  assert.equal(findings.length, 0);
});

test("lintText: an empty message produces no findings", () => {
  const findings = lintText("", DEFAULT_CONFIG);
  assert.equal(findings.length, 0);
});

test("lintText: findings are sorted by line then column", () => {
  const config = mergeConfig({
    rules: { "subject-not-capitalized": "off" },
  });
  const findings = lintText("wip: fix\nnot blank\ntrailing \t", config);
  for (let i = 1; i < findings.length; i++) {
    const prev = findings[i - 1];
    const cur = findings[i];
    assert.ok(cur.line > prev.line || (cur.line === prev.line && cur.column >= prev.column));
  }
});

test("mergeConfig: applies overrides on top of defaults", () => {
  const config = mergeConfig({ maxSubjectLength: 50, rules: { "wip-marker": "off" } });
  assert.equal(config.maxSubjectLength, 50);
  assert.equal(config.maxBodyLineLength, DEFAULT_CONFIG.maxBodyLineLength);
  assert.equal(config.rules["wip-marker"], "off");
  assert.equal(config.rules["missing-blank-line"], DEFAULT_CONFIG.rules["missing-blank-line"]);
});

test("splitLogStream: parses NUL-separated hash/message pairs", () => {
  const stream = "abc123\0Subject one\n\nBody one\0def456\0Subject two\0";
  const commits = splitLogStream(stream);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].hash, "abc123");
  assert.equal(commits[0].message, "Subject one\n\nBody one");
  assert.equal(commits[1].hash, "def456");
  assert.equal(commits[1].message, "Subject two");
});

test("splitLogStream: an empty stream produces no commits", () => {
  assert.deepEqual(splitLogStream(""), []);
});

test("splitLogStream: rejects an odd number of parts", () => {
  assert.throws(() => splitLogStream("abc123\0Subject with no terminator"));
});
