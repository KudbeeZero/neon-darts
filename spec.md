# Neon Darts — Dart Mesh, 3D Flight & Impact System

## Current State
- Full 301 game with accurate hit detection via 2D SVG dartboard
- Dart throws are represented as small SVG circle markers on the board
- Input: drag-to-aim on the SVG canvas, release to throw
- Audio: minimal Web Audio API synth (throw only)
- No 3D dart mesh, no flight animation, no impact particles, no Tone.js

## Requested Changes (Diff)

### Add
- React Three Fiber canvas overlay (absolute, over the board, pointer-events: none) rendering the animated 3D dart during each throw
- 3D dart mesh: metallic tip (ConeGeometry), barrel (CylinderGeometry with neon emissive band), shaft (thin CylinderGeometry), flights (4x PlaneGeometry in X formation)
- Dart flight animation: dart spawns below the board viewport, arcs toward hit position, rotates to face velocity direction each frame (smooth interpolation)
- Neon trail: short-lived line trail (5–8 points) behind dart during flight, cyan/electric blue, fades out over 200ms
- Camera states (orthographic or perspective on the overlay): idle = full board view, aim = slight zoom in, throw = brief follow, impact = snap back
- Impact system: on dart arrival — stop motion, embed dart slightly into board surface, trigger neon spark particle burst (10–15 particles, brief), micro camera shake, brief slow-motion effect (50ms time scale 0.1 → 1.0)
- Tone.js synthesized audio: throw whoosh (filtered noise sweep), impact (bass thud + high-freq crackle), layered and punchy
- DartFlight component: manages dart animation state (idle | aiming | flying | embedded)
- useDartAudio hook: Tone.js setup, playThrow(), playImpact()

### Modify
- DartBoard.tsx: export a callback that signals aim start/end so App can pass aiming state to the overlay
- App.tsx: replace playThrowSound() with useDartAudio hook; pass throw target position to DartFlight overlay; layer DartFlight canvas over the board div
- App.tsx cameraShake: drive from impact system instead of timeout array

### Remove
- playThrowSound() inline Web Audio function in App.tsx (replaced by Tone.js hook)

## Implementation Plan
1. Install Tone.js if not present; verify @react-three/fiber and @react-three/drei are available
2. Create `src/frontend/src/hooks/useDartAudio.ts` — Tone.js synth setup, playThrow(), playImpact()
3. Create `src/frontend/src/components/DartMesh.tsx` — 3D dart geometry (tip + barrel + shaft + flights), accepts color prop
4. Create `src/frontend/src/components/DartFlight.tsx` — R3F Canvas overlay, manages animation state machine (idle→aiming→flying→embedded), neon trail, spark particles, camera states, slow-motion timeScale
5. Update `DartBoard.tsx` — expose onAimStart / onAimEnd callbacks
6. Update `App.tsx` — wire DartFlight overlay above board div; pass hitPosition on throw; replace inline audio with useDartAudio; propagate aim state for camera zoom
