/**
 * Orders for the storefront. Each order has one long random token, and the link that carries it
 * opens the customer's workspace. When sign-in is switched on an order also belongs to an account
 * (accounts.ts). Stored as one JSON file (gitignored — it holds customers' names and email addresses).
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { nowIso } from "../core/util.ts";
import type { CharacterModel } from "../skills/render-talking-character/rigs.ts";
import type { Theme } from "../skills/render-themed/schema.ts";
import { OWN_HOST, OWN_LOOK, type Catalog } from "./catalog.ts";
import { READY_RIG, buildHost, buildLook, hasHost, hasLook } from "./designer.ts";

export const ORDER_STATUSES = ["awaiting-payment", "paid", "in-production", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The parts of a brand kit a customer signs off, one decision each. */
export const SECTIONS = [
  { id: "name", label: "The name and the promise" },
  { id: "host", label: "The host: look, personality, voice" },
  { id: "colours", label: "The colours" },
  { id: "look", label: "The look" },
  { id: "format", label: "The story format" },
  { id: "tone", label: "The tone and the never-list" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

export interface Intake {
  contact_name: string;
  email: string;
  idea: string;
  audience: string;
  tone: string;
  /** The name of a look in themes/, or OWN_LOOK. */
  look: string;
  look_note: string;
  /** The world the videos happen in, in the customer's words (painted for every video). Orders from before worlds have none. */
  world?: string;
  /** The name of a ready-made host in avatars/, or OWN_HOST. */
  avatar: string;
  host: string;
  avoid: string;
}

/** What the customer designed, ready to become a channel's theme.json and its character's model.json. Null = described in words only. */
export interface Design {
  theme: Theme | null;
  model: CharacterModel | null;
}

export interface Decision {
  decision: "approve" | "change";
  note: string;
  at: string;
}

/** Where an order's automatic build stands (builder.ts). Absent when none was ever queued. */
export interface Build {
  /** "revise" = making the customer's change requests; absent = the first build. */
  kind?: "revise";
  state: "queued" | "building" | "done" | "failed";
  /** How many times it was started. */
  attempts: number;
  /** When it reached this state. */
  at: string;
  /** When the latest attempt started. */
  started?: string;
  /** Why it failed. */
  error?: string;
}

/** Where an order's first video stands (builder.ts). Absent until the kit is approved and its channel was built here. */
export interface Video {
  /**
   * writing = the script is being written; facts = the customer is checking its facts;
   * making = being voiced, drawn and checked; done = on the order's page; failed = stopped, see `error`.
   */
  state: "writing" | "facts" | "making" | "done" | "failed";
  /** The step that was running when it failed. */
  failed_at?: "writing" | "making";
  /** The episode folder in the channel, once there is one. */
  episode?: string;
  /** How many times the current step was started. */
  attempts: number;
  /** How many times the script was rewritten because the customer asked for a change to its facts. */
  rounds: number;
  /** When it reached this state. */
  at: string;
  /** Why it failed. */
  error?: string;
}

export interface Order {
  /** Secret: whoever has it can open the workspace. Never log it. */
  token: string;
  /** Short reference that is safe to say out loud or put in an email subject. */
  id: string;
  created: string;
  status: OrderStatus;
  /** True when the order was taken while payment was switched off: it never waited for payment. */
  no_payment?: true;
  /** The account that made it (a user id from accounts.ts). Absent when sign-in was switched off. */
  user?: string;
  intake: Intake;
  /** Absent on orders made before the designer existed. */
  design?: Design;
  /** The engine channel this order is being made as, once you link one. */
  channel: string | null;
  build?: Build;
  /** How many times the kit was revised from the customer's change requests (each start counts). */
  rounds?: number;
  /** When the customer approved the whole brand kit. From then on it is locked. */
  kit_approved?: string;
  video?: Video;
  decisions: Partial<Record<SectionId, Decision>>;
}

const LIMITS: Record<keyof Intake, { label: string; max: number; required: boolean }> = {
  contact_name: { label: "Your name", max: 80, required: true },
  email: { label: "Email", max: 120, required: true },
  idea: { label: "What the channel is about", max: 400, required: true },
  audience: { label: "Who it is for", max: 200, required: true },
  tone: { label: "How it should feel", max: 200, required: true },
  look: { label: "The look", max: 40, required: true },
  look_note: { label: "The look, in your words", max: 300, required: false },
  world: { label: "Your world", max: 1200, required: false },
  avatar: { label: "The host", max: 40, required: true },
  host: { label: "Host notes", max: 300, required: false },
  avoid: { label: "Topics to avoid", max: 300, required: false },
};

export const INTAKE_FIELDS = Object.keys(LIMITS) as (keyof Intake)[];

export function intakeLabel(field: keyof Intake): string {
  return LIMITS[field].label;
}

export function intakeRequired(field: keyof Intake): boolean {
  return LIMITS[field].required;
}

export function intakeMax(field: keyof Intake): number {
  return LIMITS[field].max;
}

/** The world to paint: the customer's own words, or, left blank, a brief made from what the channel is about and how it should feel. */
export function worldBrief(i: Pick<Intake, "idea" | "audience" | "tone" | "look_note" | "world">): string {
  if (i.world) return i.world;
  return `A vivid, specific world for a channel about ${i.idea}, made for ${i.audience}, that feels ${i.tone}.${i.look_note ? ` ${i.look_note}` : ""} Invent a setting that suits it, drawn as a very simple cartoon: flat shapes, clean outlines, few colours.`;
}

/**
 * Check a submitted form. Returns the cleaned intake and the design, or one message per bad field.
 * The look and the host each come from the designer's settings when they were sent, otherwise from the
 * ready-made one that was picked, otherwise (the "in my own words" choices) from the notes alone.
 */
export function validateIntake(form: Record<string, string>, catalog: Catalog): { intake: Intake; design: Design; errors: null } | { intake: null; design: null; errors: Partial<Record<keyof Intake, string>> } {
  const errors: Partial<Record<keyof Intake, string>> = {};
  const values = {} as Record<keyof Intake, string>;
  for (const field of INTAKE_FIELDS) {
    const { label, max, required } = LIMITS[field];
    const value = (form[field] ?? "").trim();
    values[field] = value;
    if (required && !value) errors[field] = `${label} is required.`;
    else if (value.length > max) errors[field] = `${label} must be ${max} characters or fewer.`;
  }
  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Enter an email address like name@example.com.";
  const design: Design = { theme: null, model: null };

  const readyLook = catalog.looks.find((l) => l.name === values.look);
  if (!errors.look && values.look !== OWN_LOOK && !readyLook) errors.look = "Pick a look to start from.";
  if (!errors.look && hasLook(form)) {
    const built = buildLook(form, readyLook ? readyLook.name : "Own design");
    if (built.problems) errors.look = `These look settings are not valid: ${built.problems.join("; ")}.`;
    else design.theme = built.theme;
  } else if (!errors.look && readyLook) design.theme = readyLook.theme;
  if (!errors.look && !errors.look_note && !design.theme && !values.look_note) errors.look_note = "Describe the look you want.";
  // Every designed look happens in a painted world: the customer's words for it, or one made from what the channel is.
  if (design.theme) design.theme = { ...design.theme, world: { description: worldBrief(values) } };

  const readyHost = catalog.hosts.find((h) => h.name === values.avatar);
  if (!errors.avatar && values.avatar !== OWN_HOST && !readyHost) errors.avatar = "Pick a host to start from.";
  if (!errors.avatar && hasHost(form)) {
    if (form.h_rig === READY_RIG) {
      if (readyHost?.model.rig === READY_RIG) design.model = readyHost.model;
      else errors.avatar = "A 3D robot is used as it is: start from one of the 3D robots, or pick another kind of host.";
    } else {
      const built = buildHost(form);
      if (built.problems) errors.avatar = `These host settings are not valid: ${built.problems.join("; ")}.`;
      else design.model = built.model;
    }
  } else if (!errors.avatar && readyHost) design.model = readyHost.model;

  if (Object.keys(errors).length) return { intake: null, design: null, errors };
  return { intake: values, design, errors: null };
}

/** The most times one order's kit is revised automatically; after that, changes are made by hand. */
export const MAX_ROUNDS = 3;

/** The change requests waiting on an order, in the kit's order. */
export function changeRequests(order: Order): { id: SectionId; label: string; note: string }[] {
  return SECTIONS.flatMap((s) => {
    const d = order.decisions[s.id];
    return d?.decision === "change" ? [{ id: s.id, label: s.label, note: d.note }] : [];
  });
}

/** True while the order's channel is being built or revised: nothing can be decided meanwhile. */
export function isBuilding(order: Order): boolean {
  return order.build?.state === "queued" || order.build?.state === "building";
}

/** True while the order's video is being worked on by the server (not while it waits for the customer). */
export function isMakingVideo(order: Order): boolean {
  return order.video?.state === "writing" || order.video?.state === "making";
}

export class OrderStore {
  constructor(private readonly file: string) {}

  private read(): Order[] {
    if (!existsSync(this.file)) return [];
    return JSON.parse(readFileSync(this.file, "utf8")) as Order[];
  }

  /** Write through a temp file so a crash can't leave half an orders file. */
  private write(orders: Order[]): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(orders, null, 2) + "\n");
    renameSync(tmp, this.file);
  }

  list(): Order[] {
    return this.read();
  }

  /** `takePayment` false = payment is switched off, so work starts without waiting for it. */
  create(intake: Intake, design: Design, takePayment: boolean, user: string | null): Order {
    const orders = this.read();
    const order: Order = {
      token: randomBytes(32).toString("base64url"),
      id: `ord-${randomBytes(4).toString("hex")}`,
      created: nowIso(),
      status: takePayment ? "awaiting-payment" : "in-production",
      ...(takePayment ? {} : { no_payment: true as const }),
      ...(user ? { user } : {}),
      intake,
      design,
      channel: null,
      decisions: {},
    };
    this.write([...orders, order]);
    return order;
  }

  /** One account's orders, oldest first. */
  listFor(user: string): Order[] {
    return this.read().filter((o) => o.user === user);
  }

  byToken(token: string): Order | undefined {
    return this.read().find((o) => o.token === token);
  }

  byId(id: string): Order | undefined {
    return this.read().find((o) => o.id === id);
  }

  /** Change one order. Throws if it does not exist. */
  update(id: string, change: (order: Order) => void): Order {
    const orders = this.read();
    const order = orders.find((o) => o.id === id);
    if (!order) throw new Error(`No order "${id}".`);
    change(order);
    this.write(orders);
    return order;
  }
}
