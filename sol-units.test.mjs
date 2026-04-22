import test from "node:test";
import assert from "node:assert/strict";

import {
  LAMPORTS_PER_SOL,
  lamportsToSolString,
  solToLamports,
} from "./sol-units.mjs";

test("converts whole SOL values to lamports", () => {
  assert.equal(LAMPORTS_PER_SOL, 1_000_000_000n);
  assert.equal(solToLamports("2"), 2_000_000_000n);
});

test("converts fractional SOL values to lamports exactly", () => {
  assert.equal(solToLamports("1.5"), 1_500_000_000n);
  assert.equal(solToLamports("0.000005"), 5_000n);
});

test("formats lamports as SOL without floating point math", () => {
  assert.equal(lamportsToSolString(2_000_000_000n), "2");
  assert.equal(lamportsToSolString(1_500_000_000n), "1.5");
  assert.equal(lamportsToSolString(5_000n), "0.000005");
});
