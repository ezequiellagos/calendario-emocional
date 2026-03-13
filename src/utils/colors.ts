function normalizeHex(hex: string) {
  const safeHex = hex.replace('#', '');
  return safeHex.length === 3
    ? safeHex.split('').map((value) => `${value}${value}`).join('')
    : safeHex;
}

export function toRgba(hex: string, alpha: number) {
  const normalized = normalizeHex(hex);

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getContrastColor(hex: string) {
  const normalized = normalizeHex(hex);

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? '#1f1a17' : '#fffaf4';
}

export function buildEmotionGradient(colors: string[], alpha = 1) {
  if (colors.length === 0) {
    return undefined;
  }

  if (colors.length === 1) {
    return undefined;
  }

  const segmentSize = 100 / colors.length;
  const segments = colors.map((color, index) => {
    const start = segmentSize * index;
    const end = segmentSize * (index + 1);
    return `${toRgba(color, alpha)} ${start}% ${end}%`;
  });

  return `conic-gradient(${segments.join(', ')})`;
}