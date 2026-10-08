#!/usr/bin/env node
// Builds the mechanical parts of a your-call review.json from git and the
// branch's decision log. From an existing review.json it keeps only the log
// entries (merged by id) and the PR link. Judgment fields (title, summary,
// layers, file why, flows, plan_vs_built, missed_stops) are left empty for the
// generate skill to write fresh on every run, into a separate judgment file
// that a second run merges in with --judgment.
//
// Usage:
//   node build-review.mjs --out review.json [--existing old-review.json]
//                         [--judgment judgment.json] [--page-out index.html]
//                         [--base main] [--head branch] [--log path/to/log.jsonl]
//                         [--repo-dir .]
//
// --page-out writes the page template with its <title> set from the review's title.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), "..", "template", "index.html");

const DEFAULTS = {
  fileLines: 1500,
  fileBytes: 150 * 1024,
  totalBytes: 2 * 1024 * 1024,
};

const LOCKFILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "npm-shrinkwrap.json",
  "poetry.lock", "Pipfile.lock", "uv.lock", "Cargo.lock", "Gemfile.lock",
  "composer.lock", "go.sum", "bun.lockb", "flake.lock",
]);

const GENERATED_PATTERNS = ["**/*.min.js", "**/*.min.css", "**/*.map", "dist/**", "build/**"];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    args[key.slice(2)] = argv[i + 1];
    i++;
  }
  return args;
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

function tryGit(cwd, args) {
  try { return git(cwd, args).trim(); } catch { return ""; }
}

/** Convert a glob with * and ** into a regular expression over / paths. */
function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

function loadConfig(repoDir) {
  const path = join(repoDir, ".your-call.json");
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { warn(`Ignoring .your-call.json: ${e.message}`); return {}; }
}

function warn(message) { process.stderr.write(`warning: ${message}\n`); }

function detectBase(repoDir, configured) {
  if (configured) return configured;
  const remoteHead = tryGit(repoDir, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (remoteHead) return remoteHead.replace(/^origin\//, "");
  for (const name of ["develop", "main", "master"]) {
    if (tryGit(repoDir, ["rev-parse", "--verify", "--quiet", name])) return name;
  }
  throw new Error("Couldn't find a base branch. Pass --base or set \"base\" in .your-call.json.");
}

function webUrl(remote) {
  const ssh = remote.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  const https = remote.match(/^https?:\/\/(?:[^@/]+@)?(.+?)(?:\.git)?$/);
  if (https) return `https://${https[1]}`;
  return null;
}

function logPathFor(repoName, branch) {
  return join(homedir(), ".claude", "your-call", "logs", repoName, `${branch.replace(/\//g, "--")}.jsonl`);
}

function readLog(path) {
  if (!existsSync(path)) return [];
  const entries = [];
  readFileSync(path, "utf8").split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try { entries.push(JSON.parse(line)); }
    catch { warn(`Skipping malformed log line ${i + 1} in ${path}`); }
  });
  return entries;
}

/** Union of entries by id; the first copy of an id wins, then sorted by time.
 * Entries are never edited, so two different copies of one id mean something went wrong. */
function mergeEntries(...lists) {
  const byId = new Map();
  for (const list of lists) for (const e of list) {
    if (!e?.id) continue;
    if (!byId.has(e.id)) byId.set(e.id, e);
    else if (JSON.stringify(byId.get(e.id)) !== JSON.stringify(e)) warn(`Entry ${e.id} differs between the log and the page; keeping the log's copy.`);
  }
  return [...byId.values()].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

/** Parse `git diff --name-status -z -M` and `--numstat -z -M` into file records. */
function readChangedFiles(repoDir, from, to) {
  const statusParts = git(repoDir, ["diff", "--name-status", "-z", "-M", from, to]).split("\0").filter(Boolean);
  const files = [];
  for (let i = 0; i < statusParts.length;) {
    const code = statusParts[i++];
    const status = code[0];
    if (status === "R" || status === "C") {
      files.push({ old_path: statusParts[i++], path: statusParts[i++], status: "R" });
    } else {
      files.push({ path: statusParts[i++], status: status === "T" ? "M" : status });
    }
  }
  const numParts = git(repoDir, ["diff", "--numstat", "-z", "-M", from, to]).split("\0");
  const stats = new Map();
  for (let i = 0; i < numParts.length;) {
    const head = numParts[i++];
    if (!head) continue;
    const [add, del, path] = head.split("\t");
    let target = path;
    if (path === "") { i++; target = numParts[i++]; } // rename: old\0new follow
    stats.set(target, add === "-" ? { binary: true } : { add: Number(add), del: Number(del) });
  }
  for (const f of files) Object.assign(f, stats.get(f.path) || { add: 0, del: 0 });
  return files;
}

function readAttributes(repoDir, paths) {
  if (!paths.length) return new Map();
  const out = execFileSync("git", ["check-attr", "-z", "linguist-generated", "diff", "--stdin"], {
    cwd: repoDir, encoding: "utf8", input: paths.join("\0") + "\0",
  }).split("\0");
  const attrs = new Map();
  for (let i = 0; i + 2 < out.length; i += 3) {
    const [path, attr, value] = [out[i], out[i + 1], out[i + 2]];
    const a = attrs.get(path) || {};
    a[attr] = value;
    attrs.set(path, a);
  }
  return attrs;
}

/** Why a file's diff is never shown, or null when it can be. */
function skipReason(file, attrs, skipRegexes) {
  if (file.binary) return "binary";
  if (LOCKFILES.has(basename(file.path))) return "lockfile";
  const a = attrs.get(file.path) || {};
  if (a.diff === "unset" || a["linguist-generated"] === "set" || a["linguist-generated"] === "true") return "generated";
  if (skipRegexes.some(re => re.test(file.path))) return "generated";
  return null;
}

function fileDiff(repoDir, from, to, file) {
  const paths = file.old_path ? [file.old_path, file.path] : [file.path];
  const raw = git(repoDir, ["diff", "-M", "--no-color", from, to, "--", ...paths]);
  const start = raw.indexOf("\n@@");
  return start === -1 ? "" : raw.slice(start + 1).replace(/\n$/, "");
}

function fileCommits(repoDir, from, to, file) {
  return tryGit(repoDir, ["log", "--format=%H", `${from}..${to}`, "--", file.path]).split("\n").filter(Boolean);
}

/** Overlay the generate skill's judgment fields onto the review. Unknown file paths are reported, not added. */
function applyJudgment(review, judgment) {
  for (const key of ["title", "summary", "layers", "flows", "plan_vs_built", "missed_stops"]) {
    if (judgment[key] !== undefined) review[key] = judgment[key];
  }
  const byPath = new Map(review.files.map(f => [f.path, f]));
  for (const [path, info] of Object.entries(judgment.files || {})) {
    const f = byPath.get(path);
    if (!f) { warn(`Judgment names a file that isn't in this diff: ${path}`); continue; }
    if (info.layer !== undefined) f.layer = info.layer;
    if (info.why !== undefined) f.why = info.why;
  }
  const layerIds = new Set(review.layers.map(l => l.id));
  for (const f of review.files) {
    if (!f.layer) warn(`No layer for ${f.path}`);
    else if (!layerIds.has(f.layer)) warn(`${f.path} names layer "${f.layer}", which isn't in layers`);
  }
}

function writePage(path, title) {
  const escaped = String(title).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const html = readFileSync(TEMPLATE, "utf8").replace(/<title>[^<]*<\/title>/, `<title>${escaped}</title>`);
  writeFileSync(path, html);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoDir = tryGit(args["repo-dir"] || process.cwd(), ["rev-parse", "--show-toplevel"]);
  if (!repoDir) throw new Error("Not inside a git repository.");
  const config = loadConfig(repoDir);
  const limits = { ...DEFAULTS, ...(config.limits || {}) };
  const skipRegexes = [...GENERATED_PATTERNS, ...(config.skip || [])].map(globToRegex);

  const repoName = basename(repoDir);
  const head = args.head || "HEAD";
  // A commit hash or a detached HEAD has no branch name, so fall back to its short hash.
  const abbrev = tryGit(repoDir, ["rev-parse", "--abbrev-ref", head]);
  const branch = abbrev && abbrev !== "HEAD" ? abbrev : tryGit(repoDir, ["rev-parse", "--short", head]);
  const base = detectBase(repoDir, args.base || config.base);
  const mergeBase = git(repoDir, ["merge-base", base, head]).trim();
  const remote = tryGit(repoDir, ["remote", "get-url", "origin"]);
  const existing = args.existing && existsSync(args.existing) ? JSON.parse(readFileSync(args.existing, "utf8")) : null;

  const commits = tryGit(repoDir, ["log", "--format=%H%x1f%s%x1f%an%x1f%aI", `${mergeBase}..${head}`])
    .split("\n").filter(Boolean)
    .map(line => { const [sha, subject, author, time] = line.split("\x1f"); return { sha, subject, author, time }; });

  const logPath = args.log || logPathFor(repoName, branch);
  const entries = mergeEntries(readLog(logPath), existing?.entries || []);
  const mentioned = new Set(entries.flatMap(e => e.files || []));

  const files = readChangedFiles(repoDir, mergeBase, head);
  const attrs = readAttributes(repoDir, files.map(f => f.path));

  // Collect every diff that isn't skipped by type or size, then fit them to the page budget:
  // files that log entries mention first, then smallest first.
  const candidates = [];
  for (const f of files) {
    f.commits = fileCommits(repoDir, mergeBase, head, f);
    f.layer = null;
    f.why = null;
    const reason = skipReason(f, attrs, skipRegexes);
    if (reason) { f.diff = null; f.diff_omitted = reason; continue; }
    if ((f.add || 0) + (f.del || 0) > limits.fileLines) { f.diff = null; f.diff_omitted = "too-large"; continue; }
    const diff = fileDiff(repoDir, mergeBase, head, f);
    const bytes = Buffer.byteLength(diff, "utf8");
    if (bytes > limits.fileBytes) { f.diff = null; f.diff_omitted = "too-large"; continue; }
    candidates.push({ f, diff, bytes });
  }
  candidates.sort((a, b) => (mentioned.has(b.f.path) - mentioned.has(a.f.path)) || a.bytes - b.bytes);
  let used = 0;
  for (const c of candidates) {
    if (used + c.bytes > limits.totalBytes) { c.f.diff = null; c.f.diff_omitted = "over-budget"; continue; }
    c.f.diff = c.diff;
    used += c.bytes;
  }
  for (const f of files) delete f.binary;

  const review = {
    format: 1,
    title: null,
    repo: { name: repoName, url: remote ? webUrl(remote) : null },
    branch,
    base,
    pr: existing?.pr || null,
    generated: { at: new Date().toISOString(), by: tryGit(repoDir, ["config", "user.name"]) || "unknown" },
    summary: [],
    entries,
    commits,
    layers: [],
    files,
    flows: [],
    plan_vs_built: [],
    missed_stops: [],
  };

  if (args.judgment) applyJudgment(review, JSON.parse(readFileSync(args.judgment, "utf8")));

  const out = JSON.stringify(review, null, 2);
  if (args.out) writeFileSync(args.out, out + "\n");
  else process.stdout.write(out + "\n");
  if (args["page-out"]) writePage(args["page-out"], review.title || `${branch} review`);

  const omitted = files.filter(f => f.diff_omitted);
  process.stderr.write(
    `${branch} vs ${base}: ${commits.length} commits, ${files.length} files, ${entries.length} log entries` +
    ` (log: ${existsSync(logPath) ? logPath : "none found"}).\n` +
    `Inline diffs: ${files.length - omitted.length} files, ${(used / 1024).toFixed(1)} KB.` +
    (omitted.length ? ` Left out: ${omitted.map(f => `${f.path} (${f.diff_omitted})`).join(", ")}.` : "") + "\n",
  );
}

try { main(); }
catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
