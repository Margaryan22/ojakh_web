import { cn } from '@/lib/utils';

interface EditorialNumberProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'text-3xl md:text-4xl',
  md: 'text-5xl md:text-6xl',
  lg: 'text-7xl md:text-8xl',
};

export function EditorialNumber({
  children,
  size = 'md',
  className,
}: EditorialNumberProps) {
  return (
    <span
      className={cn(
        'font-display italic text-gold/40 leading-none tabular-nums select-none',
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
