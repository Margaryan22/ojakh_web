import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/motion/fade-in';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
      <FadeIn className="flex flex-col items-center gap-4">
        <SearchX className="h-16 w-16 text-primary" strokeWidth={1.5} />
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="text-2xl">Страница не найдена</h1>
        <p className="text-muted-foreground max-w-md">
          Возможно, ссылка устарела или страница была удалена.
        </p>
        <Button asChild>
          <Link href="/catalog">Вернуться в каталог</Link>
        </Button>
      </FadeIn>
    </div>
  );
}
