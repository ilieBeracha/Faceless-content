import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMarkdown, updateFrontmatter } from "../core/markdown.ts";

const FILE = `---
slug: demo                # required slug — folder name
status: draft             # required enum(draft|active|paused)
audience:                 # required object
  who: ""                 # required string
approved_by: ""           # optional string
draft:
  status: proposed
---

# Demo
`;

test("updateFrontmatter keeps comments and untouched lines byte-identical", () => {
  const out = updateFrontmatter(FILE, { status: "active", "audience.who": "teens: 13+", approved_by: "Sam", "draft.status": "approved", "draft.decided": "2026-10-15" });
  const lines = out.split("\n");
  assert.equal(lines[1], "slug: demo                # required slug — folder name");
  assert.equal(lines[2], "status: active            # required enum(draft|active|paused)");
  assert.equal(lines[3], "audience:                 # required object");
  assert.match(lines[4], /^ {2}who: "teens: 13\+" +# required string$/);
  const { data } = parseMarkdown(out);
  assert.deepEqual(data, { slug: "demo", status: "active", audience: { who: "teens: 13+" }, approved_by: "Sam", draft: { status: "approved", decided: "2026-10-15" } });
  assert.ok(out.endsWith("# Demo\n"));
});

test("updateFrontmatter falls back to a full rewrite for collection values", () => {
  const out = updateFrontmatter(FILE, { tone: ["calm", "precise"] });
  assert.deepEqual(parseMarkdown(out).data.tone, ["calm", "precise"]);
  assert.equal(parseMarkdown(out).data.status, "draft");
});
