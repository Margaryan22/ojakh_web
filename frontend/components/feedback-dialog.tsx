'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, HelpCircle, AlertCircle, Heart, Send } from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { FeedbackKind } from '@/types';

const MIN_LEN = 5;
const MAX_LEN = 2000;

const KIND_OPTIONS: {
  value: FeedbackKind;
  label: string;
  Icon: typeof Sparkles;
  placeholder: string;
}[] = [
  {
    value: 'idea',
    label: 'Идея',
    Icon: Sparkles,
    placeholder: 'Опишите вашу идею или предложение — что бы вы хотели увидеть в Ojakh?',
  },
  {
    value: 'question',
    label: 'Вопрос',
    Icon: HelpCircle,
    placeholder: 'О чём хотите спросить? Мы постараемся ответить.',
  },
  {
    value: 'complaint',
    label: 'Жалоба',
    Icon: AlertCircle,
    placeholder: 'Что пошло не так? Опишите ситуацию — мы разберёмся.',
  },
  {
    value: 'praise',
    label: 'Похвала',
    Icon: Heart,
    placeholder: 'Поделитесь, что вам понравилось — приятно слышать!',
  },
];

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [text, setText] = useState('');

  const reset = () => {
    setKind('idea');
    setText('');
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post('/feedback', { kind, text: text.trim() });
    },
    onSuccess: () => {
      toast.success('Спасибо! Мы прочитаем ваше сообщение.');
      reset();
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof AxiosError) {
        toast.error(err.response?.data?.message ?? 'Не удалось отправить — попробуйте ещё раз');
      } else {
        toast.error('Не удалось отправить — попробуйте ещё раз');
      }
    },
  });

  const trimmedLen = text.trim().length;
  const canSubmit = trimmedLen >= MIN_LEN && trimmedLen <= MAX_LEN && !mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  };

  const activeOption = KIND_OPTIONS.find((o) => o.value === kind) ?? KIND_OPTIONS[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !mutation.isPending) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='h-5 w-5 text-primary' />
            Предложения и обратная связь
          </DialogTitle>
          <DialogDescription>
            Расскажите, что нам улучшить, что добавить или поделитесь впечатлением — каждое сообщение читает владелец.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='feedback-kind'>Тип сообщения</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as FeedbackKind)}>
              <SelectTrigger id='feedback-kind'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map(({ value, label, Icon }) => (
                  <SelectItem key={value} value={value}>
                    <span className='inline-flex items-center gap-2'>
                      <Icon className='h-4 w-4 text-primary' />
                      {label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='feedback-text'>Сообщение</Label>
            <textarea
              id='feedback-text'
              rows={6}
              maxLength={MAX_LEN}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={activeOption.placeholder}
              className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none'
            />
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>
                Если хотите, чтобы вам ответили — оставьте контакт в тексте.
              </span>
              <span
                className={cn(
                  'tabular-nums',
                  trimmedLen > 0 && trimmedLen < MIN_LEN && 'text-destructive',
                )}
              >
                {trimmedLen} / {MAX_LEN}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Отмена
            </Button>
            <Button type='submit' disabled={!canSubmit} className='gap-1.5'>
              <Send className='h-4 w-4' />
              {mutation.isPending ? 'Отправляем…' : 'Отправить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
