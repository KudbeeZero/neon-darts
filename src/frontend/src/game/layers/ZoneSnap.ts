/**
 * ZONE SNAP LAYER
 * ---------------
 * Provides autocorrect snap toward premium scoring zones:
 * bull, bullseye, triple rings, and double rings.
 *
 * Regular single segments are NOT snapped — what you aim is what you hit.
 * Only zones within snapRadius of the intended landing point are snapped.
 *
 * Snap radii are intentionally small so throws feel free-roaming.
 * Only very close shots to premium zones get the assist.
 */

const SEGMENT_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

export interface ZoneCenter {
  x: number;
  y: number;
  label: string;
  snapRadius: number;
}

/**
 * Returns zone center points for all premium scoring zones:
 * bull, bullseye, triple ring centers, and double ring centers.
 *
 * @param cx  Board center X
 * @param cy  Board center Y
 * @param r   Board radius
 */
export function getZoneCenters(
  cx: number,
  cy: number,
  r: number,
): ZoneCenter[] {
  const centers: ZoneCenter[] = [];

  // Bull zones — tight snap radius so only very close shots snap
  centers.push({ x: cx, y: cy, label: "BULLSEYE", snapRadius: r * 0.02 });
  centers.push({ x: cx, y: cy, label: "BULL", snapRadius: r * 0.03 });

  const tripleR = r * 0.578; // midpoint of triple ring
  const doubleR = r * 0.905; // midpoint of double ring

  for (let i = 0; i < 20; i++) {
    const segAngle = (i * 18 - 90) * (Math.PI / 180); // -90 so segment 20 is at top
    const seg = SEGMENT_ORDER[i];
    centers.push({
      x: cx + Math.cos(segAngle) * tripleR,
      y: cy + Math.sin(segAngle) * tripleR,
      label: `T${seg}`,
      snapRadius: r * 0.022,
    });
    centers.push({
      x: cx + Math.cos(segAngle) * doubleR,
      y: cy + Math.sin(segAngle) * doubleR,
      label: `D${seg}`,
      snapRadius: r * 0.02,
    });
  }

  return centers;
}

/**
 * If the intended target (tx, ty) falls within snapRadius of any premium zone
 * center, snap it to that center with a tiny random jitter for realism.
 * Otherwise return the original target unchanged.
 */
export function snapToPremiumZone(
  tx: number,
  ty: number,
  centers: ZoneCenter[],
): { x: number; y: number } {
  let best: ZoneCenter | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const c of centers) {
    const d = Math.hypot(tx - c.x, ty - c.y);
    if (d < c.snapRadius && d < bestDist) {
      best = c;
      bestDist = d;
    }
  }

  if (best) {
    const j = () => (Math.random() - 0.5) * 5;
    return { x: best.x + j(), y: best.y + j() };
  }

  return { x: tx, y: ty };
}
