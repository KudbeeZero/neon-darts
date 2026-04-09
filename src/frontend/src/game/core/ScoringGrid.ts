/**
 * SCORING GRID
 * O(1) zone lookup from normalized board coordinates (radius = 1.0).
 */

export const SEGMENT_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

// Ring boundaries (normalised, board radius = 1.0)
export const BOARD_RINGS = {
  BULLSEYE_R: 0.038,
  BULL_R: 0.094,
  TRIPLE_INNER_R: 0.574,
  TRIPLE_OUTER_R: 0.629,
  DOUBLE_INNER_R: 0.945,
  DOUBLE_OUTER_R: 1.0,
} as const;

export type RingType =
  | "single"
  | "double"
  | "triple"
  | "bull"
  | "bullseye"
  | "miss";

export interface ZoneResult {
  segment: number;
  ring: RingType;
  score: number;
  label: string;
}

/**
 * Look up which scoring zone a point on the board belongs to.
 * @param nx normalised X (-1..1)
 * @param ny normalised Y (-1..1)
 */
export function lookupZone(nx: number, ny: number): ZoneResult {
  const dist = Math.sqrt(nx * nx + ny * ny);

  if (dist < BOARD_RINGS.BULLSEYE_R)
    return { segment: 25, ring: "bullseye", score: 50, label: "BULLSEYE" };
  if (dist < BOARD_RINGS.BULL_R)
    return { segment: 25, ring: "bull", score: 25, label: "BULL" };
  if (dist > BOARD_RINGS.DOUBLE_OUTER_R)
    return { segment: 0, ring: "miss", score: 0, label: "MISS" };

  // atan2(x, y) gives angle from +Y axis, increasing clockwise
  let angle = Math.atan2(nx, ny) * (180 / Math.PI) + 9; // +9° offset to align with board image
  if (angle < 0) angle += 360;

  // Segment 0 (value=20) centred at 0° (top). Each segment is 18°.
  const segIndex = Math.floor(((angle + 9) % 360) / 18) % 20;
  const segment = SEGMENT_ORDER[segIndex];

  let ring: RingType = "single";
  let multiplier = 1;

  if (dist >= BOARD_RINGS.DOUBLE_INNER_R) {
    ring = "double";
    multiplier = 2;
  } else if (
    dist >= BOARD_RINGS.TRIPLE_INNER_R &&
    dist <= BOARD_RINGS.TRIPLE_OUTER_R
  ) {
    ring = "triple";
    multiplier = 3;
  }

  const score = segment * multiplier;
  const prefix = ring === "double" ? "D" : ring === "triple" ? "T" : "";
  return { segment, ring, score, label: `${prefix}${segment}` };
}
