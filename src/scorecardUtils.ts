export interface BallInfo {
  text: string;
  kind: "w" | "four" | "six" | "extra" | "dot" | "normal" | "separator";
}

// Correctly categorizes cricket deliveries:
// - Exact batting boundaries: "4" and "6"
// - Extras: WD, NB, LB, B (e.g. Wd, 1Wd, Nb, 1nb, 4lb, 4b, 6lb, 1b, 1lb, 4B)
// - Wickets: W and run+W (e.g. W, w, 1W, 2W)
// - Dots: "0" and "."
// - Separator: "|"
// - Normal runs or unknown tokens fall through to "normal" to prevent invented classifications.
export function parseBall(ball: string): BallInfo {
  const trimmed = ball.trim();
  if (trimmed === "|") return { text: ball, kind: "separator" };
  const upper = trimmed.toUpperCase();

  // Extras: wides, no-balls, leg byes, byes
  if (
    /^\d*WD\d*$/i.test(upper) ||
    /^\d*NB\d*$/i.test(upper) ||
    /^\d*LB\d*$/i.test(upper) ||
    /^\d*B$/i.test(upper)
  ) {
    return { text: ball, kind: "extra" };
  }

  // Wickets: pure wickets and run+wicket (e.g. W, 1W, 2W)
  if (/^\d*W\d*$/i.test(upper)) {
    return { text: ball, kind: "w" };
  }

  // Exact batting boundaries
  if (upper === "6") {
    return { text: ball, kind: "six" };
  }
  if (upper === "4") {
    return { text: ball, kind: "four" };
  }

  // Dot balls
  if (upper === "0" || upper === ".") {
    return { text: ball, kind: "dot" };
  }

  return { text: ball, kind: "normal" };
}
