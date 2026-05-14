'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CATEGORY_LABELS } from '@/lib/constants';
import { DUR_BASE, EASE_OUT } from '@/components/motion/motion-presets';
import { cn } from '@/lib/utils';
import type { ProductCategory } from '@/types';

interface CategoryNavProps {
  categories: ProductCategory[];
}

export function CategoryNav({ categories }: CategoryNavProps) {
  const [active, setActive] = useState<ProductCategory | null>(
    categories[0] ?? null,
  );
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const isScrollingProgrammatically = useRef(false);

  useEffect(() => {
    if (categories.length === 0) return;

    const sections = categories
      .map((cat) => document.getElementById(cat))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingProgrammatically.current) return;

        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.target.getBoundingClientRect().top -
              b.target.getBoundingClientRect().top,
          );

        if (visible.length > 0) {
          setActive(visible[0].target.id as ProductCategory);
        }
      },
      {
        rootMargin: '-120px 0px -50% 0px',
        threshold: 0,
      },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    if (!active) return;
    const pill = pillRefs.current.get(active);
    pill?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active]);

  const handleClick = (cat: ProductCategory) => {
    const el = document.getElementById(cat);
    if (!el) return;
    setActive(cat);
    isScrollingProgrammatically.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, 700);
  };

  return (
    <nav className="sticky top-16 z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {categories.map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              ref={(el) => {
                if (el) pillRefs.current.set(cat, el);
                else pillRefs.current.delete(cat);
              }}
              type="button"
              onClick={() => handleClick(cat)}
              className={cn(
                'relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/70',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="category-pill"
                  className="absolute inset-0 rounded-full bg-primary z-0"
                  transition={{ type: 'tween', duration: DUR_BASE, ease: EASE_OUT }}
                />
              )}
              <span className="relative z-10">{CATEGORY_LABELS[cat]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
