/**
 * What a customer can pick on the create page. Nothing is listed in code: every file in the engine's
 * `themes/` folder is a look, and every file in `avatars/` is a ready-made host. Add a file and it is an
 * option on the next page load. A customer can always ask for something that is not in either folder.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { readJson } from "../core/util.ts";
import { checkCharacterModel, parseCharacterModel, type CharacterModel } from "../skills/render-talking-character/rigs.ts";
import { parseTheme, type Theme } from "../skills/render-themed/schema.ts";

/** The choices that are always offered, whatever the folders hold. */
export const OWN_LOOK = "Something else";
export const OWN_HOST = "Design one for me";
/** A channel with no host on screen: the voice narrates (looks with a painted world only). */
export const NO_HOST = "No host, just the voice";

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hostFile = z.object({ name: z.string().min(1).max(40), summary: z.string().min(1).max(80), model: z.unknown() }).strict();

export interface LookOption {
  id: string;
  name: string;
  theme: Theme;
}
export interface HostOption {
  id: string;
  name: string;
  summary: string;
  model: CharacterModel;
}
export interface Catalog {
  looks: LookOption[];
  hosts: HostOption[];
}

function ids(dir: string, folder: string): string[] {
  const path = join(dir, folder);
  if (!existsSync(path)) throw new Error(`The ${folder}/ folder is missing (${path}).`);
  return readdirSync(path)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort()
    .map((id) => {
      if (!ID.test(id)) throw new Error(`${folder}/${id}.json: the file name must be lowercase words joined by dashes.`);
      return id;
    });
}

/** Names are what the customer picks and what is stored on the order, so they must be unique. */
function unique<T extends { id: string; name: string }>(folder: string, options: T[], ...reserved: string[]): T[] {
  const seen = new Map<string, string>(reserved.map((r) => [r.toLowerCase(), "a built-in choice"]));
  for (const o of options) {
    const clash = seen.get(o.name.toLowerCase());
    if (clash) throw new Error(`${folder}/${o.id}.json: the name "${o.name}" is already used by ${clash}.`);
    seen.set(o.name.toLowerCase(), `${folder}/${o.id}.json`);
  }
  return options;
}

export function readLooks(dir: string): LookOption[] {
  return unique(
    "themes",
    ids(dir, "themes").map((id) => {
      const theme = parseTheme(readJson(join(dir, "themes", `${id}.json`)), `themes/${id}.json`);
      return { id, name: theme.name, theme };
    }),
    OWN_LOOK,
  );
}

export function readHosts(dir: string): HostOption[] {
  return unique(
    "avatars",
    ids(dir, "avatars").map((id) => {
      const label = `avatars/${id}.json`;
      const file = hostFile.safeParse(readJson(join(dir, "avatars", `${id}.json`)));
      if (!file.success) throw new Error(`${label} is not a valid host:\n${file.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n")}`);
      const problems = checkCharacterModel(file.data.model);
      if (problems.length) throw new Error(`${label} is not a valid host:\n${problems.map((p) => `  model.${p}`).join("\n")}`);
      return { id, name: file.data.name, summary: file.data.summary, model: parseCharacterModel(file.data.model) };
    }),
    OWN_HOST,
    NO_HOST,
  );
}

export function hostPicture(dir: string, id: string): string {
  return join(dir, "avatars", `${id}.jpg`);
}

/** Everything on offer. A host without its picture is an error, not a blank card. */
export function loadCatalog(dir: string): Catalog {
  const hosts = readHosts(dir);
  for (const h of hosts) if (!existsSync(hostPicture(dir, h.id))) throw new Error(`avatars/${h.id}.json has no picture (avatars/${h.id}.jpg). Make it with: npm run avatars:thumbs`);
  return { looks: readLooks(dir), hosts };
}
