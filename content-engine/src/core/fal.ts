/**
 * fal.ai's queue API (paid, needs FAL_KEY): submit a job, wait for it, read its result, download its files.
 */
import { writeFileSync } from "node:fs";
import { EngineError } from "./errors.ts";

const QUEUE = "https://queue.fal.run";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function falKey(what: string): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new EngineError(`${what} needs FAL_KEY in .env.`, "It is a paid API (fal.ai). Add the key to .env (and to the server's secrets for the storefront).");
  return key;
}

async function call<T>(what: string, method: "GET" | "POST", url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { Authorization: `Key ${falKey(what)}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new EngineError(`${what}: fal ${method} ${url.replace(QUEUE, "")} failed (${res.status}): ${text.slice(0, 400)}`, res.status === 401 || res.status === 403 ? "Check that FAL_KEY is valid and the fal account has credit." : undefined);
  return JSON.parse(text) as T;
}

/** Run one job on a fal endpoint and return its result. `what` names it in errors ("The music"). */
export async function runFal<T>(what: string, endpoint: string, input: unknown, timeoutSeconds = 300): Promise<T> {
  const job = await call<{ status_url: string; response_url: string }>(what, "POST", `${QUEUE}/${endpoint}`, input);
  let status = "IN_QUEUE";
  for (let waited = 0; status !== "COMPLETED"; waited += 2) {
    if (waited > timeoutSeconds) throw new EngineError(`${what} did not finish in ${timeoutSeconds}s on fal (last status: ${status}).`);
    await sleep(2000);
    status = (await call<{ status: string }>(what, "GET", job.status_url)).status;
    if (status !== "COMPLETED" && status !== "IN_QUEUE" && status !== "IN_PROGRESS") throw new EngineError(`${what} stopped on fal with status "${status}".`);
  }
  return call<T>(what, "GET", job.response_url);
}

/** Download a file a fal job made. */
export async function downloadFal(what: string, url: string, file: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new EngineError(`Downloading ${what} failed (${res.status}).`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
