// OIML R-76 Table 6 — Maximum Permissible Error tier lookup.
// Shared by the observation grid (live entry) and the Results fallback
// (deterministic local verdict when the backend evaluation is unavailable).
export interface MpeResult {
  factor: number;
  m: number;
  limitValue: number;
  limitStr: string;
}

export function getMpeForLoad(
  loadVal: number,
  verificationScaleInterval_e: number,
  accuracyClass: string,
  unit: string
): MpeResult {
  const e = verificationScaleInterval_e > 0 ? verificationScaleInterval_e : 0.1;
  const m = Math.abs(loadVal) / e;
  let factor = 0.5;

  if (accuracyClass === 'I') {
    factor = m <= 50000 ? 0.5 : m <= 200000 ? 1.0 : 1.5;
  } else if (accuracyClass === 'II') {
    factor = m <= 5000 ? 0.5 : m <= 20000 ? 1.0 : 1.5;
  } else if (accuracyClass === 'III') {
    factor = m <= 500 ? 0.5 : m <= 2000 ? 1.0 : 1.5;
  } else {
    factor = m <= 50 ? 0.5 : m <= 200 ? 1.0 : 1.5;
  }

  const limitValue = factor * e;
  return {
    factor,
    m: Math.round(m),
    limitValue,
    limitStr: `±${limitValue.toFixed(4)} ${unit} (±${factor}e)`,
  };
}
