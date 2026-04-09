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
    let startX = 0;
    let startY = 0;
    let history: PointerSample[] = [];

    const onStart = (e: TouchEvent) => {
      if (!enabledRef.current || activeTouchId !== null) return;
      e.preventDefault();
      const touch = e.changedTouches[0];
      activeTouchId = touch.identifier;
      startX = touch.clientX;
      startY = touch.clientY;
      history = [{ x: touch.clientX, y: touch.clientY, t: Date.now() }];
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

      // Emit live aim update while finger is held/dragging
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const normX = Math.max(-1, Math.min(1, dx / (window.innerWidth * 0.35)));
      const normY = Math.max(
        -1,
        Math.min(1, -dy / (window.innerHeight * 0.28)),
      );
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

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      // Always fire a throw — even taps fire straight ahead at min power
      const pt = planThrow(
        dx,
        dy,
        velocityMag,
        window.innerWidth,
        window.innerHeight,
      );
      onThrowRef.current(pt);
    };

    const opts: AddEventListenerOptions = { capture: true, passive: false };
    document.addEventListener("touchstart", onStart, opts);
    document.addEventListener("touchmove", onMove, opts);
    document.addEventListener("touchend", onEnd, opts);
    document.addEventListener("touchcancel", onEnd, opts);

    // Mouse support for desktop testing
    let mouseDown = false;
    let mouseStartX = 0;
    let mouseStartY = 0;
    let mouseHistory: PointerSample[] = [];

    const onMouseDown = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      mouseDown = true;
      mouseStartX = e.clientX;
      mouseStartY = e.clientY;
      mouseHistory = [{ x: e.clientX, y: e.clientY, t: Date.now() }];
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return;
      mouseHistory.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      if (mouseHistory.length > 12) mouseHistory.shift();
      const dx = e.clientX - mouseStartX;
      const dy = e.clientY - mouseStartY;
      const normX = Math.max(-1, Math.min(1, dx / (window.innerWidth * 0.35)));
      const normY = Math.max(
        -1,
        Math.min(1, -dy / (window.innerHeight * 0.28)),
      );
      onAimUpdateRef.current?.(normX, normY);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!mouseDown || !enabledRef.current) return;
      mouseDown = false;
      const dx = e.clientX - mouseStartX;
      const dy = e.clientY - mouseStartY;
      mouseHistory.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      const vel = computeRecencyVelocity(mouseHistory);
      const pt = planThrow(dx, dy, vel, window.innerWidth, window.innerHeight);
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
