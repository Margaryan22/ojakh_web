'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-none border-0 border-b border-border bg-transparent px-1 py-2 text-base text-foreground file:border-0 file:bg-transparent file:text-sm placeholder:text-muted-foreground/70 transition-colors focus-visible:outline-none focus-visible:border-gold disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
