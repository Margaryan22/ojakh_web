'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/motion/fade-in';

// Сегментная граница ошибок магазина: шапка и подвал из (shop)/layout.tsx
// остаются на месте, падает только контент страницы.
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center gap-4">
      <FadeIn className="flex flex-col items-center gap-4">
        <TriangleAlert className="h-14 w-14 text-destructive" strokeWidth={1.5} />
        <h1 className="text-2xl">Не получилось загрузить страницу</h1>
        <p className="text-muted-foreground max-w-md">
          Мы уже знаем о проблеме. Попробуйте ещё раз или вернитесь в каталог.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => reset()}>Попробовать снова</Button>
          <Button asChild variant="outline">
            <Link href="/catalog">В каталог</Link>
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Код ошибки: {error.digest}</p>
        )}
      </FadeIn>
    </div>
  );
}
