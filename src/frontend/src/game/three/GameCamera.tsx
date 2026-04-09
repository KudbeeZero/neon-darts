import { useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

export interface GameCameraHandle {
  startThrow: (
    landingPos: THREE.Vector3,
    flightMs: number,
    isPerfect: boolean,
  ) => void;
  onImpact: () => void;
}

type CamMode =
  | "idle"
  | "gentle_zoom"
  | "perfect_zoom"
  | "shaking"
  | "returning";

interface CamState {
  mode: CamMode;
  startTime: number;
  flightMs: number;
  shakeStartTime: number;
  returnStartFov: number;
  returnStartX: number;
  returnStartY: number;
  returnStartZ: number;
}

// ── Camera constants — Darts of Fury first-person perspective ────────────────
// Board fills upper 55-60% of screen, dart/flights visible at bottom center.
// Camera Y raised: 0.5 (up from 0.3) — board appears higher on screen.
// Camera Z: 4.8 (slightly back from 4.5) — more depth/distance feel.
// FOV: 62 — slightly wider to show flights at bottom without distortion.
const IDLE_FOV = 62;
const IDLE_POS_Y = 0.5;
const IDLE_POS_Z = 4.8;

// Every throw: gentle push-in (Darts of Fury always zooms slightly)
const GENTLE_ZOOM_FOV = 54;
const GENTLE_ZOOM_Z = 4.2;

// Perfect shots (bullseye / triple 20): dramatic cinematic zoom
const PERFECT_ZOOM_FOV = 40;
const PERFECT_ZOOM_Z = 4.3;

const GameCamera = forwardRef<GameCameraHandle, object>(
  function GameCamera(_, ref) {
    const { camera } = useThree();

    const camState = useRef<CamState>({
      mode: "idle",
      startTime: 0,
      flightMs: 400,
      shakeStartTime: 0,
      returnStartFov: IDLE_FOV,
      returnStartX: 0,
      returnStartY: IDLE_POS_Y,
      returnStartZ: IDLE_POS_Z,
    });

    useImperativeHandle(ref, () => ({
      startThrow(
        _landingPos: THREE.Vector3,
        flightMs: number,
        isPerfect: boolean,
      ) {
        const s = camState.current;
        s.mode = isPerfect ? "perfect_zoom" : "gentle_zoom";
        s.startTime = Date.now();
        s.flightMs = flightMs;
      },
      onImpact() {
        const s = camState.current;
        s.mode = "shaking";
        s.shakeStartTime = Date.now();
      },
    }));

    useFrame(() => {
      const s = camState.current;
      const cam = camera as THREE.PerspectiveCamera;
      const now = Date.now();

      if (s.mode === "gentle_zoom") {
        // Smooth push-in: FOV 62→54, Z 4.8→4.2 over full flight duration
        const t = Math.min(1, (now - s.startTime) / s.flightMs);
        const eased = t * t * (3 - 2 * t); // smoothstep
        cam.fov = THREE.MathUtils.lerp(IDLE_FOV, GENTLE_ZOOM_FOV, eased);
        cam.position.z = THREE.MathUtils.lerp(IDLE_POS_Z, GENTLE_ZOOM_Z, eased);
        cam.updateProjectionMatrix();
      } else if (s.mode === "perfect_zoom") {
        // Dramatic zoom for perfect shots: FOV 62→40
        const t = Math.min(1, (now - s.startTime) / s.flightMs);
        const eased = t * t; // ease-in for drama
        cam.fov = THREE.MathUtils.lerp(IDLE_FOV, PERFECT_ZOOM_FOV, eased);
        cam.position.z = THREE.MathUtils.lerp(
          IDLE_POS_Z,
          PERFECT_ZOOM_Z,
          eased,
        );
        cam.updateProjectionMatrix();
      } else if (s.mode === "shaking") {
        const elapsed = now - s.shakeStartTime;
        if (elapsed < 320) {
          const intensity = 0.013 * (1 - elapsed / 320);
          cam.position.x = (Math.random() - 0.5) * intensity * 2;
          cam.position.y = IDLE_POS_Y + (Math.random() - 0.5) * intensity * 2;
        } else {
          s.mode = "returning";
          s.startTime = now;
          s.returnStartFov = cam.fov;
          s.returnStartX = cam.position.x;
          s.returnStartY = cam.position.y;
          s.returnStartZ = cam.position.z;
        }
      } else if (s.mode === "returning") {
        const t = Math.min(1, (now - s.startTime) / 700);
        const eased = 1 - (1 - t) * (1 - t);
        cam.fov = THREE.MathUtils.lerp(s.returnStartFov, IDLE_FOV, eased);
        cam.position.x = THREE.MathUtils.lerp(s.returnStartX, 0, eased);
        cam.position.y = THREE.MathUtils.lerp(
          s.returnStartY,
          IDLE_POS_Y,
          eased,
        );
        cam.position.z = THREE.MathUtils.lerp(
          s.returnStartZ,
          IDLE_POS_Z,
          eased,
        );
        cam.updateProjectionMatrix();
        if (t >= 1) s.mode = "idle";
      }
    });

    return null;
  },
);

export default GameCamera;
