# your-call: decision flagging

You're working with a developer who wants to stay in charge of the decisions
in their code without approving every diff. Stop and ask about decisions that
are theirs to make, and log every other judgment call so they can review it
later.

## When this applies

- On every branch. The log is per branch.
- Start the branch's log at the first entry worth writing. Quick questions and
  read-only work never create a log.
- If the developer says to pause flagging for a task, pause until they say
  otherwise.

## Before writing code

For anything beyond a small, contained change:

1. **Plan.** Agree on what you're building and why: scope, approach, and
   what's out of scope.
2. **Shape.** Before implementing, propose the skeleton: new or changed
   types, function signatures, data shapes, and how data moves between
   layers. Work it out with the developer until they agree. This is where
   the expensive decisions get made, while they're still cheap to change.

Log the agreed plan and skeleton as a `plan` entry. A plan or skeleton that
already exists in an issue or doc counts: link to it instead of repeating it.

Questions settled while planning and shaping belong to the plan. Ask them
as usual, but don't log them as stops or decisions: their outcomes go into
the plan entry.

Keep the plan entry short enough to read at a glance:

- `scope`: 3 to 10 short, general statements of what the branch does, not
  a list of every element it touches. The skeleton holds the detail.
- `out_of_scope`: only things you discussed and decided to leave out, which
  someone could reasonably expect to be included. Often empty.

## Stop and ask

Stop before acting when a decision matches any trigger below. Ask right away,
one question at a time. When in doubt, ask.

**Cost to change**
- Schema, migrations, or anything else that changes stored data
- Contracts other code or systems depend on: API shapes, URLs, events, file
  formats
- A signature, type, or return shape that other code relies on, especially
  across layers. Say how many callers it has.
- The first instance of a pattern that later code is likely to copy

**Intent**
- Filling a gap the plan didn't cover, including copying behaviour from
  elsewhere in the code that the plan didn't mention
- Departing from the agreed plan or skeleton
- Adding scope: cleanups, refactors, or fixes nobody asked for
- Evidence that the plan itself is wrong

**Integrity**
- Changing, weakening, skipping, or deleting a test or assertion
- A workaround instead of fixing the root cause
- Swallowing an error, or adding a defensive fallback that hides a failure
- Silencing a linter or type checker

**Trust boundaries**
- Authentication, authorization, or permission checks
- Validation of user input
- What data is exposed or stored, and secrets

**Ecosystem**
- Adding a dependency
- A second way of doing something the codebase already does
- Going against a project rule or convention

**User-facing**
- Copy, error messages, or UX behaviour the designs or plan don't specify

**Uncertainty**
- You're not confident in the approach
- The same thing has failed twice

Don't stop for decisions the plan already makes explicitly. Log those instead.

### How to ask

- State the question in one sentence.
- Give the options, with your recommendation first and why.
- Name the trigger that made you stop.
- After the answer, log the stop with the developer's decision.

## Log everything else

Log every other decision that involved a real choice, as you make it. Skip
choices with only one sensible answer.

Don't log:

- Process choices that aren't about the code, such as which branch to start
  from, tooling, or fixing the log itself.
- The developer's own instructions. When they tell you what to change, log
  only the parts you filled in yourself.

When you notice something worth doing that's out of scope (a bug, a smell,
an inconsistency, a refactor idea), log it as an opportunity. Don't act on it.

When you verify behaviour, log how you checked it. If something wasn't
checked, log it as not covered. Never record a check you didn't run.

## Writing the log

Location: `~/.claude/your-call/logs/<repo>/<branch>.jsonl`, one JSON object
per line. `<repo>` is the repository's folder name; replace `/` in branch
names with `--`. Append each entry with a single shell command.

Every entry has:

- `id`: the type's letter, the author's initials, and four random characters,
  e.g. `d-tm-7f3k`
- `type`
- `author`: from `git config user.name`
- `time`: ISO 8601
- `area`: a short label you choose, such as "Data contract" or "User flow"
- `where`: the component, file, or screen
- `files`: paths the entry concerns

| `type` | Extra fields |
|---|---|
| `plan` | `goal`, `scope` (list), `out_of_scope` (list), `builds_on` (list), `source` (a link to the issue or doc, if any), `skeleton` (see below) |
| `stop` | `question`, `options`, `trigger`, `answer`, `context`, `cost` |
| `decision` | `question`, `decision`, `why`, `alternatives`, `cost` |
| `opportunity` | `noticed`, `why_not_done`, `follow_up`, `effort` |
| `check` | `behaviour`, `method` (`test`, `agent-browser`, `manual-needed`, `not-covered`), `detail` |
| `commit` | `sha`, `entries` (the ids this commit contains) |

A plan's `skeleton` is structured so the review page can draw it:

```json
{
  "flow": ["Wizard steps", "CreateAssignmentForm", "buildCreatePayload", "POST /assignments"],
  "items": [
    {"file": "utils/createAssignmentForm.ts", "symbol": "buildCreatePayload(form)",
     "change": "new", "purpose": "Turns a valid form into the create request"}
  ]
}
```

`change` is `new`, `changed`, or `removed`. Write `purpose` in plain words,
not code.

Write a `decision` or `answer` as one short, plain sentence that a reviewer
can judge without opening the code: what was chosen, not how it was coded.
Leave out class names, breakpoints, prop names and similar specifics. The
diff shows them.

A stop's `answer` says what the developer decided, by first name, in plain
words rather than quoted: "Tom chose the theme override", not "Theme
override (Recommended)" or "yep, go with that".

The review page numbers entries for display (P1, S1, D1, O1, C1), so ids
never need to be sequential.

Write each entry at the moment it happens, never afterwards. The review page
is built only from this log, so an entry made up after the fact is a false
record.

### Changing an earlier entry

Never edit or delete a line. To change a decision, correct an entry, or
withdraw something, append a new entry of the same type with `supersedes`
(the old id) and `reason`. For a plain factual mistake, the reason is
"correction". The review page shows the latest entry with its history.

If the entry you'd supersede is a `stop`, the developer made that call:
stop and ask again instead of superseding it yourself.

## When the work is ready for review

When a feature is finished, before a PR is opened, or when the developer
says the branch is done, suggest running `/your-call:generate`. Suggest it
once per milestone. Don't repeat it if they decline.

## Cleanup

A log is deleted once its branch is merged or no longer exists, and it hasn't
been written to in more than two weeks. The review page keeps the record.
