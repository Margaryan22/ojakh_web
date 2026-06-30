'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2, UserRound, Package } from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { FadeIn } from '@/components/motion/fade-in';
import api from '@/lib/api';

interface AdminReview {
  id: number;
  rating: number;
  text: string;
  createdAt: string;
  user: { id: number; name: string; email: string } | null;
  product: { id: number; name: string } | null;
}

const PAGE_SIZE = 50;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminReviewsPage() {
  const [offset, setOffset] = useState(0);
  const [reviewToDelete, setReviewToDelete] = useState<AdminReview | null>(null);
  const queryClient = useQueryClient();

  const { data: reviews = [], isLoading, isFetching } = useQuery<AdminReview[]>({
    queryKey: ['admin-reviews', offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const { data } = await api.get(`/admin/reviews?${params.toString()}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/reviews/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Отзыв удалён');
      setReviewToDelete(null);
    },
    onError: (err) => {
      if (err instanceof AxiosError) {
        toast.error(err.response?.data?.message ?? 'Не удалось удалить');
      } else {
        toast.error('Не удалось удалить');
      }
    },
  });

  const hasMore = reviews.length === PAGE_SIZE;

  return (
    <FadeIn>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-primary" />
            Отзывы о товарах
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Отзывы, оставленные покупателями к товарам. Удалите спам или
            недопустимые сообщения.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            Отзывов пока нет.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        {r.product?.name ?? 'Товар удалён'}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-amber-500 text-sm">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className="h-3.5 w-3.5"
                            fill={i < r.rating ? 'currentColor' : 'none'}
                          />
                        ))}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setReviewToDelete(r)}
                      aria-label="Удалить отзыв"
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                    <UserRound className="h-3 w-3" />
                    {r.user
                      ? `${r.user.name} · ${r.user.email}`
                      : 'Пользователь удалён'}
                    <span>· {formatWhen(r.createdAt)}</span>
                  </p>

                  <p className="text-sm whitespace-pre-wrap break-words">
                    {r.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {(hasMore || offset > 0) && (
          <div className="flex justify-center gap-2">
            {offset > 0 && (
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={isFetching}
              >
                Назад
              </Button>
            )}
            {hasMore && (
              <Button
                variant="outline"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={isFetching}
              >
                {isFetching ? 'Загрузка…' : 'Следующие'}
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={!!reviewToDelete}
        onOpenChange={(open) => !open && setReviewToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить отзыв?</DialogTitle>
            <DialogDescription>
              Отзыв будет удалён без возможности восстановления. Покупатель сможет
              оставить новый отзыв на этот товар.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Отмена</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                reviewToDelete && deleteMutation.mutate(reviewToDelete.id)
              }
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
}
