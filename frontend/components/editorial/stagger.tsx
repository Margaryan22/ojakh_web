'use client';

import { motion, useReducedMotion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

interface StaggerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  disableInitial?: boolean;
}

export function Stagger({
  children,
  className,
  staggerDelay = 0.06,
  disableInitial = false,
}: StaggerProps) {
  const reduced = useReducedMotion();

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduced ? 0 : staggerDelay,
        delayChildren: 0.05,
      },
    },
  };

  return (
    <motion.div
      className={className}
      initial={disableInitial ? false : 'hidden'}
      whileInView='visible'
      viewport={{ once: true, amount: 0.1, margin: '-40px' }}
      variants={containerVariants}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  y?: number;
}

export function StaggerItem({ children, className, y = 16 }: StaggerItemProps) {
  const reduced = useReducedMotion();

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduced ? 0.2 : 0.6,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
