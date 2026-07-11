/**
 * Quiz endpoints.
 *
 *   POST /api/quizzes             -> generate + seal a quiz (auth-gated), open a room
 *   GET  /api/quizzes/:id/results -> past game results for a quiz (owner only)
 *
 * Generation is the only thing that calls Claude, and it's gated behind a logged-in
 * creator (cost/abuse guard). The response never contains answers.
 */
import { Router, type Request, type Response } from "express";
import {
  ALLOWED_DIFFICULTIES,
  ALLOWED_LANGUAGES,
  ALLOWED_TIMERS,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  type CreateQuizRequest,
  type CreateQuizResponse,
  type Difficulty,
  type GameResultSummary,
  type Language,
} from "@quizmaster/shared";
import type { PrismaClient } from "@prisma/client";
import type { Env } from "../env.js";
import { getUserFromCookie } from "../auth/session.js";
import { generateQuiz, QuizGenerationError } from "./generate.js";
import type { GameEngine } from "../game/engine.js";

export function createQuizRouter(prisma: PrismaClient, env: Env, engine: GameEngine): Router {
  const router = Router();

  router.post("/quizzes", async (req: Request, res: Response) => {
    const user = await getUserFromCookie({ prisma, env }, req.headers.cookie);
    if (!user) {
      res.status(401).json({ error: "unauthenticated", message: "Sign in to create a quiz." });
      return;
    }

    const parsed = parseCreateQuizRequest(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: "invalid_request", message: parsed.error });
      return;
    }
    const { topic, count, difficulty, timerSeconds, language, roomCode } = parsed.value;

    // Re-arm flow: validate the room + creator ownership BEFORE the (rate-limited) Claude call.
    if (roomCode) {
      const own = engine.roomOwnership(roomCode, user.id);
      if (own === "not_found") {
        res.status(404).json({ error: "not_found", message: "That room no longer exists." });
        return;
      }
      if (own === "not_creator") {
        res.status(403).json({ error: "forbidden", message: "Only the room's host can start a new quiz here." });
        return;
      }
    }

    let questions;
    try {
      questions = await generateQuiz(env, { topic, count, difficulty, language });
    } catch (err) {
      if (err instanceof QuizGenerationError) {
        // Rate-limit → 429 so the client can show a friendly "busy, try again" and keep the form.
        const status = err.rateLimited ? 429 : 502;
        res.status(status).json({
          error: err.rateLimited ? "rate_limited" : "generation_failed",
          message: err.message,
        });
        return;
      }
      res.status(502).json({ error: "generation_failed", message: "Quiz generation failed." });
      return;
    }

    // Persist the sealed quiz (questions incl. answers) owned by this creator.
    const quiz = await prisma.quiz.create({
      data: {
        ownerId: user.id,
        topic,
        difficulty,
        timerSeconds,
        questionsJson: JSON.stringify(questions),
      },
    });

    // Re-arm the existing room in place, or spin up a fresh one.
    let outRoomCode: string;
    if (roomCode) {
      engine.rearmRoom(roomCode, { quizId: quiz.id, topic, timerSeconds, questions });
      outRoomCode = roomCode.toUpperCase();
    } else {
      outRoomCode = engine.createRoom({
        quizId: quiz.id,
        topic,
        ownerUserId: user.id,
        timerSeconds,
        questions,
      }).code;
    }

    const body: CreateQuizResponse = {
      quizId: quiz.id,
      roomCode: outRoomCode,
      topic,
      questionCount: questions.length,
    };
    res.status(201).json(body);
  });

  // Open a fresh room for an already-generated quiz (replay).
  router.post("/quizzes/:id/play", async (req: Request, res: Response) => {
    const user = await getUserFromCookie({ prisma, env }, req.headers.cookie);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
    if (!quiz || quiz.ownerId !== user.id) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const questions = JSON.parse(quiz.questionsJson);
    const room = engine.createRoom({
      quizId: quiz.id,
      topic: quiz.topic,
      ownerUserId: user.id,
      timerSeconds: quiz.timerSeconds,
      questions,
    });
    const body: CreateQuizResponse = {
      quizId: quiz.id,
      roomCode: room.code,
      topic: quiz.topic,
      questionCount: questions.length,
    };
    res.status(201).json(body);
  });

  router.get("/quizzes/:id/results", async (req: Request, res: Response) => {
    const user = await getUserFromCookie({ prisma, env }, req.headers.cookie);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
    if (!quiz || quiz.ownerId !== user.id) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const results = await prisma.gameResult.findMany({
      where: { quizId: quiz.id },
      orderBy: { playedAt: "desc" },
    });
    const body: GameResultSummary[] = results.map((r) => {
      const standings = JSON.parse(r.standingsJson) as { nickname: string; score: number; rank: number }[];
      return {
        gameId: r.id,
        quizId: r.quizId,
        playedAt: r.playedAt.toISOString(),
        winners: standings.filter((s) => s.rank === 1),
        playerCount: r.playerCount,
      };
    });
    res.json(body);
  });

  return router;
}

type ParseResult =
  | { value: CreateQuizRequest }
  | { error: string };

function parseCreateQuizRequest(body: unknown): ParseResult {
  if (!body || typeof body !== "object") return { error: "Missing request body." };
  const b = body as Record<string, unknown>;

  const topic = typeof b.topic === "string" ? b.topic.trim() : "";
  if (!topic) return { error: "topic is required." };
  if (topic.length > 200) return { error: "topic is too long (max 200 chars)." };

  const count = Number(b.count);
  if (!Number.isInteger(count) || count < MIN_QUESTIONS || count > MAX_QUESTIONS) {
    return { error: `count must be an integer between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}.` };
  }

  const difficulty = b.difficulty as Difficulty;
  if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
    return { error: `difficulty must be one of ${ALLOWED_DIFFICULTIES.join(", ")}.` };
  }

  const timerSeconds = Number(b.timerSeconds) as 10 | 20 | 30;
  if (!ALLOWED_TIMERS.includes(timerSeconds as (typeof ALLOWED_TIMERS)[number])) {
    return { error: `timerSeconds must be one of ${ALLOWED_TIMERS.join(", ")}.` };
  }

  const language = (b.language as Language) ?? "en";
  if (!ALLOWED_LANGUAGES.includes(language)) {
    return { error: `language must be one of ${ALLOWED_LANGUAGES.join(", ")}.` };
  }

  let roomCode: string | undefined;
  if (b.roomCode !== undefined && b.roomCode !== null) {
    if (typeof b.roomCode !== "string" || !/^[A-Za-z0-9]{4,8}$/.test(b.roomCode)) {
      return { error: "roomCode is invalid." };
    }
    roomCode = b.roomCode;
  }

  return { value: { topic, count, difficulty, timerSeconds, language, roomCode } };
}
