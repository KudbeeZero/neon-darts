import { useCallback, useEffect, useRef, useState } from "react";
import type { DartConfig } from "../types/dart";

export type FlickState = "idle" | "grabbed" | "released";

export interface FlickResult {
  aimOffsetNX: number; // −1 to 1 left/right
  aimOffsetNY: number; // −1 to 1 (positive = higher on board)
  power: number; // 0 to 1
  dartPos: { x: number; y: number }; // screen offset from zone center at release
}

interface PointerSample {
  x: number;
  y: number;
  t: number;
}

export function triggerImpactHaptic() {
  if (navigator.vibrate) navigator.vibrate([20, 10, 30]);
}

export function useFlickInput(
  dartConfig: DartConfig,
  onFlick: (result: FlickResult) => void,
  flickZoneRef?: React.RefObject<HTMLDivElement | null>,
) {
  const [flickState, setFlickState] = useState<FlickState>("idle");
  const [dartPos, setDartPos] = useState({ x: 0, y: 0 });
  const [pullDistance, setPullDistance] = useState(0);
  const [engaged, setEngaged] = useState(false);

  const isGrabbed = useRef(false);
  const engagedRef = useRef(false);
  const pointerSamples = useRef<PointerSample[]>([]);
  const zoneRectRef = useRef<DOMRect | null>(null);
  const dartPosRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const touchStartTimeRef = useRef(0);
  const lastTapTimeRef = useRef(0);

  const getRelPos = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => ({
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2,
    }),
    [],
  );

  const fireStrightAhead = useCallback(
    (rect: DOMRect) => {
      // Fire dart straight at center with moderate power
      setFlickState("released");
      engagedRef.current = false;
      setEngaged(false);
      isGrabbed.current = false;
      onFlick({
        aimOffsetNX: 0,
        aimOffsetNY: 0,
        power: 0.65,
        dartPos: { x: 0, y: 0 },
      });
      void rect;
      setTimeout(() => {
        setDartPos({ x: 0, y: 0 });
        dartPosRef.current = { x: 0, y: 0 };
        setPullDistance(0);
        setFlickState("idle");
      }, 750);
    },
    [onFlick],
  );

  const startGrab = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => {
      if (navigator.vibrate) navigator.vibrate(15);
      isGrabbed.current = true;
      zoneRectRef.current = rect;
      pointerSamples.current = [];
      const pos = engagedRef.current
        ? dartPosRef.current // keep current dart pos if already engaged
        : getRelPos(clientX, clientY, rect);
      dartPosRef.current = pos;
      startPosRef.current = { x: clientX, y: clientY };
      touchStartTimeRef.current = Date.now();
      setDartPos(pos);
      setPullDistance(0);
      setFlickState("grabbed");
      pointerSamples.current.push({ x: clientX, y: clientY, t: Date.now() });
    },
    [getRelPos],
  );

  const moveGrab = useCallback(
    (clientX: number, clientY: number) => {
      if (!isGrabbed.current || !zoneRectRef.current) return;
      const pos = getRelPos(clientX, clientY, zoneRectRef.current);
      dartPosRef.current = pos;
      setDartPos(pos);

      const maxPull = zoneRectRef.current.height * 0.4;
      const pull = Math.max(0, Math.min(1, pos.y / maxPull));
      setPullDistance(pull);

      const now = Date.now();
      pointerSamples.current.push({ x: clientX, y: clientY, t: now });
      pointerSamples.current = pointerSamples.current.filter(
        (s) => now - s.t <= 150,
      );
    },
    [getRelPos],
  );

  const endGrab = useCallback(
    (rect?: DOMRect) => {
      if (!isGrabbed.current) {
        isGrabbed.current = false;
        return;
      }

      const samples = pointerSamples.current;
      let vx = 0;
      let vy = 0;

      if (samples.length >= 2) {
        const recent = samples.slice(-8);
        if (recent.length >= 2) {
          const dt = (recent[recent.length - 1].t - recent[0].t) / 1000;
          if (dt > 0.001) {
            vx = (recent[recent.length - 1].x - recent[0].x) / dt;
            vy = (recent[recent.length - 1].y - recent[0].y) / dt;
          }
        }
      }

      const speed = Math.sqrt(vx * vx + vy * vy);
      const effectiveRect = rect ?? zoneRectRef.current;
      const snapPos = dartPosRef.current;
      const holdDuration = Date.now() - touchStartTimeRef.current;

      // Compute movement from start
      const dx =
        (samples[samples.length - 1]?.x ?? startPosRef.current.x) -
        startPosRef.current.x;
      const dy =
        (samples[samples.length - 1]?.y ?? startPosRef.current.y) -
        startPosRef.current.y;
      const totalMovement = Math.sqrt(dx * dx + dy * dy);

      const isShortTap = totalMovement < 15 && holdDuration < 300;

      // --- Double-tap detection ---
      const now = Date.now();
      if (isShortTap) {
        const timeSinceLast = now - lastTapTimeRef.current;
        if (timeSinceLast < 350 && effectiveRect) {
          // Double-tap → fire straight ahead
          isGrabbed.current = false;
          pointerSamples.current = [];
          fireStrightAhead(effectiveRect);
          lastTapTimeRef.current = 0; // reset so third tap doesn't double-fire
          return;
        }
        // Single tap → engage dart (or re-engage if somehow not)
        lastTapTimeRef.current = now;
        isGrabbed.current = false;
        pointerSamples.current = [];
        engagedRef.current = true;
        setEngaged(true);
        // Keep flickState as "grabbed" so dart is visible and ready
        setFlickState("grabbed");
        setDartPos({ x: 0, y: 0 });
        dartPosRef.current = { x: 0, y: 0 };
        setPullDistance(0);
        return;
      }

      // --- Normal flick detection ---
      isGrabbed.current = false;
      const isFlick = speed > 15 && vy < -5;

      if (isFlick && effectiveRect) {
        const maxAimX = effectiveRect.width * 0.38;
        const maxAimY = effectiveRect.height * 0.38;
        const aimNX = Math.max(-1, Math.min(1, snapPos.x / maxAimX));
        const aimNY = Math.max(-1, Math.min(1, -snapPos.y / maxAimY));
        const maxSpeed = 2000;
        const power = Math.min(1, Math.max(0.15, speed / maxSpeed));

        engagedRef.current = false;
        setEngaged(false);
        setFlickState("released");
        onFlick({
          aimOffsetNX: aimNX,
          aimOffsetNY: aimNY,
          power,
          dartPos: { ...snapPos },
        });

        setTimeout(() => {
          setDartPos({ x: 0, y: 0 });
          dartPosRef.current = { x: 0, y: 0 };
          setPullDistance(0);
          setFlickState("idle");
        }, 750);
      } else if (engagedRef.current) {
        // Finger lifted without a valid flick but dart is engaged → stay engaged, reset pos
        setDartPos({ x: 0, y: 0 });
        dartPosRef.current = { x: 0, y: 0 };
        setPullDistance(0);
        setFlickState("grabbed");
      } else {
        setDartPos({ x: 0, y: 0 });
        dartPosRef.current = { x: 0, y: 0 };
        setPullDistance(0);
        setFlickState("idle");
      }

      pointerSamples.current = [];
    },
    [onFlick, fireStrightAhead],
  );

  // React pointer handlers (desktop + non-touch devices)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // On iOS Chrome, pointer events AND touch events both fire.
      // Native touch handlers below take priority — skip pointer events on touch devices.
      if (e.pointerType === "touch") return;
      e.currentTarget.setPointerCapture(e.pointerId);
      startGrab(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
    },
    [startGrab],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      moveGrab(e.clientX, e.clientY);
    },
    [moveGrab],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      endGrab(e.currentTarget.getBoundingClientRect());
    },
    [endGrab],
  );

  // Native touch handlers (non-passive for iOS Chrome) — these are the primary handlers on mobile
  const nativeTouchStart = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const el = e.currentTarget as HTMLElement;
      startGrab(touch.clientX, touch.clientY, el.getBoundingClientRect());
    },
    [startGrab],
  );

  const nativeTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      moveGrab(touch.clientX, touch.clientY);
    },
    [moveGrab],
  );

  const nativeTouchEnd = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      endGrab(el.getBoundingClientRect());
    },
    [endGrab],
  );

  // Attach non-passive touch listeners to flickZoneRef if provided
  useEffect(() => {
    const el = flickZoneRef?.current;
    if (!el) return;
    el.addEventListener("touchstart", nativeTouchStart, { passive: false });
    el.addEventListener("touchmove", nativeTouchMove, { passive: false });
    el.addEventListener("touchend", nativeTouchEnd, { passive: false });
    el.addEventListener("touchcancel", nativeTouchEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", nativeTouchStart);
      el.removeEventListener("touchmove", nativeTouchMove);
      el.removeEventListener("touchend", nativeTouchEnd);
      el.removeEventListener("touchcancel", nativeTouchEnd);
    };
  }, [flickZoneRef, nativeTouchStart, nativeTouchMove, nativeTouchEnd]);

  const resetDart = useCallback(() => {
    isGrabbed.current = false;
    engagedRef.current = false;
    pointerSamples.current = [];
    lastTapTimeRef.current = 0;
    setEngaged(false);
    setDartPos({ x: 0, y: 0 });
    dartPosRef.current = { x: 0, y: 0 };
    setPullDistance(0);
    setFlickState("idle");
  }, []);

  void dartConfig;

  return {
    flickState,
    dartPos,
    pullDistance,
    engaged,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    resetDart,
  };
}
