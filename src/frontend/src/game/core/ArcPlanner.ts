/**
 * ARC PLANNER
 * Computes a fully pre-determined cubic bezier throw path in 3D.
 * The entire flight is computed ONCE at release. No per-frame physics.
 */

import * as THREE from "three";
import { SEGMENT_ORDER, type ZoneResult, lookupZone } from "./ScoringGrid";

export const BOARD_Z = -5.0;
export const BOARD_RADIUS = 1.5; // Three.js units
export const DART_START = new THREE.Vector3(0, -0.3, -1.5);

export interface PlannedThrow {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  p3: THREE.Vector3;
  landingZone: ZoneResult;
  power: number;
  flightMs: number;
  landingPos3D: THREE.Vector3;
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

function computePower(velocityMag: number): number {
  const MIN = 150;
  const MAX = 1500;
  const t = Math.min(Math.max(velocityMag - MIN, 0) / (MAX - MIN), 1);
  return t ** 0.6;
}

// ── Main planner ─────────────────────────────────────────────────────────────

/**
 * Plan a throw from touch input.
 * @param touchX - X position where touch started (screen pixels)
 * @param touchY - Y position where touch started
 * @param velocityMag - swipe speed in px/s
 * @param screenW - window.innerWidth
 * @param screenH - window.innerHeight
 */
export function planThrow(
  touchX: number,
  touchY: number,
  velocityMag: number,
  screenW: number,
  screenH: number,
): PlannedThrow {
  // Map screen position to normalised board coordinates
  // Board centre projects to approximately (screenW/2, screenH*0.5)
  const normX = (touchX - screenW * 0.5) / (screenW * 0.42);
  const normY = -((touchY - screenH * 0.48) / (screenH * 0.42));

  // Clamp to board edge
  const clampedX = Math.max(-0.98, Math.min(0.98, normX));
  const clampedY = Math.max(-0.98, Math.min(0.98, normY));

  // Zone autocorrect near premium zones
  const snapped = snapToZone(clampedX, clampedY);

  const landingX = snapped.x * BOARD_RADIUS;
  const landingY = snapped.y * BOARD_RADIUS;
  const landingPos3D = new THREE.Vector3(landingX, landingY, BOARD_Z);
  const landingZone = lookupZone(snapped.x, snapped.y);

  const power = computePower(velocityMag);
  const flightMs = 320 + (1 - power) * 300; // 320–620 ms

  // Bezier control points — create a natural parabolic arc
  // p0: dart start (low foreground)
  // p1: early lift (near start, pulled up)
  // p2: late apex (near end, still elevated)
  // p3: landing on board
  const p0 = DART_START.clone();
  const p3 = landingPos3D.clone();

  const arcHeight = 0.35 + (1 - power) * 1.1; // 0.35 (hard) to 1.45 (soft)

  const p1 = new THREE.Vector3(
    p0.x * 0.5 + p3.x * 0.15,
    p0.y + arcHeight * 0.9,
    -2.4,
  );
  const p2 = new THREE.Vector3(
    p0.x * 0.1 + p3.x * 0.85,
    p3.y + arcHeight * 0.45,
    -4.0,
  );

  return { p0, p1, p2, p3, landingZone, power, flightMs, landingPos3D };
}

// Re-export SEGMENT_ORDER for board drawing
export { SEGMENT_ORDER };
