export interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max));

/** Where a window of `card` size sits in the overlay: where it was left, or centred, always on-screen. */
export const place = (card: Size, view: Size, at?: Point, cascade = 0): Point => ({
  x: clamp(at?.x ?? (view.width - card.width) / 2 + cascade * 32, view.width - card.width),
  y: clamp(at?.y ?? (view.height - card.height) / 2 + cascade * 32, view.height - card.height),
});

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function nudge(at: Point, key: string, far: boolean): Point | undefined {
  const arrow = ARROWS[key];
  const step = far ? 50 : 10;
  return arrow && { x: at.x + arrow[0] * step, y: at.y + arrow[1] * step };
}
