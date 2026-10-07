---
name: generate
description: Build or update the review page for the current branch from its decision log and diff, publish it, and link it from the branch's PR. Use when a feature is finished, before opening a PR, or when asked to generate the your-call review.
---

# Generate the review page

The page is a recap of the branch: the plan, what changed and where, every
decision with its reasoning, and how behaviour was checked. Everything on it
must come from the decision log, git, or what you can see in the diff.
Never invent a decision, a check, or a reason.

Paths used below:

- Script: `${CLAUDE_PLUGIN_ROOT}/skills/generate/scripts/build-review.mjs`
- Logs: `~/.claude/your-call/logs/<repo>/<branch>.jsonl`, where `<repo>` is
  the repository's folder name and `/` in the branch name becomes `--`
- Page record: `~/.claude/your-call/logs/<repo>/<branch>.page.json`, holding
  the published page's URL

## 1. Check the setup

If neither `~/.claude/rules/your-call.md` nor `.claude/rules/your-call.md`
exists, tell the person to run `/your-call:setup` first, and stop.

## 2. Clean up old logs

For each log in this repo's log folder, delete it and its `.page.json` when
both are true:

- its branch no longer exists locally, or is fully merged into the base
  branch
- the log hasn't been written to in more than two weeks

List what you deleted in one line. Never delete the current branch's log.

## 3. Pick a work folder

Use your scratchpad directory if this session has one. Otherwise use
`.your-call/` at the repo root, and add `.your-call/` to `.git/info/exclude`
so it's never committed. The files below go in this folder.

## 4. Find the existing page

Look for the page's URL in the page record. If there isn't one, look in the
branch's PR body (`gh pr view --json body`) for a link between
`<!-- your-call -->` markers.

If a page exists, read its `review.json` with the Artifact tool (`action:
"read"`, `path: "review.json"`) and save it as `existing-review.json`.

## 5. Build the facts

```
node "${CLAUDE_PLUGIN_ROOT}/skills/generate/scripts/build-review.mjs" \
  --out review.json [--existing existing-review.json]
```

Add `--base <branch>` if the base branch isn't the repo's default. Read the
script's stderr: it reports the commit, file and entry counts and any
warnings. If there are no log entries, say so. The page still works, but has
no decisions on it.

## 6. Write the judgment

Read the log entries and the diff (`git diff <base>...HEAD`), then write
`judgment.json`:

```json
{
  "title": "Short name for the work, e.g. the PR or plan title",
  "summary": ["3 to 6 bullets on what changed, in plain words"],
  "layers": [{ "id": "api", "name": "core API", "tier": "Backend", "kind": "changed", "note": "optional" }],
  "files": { "path/to/file.ts": { "layer": "api", "why": "One sentence on why it changed" } },
  "flows": [{ "name": "…", "before": ["step"], "after": [{ "label": "step", "new": true }] }],
  "plan_vs_built": [{ "planned": "…", "built": "…", "status": "changed", "settled_by": ["entry id"], "note": "optional" }],
  "calibration": [{ "kind": "Missed stop", "targets": ["entry id"], "rule": "Trigger that applied", "explanation": "…", "suggestion": null }]
}
```

- **layers:** group the changed files by where they sit in the system.
  `kind` is `changed`, `contract` (changed and includes something other code
  depends on), `depended-on` (unchanged, but the change relies on it), or
  `unchanged`. Include `depended-on` and `unchanged` layers only when they
  help someone see the shape of the change.
- **files:** give every changed file a layer and a `why`.
- **flows:** only for a user or data flow the branch changed. Leave empty
  otherwise.
- **plan_vs_built:** compare the latest `plan` entry with the diff. Status is
  `as-planned`, `changed`, `added`, or `dropped`. `settled_by` names the stop
  or decision entries that settled it. Leave empty when there's no plan.
- **calibration:** places where the flag rule and what happened don't match:
  a logged decision that matched a stop trigger, something in the diff with
  no entry that should have one, or a stop that the plan had already
  settled. Leave empty when everything lines up.

Then build the final files:

```
node "${CLAUDE_PLUGIN_ROOT}/skills/generate/scripts/build-review.mjs" \
  --out review.json --judgment judgment.json --page-out index.html \
  [--existing existing-review.json]
```

Fix every warning about missing layers or unknown files before publishing.

## 7. Publish

Publish `index.html` with the Artifact tool, with `files: {"review.json":
"<work folder>/review.json"}` and `capabilities: {"db": {}}`. If a page
already exists, pass its `url` so the link stays the same. Save the URL in
the page record.

Leave the page's marks alone. They belong to the review skill.

## 8. Link it from the PR

Find the PR for this branch with `gh pr view`.

- **A PR exists:** put this block in its body, replacing an existing
  `your-call` block if there is one:

  ```
  <!-- your-call -->
  **Decision recap:** <page URL>
  Can't open it? Ask @<your GitHub login> to share it with you.
  <!-- /your-call -->
  ```

- **No PR:** ask whether to open one. If yes, open it with a short summary
  from `summary` and the block above.

## 9. Finish

End with:

> The review page is ready: <URL>. Share it with your reviewers from the
> page's Share menu, since it's private until you do. Mark anything you want
> to discuss or change, then run `/your-call:review`.
