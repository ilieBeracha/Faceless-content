/**
 * Accounts for the storefront: who signed in, their open sessions, the design each one saved for
 * later, and forms held while someone is away signing in. Stored as one JSON file next to the
 * orders (gitignored — it holds customers' names and email addresses). Session and hold secrets are
 * stored only as hashes, so the file alone cannot be used to sign in as someone.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { nowIso } from "../core/util.ts";

/** Who the sign-in provider says this is. */
export interface Identity {
  /** The provider's own stable id for the person. */
  sub: string;
  email: string;
  name: string;
}

export interface User {
  id: string;
  sub: string;
  email: string;
  name: string;
  created: string;
}

export interface Draft {
  form: Record<string, string>;
  saved: string;
}

/** What a held form is for: sending the order, or saving it for later. */
export type HoldKind = "order" | "draft";

interface File {
  users: User[];
  sessions: { hash: string; user: string; expires: string }[];
  drafts: Record<string, Draft>;
  holds: { hash: string; kind: HoldKind; form: Record<string, string>; expires: string }[];
}

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const HOLD_SECONDS = 15 * 60;

const hash = (secret: string) => createHash("sha256").update(secret).digest("base64url");
const later = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

export class AccountStore {
  constructor(private readonly file: string) {}

  private read(): File {
    if (!existsSync(this.file)) return { users: [], sessions: [], drafts: {}, holds: [] };
    return JSON.parse(readFileSync(this.file, "utf8")) as File;
  }

  /** Write through a temp file so a crash can't leave half a file. Expired sessions and holds are dropped here. */
  private write(data: File): void {
    const now = nowIso();
    data.sessions = data.sessions.filter((s) => s.expires > now);
    data.holds = data.holds.filter((h) => h.expires > now);
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
    renameSync(tmp, this.file);
  }

  /** The account for this identity, made on first sign-in. Email and name follow the provider. */
  signIn(who: Identity): User {
    const data = this.read();
    let user = data.users.find((u) => u.sub === who.sub);
    if (user) {
      user.email = who.email;
      user.name = who.name;
    } else {
      user = { id: `usr-${randomBytes(6).toString("hex")}`, sub: who.sub, email: who.email, name: who.name, created: nowIso() };
      data.users.push(user);
    }
    this.write(data);
    return user;
  }

  /** Start a session. Returns its secret, which goes in the browser's cookie and nowhere else. */
  openSession(userId: string): string {
    const data = this.read();
    const secret = randomBytes(32).toString("base64url");
    data.sessions.push({ hash: hash(secret), user: userId, expires: later(SESSION_SECONDS) });
    this.write(data);
    return secret;
  }

  userBySession(secret: string): User | undefined {
    const data = this.read();
    const session = data.sessions.find((s) => s.hash === hash(secret) && s.expires > nowIso());
    return session ? data.users.find((u) => u.id === session.user) : undefined;
  }

  closeSession(secret: string): void {
    const data = this.read();
    data.sessions = data.sessions.filter((s) => s.hash !== hash(secret));
    this.write(data);
  }

  draft(userId: string): Draft | undefined {
    return this.read().drafts[userId];
  }

  saveDraft(userId: string, form: Record<string, string>): void {
    const data = this.read();
    data.drafts[userId] = { form, saved: nowIso() };
    this.write(data);
  }

  clearDraft(userId: string): void {
    const data = this.read();
    delete data.drafts[userId];
    this.write(data);
  }

  /** Keep a form while its owner signs in. Returns the secret that takes it back out. */
  hold(kind: HoldKind, form: Record<string, string>): string {
    const data = this.read();
    const secret = randomBytes(32).toString("base64url");
    data.holds.push({ hash: hash(secret), kind, form, expires: later(HOLD_SECONDS) });
    this.write(data);
    return secret;
  }

  /** Take a held form back out. It can be taken once. */
  take(secret: string): { kind: HoldKind; form: Record<string, string> } | undefined {
    const data = this.read();
    const held = data.holds.find((h) => h.hash === hash(secret) && h.expires > nowIso());
    if (!held) return undefined;
    data.holds = data.holds.filter((h) => h !== held);
    this.write(data);
    return { kind: held.kind, form: held.form };
  }
}
