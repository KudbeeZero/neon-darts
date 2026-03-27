import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BOARD_RADIUS, BOARD_Z } from "../core/ArcPlanner";
import { BOARD_RINGS, SEGMENT_ORDER } from "../core/ScoringGrid";

function createRingSector(
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
  nSegs = 18,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const startA = (startDeg * Math.PI) / 180;
  const endA = (endDeg * Math.PI) / 180;

  for (let i = 0; i <= nSegs; i++) {
    const a = startA + ((endA - startA) * i) / nSegs;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    positions.push(innerR * cos, innerR * sin, 0);
    normals.push(0, 0, 1);
    positions.push(outerR * cos, outerR * sin, 0);
    normals.push(0, 0, 1);
  }

  for (let i = 0; i < nSegs; i++) {
    const b = i * 2;
    indices.push(b, b + 2, b + 1);
    indices.push(b + 1, b + 2, b + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

function makeNumberSprite(num: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "white";
  ctx.font = "bold 38px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, sizeAttenuation: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.15, 0.15, 0.15);
  return sprite;
}

function buildBoardObjects(): THREE.Object3D[] {
  const R = BOARD_RADIUS;
  const objects: THREE.Object3D[] = [];

  const BE_R = BOARD_RINGS.BULLSEYE_R * R;
  const BULL_R = BOARD_RINGS.BULL_R * R;
  const TI_R = BOARD_RINGS.TRIPLE_INNER_R * R;
  const TO_R = BOARD_RINGS.TRIPLE_OUTER_R * R;
  const DI_R = BOARD_RINGS.DOUBLE_INNER_R * R;
  const DO_R = BOARD_RINGS.DOUBLE_OUTER_R * R;

  for (let i = 0; i < 20; i++) {
    const centre = 90 - i * 18;
    const sA = centre - 9;
    const eA = centre + 9;
    const even = i % 2 === 0;

    const darkA = even ? "#0b0b22" : "#080814";
    const darkB = even ? "#090918" : "#060610";

    objects.push(
      new THREE.Mesh(
        createRingSector(BULL_R, TI_R, sA, eA),
        new THREE.MeshStandardMaterial({ color: darkA, roughness: 0.9 }),
      ),
    );
    objects.push(
      new THREE.Mesh(
        createRingSector(TO_R, DI_R, sA, eA),
        new THREE.MeshStandardMaterial({ color: darkB, roughness: 0.9 }),
      ),
    );

    const tripleColor = even ? "#00ccff" : "#ff00aa";
    objects.push(
      new THREE.Mesh(
        createRingSector(TI_R, TO_R, sA, eA),
        new THREE.MeshStandardMaterial({
          color: tripleColor,
          emissive: tripleColor,
          emissiveIntensity: 0.55,
          roughness: 0.25,
          metalness: 0.15,
        }),
      ),
    );

    const doubleColor = even ? "#ff4400" : "#cc0033";
    objects.push(
      new THREE.Mesh(
        createRingSector(DI_R, DO_R, sA, eA),
        new THREE.MeshStandardMaterial({
          color: doubleColor,
          emissive: doubleColor,
          emissiveIntensity: 0.55,
          roughness: 0.25,
          metalness: 0.15,
        }),
      ),
    );
  }

  objects.push(
    new THREE.Mesh(
      new THREE.CircleGeometry(BULL_R, 40),
      new THREE.MeshStandardMaterial({
        color: "#00aa44",
        emissive: "#00aa44",
        emissiveIntensity: 0.5,
      }),
    ),
  );

  const bullseyeMesh = new THREE.Mesh(
    new THREE.CircleGeometry(BE_R, 32),
    new THREE.MeshStandardMaterial({
      color: "#ff2200",
      emissive: "#ff2200",
      emissiveIntensity: 0.7,
    }),
  );
  bullseyeMesh.position.z = 0.001;
  objects.push(bullseyeMesh);

  const back = new THREE.Mesh(
    new THREE.CircleGeometry(R * 1.12, 64),
    new THREE.MeshStandardMaterial({ color: "#030308", roughness: 1.0 }),
  );
  back.position.z = -0.015;
  objects.push(back);

  objects.push(
    new THREE.Mesh(
      new THREE.TorusGeometry(R * 1.002, 0.009, 8, 100),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#8888ff",
        emissiveIntensity: 0.8,
      }),
    ),
  );

  objects.push(
    new THREE.Mesh(
      new THREE.TorusGeometry(R * 1.014, 0.007, 8, 100),
      new THREE.MeshStandardMaterial({
        color: "#4444ff",
        emissive: "#4444ff",
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.5,
      }),
    ),
  );

  const LABEL_R = R * 1.14;
  for (let i = 0; i < 20; i++) {
    const angleDeg = 90 - i * 18;
    const a = (angleDeg * Math.PI) / 180;
    const sprite = makeNumberSprite(SEGMENT_ORDER[i]);
    sprite.position.set(Math.cos(a) * LABEL_R, Math.sin(a) * LABEL_R, 0.02);
    objects.push(sprite);
  }

  return objects;
}

const DartboardMesh = memo(function DartboardMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const objects = useMemo(() => buildBoardObjects(), []);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    for (const o of objects) g.add(o);
    return () => {
      for (const o of objects) g.remove(o);
    };
  }, [objects]);

  return <group ref={groupRef} position={[0, 0, BOARD_Z]} />;
});

export default DartboardMesh;
