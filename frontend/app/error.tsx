'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/motion/fade-in';

export default function Error({
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
      <FadeIn className="flex flex-col items-center gap-4">
        <TriangleAlert className="h-16 w-16 text-destructive" strokeWidth={1.5} />
        <h1 className="text-2xl">Что-то пошло не так</h1>
        <p className="text-muted-foreground max-w-md">
          Мы уже знаем о проблеме и скоро её исправим. Попробуйте обновить страницу.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => reset()}>Попробовать снова</Button>
          <Button asChild variant="outline">
            <Link href="/catalog">Вернуться в каталог</Link>
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Код ошибки: {error.digest}</p>
        )}
      </FadeIn>
    </div>
  );
}
