// Run with `npm test`. Uses Node's built-in runner (through tsx) so no test
// framework is needed. *.test.ts files are excluded from the Next type-check
// (tsconfig.json) because its @types/node predates node:test.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chaoticWaypoints,
  circularArc,
  motionPath,
  sampleFrames,
  sampleSprite,
  transitionSeconds,
} from "./sample";

const sprite = (overrides: Record<string, any> = {}): any => ({
  id: "a",
  position: { x: 0, y: 0 },
  width: 100,
  height: 50,
  rotation: 0,
  opacity: 1,
  ...overrides,
});

const close = (actual: number, expected: number, epsilon = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );

describe("sampleSprite", () => {
  it("moves LINEAR sprites in a straight line and tweens their box", () => {
    const from = sprite({ animationType: "LINEAR", width: 100, rotation: 0 });
    const to = sprite({ position: { x: 200, y: 100 }, width: 300, rotation: 90 });
    const [mid] = sampleSprite(from, to, 0.5);
    assert.deepEqual(mid.position, { x: 100, y: 50 });
    assert.equal(mid.width, 200);
    assert.equal(mid.rotation, 45);
  });

  it("is at its endpoints at t = 0 and t = 1, and clamps beyond them", () => {
    const from = sprite();
    const to = sprite({ position: { x: 10, y: 20 } });
    assert.deepEqual(sampleSprite(from, to, -1)[0].position, from.position);
    assert.deepEqual(sampleSprite(from, to, 0)[0].position, from.position);
    assert.deepEqual(sampleSprite(from, to, 1)[0].position, to.position);
    assert.deepEqual(sampleSprite(from, to, 2)[0].position, to.position);
  });

  it("fades sprites in and out where they stand", () => {
    const s = sprite({ position: { x: 5, y: 5 }, opacity: 0.8 });
    const [leaving] = sampleSprite(s, undefined, 0.25);
    close(leaving.opacity!, 0.6);
    assert.deepEqual(leaving.position, s.position);
    const [arriving] = sampleSprite(undefined, s, 0.25);
    close(arriving.opacity!, 0.2);
  });

  it("walks CHAOTIC waypoints with equal time per leg", () => {
    const from = sprite({ animationType: "CHAOTIC", nrOfIterations: 4 });
    const to = sprite({ position: { x: 400, y: 200 } });
    const points = chaoticWaypoints(from, to);
    points.forEach((p, i) =>
      assert.deepEqual(sampleSprite(from, to, i / (points.length - 1))[0].position, p),
    );
    const halfway = sampleSprite(from, to, 0.125)[0].position;
    close(halfway.x, (points[0].x + points[1].x) / 2);
    close(halfway.y, (points[0].y + points[1].y) / 2);
  });

  it("moves CIRCULAR sprites along the arc and lands on the target", () => {
    // Quarter turn from (0, 0) to (100, 100), bowing upwards: clockwise around
    // (0, 100).
    const from = sprite({ animationType: "CIRCULAR", angle: 90, circleDirection: 1 });
    const to = sprite({ position: { x: 100, y: 100 } });
    const arc = circularArc(from, to)!;
    close(arc.center.x, 0);
    close(arc.center.y, 100);
    close(arc.radius, 100);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const { x, y } = sampleSprite(from, to, t)[0].position;
      close(Math.hypot(x, y - 100), 100);
    }
    const mid = sampleSprite(from, to, 0.5)[0].position;
    close(mid.x, 100 * Math.SQRT1_2);
    close(mid.y, 100 - 100 * Math.SQRT1_2);
    const end = sampleSprite(from, to, 1)[0].position;
    close(end.x, 100);
    close(end.y, 100);
  });

  it("bows CIRCULAR arcs the same way whichever way the sprite travels", () => {
    const left = sprite({ animationType: "CIRCULAR", circleDirection: 1 });
    const right = sprite({ position: { x: 200, y: 0 } });
    // Both directions pass above the chord (negative y) with circleDirection 1…
    assert.ok(sampleSprite(left, right, 0.5)[0].position.y < 0);
    const back = { ...right, animationType: "CIRCULAR", circleDirection: 1 };
    assert.ok(sampleSprite(back, left, 0.5)[0].position.y < 0);
    // …and below it with -1.
    assert.ok(
      sampleSprite({ ...left, circleDirection: -1 }, right, 0.5)[0].position.y > 0,
    );
  });

  it("sweeps the stored angle, including the long way round", () => {
    const from = sprite({ animationType: "CIRCULAR", angle: 270 });
    const to = sprite({ position: { x: 100, y: 100 } });
    const arc = circularArc(from, to)!;
    close(arc.sweep, (3 * Math.PI) / 2);
    const end = sampleSprite(from, to, 1)[0].position;
    close(end.x, 100);
    close(end.y, 100);
  });

  it("moves CIRCULAR sprites in a straight line when there is no arc", () => {
    const to = sprite({ position: { x: 10, y: 0 } });
    const from = sprite({ animationType: "CIRCULAR", angle: 360 });
    assert.equal(circularArc(from, to), null);
    assert.deepEqual(sampleSprite(from, to, 0.5)[0].position, { x: 5, y: 0 });
    assert.equal(circularArc(from, sprite()), null);
  });

  it("crossfades text whose wording changes", () => {
    const from = sprite({ kind: "text", text: "Hello", fontSize: 20 });
    const to = sprite({ kind: "text", text: "World", fontSize: 40 });
    const [out, inn] = sampleSprite(from, to, 0.25);
    assert.equal(out.id, "a-out");
    assert.equal((out as any).text, "Hello");
    close(out.opacity!, 0.75);
    assert.equal(inn.id, "a-in");
    assert.equal((inn as any).text, "World");
    close(inn.opacity!, 0.25);
  });

  it("tweens font size with the box when the wording is unchanged", () => {
    const from = sprite({ kind: "text", text: "Hi", fontSize: 20 });
    const to = sprite({ kind: "text", text: "Hi", fontSize: 40 });
    const result = sampleSprite(from, to, 0.5);
    assert.equal(result.length, 1);
    assert.equal((result[0] as any).fontSize, 30);
  });
});

describe("chaoticWaypoints", () => {
  const from = sprite({
    id: "s1",
    animationType: "CHAOTIC",
    nrOfIterations: 10,
    rangeOfMovement: 40,
  });
  const to = sprite({ id: "s1", position: { x: 500, y: 300 } });

  it("starts and ends on the sprite with nrOfIterations legs", () => {
    const points = chaoticWaypoints(from, to);
    assert.equal(points.length, 11);
    assert.deepEqual(points[0], from.position);
    assert.deepEqual(points[10], to.position);
  });

  it("is the same path every time for the same move", () => {
    assert.deepEqual(chaoticWaypoints(from, to), chaoticWaypoints(from, to));
    assert.deepEqual(
      chaoticWaypoints({ ...from, opacity: 0.5 }, { ...to, rotation: 45 }),
      chaoticWaypoints(from, to),
    );
  });

  it("differs between sprites and between moves", () => {
    const other = chaoticWaypoints({ ...from, id: "s2" }, { ...to, id: "s2" });
    assert.notDeepEqual(other, chaoticWaypoints(from, to));
    const moved = chaoticWaypoints(from, { ...to, position: { x: 501, y: 300 } });
    assert.notDeepEqual(moved, chaoticWaypoints(from, to));
  });

  it("stays near the straight line", () => {
    // Each waypoint lies within the range plus the minimum-travel nudge of
    // the stretch of line it belongs to.
    const slack = 40 + 15 + 50;
    for (const p of chaoticWaypoints(from, to).slice(1, -1)) {
      assert.ok(p.x >= -slack && p.x <= 500 + slack, `x ${p.x}`);
      assert.ok(p.y >= -slack && p.y <= 300 + slack, `y ${p.y}`);
    }
  });
});

describe("motionPath", () => {
  it("is the waypoints for CHAOTIC moves", () => {
    const from = sprite({ animationType: "CHAOTIC", nrOfIterations: 3 });
    const to = sprite({ position: { x: 90, y: 0 } });
    assert.deepEqual(
      motionPath(from, to),
      chaoticWaypoints(from, to).flatMap((p) => [p.x, p.y]),
    );
  });

  it("follows the arc for CIRCULAR moves and runs end to end", () => {
    const from = sprite({ animationType: "CIRCULAR" });
    const to = sprite({ position: { x: 100, y: 100 } });
    const points = motionPath(from, to);
    assert.deepEqual(points.slice(0, 2), [0, 0]);
    close(points[points.length - 2], 100);
    close(points[points.length - 1], 100);
    for (let i = 0; i < points.length; i += 2) {
      close(Math.hypot(points[i], points[i + 1] - 100), 100);
    }
  });

  it("is a straight line otherwise", () => {
    const to = sprite({ position: { x: 30, y: 40 } });
    assert.deepEqual(motionPath(sprite(), to), [0, 0, 30, 40]);
  });
});

describe("transitionSeconds", () => {
  it("is the slowest sprite, counting fades", () => {
    const a = sprite({ id: "a", duration: 3 });
    const b = sprite({ id: "b", duration: 0 });
    assert.equal(transitionSeconds([a, b], [a, b]), 3);
    assert.equal(transitionSeconds([b], [b]), 1);
    assert.equal(transitionSeconds([], [a]), 1);
    assert.equal(transitionSeconds([], []), 0);
  });
});

describe("sampleFrames", () => {
  it("runs each sprite on its own duration, then holds", () => {
    const slow = sprite({ id: "slow", duration: 2 });
    const fast = sprite({ id: "fast", duration: 1 });
    const earlier = [slow, fast];
    const later = [
      { ...slow, position: { x: 100, y: 0 } },
      { ...fast, position: { x: 100, y: 0 } },
    ];
    const at = (seconds: number) =>
      Object.fromEntries(
        sampleFrames(earlier, later, seconds).map((s) => [s.id, s.position.x]),
      );
    assert.deepEqual(at(1), { slow: 50, fast: 100 });
    assert.deepEqual(at(2), { slow: 100, fast: 100 });
  });

  it("draws in the later frame's order with leaving sprites on top", () => {
    const a = sprite({ id: "a" });
    const b = sprite({ id: "b" });
    const c = sprite({ id: "c" });
    const ids = sampleFrames([a, b], [c, b], 0.5).map((s) => s.id);
    assert.deepEqual(ids, ["c", "b", "a"]);
  });
});
