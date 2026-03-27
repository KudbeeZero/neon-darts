import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { DartConfig } from "../types/dart";
import DartMesh from "./DartMesh";

export interface ThrowTargetData {
  svgX: number;
  svgY: number;
  boardRect: DOMRect;
  startScreenX: number;
  startScreenY: number;
  flightDuration: number; // seconds
}

interface DartFlightProps {
  throwTargetData: ThrowTargetData | null;
  onImpact: () => void;
  dartConfig: DartConfig;
}

// Fit orthographic camera to canvas size (1 unit = 1 CSS pixel)
function CameraFit() {
  const { camera, size } = useThree();
  useEffect(() => {
    const oc = camera as THREE.OrthographicCamera;
    oc.left = -size.width / 2;
    oc.right = size.width / 2;
    oc.top = size.height / 2;
    oc.bottom = -size.height / 2;
    oc.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

type FlightState = "idle" | "flying" | "embedded";

const SPARK_COUNT = 14;
const MAX_TRAIL_POINTS = 12;

interface SparkData {
  vel: THREE.Vector3;
  life: number;
}

function DartScene({ throwTargetData, onImpact, dartConfig }: DartFlightProps) {
  const { camera, size } = useThree();
  const [flightState, setFlightState] = useState<FlightState>("idle");

  const dartGroupRef = useRef<THREE.Group>(null);
  const dartOpacity = useRef(1);
  const timeScaleRef = useRef(1);
  const startClockRef = useRef(0);
  const embeddedClockRef = useRef(0);
  const impactCalledRef = useRef(false);
  const prevTargetRef = useRef<ThrowTargetData | null>(null);

  const startPosRef = useRef(new THREE.Vector3());
  const endPosRef = useRef(new THREE.Vector3());
  const flightDurRef = useRef(0.4);

  const trailHistory = useRef<THREE.Vector3[]>([]);

  const sparkDataRef = useRef<SparkData[]>(
    Array.from({ length: SPARK_COUNT }, () => ({
      vel: new THREE.Vector3(),
      life: 0,
    })),
  );
  const sparkBasePos = useRef(new THREE.Vector3());
  const shakeRef = useRef({
    active: false,
    frames: 0,
    base: new THREE.Vector3(),
  });

  // Expose size to effect via ref so we don't need it as dep
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const trailMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(dartConfig.color),
        transparent: true,
        opacity: 0.6,
        linewidth: 1,
      }),
    [dartConfig.color],
  );

  const trailGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_POINTS * 3), 3),
    );
    return geo;
  }, []);

  const sparksGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3),
    );
    return geo;
  }, []);

  const sparksMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color(dartConfig.color),
        size: 5,
        transparent: true,
        opacity: 1,
        sizeAttenuation: false,
      }),
    [dartConfig.color],
  );

  // Detect new throw
  useEffect(() => {
    if (throwTargetData && throwTargetData !== prevTargetRef.current) {
      prevTargetRef.current = throwTargetData;
      const { width: W, height: H } = sizeRef.current;

      // Screen px -> world
      const toWorld = (px: number, py: number) =>
        new THREE.Vector3(px - W / 2, H / 2 - py, 0);

      const start = toWorld(
        throwTargetData.startScreenX,
        throwTargetData.startScreenY,
      );
      start.z = 4;

      const br = throwTargetData.boardRect;
      const bpx = br.left + (throwTargetData.svgX / 400) * br.width;
      const bpy = br.top + (throwTargetData.svgY / 400) * br.height;
      const end = toWorld(bpx, bpy);
      end.z = 0;

      startPosRef.current.copy(start);
      endPosRef.current.copy(end);
      flightDurRef.current = throwTargetData.flightDuration;

      setFlightState("flying");
      startClockRef.current = -1;
      dartOpacity.current = 1;
      timeScaleRef.current = 1;
      impactCalledRef.current = false;
      trailHistory.current = [];
      for (const s of sparkDataRef.current) s.life = 0;
    }
  }, [throwTargetData]);

  useFrame((state, delta) => {
    const dart = dartGroupRef.current;
    if (!dart) return;

    const shake = shakeRef.current;
    if (shake.active && shake.frames > 0) {
      const amt = 5 * (shake.frames / 7);
      const oc = camera as THREE.OrthographicCamera;
      oc.position.x = shake.base.x + (Math.random() - 0.5) * amt;
      oc.position.y = shake.base.y + (Math.random() - 0.5) * amt;
      shake.frames--;
      if (shake.frames === 0) {
        oc.position.copy(shake.base);
        shake.active = false;
      }
    }

    if (flightState === "idle") {
      dart.visible = false;
      const trailAttr = trailGeometry.attributes
        .position as THREE.BufferAttribute;
      (trailAttr.array as Float32Array).fill(0);
      trailAttr.needsUpdate = true;
      const sAttr = sparksGeometry.attributes.position as THREE.BufferAttribute;
      const sPos = sAttr.array as Float32Array;
      for (let i = 0; i < SPARK_COUNT; i++) sPos[i * 3 + 2] = -9999;
      sAttr.needsUpdate = true;
      return;
    }

    dart.visible = true;

    if (flightState === "flying") {
      if (startClockRef.current === -1)
        startClockRef.current = state.clock.elapsedTime;

      const elapsed =
        (state.clock.elapsedTime - startClockRef.current) *
        timeScaleRef.current;
      const rawT = elapsed / flightDurRef.current;
      const t = Math.min(rawT, 1);
      const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const start = startPosRef.current;
      const end = endPosRef.current;

      const posX = start.x + (end.x - start.x) * easeT;
      const posY = start.y + (end.y - start.y) * easeT;
      const arcY = Math.sin(t * Math.PI) * 30;
      const posZ = start.z + (end.z - start.z) * t;

      dart.position.set(posX, posY + arcY, posZ);

      const nextT = Math.min(t + 0.06, 1);
      const nEase =
        nextT < 0.5 ? 2 * nextT * nextT : -1 + (4 - 2 * nextT) * nextT;
      const nX = start.x + (end.x - start.x) * nEase;
      const nY =
        start.y + (end.y - start.y) * nEase + Math.sin(nextT * Math.PI) * 30;
      const vel = new THREE.Vector3(
        nX - posX,
        nY - (posY + arcY),
        0,
      ).normalize();
      if (vel.length() > 0.01) {
        const forward = new THREE.Vector3(0, 0, 1);
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(
          forward,
          vel,
        );
        dart.quaternion.slerp(targetQuat, 0.35);
      }

      const currentPos = dart.position.clone();
      trailHistory.current.unshift(currentPos);
      if (trailHistory.current.length > MAX_TRAIL_POINTS)
        trailHistory.current.pop();

      const trailAttr = trailGeometry.attributes
        .position as THREE.BufferAttribute;
      const arr = trailAttr.array as Float32Array;
      for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
        const p = trailHistory.current[i] ?? currentPos;
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      }
      trailAttr.needsUpdate = true;

      if (t >= 1 && !impactCalledRef.current) {
        impactCalledRef.current = true;
        dart.position.copy(end);
        dart.rotation.set(-Math.PI / 2, 0, 0);

        setFlightState("embedded");
        embeddedClockRef.current = state.clock.elapsedTime;
        trailHistory.current = [];

        sparkBasePos.current.copy(end);
        sparkDataRef.current = Array.from({ length: SPARK_COUNT }, () => {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI * 0.6;
          const speed = 120 + Math.random() * 100;
          return {
            vel: new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta) * speed,
              Math.sin(phi) * Math.sin(theta) * speed,
              Math.abs(Math.cos(phi)) * speed * 0.2,
            ),
            life: 1,
          };
        });

        const oc = camera as THREE.OrthographicCamera;
        shakeRef.current = {
          active: true,
          frames: 7,
          base: oc.position.clone(),
        };
        timeScaleRef.current = 0.07;
        setTimeout(() => {
          timeScaleRef.current = 1;
        }, 65);
        onImpact();

        const trailA = trailGeometry.attributes
          .position as THREE.BufferAttribute;
        (trailA.array as Float32Array).fill(0);
        trailA.needsUpdate = true;
      }
    }

    if (flightState === "embedded") {
      const elapsed = state.clock.elapsedTime - embeddedClockRef.current;

      const sArr = sparksGeometry.attributes.position as THREE.BufferAttribute;
      const sPos = sArr.array as Float32Array;
      for (let i = 0; i < sparkDataRef.current.length; i++) {
        const spark = sparkDataRef.current[i];
        if (spark.life > 0) {
          spark.life = Math.max(0, spark.life - delta * 3.5);
          spark.vel.multiplyScalar(0.87);
          const base = sparkBasePos.current;
          sPos[i * 3] = base.x + spark.vel.x * delta;
          sPos[i * 3 + 1] = base.y + spark.vel.y * delta;
          sPos[i * 3 + 2] = base.z + spark.vel.z * delta;
        } else {
          sPos[i * 3 + 2] = -9999;
        }
      }
      sArr.needsUpdate = true;

      const avgLife =
        sparkDataRef.current.reduce((acc, s) => acc + s.life, 0) / SPARK_COUNT;
      sparksMaterial.opacity = Math.max(0, avgLife * 1.3);

      if (elapsed > 1.2)
        dartOpacity.current = Math.max(0, 1 - (elapsed - 1.2) / 0.6);
      if (elapsed > 1.8) {
        setFlightState("idle");
        dart.visible = false;
      }
    }
  });

  return (
    <>
      <CameraFit />
      <ambientLight intensity={0.4} />
      <pointLight
        position={[0, 0, 50]}
        intensity={1.5}
        color={dartConfig.color}
      />
      <pointLight position={[0, 200, 40]} intensity={1} color="#ffffff" />

      <group ref={dartGroupRef} visible={flightState !== "idle"}>
        <DartMesh
          color={dartConfig.color}
          barrelRadius={dartConfig.barrelRadius}
          flightSize={dartConfig.flightSize}
          opacity={dartOpacity.current}
        />
      </group>

      <primitive object={new THREE.Line(trailGeometry, trailMaterial)} />

      <points>
        <primitive object={sparksGeometry} />
        <primitive object={sparksMaterial} />
      </points>
    </>
  );
}

export default function DartFlight({
  throwTargetData,
  onImpact,
  dartConfig,
}: DartFlightProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <Canvas
        orthographic
        camera={{ zoom: 1, position: [0, 0, 10], near: 0.1, far: 2000 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent", width: "100%", height: "100%" }}
      >
        <DartScene
          throwTargetData={throwTargetData}
          onImpact={onImpact}
          dartConfig={dartConfig}
        />
      </Canvas>
    </div>
  );
}
