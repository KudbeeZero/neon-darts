# Neon Darts — 3D Engine Rebuild

## Current State
The game runs entirely on Phaser 3 with a modular 6-layer throw pipeline (Input, Aim, Power, ThrowArc, Spin, Impact) and a CameraLayer. The board, dart, and effects are all drawn on a 2D canvas. Three.js, @react-three/fiber, and @react-three/drei are already installed but unused. The game has accurate scoring, zone snap, shrinking target ring, parabolic arc physics, and a cinematic camera system.

## Requested Changes (Diff)

### Add
- Full Three.js/R3F game scene replacing Phaser entirely
- Procedural 3D dart mesh: tungsten barrel (CylinderGeometry), tapered tip (ConeGeometry), metallic PBR material with neon accent highlights, geometric flight fins (PlaneGeometry with double-sided neon material)
- Procedural 3D dartboard: flat disc face with 62 segment geometries (singles, doubles, triples rings), each segment a separate mesh with correct neon cyberpunk colors (cyan/blue singles, hot pink/magenta triples, orange/red doubles, gold bull, white bullseye center), mounted on a dark cabinet backing with slight 3D depth
- Pre-mapped scoring grid: typed Uint8Array at 4px resolution covering the board face, labeled at startup (zone number + ring type for every cell). O(1) lookup at throw time
- HTML touch layer: a plain absolutely-positioned div covering the Three.js canvas, handling all touch events natively — R3F/Three.js never intercepts touch
- Predetermined bezier arc: on release, compute full cubic bezier (start → apex → landing) once; animate dart along curve using GSAP or manual lerp each frame
- Camera zoom to plot: on release, Three.js camera begins smooth zoom toward the predetermined 3D landing coordinate; arrives just before dart does; pulls back after impact
- Deep space starfield: instanced star particles as Three.js InstancedMesh behind the board
- Neon impact effects: Three.js particle burst at impact point using a small pool of reusable sprite meshes
- Shrinking target ring: a Three.js RingGeometry mesh placed at the landing zone on release, scaled down to zero as dart approaches
- Glassmorphism HUD overlay: React/HTML layer on top of canvas for score display, mode indicator, dart counter
- All game modes preserved: 301, Around the World, Doubles, Triples

### Modify
- PhaserGame.tsx → replaced with R3FGame.tsx that mounts the Three.js canvas and the HTML touch/HUD layers
- All layer files (InputLayer, AimLayer, PowerLayer, ThrowArcLayer, SpinLayer, ImpactLayer, CameraLayer) ported to framework-agnostic TypeScript classes that operate on plain numbers/vectors, not Phaser objects
- App.tsx/main entry point to use R3FGame instead of PhaserGame

### Remove
- All Phaser 3 imports and scene files (GameScene.ts, PreloadScene.ts, IntroScene.ts, ModeSelectScene.ts, DartSelectionScene.ts)
- Phaser dependency from package.json (keep Three.js, R3F, Drei)

## Implementation Plan
1. Create `src/game/core/ScoringGrid.ts` — builds pre-mapped typed array at startup, exports `lookupZone(boardX, boardY)` returning `{segment, ring}` in O(1)
2. Create `src/game/core/ArcPlanner.ts` — on throw release, computes full cubic bezier path (start, apex, landing 3D coords) and autocorrect snap, returns `PlannedThrow` object consumed by all other systems
3. Create `src/game/three/DartMesh.tsx` — procedural R3F component: barrel + tip + flights, MeshStandardMaterial with metallic/roughness, emissive neon accent
4. Create `src/game/three/DartboardMesh.tsx` — procedural board geometry with all 62 segments, correct scoring colors, cabinet backing, subtle depth
5. Create `src/game/three/Starfield.tsx` — instanced InstancedMesh of 300 star points with slow drift animation
6. Create `src/game/three/ThrowAnimation.tsx` — animates dart along pre-computed bezier each frame using lerp; drives shrinking target ring scale; notifies on impact
7. Create `src/game/three/GameCamera.tsx` — Three.js perspective camera that zooms toward predetermined landing plot on release, pulls back on impact
8. Create `src/game/input/TouchLayer.tsx` — HTML div overlay, native touch handlers, feeds into ArcPlanner on release
9. Create `src/game/ui/HUD.tsx` — React/HTML glassmorphism overlay for scores, mode, dart counter
10. Create `src/game/R3FGame.tsx` — root component mounting canvas + TouchLayer + HUD, managing game state (mode, score, dart index)
11. Port game mode logic (301, AtW, Doubles, Triples) into pure TS classes in `src/game/core/GameModes.ts`
12. Update App.tsx to render R3FGame
13. Remove Phaser scenes and uninstall phaser package
