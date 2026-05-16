import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { BOT_SENTINEL_ID, determineWinner, randomBotName } from "./compete.ts";

const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";

Deno.test("determineWinner: player wins (PvP)", () => {
  assertEquals(determineWinner(800, 500, P1, P2), P1);
  assertEquals(determineWinner(400, 900, P1, P2), P2);
});

Deno.test("determineWinner: draw returns null (PvP)", () => {
  assertEquals(determineWinner(700, 700, P1, P2), null);
  assertEquals(determineWinner(0, 0, P1, P2), null);
});

Deno.test("determineWinner: player wins vs bot", () => {
  assertEquals(determineWinner(1200, 800, P1, null), P1);
});

Deno.test("determineWinner: bot wins → returns sentinel id (not null)", () => {
  const winner = determineWinner(600, 1100, P1, null);
  assertEquals(winner, BOT_SENTINEL_ID);
  assertNotEquals(winner, null, "bot win must NOT be reported as a draw");
  assertNotEquals(winner, P1, "bot win must not credit the player");
});

Deno.test("determineWinner: true draw vs bot still returns null", () => {
  assertEquals(determineWinner(900, 900, P1, null), null);
});

Deno.test("randomBotName: matches Prefix+Suffix-NN pattern", () => {
  for (let i = 0; i < 20; i++) {
    const name = randomBotName();
    assert(/^[A-Z][a-z]+[A-Z][a-z]+-\d{2}$/.test(name), `unexpected name: ${name}`);
  }
});

Deno.test("randomBotName: produces variety across calls", () => {
  const names = new Set<string>();
  for (let i = 0; i < 50; i++) names.add(randomBotName());
  // With ~24 * 20 * 90 combinations, 50 draws should yield many unique names.
  assert(names.size > 25, `expected variety, got ${names.size} unique names`);
});
