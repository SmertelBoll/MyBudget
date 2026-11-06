// Calculator for amount fields (spec 4.2): + − × ÷, %, parentheses. A small recursive-descent parser instead of
// eval (spec 3.4).
//   200 + 10%  -> 220     (percent of the left operand, as on phone calculators)
//   200 × 10%  -> 20
//   15%        -> 0.15

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "(" | ")" | "%" };

const OPS: Record<string, "+" | "-" | "*" | "/"> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "*": "*",
  "×": "*",
  "x": "*",
  "/": "/",
  "÷": "/",
};

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === " ") {
      i += 1;
    } else if (/[\d.,]/.test(char)) {
      let text = "";
      while (i < source.length && /[\d.,]/.test(source[i])) text += source[i++];
      const value = Number(text.replace(",", "."));
      if (!Number.isFinite(value) || (text.match(/[.,]/g)?.length ?? 0) > 1) throw new Error("number");
      tokens.push({ type: "num", value });
    } else if (OPS[char]) {
      tokens.push({ type: "op", value: OPS[char] });
      i += 1;
    } else if (char === "(" || char === ")" || char === "%") {
      tokens.push({ type: char });
      i += 1;
    } else {
      throw new Error(`unexpected ${char}`);
    }
  }
  return tokens;
};

type Value = { value: number; percent: boolean };

export const evaluate = (source: string): number | null => {
  let tokens: Token[];
  try {
    tokens = tokenize(source);
  } catch {
    return null;
  }
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (op: string) => peek()?.type === "op" && (peek() as { value: string }).value === op;

  const primary = (): number => {
    const token = tokens[pos++];
    if (token?.type === "num") return token.value;
    if (token?.type === "(") {
      const inner = expression();
      if (tokens[pos++]?.type !== ")") throw new Error("paren");
      return inner;
    }
    throw new Error("value expected");
  };

  const factor = (): Value => {
    let sign = 1;
    while (isOp("-") || isOp("+")) {
      if (isOp("-")) sign = -sign;
      pos += 1;
    }
    const value = sign * primary();
    if (peek()?.type === "%") {
      pos += 1;
      return { value, percent: true };
    }
    return { value, percent: false };
  };

  const term = (): Value => {
    let left = factor();
    while (isOp("*") || isOp("/")) {
      const op = (tokens[pos++] as { value: string }).value;
      const right = factor();
      const l = left.percent ? left.value / 100 : left.value;
      const r = right.percent ? right.value / 100 : right.value;
      if (op === "/" && r === 0) throw new Error("division by zero");
      left = { value: op === "*" ? l * r : l / r, percent: false };
    }
    return left;
  };

  const expression = (): number => {
    const first = term();
    let result = first.percent ? first.value / 100 : first.value;
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { value: string }).value;
      const right = term();
      const r = right.percent ? (result * right.value) / 100 : right.value;
      result = op === "+" ? result + r : result - r;
    }
    return result;
  };

  try {
    const result = expression();
    if (pos !== tokens.length || !Number.isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
};
