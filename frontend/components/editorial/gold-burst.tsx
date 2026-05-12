'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface GoldBurstProps {
  trigger: number;
  particleCount?: number;
  radius?: number;
}

export function GoldBurst({
  trigger,
  particleCount = 12,
  radius = 36,
}: GoldBurstProps) {
  const [active, setActive] = useState(0);
  const previous = useRef(trigger);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (trigger > previous.current) {
      setActive((n) => n + 1);
    }
    previous.current = trigger;
  }, [trigger]);

  if (reduced) return null;

  return (
    <span
      aria-hidden
      className='pointer-events-none absolute inset-0 flex items-center justify-center'
    >
      <AnimatePresence>
        {Array.from({ length: active === 0 ? 0 : particleCount }).map((_, i) => {
          const angle = (i / particleCount) * Math.PI * 2;
          const dx = Math.cos(angle) * radius;
          const dy = Math.sin(angle) * radius;
          return (
            <motion.span
              key={`${active}-${i}`}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: dx, y: dy, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className='absolute h-1 w-1 rounded-full bg-gold'
            />
          );
        })}
      </AnimatePresence>
    </span>
  );
}
