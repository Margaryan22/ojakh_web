'use client';

import Link, { type LinkProps } from 'next/link';
import { useRouter } from 'next/navigation';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

type ViewTransitionLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
    className?: string;
  };

export function ViewTransitionLink({
  children,
  onClick,
  href,
  ...rest
}: ViewTransitionLinkProps) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (typeof href !== 'string') return;

    if (
      typeof document !== 'undefined' &&
      'startViewTransition' in document
    ) {
      e.preventDefault();
      (document as Document & {
        startViewTransition: (cb: () => void) => void;
      }).startViewTransition(() => {
        router.push(href);
      });
    }
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
