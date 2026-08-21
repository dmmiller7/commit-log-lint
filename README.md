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
| `wip-marker` | error | subject starts with `wip`, `fixup!`, or `squash!` |
| `missing-blank-line` | error | no blank line between subject and body |
| `trailing-whitespace` | warning | any line ends with trailing spaces or tabs |
| `body-line-length` | warning | a wrapped body line over 100 characters |

## License

MIT, see [LICENSE](LICENSE).
