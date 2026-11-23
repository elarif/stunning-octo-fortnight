export const COLORS = Object.freeze([
  { id: 'green', name: 'Vert', symbol: '✦', hex: '#7ccf9c', ink: '#14251a' },
  { id: 'pink', name: 'Rose', symbol: '♥', hex: '#f0a8d0', ink: '#2a1020' },
  { id: 'blue', name: 'Bleu', symbol: '●', hex: '#86cce8', ink: '#0d2330' },
  { id: 'red', name: 'Rouge', symbol: '■', hex: '#ef8f8f', ink: '#2a1010' },
  { id: 'orange', name: 'Orange', symbol: '▲', hex: '#f3bd7a', ink: '#2a1a08' },
]);

export const TILES = Object.freeze(
  Array.from({ length: 60 }, (_, index) => {
    const n = index + 1;
    const colorIndex = (n - 1) % 5;
    const dots = (Math.floor((n - 1) / 5) % 3) + 1;
    return Object.freeze({ n, colorIndex, color: COLORS[colorIndex], dots });
  }),
);

const BY_NUMBER = new Map(TILES.map((t) => [t.n, t]));

export function tile(n) {
  const found = BY_NUMBER.get(n);
  if (!found) throw new Error(`Tuile inconnue : ${n}`);
  return found;
}

export function tilesForColor(colorIndex) {
  return TILES.filter((t) => t.colorIndex === colorIndex);
}

export function isTileNumber(n) {
  return Number.isInteger(n) && n >= 1 && n <= 60;
}
