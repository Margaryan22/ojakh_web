import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-gold/60 bg-transparent text-foreground',
        secondary: 'border-border bg-sand text-foreground',
        destructive:
          'border-destructive/60 bg-transparent text-destructive',
        outline: 'border-gold/40 bg-transparent text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
