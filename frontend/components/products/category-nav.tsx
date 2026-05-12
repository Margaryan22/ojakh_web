'use client';

import { useEffect, useRef, useState } from 'react';
import { CATEGORY_LABELS } from '@/lib/constants';
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
                'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/70',
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
