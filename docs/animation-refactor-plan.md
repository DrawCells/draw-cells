# Animation Refactor — One Sampling Function, One Clock

> **Status:** Done — all four steps, React Spring removed · **Last updated:** 2026-10-09
>
> Planned as its own PR, separate from the AI chat work.

## Problem

Motion is implemented twice, and the two have drifted:

- **Playback** (`src/Sprites/AnimationSprite.jsx`) runs eight `useSpring` hooks
  per sprite on every render — scale, opacity, offset, static, linear,
  chaotic, circular, rotation — and picks one. Most of that work is discarded.
- **Video export** (`src/Header/components/ExportVideo.tsx`) has its own
  hand-written interpolation, with different circular maths, different fade
  handling, and the correct "earlier frame's settings govern the transition"
  rule.

So the editor preview and the exported video can disagree, and every fix has to
be made in both places.

React Spring is built for interruptible UI transitions (a value heads toward a
target and redirects smoothly if the target changes). These animations are
deterministic timelines: A → B over a known duration along a known path. That
mismatch is what makes it feel awkward.

### Concrete bugs this would fix

- **Playback direction compares frame ids as numbers.** `AnimationSprite.jsx`
  does `parseInt(String(frame.id))` and `crtFrameId > prevFrameId`. Ids are
  UUIDs, so this compares `NaN`s or a leading hex digit, and forward vs
  reverse is effectively arbitrary — including which sprite's
  `animationType` / `duration` is used.
- **Circular motion animates `rotateSpring` from `prevFrameId` to
  `crtFrameId`**, so it is broken by the same UUID problem. It also relies on a
  nested-rotation trick (rotate the outer group around the circle's centre,
  offset the inner node, counter-rotate) that is hard to reason about.
- **Stale reverse motion.** `computeNewFrames` (`src/Frames/reducers/frames.ts`)
  computes the next frame's `reverseAnimationProps` on a clone that it then
  discards.
- **Chaotic paths are re-randomised on every edit.** `computeNewFrames` reruns
  on every mutation, so a CHAOTIC sprite's path changes whenever anything on
  a neighbouring frame is nudged.

## Proposal

### 1. One pure sampling function

```ts
// src/Animation/sample.ts — no React, no library
export function sampleSprite(
  from: Sprite | undefined,
  to: Sprite | undefined,
  t: number, // 0..1
): { x: number; y: number; width: number; height: number; rotation: number; opacity: number } {
  // from only → fade out; to only → fade in; both → move using from.animationType
  // LINEAR: lerp. CIRCULAR: rotate around the computed centre by t * angle.
  // CHAOTIC: walk the waypoints.
}
```

`ExportVideo.tsx` already contains most of this logic; it mainly needs pulling
out of the export loop.

### 2. One clock per transition

Each sprite renders `sampleSprite(from, to, t)`. Drive `t` with either:

- a single React Spring value and `.to(t => …)` (keeps the dependency, uses it
  for what it is good at), or
- `Konva.Animation` / a small `requestAnimationFrame` hook (no dependency).

Direction comes from which frame we are moving to, never from id arithmetic.
Reverse playback is the same transition with `t` running from 1 to 0.

### 3. Export uses the same function

```ts
for (let i = 0; i < 30 * duration; i++) render(sampleSprite(a, b, i / frameCount));
```

### 4. Compute motion when drawn instead of storing it

Compute circle centres and chaotic waypoints inside `sampleSprite`, with a
random generator seeded from `sprite.id + frame.id`, instead of storing them as
`animationProps` / `reverseAnimationProps` in Redux. That gives:

- the same chaotic path every time, between edits and between preview and export;
- smaller saved presentations;
- a reducer that no longer recalculates motion on every action;
- an AI state projection that no longer needs to strip `animationProps`.

## Benefits

- Preview and export cannot disagree, because they run the same code.
- Reverse playback, scrubbing, and a timeline view come almost for free, since
  any `t` can be rendered.
- `sampleSprite` is pure, so it can be unit-tested without a browser.

## Library options

| Option | Fit |
|---|---|
| Keep React Spring, one spring per transition | Fine once it only drives `t`. |
| `Konva.Animation` / `Konva.Tween` | No new dependency; enough for today's needs. |
| GSAP | Best for timelines — sequencing, easing, scrubbing, motion paths — and works well with Konva. Free, plugins included. Worth it for staggered entrances or easing curves later; still sits on top of steps 1–3. |
| Framer Motion | DOM-oriented; a poor fit for a canvas app. |

None of these fixes the preview/export drift on its own; the shared sampling
function does.

## Steps

- [x] Extract `sampleSprite` from `ExportVideo.tsx` and add tests for it.
      Lives in `src/Animation/sample.ts` (with `sampleFrames` /
      `transitionSeconds` for whole frames); tests run with `npm test`.
- [x] Rewrite `AnimationSprite` to use it with one clock (fixes the UUID
      direction bug and circular motion). The clock is
      `src/Animation/useTransitionClock.ts` (`requestAnimationFrame`), and
      `@react-spring/konva` is no longer a dependency.
- [x] Switch `ExportVideo.tsx` to call it.
- [x] Stop storing `animationProps` / `reverseAnimationProps`; seed CHAOTIC
      randomness from ids. **Changes the saved data:** the old fields are
      dropped when a presentation loads, so its next save no longer stores
      them. The seed is the sprite id plus its move's endpoints and chaotic
      settings (not the frame id, which `sampleSprite` never sees), so a path
      only changes when that sprite's own move does. The circle centre is
      solved exactly from the chord and the signed sweep instead of the
      rounded quadratic, and the editor's path overlay
      (`AnimationCanvasPreview`) draws `motionPath`, the same route playback
      takes.

The first three steps ship without touching saved data.
