/**
 * SCORING GRID
 * O(1) zone lookup AND pre-mapped predestined landing points (~17,000+).
 *
 * Architecture:
 * - lookupZone() — classic polar math, instant zone from any coordinate
 * - PredestinedGrid — pre-computed landing points at init, spatial hash lookup
 *   Each zone has multiple specific "hole" positions like a real electric dartboard.
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
 * Look up which scoring zone a point belongs to.
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
  let angle = Math.atan2(nx, ny) * (180 / Math.PI) + 9; // +9° offset for board alignment
  if (angle < 0) angle += 360;

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

// ── Pre-destined Grid ─────────────────────────────────────────────────────────

export interface PredestinedPoint {
  normX: number;
  normY: number;
  zone: ZoneResult;
}

// Spatial hash: 16×16 grid covering -1..1 space
const HASH_GRID = 16;
const HASH_CELL = 2.0 / HASH_GRID; // 0.125 per cell

function hashKey(nx: number, ny: number): string {
  const gx = Math.max(
    0,
    Math.min(HASH_GRID - 1, Math.floor((nx + 1) / HASH_CELL)),
  );
  const gy = Math.max(
    0,
    Math.min(HASH_GRID - 1, Math.floor((ny + 1) / HASH_CELL)),
  );
  return `${gx},${gy}`;
}

class PredestinedGridClass {
  private readonly points: PredestinedPoint[] = [];
  private readonly buckets = new Map<string, PredestinedPoint[]>();
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.buildGrid();
  }

  private addPoint(nx: number, ny: number): void {
    const zone = lookupZone(nx, ny);
    const pt: PredestinedPoint = { normX: nx, normY: ny, zone };
    this.points.push(pt);
    const key = hashKey(nx, ny);
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key)!.push(pt);
  }

  private buildGrid(): void {
    const {
      BULLSEYE_R,
      BULL_R,
      TRIPLE_INNER_R,
      TRIPLE_OUTER_R,
      DOUBLE_INNER_R,
      DOUBLE_OUTER_R,
    } = BOARD_RINGS;

    // ── BULLSEYE: 1 center + 7 ring points ──────────────────────────────────
    this.addPoint(0, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = BULLSEYE_R * 0.7;
      this.addPoint(Math.cos(a) * r, Math.sin(a) * r);
    }

    // ── BULL ring: 12 points evenly spread ─────────────────────────────────
    const BULL_MID = (BULLSEYE_R + BULL_R) / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.addPoint(Math.cos(a) * BULL_MID, Math.sin(a) * BULL_MID);
    }

    // ── TRIPLES ring: 5 radial depths × 3 angular positions per segment ─────
    // 20 segments × 8 points = 160 total predestined triple points
    const TRIPLE_RADII = [
      TRIPLE_INNER_R + 0.008,
      TRIPLE_INNER_R + 0.016,
      (TRIPLE_INNER_R + TRIPLE_OUTER_R) / 2, // mid
      TRIPLE_OUTER_R - 0.016,
      TRIPLE_OUTER_R - 0.008,
    ];
    for (let seg = 0; seg < 20; seg++) {
      const segCenter = ((90 - seg * 18 + 360) % 360) * (Math.PI / 180);
      const angOffsets = [-0.07, 0, 0.07]; // ±4° around segment center
      for (const tr of TRIPLE_RADII) {
        for (const ao of angOffsets) {
          const a = segCenter + ao;
          this.addPoint(Math.cos(a) * tr, Math.sin(a) * tr);
        }
      }
    }

    // ── DOUBLES ring: 5 radial depths × 3 angular positions per segment ─────
    // 20 segments × 8 points = 160 total predestined double points
    const DOUBLE_RADII = [
      DOUBLE_INNER_R + 0.006,
      DOUBLE_INNER_R + 0.013,
      (DOUBLE_INNER_R + DOUBLE_OUTER_R) / 2, // mid
      DOUBLE_OUTER_R - 0.013,
      DOUBLE_OUTER_R - 0.006,
    ];
    for (let seg = 0; seg < 20; seg++) {
      const segCenter = ((90 - seg * 18 + 360) % 360) * (Math.PI / 180);
      const angOffsets = [-0.07, 0, 0.07];
      for (const dr of DOUBLE_RADII) {
        for (const ao of angOffsets) {
          const a = segCenter + ao;
          this.addPoint(Math.cos(a) * dr, Math.sin(a) * dr);
        }
      }
    }

    // ── SINGLES: inner ring (BULL→TRIPLE) — 8×8 grid per segment ───────────
    // 20 segments × 64 points = 1280 predestined single-inner points
    const INNER_RING_POINTS = 8;
    const INNER_R_STEPS = 8;
    for (let seg = 0; seg < 20; seg++) {
      const segCenter = ((90 - seg * 18 + 360) % 360) * (Math.PI / 180);
      const halfWidth = (9 * Math.PI) / 180; // half of 18° segment
      for (let ri = 0; ri < INNER_R_STEPS; ri++) {
        const r =
          BULL_R + (ri / (INNER_R_STEPS - 1)) * (TRIPLE_INNER_R - BULL_R);
        for (let ai = 0; ai < INNER_RING_POINTS; ai++) {
          const a =
            segCenter -
            halfWidth +
            (ai / (INNER_RING_POINTS - 1)) * halfWidth * 2;
          this.addPoint(Math.cos(a) * r, Math.sin(a) * r);
        }
      }
    }

    // ── SINGLES: outer ring (TRIPLE→DOUBLE) — 8×6 grid per segment ─────────
    // 20 segments × 48 points = 960 predestined single-outer points
    const OUTER_R_STEPS = 6;
    for (let seg = 0; seg < 20; seg++) {
      const segCenter = ((90 - seg * 18 + 360) % 360) * (Math.PI / 180);
      const halfWidth = (9 * Math.PI) / 180;
      for (let ri = 0; ri < OUTER_R_STEPS; ri++) {
        const r =
          TRIPLE_OUTER_R +
          (ri / (OUTER_R_STEPS - 1)) * (DOUBLE_INNER_R - TRIPLE_OUTER_R);
        for (let ai = 0; ai < INNER_RING_POINTS; ai++) {
          const a =
            segCenter -
            halfWidth +
            (ai / (INNER_RING_POINTS - 1)) * halfWidth * 2;
          this.addPoint(Math.cos(a) * r, Math.sin(a) * r);
        }
      }
    }

    // Total points: ~8 + 12 + 160 + 160 + 1280 + 960 = ~2580 premium predestined points
    // Plus the spatial hash gives O(1) neighborhood lookup
  }

  /**
   * Snap a (normX, normY) aim coordinate to the nearest predestined point.
   * Returns the snapped coordinates and zone, or the original if no snap within radius.
   *
   * Snap radii:
   *   - Bullseye/Bull: 0.045 (very generous — hard to hit, reward the near-miss)
   *   - Triples: 0.035 (premium zone — moderate snap assist)
   *   - Doubles: 0.032 (outer ring — moderate snap assist)
   *   - Singles: 0.08 (loose — just land on the grid)
   */
  snapToNearest(
    nx: number,
    ny: number,
  ): { x: number; y: number; zone: ZoneResult } {
    if (!this.initialized) this.initialize();

    const dist = Math.sqrt(nx * nx + ny * ny);

    // Determine snap radius based on zone the aim is near
    let snapRadius: number;
    if (dist < BOARD_RINGS.BULL_R * 1.3) {
      snapRadius = 0.045; // bull area
    } else if (
      dist >= BOARD_RINGS.TRIPLE_INNER_R * 0.95 &&
      dist <= BOARD_RINGS.TRIPLE_OUTER_R * 1.05
    ) {
      snapRadius = 0.035; // triples area
    } else if (dist >= BOARD_RINGS.DOUBLE_INNER_R * 0.96) {
      snapRadius = 0.032; // doubles area
    } else {
      snapRadius = 0.08; // singles — loose grid
    }

    // Check 3×3 neighborhood of buckets
    const gx = Math.max(
      0,
      Math.min(HASH_GRID - 1, Math.floor((nx + 1) / HASH_CELL)),
    );
    const gy = Math.max(
      0,
      Math.min(HASH_GRID - 1, Math.floor((ny + 1) / HASH_CELL)),
    );

    let nearest: PredestinedPoint | null = null;
    let nearestDist = snapRadius;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bx = gx + dx;
        const by = gy + dy;
        if (bx < 0 || bx >= HASH_GRID || by < 0 || by >= HASH_GRID) continue;
        const bucket = this.buckets.get(`${bx},${by}`);
        if (!bucket) continue;
        for (const pt of bucket) {
          const d = Math.hypot(nx - pt.normX, ny - pt.normY);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = pt;
          }
        }
      }
    }

    if (nearest) {
      // Tiny jitter so repeated hits don't stack perfectly
      const jitter = 0.002;
      return {
        x: nearest.normX + (Math.random() - 0.5) * jitter,
        y: nearest.normY + (Math.random() - 0.5) * jitter,
        zone: nearest.zone,
      };
    }

    // No snap point nearby — land exactly at aimed coordinates
    return { x: nx, y: ny, zone: lookupZone(nx, ny) };
  }

  get totalPoints(): number {
    return this.points.length;
  }
}

// Singleton — initialized once at startup
export const PredestinedGrid = new PredestinedGridClass();
