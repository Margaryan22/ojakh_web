'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-foreground text-background font-display uppercase tracking-[0.18em] text-xs hover:bg-primary',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 font-display uppercase tracking-[0.18em] text-xs',
        outline:
          'border border-gold/60 bg-transparent hover:border-foreground hover:bg-gold/10 font-display uppercase tracking-[0.18em] text-xs',
        secondary:
          'bg-sand text-foreground hover:bg-accent font-display uppercase tracking-[0.18em] text-xs',
        ghost: 'hover:bg-accent hover:text-foreground',
        link: 'text-foreground underline-offset-4 hover:underline',
        editorial:
          'bg-transparent border-b border-gold rounded-none px-1 pb-1 hover:border-foreground font-display tracking-wide',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 px-4',
        lg: 'h-12 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
