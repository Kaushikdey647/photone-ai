/** Parse Adobe .cube LUT (ASCII). Returns size N and RGBA bytes for texImage3D (RGBA8). */
export function parseCubeFile(text: string): { size: number; data: Uint8Array } {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let size = 0;
  const rgb: number[] = [];
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    if (line.toUpperCase().startsWith("TITLE")) continue;
    const upper = line.toUpperCase();
    if (upper.startsWith("LUT_3D_SIZE")) {
      const parts = line.split(/\s+/);
      size = parseInt(parts[1] ?? "0", 10);
      continue;
    }
    if (upper.startsWith("DOMAIN_")) continue;
    const nums = line.split(/\s+/).map(Number);
    if (nums.length >= 3 && nums.every((n) => Number.isFinite(n))) {
      rgb.push(nums[0], nums[1], nums[2]);
    }
  }
  const n = size;
  if (n < 2 || rgb.length < n * n * n * 3) {
    throw new Error("Invalid or unsupported .cube file");
  }
  const data = new Uint8Array(n * n * n * 4);
  // Adobe order: R fastest, then G, then B — index i = r + g*n + b*n*n
  for (let b = 0; b < n; b++) {
    for (let g = 0; g < n; g++) {
      for (let r = 0; r < n; r++) {
        const fi = (r + g * n + b * n * n) * 3;
        const R = Math.round(clamp01(rgb[fi]) * 255);
        const G = Math.round(clamp01(rgb[fi + 1]) * 255);
        const B = Math.round(clamp01(rgb[fi + 2]) * 255);
        const o = (r + g * n + b * n * n) * 4;
        data[o] = R;
        data[o + 1] = G;
        data[o + 2] = B;
        data[o + 3] = 255;
      }
    }
  }
  return { size: n, data };
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
