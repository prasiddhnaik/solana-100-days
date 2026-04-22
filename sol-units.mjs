export const LAMPORTS_PER_SOL = 1_000_000_000n;

export function solToLamports(solAmount) {
  const normalized = String(solAmount).trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new TypeError("SOL amount must be a positive number string");
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");

  if (fractionalPart.length > 9) {
    throw new RangeError("SOL amount supports up to 9 decimal places");
  }

  const wholeLamports = BigInt(wholePart) * LAMPORTS_PER_SOL;
  const fractionalLamports = BigInt(
    fractionalPart.padEnd(9, "0") || "0"
  );

  return wholeLamports + fractionalLamports;
}

export function lamportsToSolString(lamports) {
  const lamportsValue = BigInt(lamports);
  const wholeSol = lamportsValue / LAMPORTS_PER_SOL;
  const fractionalLamports = lamportsValue % LAMPORTS_PER_SOL;

  if (fractionalLamports === 0n) {
    return wholeSol.toString();
  }

  const fractionalSol = fractionalLamports
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");

  return `${wholeSol}.${fractionalSol}`;
}
