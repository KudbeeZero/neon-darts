/**
 * ARC PLANNER
 * Computes a fully pre-determined cubic bezier throw path in 3D.
 * The entire flight is computed ONCE at release. No per-frame physics.
 *
 * INPUT: absolute normalised aim coords (aimX, aimY in -1..1)
 *        where (-1,-1) = bottom-left of board, (1,1) = top-right
 */

import * as THREE from "three";
import { SEGMENT_ORDER, type ZoneResult, lookupZone } from "./ScoringGrid";

export const BOARD_Z = -5.0;
export const BOARD_RADIUS = 1.5; // Three.js units
export const BOARD_Y_OFFSET = 0.9; // Board center raised — sits in upper portion of screen
// Dart start: low in foreground, close to camera for big "holding" feel
export const DART_START = new THREE.Vector3(0, -1.2, 2.8);

export interface PlannedThrow {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  p3: THREE.Vector3;
  landingZone: ZoneResult;
  power: number;
  flightMs: number;
  landingPos3D: THREE.Vector3;
  isPerfect: boolean;
}

// ── Zone snap (only near premium zones) ─────────────────────────────────────

interface SnapZone {
  x: number;
  y: number;
  r: number; // snap radius in normalised board coords
}

const _snapZones: SnapZone[] = (() => {
  const zones: SnapZone[] = [
    { x: 0, y: 0, r: 0.025 }, // bullseye
    { x: 0, y: 0, r: 0.04 }, // bull
  ];
  const TRIPLE_R = 0.602;
  const DOUBLE_R = 0.972;
  for (let i = 0; i < 20; i++) {
    const angleDeg = 90 - i * 18;
    const a = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    zones.push({ x: TRIPLE_R * cos, y: TRIPLE_R * sin, r: 0.025 });
    zones.push({ x: DOUBLE_R * cos, y: DOUBLE_R * sin, r: 0.022 });
  }
  return zones;
})();

function snapToZone(nx: number, ny: number): { x: number; y: number } {
  let best: SnapZone | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const z of _snapZones) {
    const d = Math.hypot(nx - z.x, ny - z.y);
    if (d < z.r && d < bestDist) {
      best = z;
      bestDist = d;
    }
  }
  if (best) {
    const j = 0.003;
    return {
      x: best.x + (Math.random() - 0.5) * j,
      y: best.y + (Math.random() - 0.5) * j,
    };
  }
  return { x: nx, y: ny };
}

// ── Power curve ─────────────────────────────────────────────────────────────
// Lowered MIN/MAX so light flicks register easily
function computePower(velocityMag: number): number {
  const MIN = 60;
  const MAX = 800;
  const t = Math.min(Math.max(velocityMag - MIN, 0) / (MAX - MIN), 1);
  return t ** 0.6;
}

// ── Main planner ─────────────────────────────────────────────────────────────

/**
 * Plan a throw from absolute normalised aim coordinates.
 * @param aimX  - absolute board target X, -1 (full left) to +1 (full right)
 * @param aimY  - absolute board target Y, -1 (full bottom) to +1 (full top)
 * @param velocityMag - swipe speed in px/s (determines power/arc height)
 */
export function planThrow(
  aimX: number,
  aimY: number,
  velocityMag: number,
): PlannedThrow {
  // Direct board targeting — aimX/aimY already in -1..1
  const normX = Math.max(-1, Math.min(1, aimX));
  const normY = Math.max(-1, Math.min(1, aimY));

  // Zone autocorrect near premium zones
  const snapped = snapToZone(normX, normY);

  const landingX = snapped.x * BOARD_RADIUS;
  const landingY = snapped.y * BOARD_RADIUS + BOARD_Y_OFFSET;
  const landingPos3D = new THREE.Vector3(landingX, landingY, BOARD_Z);
  const landingZone = lookupZone(snapped.x, snapped.y);

  const power = computePower(velocityMag);

  // Longer hang time for soft throws — missile-like lob feel
  const flightMs = 350 + (1 - power) * 550; // 350ms (hard) to 900ms (soft)

  // Soft throw arc height: 8.0 (user spec). Hard throws are flatter: 3.5
  // ARC_HEIGHT constant: 8.0 for max (soft throw)
  const ARC_HEIGHT = 8.0;
  const arcHeight = 3.5 + (1 - power) * (ARC_HEIGHT - 3.5);

  const p0 = DART_START.clone();
  const p3 = landingPos3D.clone();

  // P1: initial outward control point — very high arc peak for missile lob
  const p1 = new THREE.Vector3(
    p0.x * 0.3 + p3.x * 0.1,
    p0.y + arcHeight * 1.6,
    0.5, // still fairly close to camera before arcing away
  );

  // P2: drops below landing point for dramatic plunge into the board
  const p2 = new THREE.Vector3(
    p0.x * 0.05 + p3.x * 0.9,
    p3.y - arcHeight * 0.5,
    -4.2,
  );

  // Perfect shot = bullseye or triple 20 (triggers cinematic camera)
  const isPerfect =
    landingZone.ring === "bullseye" ||
    landingZone.ring === "bull" ||
    (landingZone.ring === "triple" && landingZone.segment === 20);

  return {
    p0,
    p1,
    p2,
    p3,
    landingZone,
    power,
    flightMs,
    landingPos3D,
    isPerfect,
  };
}

// Re-export SEGMENT_ORDER for board drawing
export { SEGMENT_ORDER };
