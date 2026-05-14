'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { DUR_BASE, EASE_OUT, STAGGER_CHILD, Y_SHIFT } from './motion-presets';

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: STAGGER_CHILD,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: Y_SHIFT },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR_BASE, ease: EASE_OUT },
  },
};

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  once?: boolean;
  /** Trigger on mount instead of when in view */
  immediate?: boolean;
}

export function StaggerContainer({
  children,
  className,
  once = true,
  immediate = false,
}: StaggerContainerProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  if (immediate) {
    return (
      <motion.div
        className={className}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: '-10% 0px' }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
