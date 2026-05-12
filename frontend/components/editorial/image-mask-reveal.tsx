'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ImageMaskRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: 'left-to-right' | 'top-to-bottom';
}

export function ImageMaskReveal({
  children,
  className,
  delay = 0.1,
  duration = 1.1,
  direction = 'left-to-right',
}: ImageMaskRevealProps) {
  const reduced = useReducedMotion();

  const initial =
    direction === 'left-to-right'
      ? { clipPath: 'inset(0 100% 0 0)' }
      : { clipPath: 'inset(0 0 100% 0)' };
  const animate = { clipPath: 'inset(0 0 0 0)' };

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn('overflow-hidden', className)}
      initial={initial}
      animate={animate}
      transition={{
        delay,
        duration,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
