'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { StarRating } from './star-rating';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { Review } from '@/types';

interface ReviewFormProps {
  productId: number;
  existing?: Review;
}

const MAX_LEN = 2000;

export function ReviewForm({ productId, existing }: ReviewFormProps) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? '');

  useEffect(() => {
    setRating(existing?.rating ?? 0);
    setText(existing?.text ?? '');
  }, [existing?.id, existing?.rating, existing?.text]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/reviews', {
        productId,
        rating,
        text: text.trim(),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['reviews-summary', productId] });
      toast.success(existing ? 'Отзыв обновлён' : 'Отзыв опубликован');
      if (!existing) {
        setRating(0);
        setText('');
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Не удалось сохранить отзыв');
    },
  });

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      toast.error('Поставьте оценку от 1 до 5');
      return;
    }
    if (!text.trim()) {
      toast.error('Напишите текст отзыва');
      return;
    }
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-4 space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">
          {existing ? 'Ваш отзыв' : 'Оставить отзыв'}
        </p>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
        rows={4}
        placeholder="Поделитесь впечатлениями"
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {text.length}/{MAX_LEN}
        </span>
        <Button type="submit" disabled={mutation.isPending}>
          {existing ? 'Обновить' : 'Опубликовать'}
        </Button>
      </div>
    </form>
  );
}
