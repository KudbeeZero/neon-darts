import { useEffect, useRef } from "react";
import { type PlannedThrow, planThrow } from "../core/ArcPlanner";

interface PointerSample {
  x: number;
  y: number;
  t: number;
}

function computeRecencyVelocity(history: PointerSample[]): number {
  const tail = history.slice(-5);
  if (tail.length < 2) return 0;
  let wVX = 0;
  let wVY = 0;
  let wTotal = 0;
  for (let i = 1; i < tail.length; i++) {
    const dt = Math.max(1, tail[i].t - tail[i - 1].t);
    const vx = ((tail[i].x - tail[i - 1].x) / dt) * 1000;
    const vy = ((tail[i].y - tail[i - 1].y) / dt) * 1000;
    const rawW = i / (tail.length - 1);
    const w = i === tail.length - 1 ? rawW * 2.5 : rawW;
    wVX += vx * w;
    wVY += vy * w;
    wTotal += w;
  }
  const finalVX = wTotal > 0 ? wVX / wTotal : 0;
  const finalVY = wTotal > 0 ? wVY / wTotal : 0;
  return Math.sqrt(finalVX * finalVX + finalVY * finalVY);
}

/**
 * Map absolute screen position to normalised board coords (-1..1).
 * Top of screen → top of board (+1), bottom → bottom (-1).
 * Left edge → left edge (-1), right edge → right edge (+1).
 */
function screenToNorm(
  clientX: number,
  clientY: number,
): { normX: number; normY: number } {
  const normX = Math.max(
    -1,
    Math.min(1, (clientX / window.innerWidth) * 2 - 1),
  );
  // Y is flipped: top of screen = top of board = +1
  const normY = Math.max(
    -1,
    Math.min(1, 1 - (clientY / window.innerHeight) * 2),
  );
  return { normX, normY };
}

interface TouchLayerProps {
  enabled: boolean;
  onThrow: (pt: PlannedThrow) => void;
  onAimUpdate?: (normX: number, normY: number) => void;
}

export default function TouchLayer({
  enabled,
  onThrow,
  onAimUpdate,
}: TouchLayerProps) {
  const enabledRef = useRef(enabled);
  const onThrowRef = useRef(onThrow);
  const onAimUpdateRef = useRef(onAimUpdate);

  useEffect(() => {
    enabledRef.current = enabled;
  });
  useEffect(() => {
    onThrowRef.current = onThrow;
  });
  useEffect(() => {
    onAimUpdateRef.current = onAimUpdate;
  });

  useEffect(() => {
    let activeTouchId: number | null = null;
    let history: PointerSample[] = [];
    // Store last aim position for throw
    let lastNormX = 0;
    let lastNormY = 0;

    const onStart = (e: TouchEvent) => {
      if (!enabledRef.current || activeTouchId !== null) return;
      e.preventDefault();
      const touch = e.changedTouches[0];
      activeTouchId = touch.identifier;
      history = [{ x: touch.clientX, y: touch.clientY, t: Date.now() }];

      // Immediately aim at touch position
      const { normX, normY } = screenToNorm(touch.clientX, touch.clientY);
      lastNormX = normX;
      lastNormY = normY;
      onAimUpdateRef.current?.(normX, normY);
    };

    const onMove = (e: TouchEvent) => {
      if (!enabledRef.current || activeTouchId === null) return;
      e.preventDefault();
      let touch: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
          touch = e.changedTouches[i];
          break;
        }
      }
      if (!touch) return;
      history.push({ x: touch.clientX, y: touch.clientY, t: Date.now() });
      if (history.length > 12) history.shift();

      // Direct absolute position mapping
      const { normX, normY } = screenToNorm(touch.clientX, touch.clientY);
      lastNormX = normX;
      lastNormY = normY;
      onAimUpdateRef.current?.(normX, normY);
    };

    const onEnd = (e: TouchEvent) => {
      if (activeTouchId === null) return;
      e.preventDefault();
      let touch: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
          touch = e.changedTouches[i];
          break;
        }
      }
      if (!touch) {
        activeTouchId = null;
        return;
      }
      activeTouchId = null;
      if (!enabledRef.current) return;

      history.push({ x: touch.clientX, y: touch.clientY, t: Date.now() });
      const velocityMag = computeRecencyVelocity(history);

      // Use ABSOLUTE position from touchend as the landing zone target
      const { normX, normY } = screenToNorm(touch.clientX, touch.clientY);
      lastNormX = normX;
      lastNormY = normY;

      const pt = planThrow(lastNormX, lastNormY, velocityMag);
      onThrowRef.current(pt);
    };

    const opts: AddEventListenerOptions = { capture: true, passive: false };
    document.addEventListener("touchstart", onStart, opts);
    document.addEventListener("touchmove", onMove, opts);
    document.addEventListener("touchend", onEnd, opts);
    document.addEventListener("touchcancel", onEnd, opts);

    // Mouse support for desktop testing
    let mouseDown = false;
    let mouseHistory: PointerSample[] = [];
    let mouseLastNormX = 0;
    let mouseLastNormY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      mouseDown = true;
      mouseHistory = [{ x: e.clientX, y: e.clientY, t: Date.now() }];

      const { normX, normY } = screenToNorm(e.clientX, e.clientY);
      mouseLastNormX = normX;
      mouseLastNormY = normY;
      onAimUpdateRef.current?.(normX, normY);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return;
      mouseHistory.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      if (mouseHistory.length > 12) mouseHistory.shift();

      const { normX, normY } = screenToNorm(e.clientX, e.clientY);
      mouseLastNormX = normX;
      mouseLastNormY = normY;
      onAimUpdateRef.current?.(normX, normY);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!mouseDown || !enabledRef.current) return;
      mouseDown = false;
      mouseHistory.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      const vel = computeRecencyVelocity(mouseHistory);

      const { normX, normY } = screenToNorm(e.clientX, e.clientY);
      mouseLastNormX = normX;
      mouseLastNormY = normY;

      const pt = planThrow(mouseLastNormX, mouseLastNormY, vel);
      onThrowRef.current(pt);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener(
        "touchstart",
        onStart,
        opts as EventListenerOptions,
      );
      document.removeEventListener(
        "touchmove",
        onMove,
        opts as EventListenerOptions,
      );
      document.removeEventListener(
        "touchend",
        onEnd,
        opts as EventListenerOptions,
      );
      document.removeEventListener(
        "touchcancel",
        onEnd,
        opts as EventListenerOptions,
      );
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        pointerEvents: "none",
      }}
    />
  );
}
