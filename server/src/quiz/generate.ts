/**
 * Quiz generation. We force Claude to return structured output via a `submit_quiz`
 * tool call (tool_choice), then validate the result SERVER-SIDE before it is ever
 * persisted — because nobody (not even the creator) sees the answers, a wrong answer
 * key would be undetectable, so validation is the safety net.
 *
 * Model: claude-sonnet-5 (see CONTEXT.md). On validation failure we retry once, then
 * surface a clean error. QUIZMASTER_FAKE_QUIZ=1 returns a deterministic quiz so the
 * game loop is fully testable without a live model call — real generation is the default.
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  Difficulty,
  GeneratedQuiz,
  Question,
  QuestionType,
} from "@quizmaster/shared";
import type { Env } from "../env.js";

export interface GenerateParams {
  topic: string;
  count: number;
  difficulty: Difficulty;
}

export class QuizGenerationError extends Error {
  /** True when generation failed because the Claude credential is rate-limited (HTTP 429/529). */
  readonly rateLimited: boolean;
  constructor(message: string, rateLimited = false) {
    super(message);
    this.name = "QuizGenerationError";
    this.rateLimited = rateLimited;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pull a retry-after delay (ms) from an Anthropic API error's headers, if present. */
function retryAfterMs(err: unknown): number | null {
  const headers = (err as { headers?: Record<string, string> })?.headers;
  const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!raw) return null;
  const secs = Number(raw);
  return Number.isFinite(secs) ? Math.min(30_000, secs * 1000) : null;
}

function isRateLimit(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 529; // 429 rate_limit, 529 overloaded
}

const SUBMIT_QUIZ_TOOL = {
  name: "submit_quiz",
  description:
    "Submit the generated quiz. Provide exactly the requested number of questions. " +
    "multiple_choice questions have exactly 4 options; true_false questions have exactly " +
    "2 options which must be [\"True\", \"False\"]. correctIndex is the 0-based index of the " +
    "correct option. Options must be non-empty and distinct.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["multiple_choice", "true_false"] },
            text: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            correctIndex: { type: "integer" },
          },
          required: ["type", "text", "options", "correctIndex"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
};

export async function generateQuiz(env: Env, params: GenerateParams): Promise<Question[]> {
  if (env.fakeQuiz) {
    return buildFakeQuiz(params);
  }

  const client = makeClient(env);
  let lastError = "unknown error";
  let sawRateLimit = false;

  // Force the tool call + validate. Retry on failure; on rate-limit/overloaded, back off
  // (honoring retry-after) so a windowed subscription limit has time to recover. Subscription
  // OAuth tokens (sk-ant-oat01-…) share a rolling budget, so this smooths transient 429s.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let generated: GeneratedQuiz | null = null;
    try {
      generated = await callModel(client, env, params);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (isRateLimit(err)) {
        sawRateLimit = true;
        if (attempt < MAX_ATTEMPTS - 1) {
          // Prefer the server's retry-after; otherwise exponential (≈2s, 4s, 9s, 20s).
          const backoff = retryAfterMs(err) ?? Math.min(20_000, 2000 * Math.pow(2.1, attempt));
          await sleep(backoff);
        }
      }
      continue;
    }
    const result = validateGeneratedQuiz(generated, params.count);
    if (result.ok) {
      return result.questions;
    }
    lastError = result.error;
  }

  if (sawRateLimit) {
    throw new QuizGenerationError(
      "Claude is rate-limited right now — wait a moment and try again.",
      true,
    );
  }
  throw new QuizGenerationError(`Quiz generation failed after retry: ${lastError}`);
}

function makeClient(env: Env): Anthropic {
  // maxRetries lets the SDK itself back off + honor retry-after on 429/529 before our
  // loop even sees an error — important for the shared-budget OAuth token path.
  if (env.anthropicApiKey) {
    return new Anthropic({ apiKey: env.anthropicApiKey, maxRetries: 4 });
  }
  if (env.anthropicAuthToken) {
    // OAuth-style token (sk-ant-oat01-...): sent as Authorization: Bearer with the
    // oauth beta header, rather than as an x-api-key.
    return new Anthropic({
      authToken: env.anthropicAuthToken,
      maxRetries: 4,
      defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" },
    });
  }
  throw new QuizGenerationError("No Anthropic credentials configured (ANTHROPIC_API_KEY).");
}

async function callModel(client: Anthropic, env: Env, params: GenerateParams): Promise<GeneratedQuiz> {
  const prompt =
    `Create a ${params.difficulty} difficulty quiz on the topic: "${params.topic}".\n` +
    `Produce exactly ${params.count} questions. Mix multiple_choice (4 options) and ` +
    `true_false (options must be exactly ["True","False"]) as appropriate. Each question ` +
    `must have exactly one correct answer, factually accurate. Options within a question ` +
    `must be distinct and non-empty. Call the submit_quiz tool with the result.`;

  const response = await client.messages.create({
    model: env.quizModel,
    max_tokens: 8000,
    thinking: { type: "disabled" },
    tools: [SUBMIT_QUIZ_TOOL],
    tool_choice: { type: "tool", name: "submit_quiz" },
    messages: [{ role: "user", content: prompt }],
  });

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "submit_quiz") {
      return block.input as GeneratedQuiz;
    }
  }
  throw new QuizGenerationError("Model did not return a submit_quiz tool call.");
}

interface ValidationOk {
  ok: true;
  questions: Question[];
}
interface ValidationFail {
  ok: false;
  error: string;
}

/**
 * Server-side validation of a generated quiz. Enforces exactly `count` questions,
 * the right option counts per type, an in-range correctIndex, and no empty/duplicate
 * options. Returns a normalized Question[] on success.
 */
export function validateGeneratedQuiz(
  generated: GeneratedQuiz | null | undefined,
  count: number,
): ValidationOk | ValidationFail {
  if (!generated || !Array.isArray(generated.questions)) {
    return { ok: false, error: "missing questions array" };
  }
  const questions = generated.questions;
  if (questions.length !== count) {
    return { ok: false, error: `expected ${count} questions, got ${questions.length}` };
  }

  const normalized: Question[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q !== "object") {
      return { ok: false, error: `question ${i} is not an object` };
    }
    const type = q.type as QuestionType;
    if (type !== "multiple_choice" && type !== "true_false") {
      return { ok: false, error: `question ${i} has invalid type` };
    }
    if (typeof q.text !== "string" || q.text.trim() === "") {
      return { ok: false, error: `question ${i} has empty text` };
    }
    if (!Array.isArray(q.options)) {
      return { ok: false, error: `question ${i} options is not an array` };
    }

    const expectedOptions = type === "true_false" ? 2 : 4;
    if (q.options.length !== expectedOptions) {
      return { ok: false, error: `question ${i} expected ${expectedOptions} options, got ${q.options.length}` };
    }
    for (const opt of q.options) {
      if (typeof opt !== "string" || opt.trim() === "") {
        return { ok: false, error: `question ${i} has an empty option` };
      }
    }
    // No duplicate options (case-insensitive, trimmed).
    const seen = new Set(q.options.map((o) => o.trim().toLowerCase()));
    if (seen.size !== q.options.length) {
      return { ok: false, error: `question ${i} has duplicate options` };
    }
    if (type === "true_false") {
      if (q.options[0] !== "True" || q.options[1] !== "False") {
        return { ok: false, error: `question ${i} true_false options must be ["True","False"]` };
      }
    }
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      return { ok: false, error: `question ${i} correctIndex out of range` };
    }
    normalized.push({
      type,
      text: q.text.trim(),
      options: q.options.map((o) => o.trim()),
      correctIndex: q.correctIndex,
    });
  }

  return { ok: true, questions: normalized };
}

/** Deterministic fake quiz for QUIZMASTER_FAKE_QUIZ=1 — game loop testing without Claude. */
function buildFakeQuiz(params: GenerateParams): Question[] {
  const questions: Question[] = [];
  for (let i = 0; i < params.count; i++) {
    if (i % 3 === 2) {
      questions.push({
        type: "true_false",
        text: `[${params.topic}] True or false: statement number ${i + 1} is correct?`,
        options: ["True", "False"],
        correctIndex: i % 2,
      });
    } else {
      const correctIndex = i % 4;
      questions.push({
        type: "multiple_choice",
        text: `[${params.topic}] Question ${i + 1} (${params.difficulty})?`,
        options: [
          `Answer ${i + 1}A`,
          `Answer ${i + 1}B`,
          `Answer ${i + 1}C`,
          `Answer ${i + 1}D`,
        ],
        correctIndex,
      });
    }
  }
  return questions;
}
