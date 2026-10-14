import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadChannel } from "../core/channels.ts";
import { approveDraft, listDrafts, rejectDraft } from "../core/drafts.ts";
import { appendIdeaBlocks, parseIdeas, renderIdeas, updateIdea } from "../core/ideas.ts";
import { createChannel, createCharacter, defaultModel } from "../core/scaffold.ts";
import { readText } from "../core/util.ts";
import { makeChannel, tempWorkspace } from "./helpers.ts";

describe("ideas.md", () => {
  it("parses ideas and changes a status without touching anything else", () => {
    const text = `# Ideas\n\nSome notes a person wrote.\n\n## pen\n- title: A pen\n- series: inside\n- status: new\n- angle: why\n\n## zip\n- title: A zipper\n- series: inside\n- status: new\n`;
    const updated = updateIdea(text, "pen", { status: "used", used_in: "episodes/x" });
    assert.ok(updated.includes("Some notes a person wrote."));
    const ideas = parseIdeas(updated);
    assert.equal(ideas[0].status, "used");
    assert.equal(ideas[0].fields.used_in, "episodes/x");
    assert.equal(ideas[1].status, "new");
    assert.equal(updated.split("\n").length, text.split("\n").length + 1);
  });

  it("gives new ideas unique ids", () => {
    const { ids } = renderIdeas([{ title: "A pen", series: "s" }, { title: "A pen", series: "s" }], ["a-pen"], "new", "2026-10-14");
    assert.deepEqual(ids, ["a-pen-2", "a-pen-3"]);
  });
});

describe("never overwrite, never delete", () => {
  it("refuses to create a channel or character that exists", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha");
    assert.throws(() => createChannel(ws, { slug: "alpha" } as never), /already exists/);
    assert.throws(
      () => createCharacter(ws, "alpha", { name: "bot", display_name: "x", pronoun: "it", concept: "x", look: "x", personality: ["a", "b"], catchphrases: [], good_at: ["a"], bad_at: ["b"], voice: { provider: "kokoro", voice_id: "af_heart", speed: 1 }, how_it_talks: "x", model: defaultModel("flat-2d", { body: "#ffffff", accent: "#000000" }) }),
      /already exists/,
    );
  });

  it("approving an idea batch appends to ideas.md and marks the draft; rejecting keeps the file", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha");
    const dir = ws.path("drafts", "alpha", "ideas");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "2026-10-14-batch.md");
    const body = renderIdeas([{ title: "A stapler", series: "inside" }, { title: "A toaster", series: "inside" }, { title: "A kettle", series: "inside" }], [], "proposed", "2026-10-14").text;
    writeFileSync(file, `---\ndraft: {kind: ideas, channel: alpha, status: proposed, created: 2026-10-14}\n---\n\n${body}\n`);
    const draft = listDrafts(ws).find((d) => d.abs === file)!;
    approveDraft(ws, draft, { only: ["a-stapler", "a-toaster"] });
    const ideas = loadChannel(ws, "alpha").ideas;
    assert.deepEqual(ideas.filter((i) => ["a-stapler", "a-toaster"].includes(i.id)).map((i) => i.status), ["new", "new"]);
    rejectDraft(ws, listDrafts(ws).find((d) => d.abs === file)!, "not visual enough", { only: ["a-kettle"] });
    const after = parseIdeas(readText(file));
    assert.deepEqual(after.map((i) => i.status), ["approved", "approved", "rejected"]);
    assert.equal(after[2].fields.rejected_reason, "not visual enough");
    assert.ok(existsSync(file));
  });
});
