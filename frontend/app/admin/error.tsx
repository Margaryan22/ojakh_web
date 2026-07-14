'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Сегментная граница ошибок админки: ошибка в разделе не роняет всё
// приложение до корневого app/error.tsx — навигация админки остаётся.
export default function AdminError({
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
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center gap-4">
      <TriangleAlert className="h-14 w-14 text-destructive" strokeWidth={1.5} />
      <h1 className="text-xl font-semibold">Раздел админки не загрузился</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Ошибка уже отправлена в мониторинг. Попробуйте обновить раздел.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>Попробовать снова</Button>
        <Button asChild variant="outline">
          <Link href="/admin">К заказам</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Код ошибки: {error.digest}</p>
      )}
    </div>
  );
}
