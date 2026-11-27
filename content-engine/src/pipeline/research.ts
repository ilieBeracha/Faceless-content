/**
 * The research dossier: before a script is written, the story is looked up in real sources and written down as
 * facts, each with the source it came from and the words on that page that say it. The script is then written from
 * the dossier alone: every claim cites a dossier source, so nothing in the video comes from memory.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { bodySection } from "../core/markdown.ts";
import { ContextBundle } from "../core/context.ts";
import { PipelinePause } from "../core/errors.ts";
import type { Task } from "../core/tasks.ts";
import { readJson } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import type { Script } from "../skills/write-script/schema.ts";
import type { EpisodeRef } from "./episode.ts";
import type { SeriesData } from "./script-check.ts";

export interface DossierFact {
  id: string;
  fact: string;
  source: string;
  quote: string;
}

export interface Dossier {
  idea: string;
  question: string;
  facts: DossierFact[];
  people: { name: string; role: string; stake: string; facts: string[] }[];
  timeline: { when: string; what: string; why?: string; facts: string[] }[];
  turn: { what: string; facts: string[] };
  key_objects: string[];
  unverified: string[];
}

/** The fewest events that make a story with a before, a turn and an after. */
export const MIN_TIMELINE = 3;

export function researchPath(episodeDir: string): string {
  return join(episodeDir, "research.json");
}

const str = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const strList = (v: unknown): v is string[] => Array.isArray(v) && v.every(str);

export function dossierErrors(value: unknown, idea: string): string[] {
  const d = value as Partial<Dossier> | null;
  if (!d || typeof d !== "object") return ["the dossier must be a JSON object"];
  const errors: string[] = [];
  if (d.idea !== idea) errors.push(`"idea" must be "${idea}"`);
  if (!str(d.question)) errors.push('"question" must say, in one sentence, what the video answers');
  const ids = new Set<string>();
  if (!Array.isArray(d.facts) || d.facts.length === 0) errors.push('"facts" must list at least one fact');
  else
    d.facts.forEach((f, k) => {
      if (!f || !str(f.id) || !str(f.fact) || !str(f.source) || !str(f.quote)) {
        errors.push(`facts[${k}] needs "id", "fact", "source" and "quote" (strings)`);
        return;
      }
      if (ids.has(f.id)) errors.push(`facts[${k}]: the id "${f.id}" is used twice`);
      ids.add(f.id);
      if (!/^https:\/\/\S+$/.test(f.source.trim())) errors.push(`facts[${k}] (${f.id}): "source" must be the https address of the page the quote is on`);
    });
  const refs = (where: string, list: unknown) => {
    if (!strList(list) || list.length === 0) {
      errors.push(`${where}: "facts" must list the ids of the facts that back it`);
      return;
    }
    for (const id of list) if (!ids.has(id)) errors.push(`${where}: no fact "${id}"`);
  };
  if (!Array.isArray(d.people) || d.people.length === 0) errors.push('"people" must name at least one person with something at stake');
  else
    d.people.forEach((p, k) => {
      if (!p || !str(p.name) || !str(p.role) || !str(p.stake)) errors.push(`people[${k}] needs "name", "role" and "stake" (strings)`);
      else refs(`people[${k}] (${p.name})`, p.facts);
    });
  if (!Array.isArray(d.timeline) || d.timeline.length < MIN_TIMELINE) errors.push(`"timeline" must list at least ${MIN_TIMELINE} events, in the order they happened`);
  else
    d.timeline.forEach((t, k) => {
      if (!t || !str(t.when) || !str(t.what) || (t.why !== undefined && typeof t.why !== "string")) errors.push(`timeline[${k}] needs "when" and "what" (strings), and "why" is a string when given`);
      else refs(`timeline[${k}]`, t.facts);
    });
  if (!d.turn || !str(d.turn.what)) errors.push('"turn" needs "what": the moment the facts change meaning');
  else refs("turn", d.turn.facts);
  if (!strList(d.key_objects) || d.key_objects.length === 0) errors.push('"key_objects" must list what the viewer has to see (strings)');
  if (!strList(d.unverified)) errors.push('"unverified" must be a list of strings (empty when nothing was left unconfirmed)');
  return errors;
}

/** The dossier on file, checked; a broken one stops the episode with its problems. Null when there is none. */
export function readDossier(ep: EpisodeRef): Dossier | null {
  const path = researchPath(ep.dir);
  if (!existsSync(path)) return null;
  const value = readJson<unknown>(path);
  const errors = dossierErrors(value, ep.state.idea);
  if (errors.length) throw new PipelinePause("needs-fix", [`${ep.ws.rel(path)} has problems:`, ...errors.map((e) => `  - ${e}`), "Fix the dossier, then run the same command again."]);
  return value as Dossier;
}

/** Claims whose source isn't a page in the dossier: they came from somewhere nobody looked up for this video. */
export function claimsOutsideDossier(script: Pick<Script, "claims">, dossier: Dossier): string[] {
  const sources = new Set(dossier.facts.map((f) => f.source.trim()));
  return script.claims
    .filter((c) => !sources.has(c.source.trim()))
    .map((c) => `claim ${c.id} cites "${c.source}", which is not a source in research.json: cite the source of the dossier fact it comes from, or cut the claim`);
}

/** Text compared for quotes: letters and digits only, lower case, single spaces (markup, punctuation and quote styles don't count). */
export function comparableText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", mdash: "—", ndash: "–", hellip: "…" };

/** The words a person reads on an HTML page: scripts, styles and tags removed, entities decoded. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e.toLowerCase()] ?? m),
    );
}

/**
 * Facts whose quote isn't on the page they cite. Each page is opened once; a page that can't be opened, or isn't a
 * web page (a PDF), can't back a quote, so its facts are problems too. A quote cut with "…" must have every part on the page.
 */
export async function quoteProblems(facts: DossierFact[]): Promise<string[]> {
  const sources = [...new Set(facts.map((f) => f.source.trim()))];
  const pages = new Map(
    await Promise.all(
      sources.map(async (url): Promise<[string, { text: string } | { problem: string }]> => {
        let res: Response;
        try {
          res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; content-engine research check)", accept: "text/html,*/*" }, signal: AbortSignal.timeout(20_000) });
        } catch (e) {
          return [url, { problem: `could not be opened (${(e as Error).message})` }];
        }
        if (!res.ok) return [url, { problem: `could not be opened (status ${res.status})` }];
        const type = res.headers.get("content-type") ?? "";
        if (!/html|text\/plain|xml/i.test(type)) return [url, { problem: `is not a web page (${type || "no content type"}), so its words can't be checked: cite the web page that has them (a paper's abstract page, for one)` }];
        return [url, { text: comparableText(pageText(await res.text())) }];
      }),
    ),
  );
  const problems: string[] = [];
  for (const f of facts) {
    const page = pages.get(f.source.trim())!;
    if ("problem" in page) {
      problems.push(`fact ${f.id}: its source ${f.source} ${page.problem}. Use a page that opens and says it, or move the fact to "unverified"`);
      continue;
    }
    const parts = f.quote.split(/\.\.\.|…/).map(comparableText).filter(Boolean);
    if (!parts.length || parts.some((p) => !page.text.includes(p)))
      problems.push(`fact ${f.id}: the quote "${f.quote}" is not on ${f.source}. Copy the words exactly as that page has them, cite the page that says them, or move the fact to "unverified"`);
  }
  return problems;
}

/**
 * The research task: the house rules, this channel's files and the idea. It looks the story up; it writes no script.
 * `rewriteScript`: a script already exists (the research is being redone), so the next command writes it again.
 */
export function researchTask(ws: Workspace, ep: EpisodeRef, series: SeriesData, rewriteScript: boolean): Task {
  const ch = ep.channel;
  const path = researchPath(ep.dir);
  const idea = ch.ideas.find((i) => i.id === ep.state.idea)!;
  const ctx = new ContextBundle(ws, { purpose: "research", channel: ch.slug, series: ep.series, skills: [] });
  ctx.addFile(ws.rel(ch.doc.abs), "channel");
  ctx.addFile(ws.rel(ch.series.get(ep.series)!.abs), "channel");
  ctx.addInline(
    "the idea for this episode",
    ["```", `id: ${idea.id}`, `title: ${idea.title}`, `angle: ${idea.angle ?? "(none)"}`, ...["point", "fact", "fact_source"].flatMap((k) => (idea.fields[k] ? [`${k}: ${idea.fields[k]}`] : [])), "```"].join("\n"),
  );

  const instructions = `
Look up the true story behind the idea **"${idea.title}"** (\`${idea.id}\`) for an episode of **${series.name}**, before
anyone writes a line of it. The script will be written from what you find and nothing else, so find what it needs:

- **The person.** Who had something at stake, by name, and who actually noticed, decided or acted at the turn. Not
  "the team", "scientists" or a machine when the sources name a person.
- **What happened, in order**, with the date or year of each event, and **why** each surprising thing was done
  (why they looked there, why they doubted, why someone acted the way they did) when the sources say why.
- **The turn**: the moment the facts change meaning, and what came of it afterwards.
- **What the viewer has to see**: the objects, places and things the story can't be told without.
- **The point**: what this story shows about the channel's Belief
  (${JSON.stringify(bodySection(ch.doc.md.body, "Belief"))}).

Rules:
1. Open every page you use. Each fact is one sentence, with \`source\` the https address of that page and \`quote\`
   the words on it that say this, copied exactly: the engine opens each page and looks for the quote on it. Cite web
   pages, not PDFs (a paper's abstract page, not its PDF). Prefer the original paper, the institution, a museum or an
   encyclopedia over a blog or a list.
2. Never write a fact from memory. If you can't find a page that says it, it goes in \`unverified\`, not \`facts\`.
3. Put the popular versions of the story that the sources don't back in \`unverified\` too (a wrong date, a person
   who gets the credit but didn't do it, a detail added in retellings), so the script doesn't repeat them.
4. Don't write the script, a title or any voiceover.

Write \`${ws.rel(path)}\` as JSON:

\`\`\`json
{
  "idea": "${idea.id}",
  "question": "What the video answers, in one sentence",
  "facts": [{ "id": "f1", "fact": "…", "source": "https://…", "quote": "the exact words on that page" }],
  "people": [{ "name": "…", "role": "who they were", "stake": "what they could win or lose", "facts": ["f1"] }],
  "timeline": [{ "when": "1998", "what": "…", "why": "why it was done, when the sources say", "facts": ["f2"] }],
  "turn": { "what": "the moment the facts change meaning", "facts": ["f3"] },
  "key_objects": ["…"],
  "unverified": ["…"]
}
\`\`\`

\`people\` has at least one person, \`timeline\` at least ${MIN_TIMELINE} events in the order they happened, and every
person, event and the turn list the ids of the facts that back them.
`;
  return {
    id: "research",
    title: `Research the story for ${ep.state.id}`,
    dir: ep.dir,
    context: ctx,
    instructions,
    outputs: [{ path, format: "json", description: "the research dossier" }],
    next: `./engine make episode --channel ${ch.slug} --series ${ep.series} --episode ${ep.state.id}${rewriteScript ? " --redo script" : ""}`,
    research: { maxSearches: 12 },
    // The shape first; then every quote is looked for on its page, so a fact can't come from memory with a quote attached.
    check: async () => {
      const errors = dossierErrors(readJson(path), idea.id);
      return errors.length ? errors : quoteProblems(readJson<Dossier>(path).facts);
    },
  };
}
