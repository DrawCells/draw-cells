// Where every sprite is, at any moment of a transition between two frames.
// Presentation playback and video export both render from this, so the editor
// preview and the exported video cannot disagree. No React and no Konva here,
// so it runs (and is tested) without a browser.
//
// `Sprite` is imported as a type only: the frames module pulls in Konva at
// runtime.
import type { Position, Sprite } from "../Frames/reducers/frames";

// How long a sprite that only exists on one side of a transition takes to
// fade in or out.
export const FADE_SECONDS = 1;

// A sprite's own transition length. Missing or non-positive durations fall
// back to one second rather than dividing by zero.
const durationOf = (sprite: Sprite): number =>
  sprite.duration && sprite.duration > 0 ? sprite.duration : 1;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpPosition = (a: Position, b: Position, t: number): Position => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
});

const isText = (s: Sprite): boolean => s.kind === "text";

// CIRCULAR: the arc from `from` to `to` that sweeps `from.angle` degrees
// (default 90). For a sideways move, `circleDirection` 1 bows the arc
// upwards whichever way the sprite travels and -1 bows it downwards (the rule
// the stored animationProps used); a straight vertical move with 1 turns
// anticlockwise.
// The chord and the signed sweep fix the centre, so nothing is stored.
// Null when there is no arc to follow (no movement, or a 0° / 360° sweep).
export function circularArc(
  from: Sprite,
  to: Sprite,
): { center: Position; radius: number; sweep: number } | null {
  const p1 = from.position;
  const p2 = to.position;
  if (p1.x === p2.x && p1.y === p2.y) return null;

  const degrees = (from.angle || 90) % 360;
  const direction = from.circleDirection || 1;
  // Positive sweeps run clockwise on screen (y points down).
  const sweep =
    ((p1.x < p2.x ? direction : -direction) * degrees * Math.PI) / 180;
  if (sweep === 0) return null;

  // The centre c satisfies p2 - c = R(sweep)(p1 - c), i.e.
  // (I - R) c = p2 - R p1, a 2×2 system whose determinant 2 - 2cos(sweep)
  // is non-zero for any sweep strictly between 0° and 360°.
  const cos = Math.cos(sweep);
  const sin = Math.sin(sweep);
  const bx = p2.x - (cos * p1.x - sin * p1.y);
  const by = p2.y - (sin * p1.x + cos * p1.y);
  const det = 2 - 2 * cos;
  const center = {
    x: ((1 - cos) * bx - sin * by) / det,
    y: (sin * bx + (1 - cos) * by) / det,
  };
  return {
    center,
    radius: Math.hypot(p1.x - center.x, p1.y - center.y),
    sweep,
  };
}

function circularPosition(from: Sprite, to: Sprite, t: number): Position | null {
  const arc = circularArc(from, to);
  if (!arc) return null;
  const { center, sweep } = arc;
  const angle = sweep * t;
  const vx = from.position.x - center.x;
  const vy = from.position.y - center.y;
  return {
    x: center.x + Math.cos(angle) * vx - Math.sin(angle) * vy,
    y: center.y + Math.sin(angle) * vx + Math.cos(angle) * vy,
  };
}

// Deterministic randomness: the same seed always yields the same sequence
// (mulberry32 over a 32-bit FNV-1a hash of the seed string).
function seededRandom(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let r = Math.imul(h ^ (h >>> 15), 1 | h);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * CHAOTIC: a jittery walk from `from` to `to` through `nrOfIterations - 1`
 * random waypoints, each within `rangeOfMovement` of the straight line and at
 * least `minTravelDistance` from the one before on each axis.
 *
 * The randomness is seeded from the sprite and its move, so a path stays the
 * same across reloads, in the preview and in the export, and only changes
 * when the sprite's own move or chaotic settings do.
 */
export function chaoticWaypoints(from: Sprite, to: Sprite): Position[] {
  const iterations = Math.max(1, Math.round(from.nrOfIterations || 10));
  const range = from.rangeOfMovement || 40;
  const minTravel = from.minTravelDistance || 15;
  const random = seededRandom(
    [
      from.id,
      from.position.x,
      from.position.y,
      to.position.x,
      to.position.y,
      iterations,
      range,
      minTravel,
    ].join(":"),
  );

  // One axis of the walk: a random point within `range` of where the straight
  // line would be after this step, pushed further along if it lands too close
  // to the previous point.
  const step = (start: number, end: number, i: number, previous: number) => {
    const stride = (end - start) / iterations;
    const direction = stride < 0 ? -1 : 1;
    const low = Math.round(start + stride * i) - range * direction;
    const high = Math.round(start + stride * (i + 1)) + range * direction;
    let next = Math.floor(random() * (high - low)) + low;
    if (Math.abs(next - previous) < minTravel) next += minTravel * direction;
    return next;
  };

  const points: Position[] = [{ ...from.position }];
  for (let i = 0; i < iterations - 1; i++) {
    const previous = points[points.length - 1];
    points.push({
      x: step(from.position.x, to.position.x, i, previous.x),
      y: step(from.position.y, to.position.y, i, previous.y),
    });
  }
  points.push({ ...to.position });
  return points;
}

// Walk the waypoints, spending equal time on each leg.
function chaoticPosition(from: Sprite, to: Sprite, t: number): Position {
  const points = chaoticWaypoints(from, to);
  const s = t * (points.length - 1);
  const leg = Math.min(Math.floor(s), points.length - 2);
  return lerpPosition(points[leg], points[leg + 1], s - leg);
}

// The earlier frame's sprite governs the transition (its animationType,
// duration and path settings). LINEAR, and a circle with no arc to follow,
// moves in a straight line.
function movedPosition(from: Sprite, to: Sprite, t: number): Position {
  const path =
    from.animationType === "CIRCULAR"
      ? circularPosition(from, to, t)
      : from.animationType === "CHAOTIC"
        ? chaoticPosition(from, to, t)
        : null;
  return path ?? lerpPosition(from.position, to.position, t);
}

/**
 * The route a sprite's centre takes from `from` to `to`, as a flat Konva
 * points array. Used by the editor to preview a move before playing it.
 */
export function motionPath(from: Sprite, to: Sprite): number[] {
  if (from.animationType === "CHAOTIC") {
    return chaoticWaypoints(from, to).flatMap((p) => [p.x, p.y]);
  }
  const steps = from.animationType === "CIRCULAR" ? 48 : 1;
  const points: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const { x, y } = movedPosition(from, to, i / steps);
    points.push(x, y);
  }
  return points;
}

/**
 * Renders one sprite `t` (0..1) of the way through a transition.
 *
 * - `from` only: fades out where it stands.
 * - `to` only: fades in where it stands.
 * - both: moves along `from.animationType`, tweening size, rotation and
 *   opacity. Text whose wording changes crossfades, so this can return two
 *   sprites (ids suffixed `-out` / `-in`).
 *
 * Reverse playback is the same transition with `t` running from 1 to 0.
 */
export function sampleSprite(
  from: Sprite | undefined,
  to: Sprite | undefined,
  t: number,
): Sprite[] {
  t = clamp01(t);

  if (from && !to) {
    return [{ ...from, opacity: (from.opacity ?? 1) * (1 - t) }];
  }
  if (to && !from) {
    return [{ ...to, opacity: (to.opacity ?? 1) * t }];
  }
  if (!from || !to) return [];

  const position = movedPosition(from, to, t);
  const rotation = lerp(from.rotation, to.rotation, t);
  const opacity = lerp(from.opacity ?? 1, to.opacity ?? 1, t);

  if (isText(from) && isText(to) && (from as any).text !== (to as any).text) {
    // Wording cannot be interpolated, and drawing either wording in a box
    // tweening toward the other's size wraps it past the box height, where
    // Konva drops the overflowing lines. Each wording keeps its own box and
    // both follow the sprite's path.
    return [
      { ...from, id: `${from.id}-out`, position, rotation, opacity: opacity * (1 - t) },
      { ...to, id: `${to.id}-in`, position, rotation, opacity: opacity * t },
    ];
  }

  return [
    {
      ...from,
      position,
      rotation,
      opacity,
      width: lerp(from.width, to.width, t),
      height: lerp(from.height, to.height, t),
      // Resizing a text box on the canvas scales its font with it, so the
      // font has to tween alongside the box.
      ...(isText(from) && isText(to)
        ? { fontSize: lerp((from as any).fontSize, (to as any).fontSize, t) }
        : {}),
    } as Sprite,
  ];
}

const sameId = (a: Sprite, b: Sprite) => a.id.toString() === b.id.toString();

// How long a sprite takes over this transition, in seconds.
function spriteSeconds(from: Sprite | undefined, to: Sprite | undefined): number {
  return from && to ? durationOf(from) : FADE_SECONDS;
}

/**
 * Length in seconds of the transition from the `earlier` frame's sprites to
 * the `later` frame's: the slowest sprite, including fades.
 */
export function transitionSeconds(earlier: Sprite[], later: Sprite[]): number {
  let seconds = 0;
  for (const s of earlier) {
    seconds = Math.max(seconds, spriteSeconds(s, later.find((o) => sameId(o, s))));
  }
  for (const s of later) {
    if (!earlier.some((o) => sameId(o, s))) seconds = Math.max(seconds, FADE_SECONDS);
  }
  return seconds;
}

/**
 * Every sprite to draw `seconds` into the transition from the `earlier` frame
 * to the `later` one. Each sprite runs on its own duration and then holds.
 * Draw order follows the later frame, with sprites leaving it drawn on top.
 */
export function sampleFrames(
  earlier: Sprite[],
  later: Sprite[],
  seconds: number,
): Sprite[] {
  const at = (from: Sprite | undefined, to: Sprite | undefined) =>
    sampleSprite(from, to, seconds / spriteSeconds(from, to));

  return [
    ...later.flatMap((to) => at(earlier.find((s) => sameId(s, to)), to)),
    ...earlier
      .filter((from) => !later.some((s) => sameId(s, from)))
      .flatMap((from) => at(from, undefined)),
  ];
}
