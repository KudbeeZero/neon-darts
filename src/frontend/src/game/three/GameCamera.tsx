import { useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

export interface GameCameraHandle {
  startThrow: (landingPos: THREE.Vector3, flightMs: number) => void;
  onImpact: () => void;
}

type CamMode = "idle" | "zooming" | "shaking" | "returning";

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

// Camera constants — first-person Darts of Fury feel
const IDLE_FOV = 65;
const IDLE_POS_Y = 0.3;
const IDLE_POS_Z = 4.5;
const PERFECT_ZOOM_FOV = 42;

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
      // Only call this for perfect shots — triggers dramatic zoom
      startThrow(_landingPos: THREE.Vector3, flightMs: number) {
        const s = camState.current;
        s.mode = "zooming";
        s.startTime = Date.now();
        s.flightMs = flightMs;
      },
      // Always called on impact — triggers screen shake
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

      if (s.mode === "zooming") {
        const t = Math.min(1, (now - s.startTime) / s.flightMs);
        // Dramatic zoom for perfect shots: FOV 65→42, slight push forward
        cam.fov = THREE.MathUtils.lerp(IDLE_FOV, PERFECT_ZOOM_FOV, t * t);
        cam.position.z = THREE.MathUtils.lerp(
          IDLE_POS_Z,
          IDLE_POS_Z - 0.4,
          t * t,
        );
        cam.updateProjectionMatrix();
      } else if (s.mode === "shaking") {
        const elapsed = now - s.shakeStartTime;
        if (elapsed < 320) {
          const intensity = 0.012 * (1 - elapsed / 320);
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
