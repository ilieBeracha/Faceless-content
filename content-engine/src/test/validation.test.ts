import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadChannel, validateChannel } from "../core/channels.ts";
import { parseMarkdown } from "../core/markdown.ts";
import { parseTemplate } from "../core/template-schema.ts";
import { readText } from "../core/util.ts";
import { formatIssues, hasErrors, validateAgainstTemplate } from "../core/validate.ts";
import { makeChannel, tempWorkspace } from "./helpers.ts";

describe("templates are the schema", () => {
  it("reads required/optional fields, types and bounds from template annotations", () => {
    const ws = tempWorkspace();
    const schema = parseTemplate(ws.templatePath("series.md"));
    const beatsId = schema.byPath.get("beats[].id");
    assert.equal(beatsId?.required, true);
    assert.deepEqual(beatsId?.type, { kind: "scalar", name: "slug" });
    const render = schema.byPath.get("skills.render");
    assert.deepEqual(render?.type, { kind: "list", of: { kind: "ref", target: "skill:render" } });
    assert.equal(render?.min, 1);
    assert.equal(schema.byPath.get("cta")?.required, false);
  });

  it("a fresh channel made from the templates is valid", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha");
    const issues = validateChannel(ws, loadChannel(ws, "alpha"));
    assert.equal(hasErrors(issues), false, formatIssues(issues));
  });

  it("reports a missing field clearly, with the template's explanation", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha");
    const file = join(ws.channelDir("alpha"), "series", "inside.md");
    writeFileSync(file, readText(file).replace(/^hook_pattern:.*\n/m, ""));
    const issues = validateChannel(ws, loadChannel(ws, "alpha")).filter((i) => i.level === "error");
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /missing required field "hook_pattern"/);
    assert.match(issues[0].hint ?? "", /how the first 2 seconds grab attention \(templates\/series\.md:\d+\)/);
    assert.equal(issues[0].file, "channels/alpha/series/inside.md");
  });

  it("checks types, enums, nested fields, list items and placeholders", () => {
    const ws = tempWorkspace();
    const schema = parseTemplate(ws.templatePath("series.md"));
    const doc = parseMarkdown(`---
slug: Bad Slug
name: X
status: live
format: TODO
characters: [bot]
length: { min_seconds: "fifty", max_seconds: 40 }
hook_pattern: q
beats:
  - { id: hook, seconds: 3, purpose: grab }
  - { id: body, purpose: explain }
visual_style: v
skills: { script: write-script, render: [], captions: captions }
created: 2026-10-14
lenght: 3
---
`);
    const issues = validateAgainstTemplate(doc, schema, { file: "s.md" });
    const text = issues.map((i) => `${i.level}: ${i.message}`).join("\n");
    assert.match(text, /"slug" must be lowercase-with-dashes/);
    assert.match(text, /"status" must be one of: draft, active, paused, retired \(got "live"\)/);
    assert.match(text, /missing required field "format"/); // TODO placeholder counts as missing
    assert.match(text, /"length.min_seconds" must be a number \(got "fifty"\)/);
    assert.match(text, /missing required field "beats\[1\]\.seconds"/);
    assert.match(text, /missing required field "skills.render"/);
    assert.match(text, /warning: unknown field "lenght"/);
  });

  it("references are scoped to the channel (no borrowing another channel's characters)", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha");
    makeChannel(ws, "beta");
    const file = join(ws.channelDir("beta"), "series", "inside.md");
    writeFileSync(file, readText(file).replace("- bot", "- pip"));
    const issues = validateChannel(ws, loadChannel(ws, "beta")).filter((i) => i.level === "error");
    assert.ok(issues.some((i) => /refers to character "pip", which doesn't exist \(available: bot\)/.test(i.message)), formatIssues(issues));
  });

  it("checks required body sections and character model files", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha");
    const md = join(ws.channelDir("alpha"), "characters", "bot.md");
    writeFileSync(md, readText(md).replace(/## How it talks[\s\S]*?(?=## Backstory)/, ""));
    writeFileSync(join(ws.channelDir("alpha"), "characters", "bot", "model.json"), JSON.stringify({ rig: "orb-bot-3d", params: {}, expressions: {} }));
    const text = formatIssues(validateChannel(ws, loadChannel(ws, "alpha")));
    assert.match(text, /missing required section "## How it talks"/);
    assert.match(text, /must include a "neutral" expression/);
  });
});
