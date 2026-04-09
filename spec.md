# Neon Darts

## Current State
Three.js/R3F game. TouchLayer fires planThrow only on swipe with dist >= 8px — tapping or holding does nothing. Barrel roll is applied constantly during flight regardless of dart direction. Scoring uses atan2(nx,ny) but may have alignment issues vs. the board image texture. Camera FOV/position gives a slightly low perspective.

## Requested Changes (Diff)

### Add
- Idle barrel roll: while in `aiming` state, dart flights rotate slowly/continuously (floating animation)
- Live aim preview: onAimUpdate callback from TouchLayer so R3FGame can update dart visual position while finger is held
- `tangentY` field to AnimFrame so GameScene knows if dart is ascending or descending

### Modify
- **TouchLayer**: Remove `dist < 8` restriction; fire throw on any touchend; add `onAimUpdate(normX, normY)` callback during touchmove drag; holding/dragging updates aim in real-time
- **ThrowAnimation**: Expose `tangentY` in AnimFrame return
- **GameScene (R3FGame)**: Only call `setFlightRoll(t)` when `result.tangentY < 0` (dart descending); add idle barrel roll via useFrame when `gameState === 'aiming'`
- **ScoringGrid**: Add `BOARD_ANGLE_OFFSET_DEG = 9` correction so scoring aligns with the actual image texture (image may be offset 9° from math expectation)
- **Camera**: Raise camera y slightly, adjust lookAt to show more board from top-down first-person view matching the Darts of Fury reference
- **ArcPlanner**: On zero-movement tap, still fire straight ahead at minimum power (don't discard)

### Remove
- Nothing removed

## Implementation Plan
1. ScoringGrid.ts — add 9° rotation offset to angle calc (segment image alignment fix)
2. ThrowAnimation.ts — add `tangentY: number` to AnimFrame, set from `_tan.y`
3. TouchLayer.tsx — remove dist<8 gate; add onAimUpdate prop; fire onAimUpdate(normDX, normDY) on every touchmove; touchend always fires planThrow (zero movement = center aim, min power)
4. DartMesh.tsx — add separate `setBarrelRoll(angle: number)` imperative method for idle animation
5. R3FGame.tsx — wire onAimUpdate; in useFrame for aiming state: increment idleRollAngle and call setBarrelRoll; in throwing useFrame: only call setFlightRoll when tangentY < 0; update camera position/lookAt
