import { useEffect, useState } from "react";

/**
 * Seconds elapsed in the current transition, from 0 up to `totalSeconds`,
 * ticking once per animation frame. A new `transitionKey` restarts it at 0.
 */
export function useTransitionClock(
  transitionKey: string,
  totalSeconds: number,
): number {
  const [clock, setClock] = useState({ key: transitionKey, elapsed: 0 });

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(totalSeconds, (now - start) / 1000);
      setClock({ key: transitionKey, elapsed });
      if (elapsed < totalSeconds) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [transitionKey, totalSeconds]);

  // The effect only runs after the render where the key changes, so until its
  // first tick the previous transition's time would still be in state. Starting
  // from 0 here avoids flashing the new transition's end state for a frame.
  return clock.key === transitionKey ? clock.elapsed : 0;
}
