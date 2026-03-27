import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import DartMesh from "./DartMesh";

interface ThrowTarget {
  svgX: number;
  svgY: number;
}

interface DartFlightProps {
  throwTarget: ThrowTarget | null;
  onImpact: () => void;
  dartColor: string;
}

// SVG coords (0-400) to world coords (-200 to 200)
function svgToWorld(svgX: number, svgY: number): [number, number] {
  return [svgX - 200, 200 - svgY];
}

type FlightState = "idle" | "flying" | "embedded";

interface SparkData {
  vel: THREE.Vector3;
  life: number;
}

const FLIGHT_DURATION = 0.26; // seconds
const MAX_TRAIL_POINTS = 10;
const SPARK_COUNT = 12;

function DartScene({ throwTarget, onImpact, dartColor }: DartFlightProps) {
  const { camera } = useThree();
  const [flightState, setFlightState] = useState<FlightState>("idle");

  const dartGroupRef = useRef<THREE.Group>(null);
  const dartOpacity = useRef(1);
  const timeScaleRef = useRef(1);
  const startClockRef = useRef(0);
  const embeddedClockRef = useRef(0);
  const impactCalledRef = useRef(false);
  const prevTargetRef = useRef<ThrowTarget | null>(null);

  // Trail
  const trailHistory = useRef<THREE.Vector3[]>([]);

  // Spark data
  const sparkDataRef = useRef<SparkData[]>(
    Array.from({ length: SPARK_COUNT }, () => ({
      vel: new THREE.Vector3(),
      life: 0,
    })),
  );
  const sparkBasePos = useRef(new THREE.Vector3());

  // Camera shake
  const shakeRef = useRef({
    active: false,
    frames: 0,
    base: new THREE.Vector3(),
  });

  const trailMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(dartColor),
        transparent: true,
        opacity: 0.55,
        linewidth: 1,
      }),
    [dartColor],
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
        color: new THREE.Color(dartColor),
        size: 4,
        transparent: true,
        opacity: 1,
        sizeAttenuation: false,
      }),
    [dartColor],
  );

  // Detect new throw
  useEffect(() => {
    if (throwTarget && throwTarget !== prevTargetRef.current) {
      prevTargetRef.current = throwTarget;
      setFlightState("flying");
      startClockRef.current = -1;
      dartOpacity.current = 1;
      timeScaleRef.current = 1;
      impactCalledRef.current = false;
      trailHistory.current = [];
      // Hide sparks
      for (const s of sparkDataRef.current) {
        s.life = 0;
      }
    }
  }, [throwTarget]);

  useFrame((state, delta) => {
    const dart = dartGroupRef.current;
    if (!dart) return;

    // Camera shake update
    const shake = shakeRef.current;
    if (shake.active && shake.frames > 0) {
      const amt = 4 * (shake.frames / 6);
      camera.position.x = shake.base.x + (Math.random() - 0.5) * amt;
      camera.position.y = shake.base.y + (Math.random() - 0.5) * amt;
      shake.frames--;
      if (shake.frames === 0) {
        camera.position.copy(shake.base);
        shake.active = false;
      }
    }

    if (flightState === "idle") {
      dart.visible = false;
      // Hide trail
      const trailAttr = trailGeometry.attributes
        .position as THREE.BufferAttribute;
      (trailAttr.array as Float32Array).fill(0);
      trailAttr.needsUpdate = true;
      // Hide sparks off-screen
      const sAttr = sparksGeometry.attributes.position as THREE.BufferAttribute;
      const sPos = sAttr.array as Float32Array;
      for (let i = 0; i < SPARK_COUNT; i++) {
        sPos[i * 3] = 0;
        sPos[i * 3 + 1] = 0;
        sPos[i * 3 + 2] = -200;
      }
      sAttr.needsUpdate = true;
      return;
    }

    dart.visible = true;

    if (flightState === "flying" && throwTarget) {
      if (startClockRef.current === -1) {
        startClockRef.current = state.clock.elapsedTime;
      }

      const elapsed =
        (state.clock.elapsedTime - startClockRef.current) *
        timeScaleRef.current;
      const t = Math.min(elapsed / FLIGHT_DURATION, 1);

      const startX = 0;
      const startY = -185;
      const startZ = 7;
      const [endX, endY] = svgToWorld(throwTarget.svgX, throwTarget.svgY);
      const endZ = 0;

      const posX = startX + (endX - startX) * t;
      const posY = startY + (endY - startY) * t;
      const arcZ = Math.sin(t * Math.PI) * 2.5;
      const posZ = startZ + (endZ - startZ) * t + arcZ;

      dart.position.set(posX, posY, posZ);

      // Rotate dart to face velocity
      const nextT = Math.min(t + 0.05, 1);
      const nX = startX + (endX - startX) * nextT;
      const nY = startY + (endY - startY) * nextT;
      const nZ =
        startZ + (endZ - startZ) * nextT + Math.sin(nextT * Math.PI) * 2.5;
      const vel = new THREE.Vector3(
        nX - posX,
        nY - posY,
        nZ - posZ,
      ).normalize();
      const forward = new THREE.Vector3(0, 0, 1);
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(
        forward,
        vel,
      );
      dart.quaternion.slerp(targetQuat, 0.3);

      // Update trail
      const currentPos = new THREE.Vector3(posX, posY, posZ);
      trailHistory.current.unshift(currentPos.clone());
      if (trailHistory.current.length > MAX_TRAIL_POINTS) {
        trailHistory.current.pop();
      }

      const trailAttr = trailGeometry.attributes
        .position as THREE.BufferAttribute;
      const arr = trailAttr.array as Float32Array;
      for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
        const p = trailHistory.current[i];
        if (p) {
          arr[i * 3] = p.x;
          arr[i * 3 + 1] = p.y;
          arr[i * 3 + 2] = p.z;
        } else {
          arr[i * 3] = currentPos.x;
          arr[i * 3 + 1] = currentPos.y;
          arr[i * 3 + 2] = currentPos.z;
        }
      }
      trailAttr.needsUpdate = true;

      if (t >= 1 && !impactCalledRef.current) {
        impactCalledRef.current = true;
        dart.position.set(endX, endY, -0.05);
        dart.quaternion.set(0, 0, 0, 1);
        dart.rotation.set(-Math.PI / 2, 0, 0); // tip into board

        setFlightState("embedded");
        embeddedClockRef.current = state.clock.elapsedTime;
        trailHistory.current = [];

        // Spark burst
        sparkBasePos.current.set(endX, endY, 0);
        sparkDataRef.current = Array.from({ length: SPARK_COUNT }, () => {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          const speed = 80 + Math.random() * 80;
          return {
            vel: new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta) * speed,
              Math.sin(phi) * Math.sin(theta) * speed,
              Math.abs(Math.cos(phi)) * speed * 0.3,
            ),
            life: 1,
          };
        });

        // Camera shake
        shakeRef.current = {
          active: true,
          frames: 6,
          base: camera.position.clone(),
        };

        // Slow-mo pulse: compress time then snap back
        timeScaleRef.current = 0.08;
        setTimeout(() => {
          timeScaleRef.current = 1;
        }, 65);

        onImpact();

        // Clear trail line
        const trailA = trailGeometry.attributes
          .position as THREE.BufferAttribute;
        (trailA.array as Float32Array).fill(0);
        trailA.needsUpdate = true;
      }
    }

    if (flightState === "embedded") {
      const elapsed = state.clock.elapsedTime - embeddedClockRef.current;

      // Update sparks
      const sArr = sparksGeometry.attributes.position as THREE.BufferAttribute;
      const sPos = sArr.array as Float32Array;
      for (let i = 0; i < sparkDataRef.current.length; i++) {
        const spark = sparkDataRef.current[i];
        if (spark.life > 0) {
          spark.life = Math.max(0, spark.life - delta * 3.5);
          spark.vel.multiplyScalar(0.88);
          const base = sparkBasePos.current;
          sPos[i * 3] = base.x + spark.vel.x * delta;
          sPos[i * 3 + 1] = base.y + spark.vel.y * delta;
          sPos[i * 3 + 2] = base.z + spark.vel.z * delta;
        } else {
          sPos[i * 3] = 0;
          sPos[i * 3 + 1] = 0;
          sPos[i * 3 + 2] = -200;
        }
      }
      sArr.needsUpdate = true;

      // Update spark material opacity
      const avgLife =
        sparkDataRef.current.reduce((acc, s) => acc + s.life, 0) / SPARK_COUNT;
      sparksMaterial.opacity = Math.max(0, avgLife * 1.2);

      // Fade dart after 1.2s
      if (elapsed > 1.2) {
        dartOpacity.current = Math.max(0, 1 - (elapsed - 1.2) / 0.6);
      }

      if (elapsed > 1.8) {
        setFlightState("idle");
        dart.visible = false;
      }
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 20]} intensity={2} color="#00e8ff" />
      <pointLight position={[0, 100, 15]} intensity={1.2} color="#ffffff" />

      {/* Dart mesh */}
      <group ref={dartGroupRef} visible={flightState !== "idle"}>
        <DartMesh
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          color={dartColor}
          opacity={dartOpacity.current}
        />
      </group>

      {/* Neon trail */}
      <primitive object={new THREE.Line(trailGeometry, trailMaterial)} />

      {/* Spark particles */}
      <points>
        <primitive object={sparksGeometry} />
        <primitive object={sparksMaterial} />
      </points>
    </>
  );
}

export default function DartFlight({
  throwTarget,
  onImpact,
  dartColor,
}: DartFlightProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <Canvas
        orthographic
        camera={{
          left: -200,
          right: 200,
          top: 200,
          bottom: -200,
          near: 0.1,
          far: 500,
          position: [0, 0, 20],
        }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <DartScene
          throwTarget={throwTarget}
          onImpact={onImpact}
          dartColor={dartColor}
        />
      </Canvas>
    </div>
  );
}
