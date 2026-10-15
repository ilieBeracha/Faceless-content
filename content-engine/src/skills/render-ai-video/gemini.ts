/**
 * Minimal client for Google's Gemini API (paid): Gemini image models for photos, Veo for video clips.
 * The key comes from GEMINI_API_KEY (.env or the environment) and is only ever sent in the request header.
 */
import { EngineError } from "../../core/errors.ts";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export function geminiKey(): string {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new EngineError(
      "GEMINI_API_KEY is not set, so realistic footage can't be generated.",
      "Create a key in Google AI Studio, then add it as GEMINI_API_KEY in your environment settings (or in .env, which is never committed).",
    );
  }
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, attempt = 0): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${BASE}/${path}`, {
    method,
    headers: { "x-goog-api-key": geminiKey(), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await sleep(2000 * 2 ** attempt);
    return call<T>(method, path, body, attempt + 1);
  }
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 400);
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      // keep the raw text
    }
    throw new EngineError(`Gemini API ${method} ${path.split("?")[0]} failed (${res.status}): ${message}`, res.status === 403 || res.status === 401 ? "Check that GEMINI_API_KEY is valid and has billing enabled for Veo." : undefined);
  }
  return JSON.parse(text) as T;
}

export interface ModelInfo {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

/** Every model the key can use (paged). */
export async function listModels(): Promise<ModelInfo[]> {
  const out: ModelInfo[] = [];
  let token = "";
  for (let page = 0; page < 20; page++) {
    const res = await call<{ models?: ModelInfo[]; nextPageToken?: string }>("GET", `models?pageSize=200${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`);
    out.push(...(res.models ?? []));
    if (!res.nextPageToken) break;
    token = res.nextPageToken;
  }
  return out;
}

export interface ImageInput {
  mimeType: string;
  data: Buffer;
}

/** One photo from a Gemini image model: a prompt plus optional reference photos (to keep a face consistent). */
export async function generateImage(model: string, prompt: string, references: ImageInput[], aspectRatio = "9:16"): Promise<Buffer> {
  const parts: unknown[] = [{ text: prompt }, ...references.map((r) => ({ inline_data: { mime_type: r.mimeType, data: r.data.toString("base64") } }))];
  const res = await call<{ candidates?: { content?: { parts?: { inlineData?: { data: string }; inline_data?: { data: string }; text?: string }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } }>(
    "POST",
    `models/${model}:generateContent`,
    { contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } } },
  );
  if (res.promptFeedback?.blockReason) throw new EngineError(`The image model refused the prompt (${res.promptFeedback.blockReason}).`, "Rephrase the shot description and try again.");
  for (const part of res.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data ?? part.inline_data?.data;
    if (data) return Buffer.from(data, "base64");
  }
  const reason = res.candidates?.[0]?.finishReason ?? "no image returned";
  const said = res.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
  throw new EngineError(`The image model returned no picture (${reason})${said ? `: ${said.slice(0, 200)}` : ""}.`, "Rephrase the shot description and try again.");
}

export interface VideoRequest {
  model: string;
  prompt: string;
  negativePrompt?: string;
  firstFrame?: ImageInput;
  aspectRatio: string;
  durationSeconds: number;
  resolution: string;
  personGeneration: string;
}

/** Start a Veo job; returns the long-running operation name. */
export async function startVideo(req: VideoRequest): Promise<string> {
  const instance: Record<string, unknown> = { prompt: req.prompt };
  if (req.firstFrame) instance.image = { bytesBase64Encoded: req.firstFrame.data.toString("base64"), mimeType: req.firstFrame.mimeType };
  const parameters: Record<string, unknown> = {
    aspectRatio: req.aspectRatio,
    durationSeconds: req.durationSeconds,
    resolution: req.resolution,
    personGeneration: req.personGeneration,
  };
  if (req.negativePrompt) parameters.negativePrompt = req.negativePrompt;
  const op = await call<{ name: string }>("POST", `models/${req.model}:predictLongRunning`, { instances: [instance], parameters });
  return op.name;
}

interface Operation {
  done?: boolean;
  error?: { message?: string };
  response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[]; raiMediaFilteredReasons?: string[] } };
}

/** Wait for a Veo job and download the clip. */
export async function waitForVideo(operation: string, log: (l: string) => void, timeoutMs = 15 * 60_000): Promise<Buffer> {
  const started = Date.now();
  for (;;) {
    const op = await call<Operation>("GET", operation);
    if (op.done) {
      if (op.error) throw new EngineError(`Veo failed: ${op.error.message ?? "unknown error"}`);
      const res = op.response?.generateVideoResponse;
      const uri = res?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new EngineError(`Veo returned no video${res?.raiMediaFilteredReasons?.length ? ` (filtered: ${res.raiMediaFilteredReasons.join("; ")})` : ""}.`, "Rephrase the shot (place, action or line) and try again.");
      const file = await fetch(uri, { headers: { "x-goog-api-key": geminiKey() }, redirect: "follow" });
      if (!file.ok) throw new EngineError(`Downloading the Veo clip failed (${file.status}).`);
      return Buffer.from(await file.arrayBuffer());
    }
    if (Date.now() - started > timeoutMs) throw new EngineError(`Veo job ${operation} took longer than ${Math.round(timeoutMs / 60000)} minutes.`, "Run the same command again; finished clips are kept.");
    await sleep(10_000);
    log(`    … still generating (${Math.round((Date.now() - started) / 1000)}s)`);
  }
}

export interface SpeechCheck {
  transcript: string;
  same_words: boolean;
  differences: string;
}

/** Ask a Gemini text model what is said in a clip's audio and whether it is the intended line. */
export async function checkSpeech(model: string, wav: Buffer, line: string): Promise<SpeechCheck> {
  const prompt = [
    "Transcribe exactly what the person says in this audio clip (ignore background noise).",
    `Then compare it with the intended line: "${line}".`,
    "same_words is true when every word of the intended line is said, in order, with nothing important added or changed.",
    "Count different ways of saying the same number (\"1,600\" / \"sixteen hundred\") and small fillers (\"uh\") as the same.",
    'Answer only JSON: {"transcript": "...", "same_words": true, "differences": "..."}',
  ].join("\n");
  const res = await call<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>("POST", `models/${model}:generateContent`, {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "audio/wav", data: wav.toString("base64") } }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  });
  const text = res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const parsed = JSON.parse(text) as Partial<SpeechCheck>;
    return { transcript: String(parsed.transcript ?? ""), same_words: parsed.same_words === true, differences: String(parsed.differences ?? "") };
  } catch {
    return { transcript: text.slice(0, 300), same_words: false, differences: "the checker's answer was not JSON" };
  }
}
