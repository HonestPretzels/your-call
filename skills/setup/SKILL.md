---
name: setup
description: Install or update the your-call decision flagging rule, globally or for this repo, and list any existing instructions that conflict with it. Run once after installing the plugin, and again after updating it.
disable-model-invocation: true
---

# Set up your-call

The default rule is `${CLAUDE_PLUGIN_ROOT}/skills/setup/decision-flagging.md`.
Read it before you start.

## 1. Explain the workflow

Open with this, in your own words but no longer:

> your-call keeps you in charge of the decisions in your code without
> approving every diff. Before writing code, we plan the work and agree on its
> skeleton together: the types, signatures and data flow. While I build, I
> stop and ask about decisions that are expensive to change or yours to make,
> and log every other judgment call. When the branch is ready,
> `/your-call:generate` builds a review page of what changed and why, and
> `/your-call:review` works through anything you want changed.

## 2. Pick a scope

Ask which scope to install into:

- **Global** (recommended): `~/.claude/rules/your-call.md`. Applies in every
  project.
- **This repo**: `.claude/rules/your-call.md`, committed so everyone on the
  project gets the same rule.

If a copy already exists in the other scope, say so. Two copies would both
load.

## 3. Install or update the rule

- **No copy at the chosen path:** copy the default rule there.
- **Copy matches the default:** say it's up to date.
- **Copy differs:** show the diff. The person may have customized it, so
  never overwrite it. Go through each difference and ask whether to keep
  their version or take the default, then write the merged result.

## 4. Offer project additions

For a repo install, or when run inside a repo after a global install, offer
to create `.claude/rules/your-call-project.md` for this project's own stop
triggers. If they accept, create it with only this content and let them fill
it in:

```markdown
# your-call: project additions

These triggers add to the your-call rule. They never replace it.

## Also stop and ask when

-
```

## 5. List conflicting instructions

Read the instructions that load alongside the rule:

- `~/.claude/CLAUDE.md` and `~/.claude/rules/`
- `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` and `.claude/rules/` in
  this repo
- `permissions` in `~/.claude/settings.json`, `.claude/settings.json` and
  `.claude/settings.local.json`
- Your memory files, if you have any

List each instruction that conflicts with the workflow, with the file, the
instruction, and one sentence on why it conflicts. Things to look for:

- Requiring approval or a check-in before every edit. Stops replace this.
- Forbidding file writes through the shell. The log is appended with one.
- Requiring questions to be batched, or forbidding interruptions. Stops are
  asked live, one at a time.
- Telling you to work without asking questions. Stops require asking.
- Skipping planning, or writing code before agreeing on an approach. The
  workflow plans and shapes first.
- `ask` permissions on Edit or Write, which prompt for every file change.

Don't change any of them. The person decides what to keep. If nothing
conflicts, say so in one line.

## 6. Finish

Create `~/.claude/your-call/logs/` if it doesn't exist. Then end with:

> Ready. Start working as usual: we'll plan and shape first, then I'll stop
> and ask about decisions that are yours and log the rest. Run
> `/your-call:generate` when the branch is ready for review.
