import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Wand2 } from "lucide-react";
import {
  ALLOWED_DIFFICULTIES,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  type Difficulty,
  type Language,
} from "@quizmaster/shared";
import { Segmented } from "../components/Segmented";
import { ApiError, createQuiz } from "../lib/api";
import { saveQuizId } from "../lib/storage";
import { Generating } from "./Generating";
import { cn } from "../lib/util";

const COUNT_OPTIONS = [5, 10, 15, 20].map((n) => ({ value: n, label: String(n) }));
const TIMER_OPTIONS = ([10, 20, 30] as const).map((n) => ({ value: n, label: `${n}s` }));
const DIFF_OPTIONS: { value: Difficulty; label: string }[] = ALLOWED_DIFFICULTIES.map((d) => ({
  value: d,
  label: d[0].toUpperCase() + d.slice(1),
}));
const LANG_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "nl", label: "Nederlands" },
];

/**
 * The quiz-creation form. Reused on the landing page (opens a fresh room) and inside a room
 * (`roomCode` set → re-arms that room with the new quiz for the same players).
 */
export function CreatePanel({
  name,
  roomCode,
  heading = "New quiz",
}: {
  name: string;
  roomCode?: string;
  heading?: string;
}) {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [timerSeconds, setTimerSeconds] = useState<10 | 20 | 30>(20);
  const [language, setLanguage] = useState<Language>("en");
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (!t) {
      setErr("Give your quiz a topic first.");
      return;
    }
    setErr(null);
    setGenerating(true);
    try {
      const res = await createQuiz({ topic: t, count, difficulty, timerSeconds, language, roomCode });
      saveQuizId(res.roomCode, res.quizId);
      navigate(`/room/${res.roomCode}`);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Couldn't generate the quiz. Please try again.");
      setGenerating(false);
    }
  }

  if (generating) return <Generating count={count} />;

  return (
    <form onSubmit={handleGenerate} className="mt-6 rounded-2xl border border-line bg-panel p-5 shadow-block">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">{heading}</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-sub">
          <Sparkles size={13} aria-hidden="true" /> {name}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="topic" className="text-[12px] font-extrabold uppercase tracking-wide text-sub">
          Topic
        </label>
        <textarea
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="e.g. 90s hip-hop deep cuts"
          className="resize-none rounded-xl border-[1.5px] border-line bg-muted px-3 py-2.5 text-base text-ink placeholder:text-sub/70"
        />
      </div>

      <Field label="Language">
        <Segmented name="language" label="Quiz language" options={LANG_OPTIONS} value={language} onChange={setLanguage} />
      </Field>

      <Field label="Questions">
        <Segmented name="count" label="Number of questions" options={COUNT_OPTIONS} value={count} onChange={setCount} />
        <span className="mt-1 block text-[11px] text-sub">
          {MIN_QUESTIONS}–{MAX_QUESTIONS} questions
        </span>
      </Field>

      <Field label="Difficulty">
        <Segmented name="difficulty" label="Difficulty" options={DIFF_OPTIONS} value={difficulty} onChange={setDifficulty} />
      </Field>

      <Field label="Timer">
        <Segmented name="timer" label="Seconds per question" options={TIMER_OPTIONS} value={timerSeconds} onChange={setTimerSeconds} />
      </Field>

      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

      <button
        type="submit"
        className={cn(
          "mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-display text-lg text-[#241a00]",
          "shadow-[0_5px_0_#a9760a] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#a9760a]",
        )}
      >
        <Wand2 size={20} aria-hidden="true" />
        {roomCode ? "Generate & restart room" : "Generate quiz"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <span className="text-[12px] font-extrabold uppercase tracking-wide text-sub">{label}</span>
      {children}
    </div>
  );
}
