'use client';

import { motion, useReducedMotion, type Variants } from 'motion/react';
import type { ElementType, ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  y?: number;
  duration?: number;
  once?: boolean;
  className?: string;
}

export function Reveal({
  children,
  as = 'div',
  delay = 0,
  y = 24,
  duration = 0.7,
  once = true,
  className,
}: RevealProps) {
  const reduced = useReducedMotion();
  const MotionTag = motion(as as 'div');

  const variants: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduced ? 0.2 : duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <MotionTag
      className={className}
      initial='hidden'
      whileInView='visible'
      viewport={{ once, margin: '-80px' }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}
