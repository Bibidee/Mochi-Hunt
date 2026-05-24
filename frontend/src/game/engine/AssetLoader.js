// ==================== Asset preloading ====================
// Loads images up front so the first frame never draws a missing sprite.

const cache = new Map();

export function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
  cache.set(src, p);
  return p;
}

// Preload a set of named assets; resolves to a map { name: HTMLImageElement }.
// Individual failures are tolerated (the renderer has vector fallbacks).
export async function preloadAll(manifest) {
  const entries = await Promise.all(
    Object.entries(manifest).map(async ([name, src]) => {
      try {
        return [name, await loadImage(src)];
      } catch (err) {
        console.warn('[assets]', err.message);
        return [name, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}
