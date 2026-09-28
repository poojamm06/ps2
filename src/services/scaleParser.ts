/**
 * NAWI TRUST — Scale ASCII Frame Parser
 *
 * Parses serial/USB output from various weighing instruments (Mettler Toledo SICS,
 * Sartorius, Ohaus, CAS, and standard raw numeric ASCII continuous streams).
 */

export interface ScaleReading {
  value: number;
  unit: string;
  stable: boolean;
  raw: string;
  timestamp: number;
}

export class ScaleParser {
  private history: number[] = [];
  private d: number;

  constructor(defaultD: number = 0.01) {
    this.d = defaultD;
  }

  public setD(d: number): void {
    if (d > 0) {
      this.d = d;
    }
  }

  public resetHistory(): void {
    this.history = [];
  }

  /**
   * Parse an incoming raw ASCII line into a structured ScaleReading.
   *
   * Formats handled:
   * 1. SICS: "S S 100.00 g" (Stable), "S D 100.00 g" (Dynamic)
   * 2. Sartorius / CAS: "ST,GS,+100.00 g" (Stable), "US,GS,+100.00 g" (Unstable/Dynamic)
   * 3. Prefix: "ST +100.00 g", "D 100.00 g"
   * 4. Raw numeric: "+100.00 g", "100.00 g", "100.00"
   *
   * Stability Rule:
   * - S / ST = stable
   * - D / US = dynamic
   * - If no explicit flag is present: stable when last 3 readings are within 0.5 * d of each other
   */
  public parse(rawLine: string, overrideD?: number): ScaleReading | null {
    if (overrideD && overrideD > 0) {
      this.d = overrideD;
    }

    // Strip control characters (STX \x02, ETX \x03, CR, LF, etc.)
    const cleaned = rawLine.replace(/[\x00-\x1F\x7F]/g, ' ').trim();
    if (!cleaned) return null;

    let value: number | null = null;
    let unit = 'g';
    let hasExplicitFlag = false;
    let isStable = false;

    // 1. Mettler Toledo SICS: "S S 100.00 g", "S D   -0.50 g"
    const sicsMatch = cleaned.match(/^S\s+([SDI])\s+([+-]?\s*\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/i);
    if (sicsMatch) {
      const flag = sicsMatch[1].toUpperCase();
      const numStr = sicsMatch[2].replace(/\s+/g, '');
      const parsedVal = parseFloat(numStr);
      if (!isNaN(parsedVal)) {
        value = parsedVal;
        unit = sicsMatch[3] || 'g';
        hasExplicitFlag = true;
        isStable = flag === 'S';
      }
    }

    // 2. Comma-separated: "ST,GS,+100.00 g", "ST,NT,+  100.00 g", "US,GS,+100.00 g"
    if (value === null) {
      const csvMatch = cleaned.match(/^(ST|US|SD|D|S)\s*,\s*(?:[A-Z]{2}\s*,\s*)?([+-]?\s*\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/i);
      if (csvMatch) {
        const flag = csvMatch[1].toUpperCase();
        const numStr = csvMatch[2].replace(/\s+/g, '');
        const parsedVal = parseFloat(numStr);
        if (!isNaN(parsedVal)) {
          value = parsedVal;
          unit = csvMatch[3] || 'g';
          hasExplicitFlag = true;
          isStable = flag === 'ST' || flag === 'S';
        }
      }
    }

    // 3. Space prefix: "ST +100.00 g", "US +100.00 g", "D 100.00 g"
    if (value === null) {
      const prefixMatch = cleaned.match(/^(ST|US|SD|S|D)\s+([+-]?\s*\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/i);
      if (prefixMatch) {
        const flag = prefixMatch[1].toUpperCase();
        const numStr = prefixMatch[2].replace(/\s+/g, '');
        const parsedVal = parseFloat(numStr);
        if (!isNaN(parsedVal)) {
          value = parsedVal;
          unit = prefixMatch[3] || 'g';
          hasExplicitFlag = true;
          isStable = flag === 'ST' || flag === 'S';
        }
      }
    }

    // 4. Raw numeric: "+100.00 g", "100.00 g", "100.00"
    if (value === null) {
      const simpleMatch = cleaned.match(/^([+-]?\s*\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
      if (simpleMatch) {
        const numStr = simpleMatch[1].replace(/\s+/g, '');
        const parsedVal = parseFloat(numStr);
        if (!isNaN(parsedVal)) {
          value = parsedVal;
          unit = simpleMatch[2] || 'g';
          hasExplicitFlag = false;
        }
      }
    }

    if (value === null) {
      return null;
    }

    // If explicit flag was identified
    if (hasExplicitFlag) {
      this.history.push(value);
      if (this.history.length > 5) this.history.shift();
      return {
        value,
        unit,
        stable: isStable,
        raw: rawLine,
        timestamp: Date.now(),
      };
    }

    // If no explicit flag: stable when last 3 readings are within 0.5 * d of each other
    this.history.push(value);
    if (this.history.length > 3) {
      this.history.shift();
    }

    if (this.history.length === 3) {
      const maxVal = Math.max(...this.history);
      const minVal = Math.min(...this.history);
      const range = maxVal - minVal;
      const tolerance = 0.5 * this.d;
      isStable = range <= tolerance;
    } else {
      isStable = false;
    }

    return {
      value,
      unit,
      stable: isStable,
      raw: rawLine,
      timestamp: Date.now(),
    };
  }
}

export const defaultScaleParser = new ScaleParser(0.01);
