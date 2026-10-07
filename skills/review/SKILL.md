---
name: review
description: Work through the entries marked to discuss on a branch's your-call review page, one at a time, changing anything the person disagrees with, then update the page. Use after someone has marked entries on the review page, or when asked to review your-call decisions.
---

# Review marked decisions

The person has read the review page and marked the entries they want to
discuss or change. Go through them with the person one at a time, make
whatever changes you agree on, and update the page.

Paths are the same as in the generate skill:
`${CLAUDE_PLUGIN_ROOT}/skills/generate/SKILL.md`.

## 1. Find the page

Get the page's URL from the page record
(`~/.claude/your-call/logs/<repo>/<branch>.page.json`), or from the
`<!-- your-call -->` block in the branch's PR body. If neither has it, ask
for the link.

## 2. Get onto the branch

The review may be run by someone other than the person who generated the
page. Make sure you're on the page's branch with its latest commits. If the
working tree has uncommitted changes, stop and ask what to do with them
before switching branches or pulling.

## 3. Read the page and its marks

- Read `review.json` with the Artifact tool (`action: "read"`, `path:
  "review.json"`).
- Read the marks with ArtifactData (`action: "list"`, `collection:
  "marks"`). Each document's id is an entry id.

Number the entries the way the page does, so you and the person use the same
labels. Fold supersede chains: an entry replaced by another isn't shown, and
its chain shows under the newest entry. Then number each type in order of
its chain's first entry time: P, S, D, O, C. A mark on an entry that has
since been replaced applies to the newest entry in its chain.

If nothing is marked, ask which entries to discuss, by number, or whether
there's nothing to change.

## 4. Seed the local log

If this machine has no log for the branch, write the page's entries to it,
one per line, so new entries continue the same record. If a log exists,
append only the entries it's missing.

## 5. Discuss each marked entry

Go through the marked entries in page order, one at a time. For each:

1. Show its number, the question, what was decided, and why. Include the
   relevant code when it helps.
2. Ask what they'd like: an explanation, a change, or to leave it.
3. If they want a change, agree on it first, then make it. The flag rule
   applies as usual: a change that hits a stop trigger is asked about, and
   every change is logged. Log a changed decision as a new entry that
   supersedes the old one, with the reason in the person's words.
4. Commit the change the way this project commits, then move to the next
   entry.

Don't move on until the current entry is settled. If the person wants to
come back to one later, leave its mark in place.

## 6. Clear handled marks

Delete the mark for every entry you settled, with ArtifactData (`action:
"delete"`, `collection: "marks"`, the entry id as `doc_id`, and the
`version` from step 3 as `if_version`). Leave marks the person deferred.

## 7. Update the page

If anything changed, ask before pushing the branch. Then follow steps 4 to 7
of the generate skill to rebuild and republish the page at the same URL. The
changed entries show as "Changed" on the page.

## 8. Finish

Summarize in a few lines: what changed, what was only explained, and what's
still marked for later. Give the page link.
