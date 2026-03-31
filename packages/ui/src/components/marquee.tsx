"use client";

import { animate, motion, useMotionValue, useSpring } from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface MarqueeProps {
  children: ReactNode;
  speed?: number;
}

export function Marquee({ children, speed = 50 }: MarqueeProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [halfWidth, setHalfWidth] = useState(0);

  const x = useMotionValue(0);
  const isDragging = useRef(false);
  const rafRef = useRef(0);
  const lastFrameTime = useRef(0);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);
  const lastPointerX = useRef(0);
  const velocityTracker = useRef<{ t: number; x: number }[]>([]);

  // Speed multiplier: 1 = full speed, 0 = paused. Springs for smooth ease.
  const targetSpeed = useMotionValue(1);
  const currentSpeed = useSpring(targetSpeed, {
    stiffness: 80,
    damping: 20,
  });

  // Measure the content half-width (one copy of children)
  useEffect(() => {
    if (!innerRef.current) {
      return;
    }
    const measure = () => {
      const w = innerRef.current!.scrollWidth / 2;
      setHalfWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, []);

  // Wrap x so it loops seamlessly
  const wrap = useCallback(
    (v: number) => {
      if (halfWidth === 0) {
        return v;
      }
      return (((-v % halfWidth) + halfWidth) % halfWidth) * -1;
    },
    [halfWidth]
  );

  // rAF-based auto-scroll that respects currentSpeed multiplier
  const tick = useCallback(
    (time: number) => {
      if (isDragging.current || !halfWidth) {
        lastFrameTime.current = time;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dt = lastFrameTime.current
        ? (time - lastFrameTime.current) / 1000
        : 0;
      lastFrameTime.current = time;

      const pxPerSec = halfWidth / speed;
      const delta = pxPerSec * dt * currentSpeed.get();
      const raw = x.get() - delta;
      x.jump(wrap(raw));

      rafRef.current = requestAnimationFrame(tick);
    },
    [halfWidth, speed, x, currentSpeed, wrap]
  );

  useEffect(() => {
    if (!halfWidth) {
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [halfWidth, tick]);

  // Hover: ease speed to 0 / back to 1
  const onContainerEnter = useCallback(() => {
    targetSpeed.set(0);
  }, [targetSpeed]);

  const onContainerLeave = useCallback(() => {
    if (!isDragging.current) {
      targetSpeed.set(1);
    }
  }, [targetSpeed]);

  // Pointer-based drag
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      animRef.current?.stop();
      targetSpeed.set(0);
      lastPointerX.current = e.clientX;
      velocityTracker.current = [{ t: Date.now(), x: e.clientX }];
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [targetSpeed]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) {
        return;
      }
      const delta = e.clientX - lastPointerX.current;
      lastPointerX.current = e.clientX;
      x.jump(wrap(x.get() + delta));

      const now = Date.now();
      velocityTracker.current.push({ t: now, x: e.clientX });
      velocityTracker.current = velocityTracker.current.filter(
        (p) => now - p.t < 50
      );
    },
    [x, wrap]
  );

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) {
      return;
    }
    isDragging.current = false;

    const samples = velocityTracker.current;
    let velocity = 0;
    if (samples.length >= 2) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const first = samples[0]!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const last = samples[samples.length - 1]!;
      const dt = (last.t - first.t) / 1000;
      if (dt > 0) {
        velocity = (last.x - first.x) / dt;
      }
    }

    // Momentum spring with overshoot, then ease back to full speed
    const momentum = velocity * 0.5;
    animRef.current = animate(x, x.get() + momentum, {
      type: "spring",
      stiffness: 150,
      damping: 12,
      velocity,
      onComplete: () => targetSpeed.set(1),
    });
  }, [x, targetSpeed]);

  return (
    <div
      className="relative touch-pan-y select-none overflow-x-clip border-[#e5e0d5] border-b bg-[#f5f3ee]"
      onMouseEnter={onContainerEnter}
      onMouseLeave={onContainerLeave}
    >
      <motion.div
        className="flex w-max cursor-grab active:cursor-grabbing"
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={innerRef}
        style={{ x }}
      >
        <div className="flex items-center py-2">{children}</div>
        <div aria-hidden="true" className="flex items-center py-2">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
