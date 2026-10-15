#!/usr/bin/env node
/**
 * Content engine CLI. Run `./engine --help` (or `npm run engine -- --help`).
 * Every command works on any channel: the engine has no niche built in.
 */
import { Command, Option } from "commander";
import pc from "picocolors";
import { approveDraft, draftInfo, rejectDraft } from "../core/drafts.ts";
import { EngineError, PipelinePause, ValidationError } from "../core/errors.ts";
import { commitPaths } from "../core/git.ts";
import type { LlmProviderName } from "../core/tasks.ts";
import { Workspace } from "../core/workspace.ts";
import { STEPS } from "../pipeline/episode.ts";
import { runSetup } from "../voice/setup.ts";
import { addCharacter, addIdeas, addSeries, setIdeaStatus } from "./commands/add.ts";
import { brainstorm, type BrainstormKind } from "./commands/brainstorm.ts";
import { approveChannel, editFile, newChannel, setChannelStatus } from "./commands/channel.ts";
import { approveFactcheckCommand, episodeStatus, makeEpisodeCommand, rejectFactcheckCommand } from "./commands/episode.ts";
import { approveFootageCommand, budgetCommand, ledgerCommand, listAiModels, makeIdentity, pickIdentity, redoShotCommand } from "./commands/ai-video.ts";
import { compare, list, validate } from "./commands/list.ts";
import { doctor } from "./commands/system.ts";
import { log, ok, printPause } from "./ui.ts";

const ws = Workspace.fromEnv();
const program = new Command();
const llmOption = () => new Option("--llm <provider>", "who writes drafts/scripts: agent (free, default) | anthropic (paid API, opt-in)").choices(["agent", "anthropic"]);
const llm = (o: { llm?: string }): LlmProviderName => (o.llm as LlmProviderName | undefined) ?? ws.config.llm.provider;

program
  .name("engine")
  .description("Faceless short-video engine. Channels are data in channels/<slug>/; the pipeline is the same for all of them.")
  .option("--no-commit", "don't auto-commit changes to git")
  .hook("preAction", (cmd) => {
    if (cmd.opts().commit === false) process.env.ENGINE_AUTO_COMMIT = "0";
  })
  .showHelpAfterError();

program.command("setup").description("one-time machine setup: local voice (Kokoro, free), ffmpeg check, render browser").action(async () => runSetup(ws, log));
program.command("doctor").description("check this machine and render a few demo stills").action(async () => {
  if (!(await doctor(ws))) process.exitCode = 1;
});

const create = program.command("new").description("create something new");
create
  .command("channel")
  .description('create a channel: interactively, or from a one-line --seed / an approved niche draft that the agent drafts for your approval')
  .option("--seed <text>", 'one-line idea, e.g. "space facts for kids"')
  .option("--slug <slug>", "folder name for the channel (default: from the seed)")
  .option("--from-draft <path>", "turn an approved niche proposal (drafts/niches/…) into a channel")
  .addOption(llmOption())
  .action(async (o) => newChannel(ws, { seed: o.seed, slug: o.slug, fromDraft: o.fromDraft, llm: llm(o) }));

program
  .command("brainstorm")
  .description("propose niches / characters / series / ideas as drafts (nothing changes until you approve)")
  .argument("<kind>", "niches | characters | series | ideas")
  .option("--channel <slug>", "channel to brainstorm for (not for niches)")
  .option("--series <slug>", "series the ideas are for")
  .option("--count <n>", "how many proposals", (v) => Number(v))
  .option("--seed <text>", "a direction, e.g. \"for teenagers\"")
  .addOption(llmOption())
  .action(async (kind: string, o) => {
    if (!["niches", "characters", "series", "ideas"].includes(kind)) throw new EngineError(`Can't brainstorm "${kind}".`, "Use: niches, characters, series or ideas");
    await brainstorm(ws, kind as BrainstormKind, { channel: o.channel, series: o.series, count: o.count, seed: o.seed, llm: llm(o) });
  });

const add = program.command("add").description("add to an existing channel");
add.command("character").description("add a character (interactive)").requiredOption("--channel <slug>").action(async (o) => addCharacter(ws, o.channel));
add.command("series").description("add a series (interactive)").requiredOption("--channel <slug>").action(async (o) => addSeries(ws, o.channel));
add
  .command("ideas")
  .description("add ideas straight to the backlog as \"new\"")
  .requiredOption("--channel <slug>")
  .requiredOption("--series <slug>", 'series the ideas are for ("any" for all)')
  .option("--angle <text>", "a one-line angle applied to every idea given")
  .argument("<titles...>", "idea titles")
  .action((titles: string[], o) => addIdeas(ws, o.channel, o.series, titles, o.angle));

const idea = program.command("idea").description("change an idea's status (ideas are never deleted)");
idea.command("reject").argument("<id>").requiredOption("--channel <slug>").option("--reason <text>").action((id: string, o) => setIdeaStatus(ws, o.channel, id, "reject", o.reason));
idea.command("reopen").argument("<id>").requiredOption("--channel <slug>").action((id: string, o) => setIdeaStatus(ws, o.channel, id, "reopen"));

program
  .command("edit")
  .description("open a channel / character / series file in $EDITOR, then validate and commit")
  .argument("<kind>", "channel | character | series")
  .requiredOption("--channel <slug>")
  .option("--name <name>", "character or series slug")
  .action((kind: string, o) => editFile(ws, kind as "channel" | "character" | "series", o.channel, o.name));

program.command("set-status").description("pause or reactivate a channel").argument("<kind>", "channel").argument("<slug>").argument("<status>", "draft | active | paused").action((_kind: string, slug: string, status: string) => setChannelStatus(ws, slug, status));

const approve = program.command("approve").description("record a human decision");
approve.command("channel").argument("<slug>").option("--by <name>").description("draft → active (after you reviewed it)").action((slug: string, o) => approveChannel(ws, slug, o.by));
approve
  .command("draft")
  .argument("<path>", "drafts/… file")
  .option("--only <ids>", "idea batches: only these idea ids (comma-separated)")
  .description("copy a drafted character / series / ideas into its channel")
  .action((path: string, o) => {
    const d = draftInfo(ws, path);
    const r = approveDraft(ws, d, { only: o.only?.split(",") });
    commitPaths(ws, r.touched, `approve draft ${d.rel}`);
    ok(r.summary);
  });
approve
  .command("factcheck")
  .requiredOption("--channel <slug>")
  .requiredOption("--episode <id>")
  .requiredOption("--by <name>", "who checked the claims")
  .description("approve every claim of an episode (rendering is blocked until this)")
  .action((o) => approveFactcheckCommand(ws, o.channel, o.episode, o.by));

approve
  .command("footage")
  .requiredOption("--channel <slug>")
  .requiredOption("--episode <id>")
  .requiredOption("--by <name>", "who looked at the stills")
  .description("render-ai-video: approve the first frames and the clip cost (no video is generated before this)")
  .action((o) => approveFootageCommand(ws, o.channel, o.episode, o.by));

const aiVideo = program.command("ai-video").description("realistic footage (render-ai-video, Google Veo via the Gemini API — paid)");
aiVideo.command("models").description("list the video/image models your GEMINI_API_KEY can use").action(async () => listAiModels(ws));
aiVideo
  .command("identity")
  .description("make candidate face photos for a photoreal character (≈$0.04 each, capped per character)")
  .requiredOption("--channel <slug>")
  .requiredOption("--character <name>")
  .option("--count <n>", "how many candidates", (v) => Number(v), 4)
  .action(async (o) => makeIdentity(ws, o.channel, o.character, o.count));
aiVideo
  .command("pick-identity")
  .description("a person picks the face: the photo(s) become the character's references")
  .requiredOption("--channel <slug>")
  .requiredOption("--character <name>")
  .requiredOption("--by <name>", "who picked it")
  .argument("<files...>", "candidate photo(s), e.g. candidate-2.jpg")
  .action((files: string[], o) => pickIdentity(ws, o.channel, o.character, files, o.by));
aiVideo
  .command("redo")
  .description("regenerate one shot's still (and so its clip) or only its clip; the old one is kept in footage/rejected/")
  .requiredOption("--channel <slug>")
  .requiredOption("--episode <id>")
  .requiredOption("--shot <id>")
  .addOption(new Option("--what <part>", "still | clip").choices(["still", "clip"]).default("still"))
  .action((o) => redoShotCommand(ws, o.channel, o.episode, o.shot, o.what));
aiVideo
  .command("budget")
  .description("set an episode's total footage budget in USD (a person decides)")
  .requiredOption("--channel <slug>")
  .requiredOption("--episode <id>")
  .requiredOption("--usd <amount>", "new total budget", (v) => Number(v))
  .requiredOption("--by <name>")
  .action((o) => budgetCommand(ws, o.channel, o.episode, o.usd, o.by));
aiVideo.command("ledger").description("every paid call for an episode and the total").requiredOption("--channel <slug>").requiredOption("--episode <id>").action((o) => ledgerCommand(ws, o.channel, o.episode));

const reject = program.command("reject").description("record a rejection (nothing is deleted)");
reject
  .command("draft")
  .argument("<path>")
  .requiredOption("--reason <text>")
  .option("--only <ids>", "idea batches: only these idea ids")
  .action((path: string, o) => {
    const d = draftInfo(ws, path);
    const r = rejectDraft(ws, d, o.reason, { only: o.only?.split(",") });
    commitPaths(ws, r.touched, `reject draft ${d.rel}`);
    ok(r.summary);
  });
reject.command("factcheck").requiredOption("--channel <slug>").requiredOption("--episode <id>").requiredOption("--reason <text>").action((o) => rejectFactcheckCommand(ws, o.channel, o.episode, o.reason));

const make = program.command("make").description("produce content");
make
  .command("episode")
  .description("idea → script → fact-check (stops for approval) → voice → render → QA; re-run to continue")
  .requiredOption("--channel <slug>")
  .requiredOption("--series <slug>")
  .option("--idea <id>", "use this idea instead of the next new one")
  .option("--new", "start another episode even if one is in progress")
  .option("--episode <id>", "continue a specific episode")
  .option("--redo <steps>", `re-run steps even if done (${STEPS.slice(1).join(",")})`)
  .addOption(llmOption())
  .action(async (o) => makeEpisodeCommand(ws, { ...o, llm: llm(o) }));

program.command("status").description("where each episode of a channel is in the pipeline").requiredOption("--channel <slug>").option("--episode <id>").action((o) => episodeStatus(ws, o.channel, o.episode));

program
  .command("list")
  .description("list channels | characters | series | ideas | episodes | drafts | skills | voices")
  .argument("[what]", "what to list", "channels")
  .option("--channel <slug>")
  .option("--status <status>", "filter ideas or drafts by status")
  .action((what: string, o) => list(ws, what, o));
program.command("compare").description("compare channels side by side").argument("<slugs...>").action((slugs: string[]) => compare(ws, slugs));
program
  .command("validate")
  .description("check channel files (and drafts) against templates/")
  .option("--channel <slug>")
  .option("--drafts", "also validate open drafts")
  .action((o) => {
    if (!validate(ws, o)) process.exitCode = 2;
  });

try {
  await program.parseAsync(process.argv);
} catch (err) {
  if (err instanceof PipelinePause) {
    printPause(err);
  } else if (err instanceof ValidationError) {
    console.error(pc.red(`✖ ${err.message}`));
    console.error(err.report);
    process.exitCode = 2;
  } else if (err instanceof EngineError) {
    console.error(pc.red(`✖ ${err.message}`));
    if (err.hint) console.error(pc.dim(`  ${err.hint}`));
    process.exitCode = 1;
  } else if ((err as Error)?.name === "ExitPromptError") {
    console.error("\nCancelled.");
    process.exitCode = 130;
  } else {
    console.error(err);
    process.exitCode = 1;
  }
}

