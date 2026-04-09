/**
 * ARC PLANNER
 * Computes a fully pre-determined cubic bezier throw path in 3D.
 * The entire flight is computed ONCE at release. No per-frame physics.
 *
 * At throw release:
 * 1. Snaps aim to nearest predestined landing point (PredestinedGrid)
 * 2. Solves full bezier arc (P0 → P1 → P2 → P3)
 * 3. Camera and scoring system immediately know the landing plot
 */

import * as THREE from "three";
import { PredestinedGrid, type ZoneResult } from "./ScoringGrid";

export const BOARD_Z = -5.0;
export const BOARD_RADIUS = 1.5; // Three.js world units
export const BOARD_Y_OFFSET = 0.9; // Board center raised — upper portion of screen
// Dart start: close to camera, higher in frame — tip visible ~60px from bottom
export const DART_START = new THREE.Vector3(0, -0.5, 2.2);

// Initialize grid at module load (runs once, lazy-computed in ScoringGrid)
PredestinedGrid.initialize();

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

// ── Power curve ───────────────────────────────────────────────────────────────
// Low MIN threshold: light flicks register easily (like Darts of Fury)
function computePower(velocityMag: number): number {
  const MIN = 50;
  const MAX = 750;
  const t = Math.min(Math.max(velocityMag - MIN, 0) / (MAX - MIN), 1);
  return t ** 0.55; // slight remap for arcade feel
}

// ── Main planner ──────────────────────────────────────────────────────────────

/**
 * Plan a throw from normalised aim coordinates.
 * @param aimX  - absolute board target X, -1 (full left) to +1 (full right)
 * @param aimY  - absolute board target Y, -1 (full bottom) to +1 (full top)
 * @param velocityMag - swipe speed px/s (determines power/arc height)
 */
export function planThrow(
  aimX: number,
  aimY: number,
  velocityMag: number,
): PlannedThrow {
  const normX = Math.max(-1, Math.min(1, aimX));
  const normY = Math.max(-1, Math.min(1, aimY));

  // Snap aim to nearest predestined landing point (~17k+ pre-mapped points)
  // This replaces the simple premium-only snap with a full board coverage system
  const snapped = PredestinedGrid.snapToNearest(normX, normY);

  const landingX = snapped.x * BOARD_RADIUS;
  const landingY = snapped.y * BOARD_RADIUS + BOARD_Y_OFFSET;
  const landingPos3D = new THREE.Vector3(landingX, landingY, BOARD_Z);
  const landingZone = snapped.zone;

  const power = computePower(velocityMag);

  // Flight duration: 380ms (hard/flat) to 950ms (soft/loopy missile arc)
  const flightMs = 380 + (1 - power) * 570;

  // Arc height: dramatic missile lob (8.0) for soft throws, flat (3.5) for hard
  const arcHeight = 3.5 + (1 - power) * 4.5;

  const p0 = DART_START.clone();
  const p3 = landingPos3D.clone();

  // P1: outward control — high arc peak for missile lob feel
  const p1 = new THREE.Vector3(
    p0.x * 0.3 + p3.x * 0.1,
    p0.y + arcHeight * 1.6,
    0.4, // close to camera before arcing away
  );

  // P2: drops below landing for dramatic plunge into the board
  const p2 = new THREE.Vector3(
    p0.x * 0.05 + p3.x * 0.9,
    p3.y - arcHeight * 0.5,
    -4.2,
  );

  // Clamp P2.z: prevent arc from going past board plane (causes backward-facing dart)
  if (p2.z < BOARD_Z + 0.3) {
    p2.z = BOARD_Z + 0.3;
  }

  // Perfect shot = bullseye / bull / triple 20 → triggers cinematic camera
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
