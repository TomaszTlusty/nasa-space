import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { INSTRUCTIONS } from "@/lib/ai/prompts";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import {
  countSteps,
  MAX_HISTORY,
  MAX_INPUT_CHARS,
  MAX_STEPS,
  type MissionUIMessage,
  missionTools,
} from "@/lib/ai/tools";

/**
 * Mission assistant / LUNA-Bot chat endpoint.
 * Body: `{ id?: string, mode: "science" | "student", messages: UIMessage[] }` (AI SDK UI messages).
 * Env: `ANTHROPIC_API_KEY` (required), `AI_MODEL` (optional, default `claude-haiku-5-5`).
 * Tools have no server `execute`; the browser runs them against the app's analysis engine and
 * resubmits, so each tool round-trip is one request here.
 */
export const maxDuration = 60;

const TEN_MIN = 10 * 60_000;
/** Cost guard, per server instance: new user questions per IP… */
const turnLimiter = createRateLimiter(20, TEN_MIN);
/** …and all requests per IP (tool round-trips included; ≤ MAX_STEPS per question). */
const requestLimiter = createRateLimiter(20 * MAX_STEPS, TEN_MIN);

const MAX_BODY_BYTES = 256_000;

const bodySchema = z.object({
  id: z.string().max(200).optional(),
  mode: z.enum(["science", "student"]),
  messages: z.array(z.unknown()).min(1).max(200),
});

const text = (status: number, message: string, headers?: Record<string, string>) =>
  new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8", ...headers } });

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return text(503, "The AI assistant is not configured on this server.");

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return text(413, "This conversation is too long. Clear it and start again.");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return text(400, "Invalid request.");
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) return text(400, "Invalid request.");

  const validated = await safeValidateUIMessages<MissionUIMessage>({
    messages: body.data.messages,
    tools: missionTools,
  });
  if (!validated.success) return text(400, "Invalid chat messages.");

  // Last 12 messages; the model conversation must start with a user message.
  const messages = validated.data.slice(-MAX_HISTORY);
  while (messages.length > 0 && messages[0].role !== "user") messages.shift();
  if (messages.length === 0) return text(400, "Invalid chat messages.");

  for (const m of messages) {
    if (m.role === "system") return text(400, "Invalid chat messages.");
    if (m.role !== "user") continue;
    const chars = m.parts.reduce((n, p) => (p.type === "text" ? n + p.text.length : n), 0);
    if (chars > MAX_INPUT_CHARS)
      return text(413, `Message too long — please keep it under ${MAX_INPUT_CHARS.toLocaleString("en-US")} characters.`);
  }

  const last = messages[messages.length - 1];
  const ip = clientIp(req);
  const limited = requestLimiter.take(ip);
  const turnLimited = limited.ok && last.role === "user" ? turnLimiter.take(ip) : limited;
  if (!limited.ok || !turnLimited.ok) {
    const retry = Math.max(limited.retryAfterS, turnLimited.retryAfterS);
    return text(429, `Too many questions in a short time. Try again in ${Math.ceil(retry / 60)} min.`, {
      "retry-after": String(retry),
    });
  }

  // Steps already taken in this turn (client resubmits after each tool round). The final allowed
  // step must answer in text, so the turn always ends with an explanation.
  const priorSteps = countSteps(last);
  if (priorSteps >= MAX_STEPS) return text(400, "Step limit reached for this question.");

  const result = streamText({
    model: anthropic(process.env.AI_MODEL ?? "claude-haiku-5-5"),
    instructions: INSTRUCTIONS[body.data.mode],
    messages: await convertToModelMessages(messages, { tools: missionTools, ignoreIncompleteToolCalls: true }),
    tools: missionTools,
    toolChoice: priorSteps >= MAX_STEPS - 1 ? "none" : "auto",
    stopWhen: isStepCount(MAX_STEPS),
    maxOutputTokens: 700,
    abortSignal: req.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools: missionTools,
      onError: () => "The assistant hit a problem while answering. Please try again.",
    }),
  });
}
