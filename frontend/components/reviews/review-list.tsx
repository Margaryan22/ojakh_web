'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StarRating } from './star-rating';
import { ReviewForm } from './review-form';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { AnimatePresence, motion } from 'framer-motion';
import { DUR_BASE, EASE_OUT } from '@/components/motion/motion-presets';
import type { Review } from '@/types';

interface ReviewListProps {
  productId: number;
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      <BadgeCheck className="h-3 w-3" />
      Подтверждённая покупка
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ReviewList({ productId }: ReviewListProps) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ['reviews', productId],
    queryFn: async () => {
      const { data } = await api.get(`/products/${productId}/reviews`);
      return data.reviews ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      await api.delete(`/reviews/${reviewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['reviews-summary', productId] });
      toast.success('Отзыв удалён');
    },
    onError: () => {
      toast.error('Не удалось удалить отзыв');
    },
  });

  const ownReview = reviews?.find((r) => r.user.id === user?.id);
  const otherReviews = reviews?.filter((r) => r.user.id !== user?.id) ?? [];

  return (
    <div className="space-y-4">
      <ReviewForm productId={productId} existing={ownReview} />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : !reviews || reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Пока нет отзывов. Будьте первым!
        </p>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
          {ownReview && (
            <motion.li
              key={`own-${ownReview.id}`}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: DUR_BASE, ease: EASE_OUT }}
              className="rounded-xl border bg-primary/5 p-4 space-y-2 overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                    {ownReview.user.name} (вы)
                    {ownReview.verifiedPurchase && <VerifiedBadge />}
                  </p>
                  <div className="flex items-center gap-2">
                    <StarRating value={ownReview.rating} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(ownReview.createdAt)}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(ownReview.id)}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:text-destructive shrink-0"
                  aria-label="Удалить отзыв"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{ownReview.text}</p>
            </motion.li>
          )}

          {otherReviews.map((review) => (
            <motion.li
              key={review.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: DUR_BASE, ease: EASE_OUT }}
              className="rounded-xl border bg-card p-4 space-y-2 overflow-hidden"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  {review.user.name}
                  {review.verifiedPurchase && <VerifiedBadge />}
                </p>
                <div className="flex items-center gap-2">
                  <StarRating value={review.rating} size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(review.createdAt)}
                  </span>
                </div>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.text}</p>
            </motion.li>
          ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
