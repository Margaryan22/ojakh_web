import { cn } from '@/lib/utils';

interface GoldDividerProps {
  variant?: 'solid' | 'dotted';
  align?: 'left' | 'center' | 'full';
  withGlyph?: boolean;
  className?: string;
}

export function GoldDivider({
  variant = 'solid',
  align = 'full',
  withGlyph = false,
  className,
}: GoldDividerProps) {
  if (withGlyph) {
    return (
      <div
        className={cn(
          'flex items-center gap-4',
          align === 'center' && 'justify-center',
          className,
        )}
      >
        <span
          className={cn(
            'h-px flex-1 bg-gold',
            variant === 'dotted' &&
              'bg-[image:repeating-linear-gradient(to_right,var(--color-gold)_0,var(--color-gold)_2px,transparent_2px,transparent_6px)] bg-transparent',
          )}
        />
        <span className='text-gold text-xs leading-none select-none'>◆</span>
        <span
          className={cn(
            'h-px flex-1 bg-gold',
            variant === 'dotted' &&
              'bg-[image:repeating-linear-gradient(to_right,var(--color-gold)_0,var(--color-gold)_2px,transparent_2px,transparent_6px)] bg-transparent',
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-px',
        variant === 'solid' && 'bg-gold',
        variant === 'dotted' &&
          'bg-[image:repeating-linear-gradient(to_right,var(--color-gold)_0,var(--color-gold)_2px,transparent_2px,transparent_6px)]',
        align === 'left' && 'w-16',
        align === 'center' && 'w-24 mx-auto',
        align === 'full' && 'w-full',
        className,
      )}
    />
  );
}
