export const FLASH_MS = 4000;

export function pruneExpiredFlashes(
  curr: Record<string, number>,
  checkNow: number,
  flashMs: number = FLASH_MS
): { next: Record<string, number>; didChange: boolean } {
  const next: Record<string, number> = {};
  let didChange = false;
  for (const [id, timestamp] of Object.entries(curr)) {
    if (checkNow - timestamp < flashMs) {
      next[id] = timestamp;
    } else {
      didChange = true;
    }
  }
  return { next: didChange ? next : curr, didChange };
}

export function calculateFlashDelay(
  changed: Record<string, number>,
  now: number,
  flashMs: number = FLASH_MS
): number {
  const values = Object.values(changed);
  if (values.length === 0) return flashMs;
  const oldest = Math.min(...values);
  return Math.max(50, flashMs - (now - oldest));
}
