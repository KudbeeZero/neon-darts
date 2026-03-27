# Neon Darts

## Current State
- Background: `arena-bg` image (competition arena photo) loaded in PreloadScene and displayed behind the scene
- Spotlight cone graphics drawn on top of it
- Board: drawn with muted colors — dark navy singles, blue/purple triples, orange/crimson doubles; segment dividers are dim (0x223355); ring outlines are subtle
- Arc: `upwardBias` default 0.35, `gravityScale` 1200 — moderate arc

## Requested Changes (Diff)

### Add
- Animated star particle field background: 200–300 small white/blue dots at varying depths, slow drift/twinkle animation each frame in the scene `update()` loop using Phaser Graphics or a simple particle array
- A few larger "nebula blobs" (soft radial gradients drawn with concentric ellipses) in dark purple/blue for depth
- Neon glow rings on triples and doubles: thick bright stroke rings (lineStyle 4–6px, full alpha) over the existing ring outlines in bright cyan (0x00eeff) for triples and hot pink/magenta (0xff0088) for doubles
- Bright segment fill colors: triples should be vivid cyan (0x00ccff) and magenta (0xff00cc); doubles vivid orange (0xff8800) and red (0xff0033) — high saturation, full opacity
- Segment dividers: replace dim 0x223355 with bright white-blue (0x4488cc, alpha 0.9) for crisp separation
- Bull's-eye: bright red (0xff0000) inner, hot orange (0xff8800) outer bull, white center dot

### Modify
- Remove the arena-bg image reference in GameScene `_buildScene()` and its depth(-10) setup — replace with a black base fill + star particles
- Remove spotlight cone triangles (the `light` graphics object)
- In `_drawBoard()`: replace all segment fill colors, ring outline colors, and divider colors per above
- `upwardBias` in ARC_CONFIG: raise from 0.35 → 0.55 (more dramatic arc loop)
- Also raise `UPWARD_BIAS_HIGH` in HOVER_CFG (GameScene) from current value → 0.80 so high dart position throws have a very visible looping arc

### Remove
- arena-bg image draw call and display size setup
- spotlight cone (the `light` graphics triangle fill)

## Implementation Plan
1. In `GameScene._buildScene()`: remove `bg = this.add.image(...)` arena-bg block and the `light` spotlight cone block
2. Add a black base fill rect at depth -10 as the new background
3. Add a `_buildStarField()` method that creates 250 star objects (x, y, radius, alpha, speed, twinklePhase) stored in `this._stars` array; draw them in a new `_updateStars(delta)` called from `update()`
4. Add 5–8 soft nebula blobs (dark purple/blue concentric ellipses) at depth -9 around the scene
5. In `_drawBoard()`: update all fillStyle / lineStyle colors per the spec above for vivid neon cyberpunk look
6. In `ThrowArcLayer.ts`: raise `upwardBias` from 0.35 → 0.55
7. In `GameScene` HOVER_CFG: raise `UPWARD_BIAS_HIGH` from current → 0.80
8. Validate and build
