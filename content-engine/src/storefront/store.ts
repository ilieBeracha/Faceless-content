/**
 * Orders for the storefront. There are no accounts: each order has one long random token, and the
 * link that carries it is the customer's whole workspace. Stored as one JSON file (gitignored — it
 * holds customers' names and email addresses).
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

export interface Order {
  /** Secret: whoever has it can open the workspace. Never log it. */
  token: string;
  /** Short reference that is safe to say out loud or put in an email subject. */
  id: string;
  created: string;
  status: OrderStatus;
  /** True when the order was taken while payment was switched off: it never waited for payment. */
  no_payment?: true;
  intake: Intake;
  /** Absent on orders made before the designer existed. */
  design?: Design;
  /** The engine channel this order is being made as, once you link one. */
  channel: string | null;
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
  create(intake: Intake, design: Design, takePayment: boolean): Order {
    const orders = this.read();
    const order: Order = {
      token: randomBytes(32).toString("base64url"),
      id: `ord-${randomBytes(4).toString("hex")}`,
      created: nowIso(),
      status: takePayment ? "awaiting-payment" : "in-production",
      ...(takePayment ? {} : { no_payment: true as const }),
      intake,
      design,
      channel: null,
      decisions: {},
    };
    this.write([...orders, order]);
    return order;
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
