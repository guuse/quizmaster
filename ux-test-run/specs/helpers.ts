import { Page, BrowserContext, expect, Browser } from "@playwright/test";

export const BASE = "http://localhost:5173";

/** Attach failure-signal hooks: uncaught errors, console.error, failed responses. */
export function watchFailures(page: Page, bag: string[], label: string) {
  page.on("pageerror", (e) => bag.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") {
      const t = m.text();
      // Ignore benign React devtools / favicon noise.
      if (/favicon|Download the React DevTools/i.test(t)) return;
      bag.push(`[${label}] console.error: ${t}`);
    }
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/api/")) {
      bag.push(`[${label}] http ${r.status()} ${r.request().method()} ${r.url()}`);
    }
  });
}

/** Capture every socket.io frame the page RECEIVES, for the secrecy assertion. */
export function captureSocketFrames(page: Page, received: string[]) {
  page.on("websocket", (ws) => {
    ws.on("framereceived", (f) => {
      const payload = typeof f.payload === "string" ? f.payload : f.payload.toString();
      received.push(payload);
    });
  });
}

/** Dev-login a creator via the UI on the landing page. */
export async function devLogin(page: Page, name: string) {
  await page.goto(BASE + "/");
  // The dev-login form has a "Your name" input + a "Go" submit button.
  const nameInput = page.getByPlaceholder("Your name");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await page.getByRole("button", { name: /^Go$/ }).click();
  // After login, the create form ("New quiz") appears.
  await expect(page.getByText("New quiz")).toBeVisible();
}

/** Create a quiz via the UI; returns the room code from the lobby. */
export async function createQuiz(
  page: Page,
  opts: { topic?: string; count?: string; difficulty?: string; timer?: string } = {},
) {
  await page.getByPlaceholder("e.g. 90s hip-hop deep cuts").fill(opts.topic ?? "Test Topic");
  // Count/difficulty/timer are role="radio" segmented controls, not plain buttons.
  if (opts.count) await page.getByRole("radio", { name: new RegExp(`^${opts.count}$`) }).click();
  if (opts.difficulty) await page.getByRole("radio", { name: new RegExp(opts.difficulty, "i") }).click();
  if (opts.timer) await page.getByRole("radio", { name: new RegExp(`^${opts.timer}s$`) }).click();
  await page.getByRole("button", { name: /Generate quiz/i }).click();
  // The creator lands on the room page and confirms a nickname (prefilled from their session),
  // then enters the lobby — they play as a participant too.
  const joinBtn = page.getByTestId("join-btn");
  await expect(joinBtn).toBeVisible({ timeout: 30_000 });
  const nick = page.getByPlaceholder("e.g. Sanne");
  if ((await nick.inputValue()).trim() === "") await nick.fill("Host");
  await joinBtn.click();
  const code = page.getByTestId("room-code");
  await expect(code).toBeVisible({ timeout: 30_000 });
  return (await code.textContent())!.trim();
}

/** Anonymous join via /join/:code with a nickname. */
export async function joinAsPlayer(context: BrowserContext, code: string, nickname: string) {
  const page = await context.newPage();
  await page.goto(`${BASE}/join/${code}`);
  const nick = page.getByPlaceholder("e.g. Sanne");
  await expect(nick).toBeVisible();
  await nick.fill(nickname);
  await page.getByTestId("join-btn").click();
  return page;
}

/** Answer the current question by clicking a tile via its accessible name (option text). */
export async function answerByText(page: Page, optionText: string) {
  await page.getByRole("button", { name: new RegExp(optionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first().click();
}

/** Click the first available answer tile (used when we don't care which). */
export async function answerFirst(page: Page) {
  // Answer tiles live inside the question phase; click the first enabled option button.
  await page.locator('[data-testid="phase-question"] button:not([disabled])').first().click();
}

export async function waitForPhase(page: Page, testId: string, timeout = 30_000) {
  await expect(page.getByTestId(testId)).toBeVisible({ timeout });
}
