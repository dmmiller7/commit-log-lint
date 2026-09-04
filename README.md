# commit-log-lint

A small linter for git commit messages. It checks the kind of thing that
slips through review: subject lines that run on forever, missing blank
lines between subject and body, trailing whitespace, leftover `wip` or
`fixup!` markers. Findings are reported as `source:line:column`, the same
shape a compiler or `eslint` would use, so you can jump straight to the
problem.

## Why

`git log` fills up with commits like `wip`, `fix`, `asdf` and 300-character
subject lines, and nobody catches it because reviewing commit message
hygiene by eye is tedious. This tool turns that into a set of mechanical
checks you can run in CI or as a `commit-msg` hook.

## Building

Requires a TypeScript compiler (`tsc`) available on your machine.

```
tsc
```

This compiles `src/` to `dist/`.

## Testing

```
npm test
```

Runs the build then Node's built-in test runner (`node --test`) against
the compiled test file. No test framework is installed; `node:test` and
`node:assert` from the standard library are enough.

## Usage

Lint a single commit message from a file:

```
node dist/cli.js .git/COMMIT_EDITMSG
```

Lint from stdin, e.g. the message of the last commit:

```
git log -1 --format=%B | node dist/cli.js -
```

With no arguments it reads stdin by default:

```
echo "wip: fix the thing" | node dist/cli.js
```

Example output:

```
<stdin>:1:1: error commit looks unfinished (wip/fixup/squash marker in subject) (wip-marker)
```

## Linting a full git log

Checking one message at a time is fine for a `commit-msg` hook, but for
auditing history you want every commit in a range at once. Pass `--log`
and feed it `git log` output formatted with NUL-separated hash/message
pairs:

```
git log --format="%H%x00%B%x00" main..feature | node dist/cli.js --log -
```

Each commit in the stream becomes its own result, labeled with the
source and the commit's abbreviated hash (`<stdin>:a1b2c3d`), so findings
still point at something you can `git show`. `--log` works with file
arguments too, if you've saved the log output to a file first.

## Output formats

By default, findings print as `source:line:column` text lines. Pass
`--format json` to get a machine-readable form instead, useful for CI
steps that want to post annotations rather than parse text:

```
git log -1 --format=%B | node dist/cli.js --format json -
```

```json
[
  {
    "source": "<stdin>",
    "readError": null,
    "findings": [
      {
        "line": 1,
        "column": 1,
        "ruleId": "wip-marker",
        "severity": "error",
        "message": "commit looks unfinished (wip/fixup/squash marker in subject)"
      }
    ]
  }
]
```

Each array entry corresponds to one source argument, in order. If a
source couldn't be read, `readError` holds the message and `findings` is
empty for that entry. The exit status is unchanged by `--format`: `1` if
any entry has a read error or an `error`-severity finding.

## As a commit-msg hook

Drop this in `.git/hooks/commit-msg` and make it executable:

```sh
#!/bin/sh
node /path/to/commit-log-lint/dist/cli.js "$1"
```

The hook receives the path to the commit message as its first argument,
which lines up with how this tool reads a file argument directly.

## Configuration

Drop a `.commitlintrc.json` in the directory you run the tool from to
override the defaults. Every field is optional; anything you leave out
keeps its default value.

```json
{
  "maxSubjectLength": 50,
  "maxBodyLineLength": 72,
  "rules": {
    "subject-not-capitalized": "off",
    "trailing-whitespace": "error"
  }
}
```

`rules` maps a rule id (see the table below) to `"error"`, `"warning"`,
or `"off"`. An unknown rule id or an invalid severity value causes the
tool to exit `1` with an explanation instead of linting anything, so a
typo in the config doesn't silently disable a check.

## Exit status

Exits `1` if any finding has severity `error` (by default that's just the
wip/fixup marker and missing-blank-line checks) or the config file couldn't
be read, `0` otherwise. Warnings are printed but don't fail the run.

## Rules

Severities below are the defaults; override any of them in
`.commitlintrc.json` as shown above.

| id | default severity | checks |
|---|---|---|
| `subject-length` | warning | subject line over 72 characters |
| `subject-trailing-period` | warning | subject line ends with `.` |
| `subject-not-capitalized` | warning | subject line doesn't start with a capital letter |
| `subject-imperative-mood` | warning | first word of the subject looks like `-ing`/`-ed` form instead of imperative |
| `wip-marker` | error | subject starts with `wip`, `fixup!`, or `squash!` |
| `missing-blank-line` | error | no blank line between subject and body |
| `trailing-whitespace` | warning | any line ends with trailing spaces or tabs |
| `body-line-length` | warning | a wrapped body line over 100 characters |

`subject-imperative-mood` is a heuristic, not a grammar check: it only
looks at whether the first word ends in `-ing` or `-ed`, so it can miss
real problems ("Fixes the bug") and occasionally flag a first word that
happens to end that way but isn't a verb. Turn it off in
`.commitlintrc.json` if it's noisier than it's worth for your history.

## License

MIT, see [LICENSE](LICENSE).
