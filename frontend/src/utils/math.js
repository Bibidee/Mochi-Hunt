// ==================== Small math helpers ====================

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

export const randInt = (n) => Math.floor(Math.random() * n);

export const choice = (arr) => arr[randInt(arr.length)];
