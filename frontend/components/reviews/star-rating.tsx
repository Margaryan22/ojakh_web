'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

export function StarRating({ value, onChange, size = 'md', className }: StarRatingProps) {
  const interactive = !!onChange;
  const sizeClass = SIZE_MAP[size];

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        const StarComponent = (
          <Star
            className={cn(
              sizeClass,
              filled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40',
              interactive && 'transition-transform hover:scale-110',
            )}
          />
        );
        if (!interactive) return <span key={star}>{StarComponent}</span>;
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            className="cursor-pointer p-0.5 -m-0.5"
            aria-label={`Поставить ${star} ${star === 1 ? 'звезду' : 'звезд'}`}
          >
            {StarComponent}
          </button>
        );
      })}
    </div>
  );
}
