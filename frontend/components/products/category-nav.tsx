'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CATEGORY_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ProductCategory } from '@/types';

const CATEGORY_DESCRIPTORS: Record<ProductCategory, string> = {
  'хинкали': 'Тбилисский рецепт',
  'пельмени': 'Сибирские и домашние',
  'блинчики': 'С разной начинкой',
  'хлеб': 'На закваске',
  'десерты': 'Без консервантов',
  'торты': 'По предзаказу',
};

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
        rootMargin: '-140px 0px -50% 0px',
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

    const lenis = window.__lenis;
    if (lenis) {
      lenis.scrollTo(el, {
        offset: -110,
        duration: 1.2,
        onComplete: () => {
          isScrollingProgrammatically.current = false;
        },
      });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 700);
    }
  };

  return (
    <nav className='sticky top-20 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-background/85 backdrop-blur-md border-b border-border'>
      <div className='flex gap-8 overflow-x-auto scrollbar-hide'>
        {categories.map((cat, i) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              ref={(el) => {
                if (el) pillRefs.current.set(cat, el);
                else pillRefs.current.delete(cat);
              }}
              type='button'
              onClick={() => handleClick(cat)}
              className={cn(
                'group shrink-0 relative pb-1.5 transition-colors text-left',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className='flex items-baseline gap-2'>
                <span className='font-mono text-[10px] text-gold tabular-nums'>
                  0{i + 1}
                </span>
                <span className='font-display text-sm uppercase tracking-[0.15em] whitespace-nowrap'>
                  {CATEGORY_LABELS[cat]}
                </span>
                <span className='hidden md:inline font-display italic text-xs text-muted-foreground whitespace-nowrap'>
                  · {CATEGORY_DESCRIPTORS[cat]}
                </span>
              </span>
              {isActive && (
                <motion.span
                  layoutId='cat-underline'
                  className='absolute left-0 right-0 -bottom-0.5 h-px bg-gold'
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
