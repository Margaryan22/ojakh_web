'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Pencil, Trash2, Plus } from 'lucide-react';
import { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth.store';
import { FadeIn } from '@/components/motion/fade-in';
import api from '@/lib/api';
import type { UserAddress } from '@/types';

const MAX_ADDRESSES = 5;

type FormState = {
  label: string;
  address: string;
  apartment: string;
  entrance: string;
  floor: string;
  intercom: string;
  notes: string;
};

const emptyForm: FormState = {
  label: '',
  address: '',
  apartment: '',
  entrance: '',
  floor: '',
  intercom: '',
  notes: '',
};

export default function AddressesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const { data: addresses, isLoading } = useQuery<UserAddress[]>({
    queryKey: ['savedAddresses'],
    queryFn: async () => {
      const { data } = await api.get('/addresses');
      return data;
    },
    enabled: !!user,
  });

  if (!isInitialized) {
    return (
      <div className='max-w-lg mx-auto space-y-4'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-32 w-full rounded-xl' />
      </div>
    );
  }

  if (!user) {
    router.push('/login?next=/profile/addresses');
    return null;
  }

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsAdding(true);
  };

  const startEdit = (a: UserAddress) => {
    setIsAdding(false);
    setEditingId(a.id);
    setForm({
      label: a.label ?? '',
      address: a.address,
      apartment: a.apartment ?? '',
      entrance: a.entrance ?? '',
      floor: a.floor ?? '',
      intercom: a.intercom ?? '',
      notes: a.notes ?? '',
    });
  };

  const cancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.address.trim()) {
      toast.error('Введите адрес');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        label: form.label.trim() || undefined,
        address: form.address.trim(),
        apartment: form.apartment.trim() || undefined,
        entrance: form.entrance.trim() || undefined,
        floor: form.floor.trim() || undefined,
        intercom: form.intercom.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editingId != null) {
        await api.patch(`/addresses/${editingId}`, payload);
        toast.success('Адрес обновлён');
      } else {
        await api.post('/addresses', payload);
        toast.success('Адрес сохранён');
      }
      await queryClient.invalidateQueries({ queryKey: ['savedAddresses'] });
      cancel();
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка сохранения');
      } else {
        toast.error('Ошибка сохранения');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот адрес?')) return;
    try {
      await api.delete(`/addresses/${id}`);
      await queryClient.invalidateQueries({ queryKey: ['savedAddresses'] });
      toast.success('Адрес удалён');
    } catch {
      toast.error('Не удалось удалить адрес');
    }
  };

  const limitReached = (addresses?.length ?? 0) >= MAX_ADDRESSES;
  const isEditing = editingId != null || isAdding;

  return (
    <FadeIn>
      <div className='max-w-lg mx-auto space-y-6'>
        <div className='flex items-center gap-2'>
          <Link href='/profile'>
            <Button variant='ghost' size='icon'>
              <ArrowLeft className='h-4 w-4' />
            </Button>
          </Link>
          <h1 className='text-2xl font-bold'>Мои адреса</h1>
        </div>

        {isLoading && <Skeleton className='h-24 w-full rounded-xl' />}

        {!isLoading && addresses && addresses.length === 0 && !isEditing && (
          <Card>
            <CardContent className='py-8 text-center text-sm text-muted-foreground space-y-3'>
              <p>Сохранённых адресов пока нет.</p>
              <p className='text-xs'>
                Адрес из ближайшего заказа сохранится автоматически, либо
                добавьте его вручную.
              </p>
            </CardContent>
          </Card>
        )}

        {addresses && addresses.length > 0 && (
          <div className='space-y-2'>
            {addresses.map((a) => (
              <Card key={a.id}>
                <CardContent className='p-4 flex items-start gap-3'>
                  <MapPin className='h-4 w-4 mt-0.5 shrink-0 text-muted-foreground' />
                  <div className='min-w-0 flex-1 space-y-0.5'>
                    {a.label && (
                      <p className='text-xs text-muted-foreground'>
                        {a.label}
                      </p>
                    )}
                    <p className='text-sm font-medium break-words'>{a.address}</p>
                    {(a.apartment || a.entrance || a.floor || a.intercom) && (
                      <p className='text-xs text-muted-foreground'>
                        {[
                          a.apartment && `кв./офис ${a.apartment}`,
                          a.entrance && `подъезд ${a.entrance}`,
                          a.floor && `этаж ${a.floor}`,
                          a.intercom && `домофон ${a.intercom}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    {a.notes && (
                      <p className='text-xs text-muted-foreground'>
                        Комментарий: {a.notes}
                      </p>
                    )}
                  </div>
                  <div className='flex gap-1 shrink-0'>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => startEdit(a)}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => handleDelete(a.id)}
                    >
                      <Trash2 className='h-4 w-4 text-destructive' />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isEditing && (
          <Card>
            <CardContent className='p-4 space-y-3'>
              <p className='text-sm font-semibold'>
                {editingId != null ? 'Изменить адрес' : 'Новый адрес'}
              </p>
              <div className='space-y-1.5'>
                <Label htmlFor='form-label'>Метка (необязательно)</Label>
                <Input
                  id='form-label'
                  value={form.label}
                  onChange={(e) =>
                    setForm({ ...form, label: e.target.value })
                  }
                  placeholder='Дом, Работа…'
                  maxLength={40}
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='form-address'>Адрес</Label>
                <Input
                  id='form-address'
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder='Улица, дом'
                  maxLength={300}
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1.5'>
                  <Label htmlFor='form-apt'>Квартира / офис</Label>
                  <Input
                    id='form-apt'
                    value={form.apartment}
                    onChange={(e) =>
                      setForm({ ...form, apartment: e.target.value })
                    }
                    maxLength={20}
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='form-entrance'>Подъезд</Label>
                  <Input
                    id='form-entrance'
                    value={form.entrance}
                    onChange={(e) =>
                      setForm({ ...form, entrance: e.target.value })
                    }
                    maxLength={20}
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='form-floor'>Этаж</Label>
                  <Input
                    id='form-floor'
                    value={form.floor}
                    onChange={(e) =>
                      setForm({ ...form, floor: e.target.value })
                    }
                    maxLength={20}
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='form-intercom'>Домофон</Label>
                  <Input
                    id='form-intercom'
                    value={form.intercom}
                    onChange={(e) =>
                      setForm({ ...form, intercom: e.target.value })
                    }
                    maxLength={50}
                  />
                </div>
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='form-notes'>Комментарий (необязательно)</Label>
                <textarea
                  id='form-notes'
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  rows={2}
                  maxLength={500}
                  className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none'
                />
              </div>
              <div className='flex gap-2 pt-1'>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Сохранение…' : 'Сохранить'}
                </Button>
                <Button variant='outline' onClick={cancel} disabled={isSaving}>
                  Отмена
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isEditing && (
          <Button
            variant='outline'
            className='w-full gap-2'
            onClick={startAdd}
            disabled={limitReached}
          >
            <Plus className='h-4 w-4' />
            {limitReached
              ? `Лимит ${MAX_ADDRESSES} адресов достигнут`
              : 'Добавить адрес'}
          </Button>
        )}
      </div>
    </FadeIn>
  );
}
