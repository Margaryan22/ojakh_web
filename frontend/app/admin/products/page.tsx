'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatPrice } from '@/lib/format';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/constants';
import type { Product, ProductCategory } from '@/types';
import { AxiosError } from 'axios';

interface ProductFormData {
  name: string;
  category: string;
  flavor: string;
  size: string;
  weightGrams: string;
  unit: string;
  price: string;
  description: string;
  available: boolean;
  maxPerDay: string;
}

const emptyForm: ProductFormData = {
  name: '',
  category: 'хинкали',
  flavor: '',
  size: '',
  weightGrams: '',
  unit: 'шт',
  price: '',
  description: '',
  available: true,
  maxPerDay: '999',
};

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data } = await api.get('/products');
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let imageUrl: string | undefined;
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const { data: uploadData } = await api.post('/uploads', formData);
        imageUrl = uploadData.url;
      }

      const payload: Record<string, unknown> = {
        name: form.name,
        category: form.category,
        flavor: form.flavor || null,
        size: form.size || null,
        weightGrams: form.weightGrams ? parseInt(form.weightGrams) : null,
        unit: form.unit,
        price: Math.round(parseFloat(form.price) * 100),
        description: form.description || null,
        available: form.available,
        maxPerDay: parseInt(form.maxPerDay) || 999,
      };
      if (imageUrl) payload.imageUrl = imageUrl;

      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success(editingProduct ? 'Товар обновлён' : 'Товар создан');
      closeDialog();
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка сохранения');
      } else {
        toast.error('Ошибка сохранения');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('Товар удалён');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка удаления');
      }
    },
  });

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      flavor: product.flavor ?? '',
      size: product.size ?? '',
      weightGrams: product.weightGrams?.toString() ?? '',
      unit: product.unit,
      price: (product.price / 100).toString(),
      description: product.description ?? '',
      available: product.available,
      maxPerDay: product.maxPerDay.toString(),
    });
    setImageFile(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      toast.error('Заполните обязательные поля');
      return;
    }
    saveMutation.mutate();
  };

  const updateField = (field: keyof ProductFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Товары</h1>
        <Button onClick={openCreate} className="gap-1">
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      <div className="space-y-2">
        {products.map((product) => (
          <Card key={product.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{product.name}</span>
                  {product.flavor && (
                    <Badge variant="secondary" className="text-[10px]">{product.flavor}</Badge>
                  )}
                  {product.size && (
                    <Badge variant="secondary" className="text-[10px]">{product.size}</Badge>
                  )}
                  {!product.available && (
                    <Badge variant="destructive" className="text-[10px]">Недоступен</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[product.category as ProductCategory]} &middot;{' '}
                  {formatPrice(product.price)} / {product.unit}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    if (confirm('Удалить товар?')) deleteMutation.mutate(product.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Редактировать товар' : 'Новый товар'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Измените данные товара' : 'Заполните данные нового товара'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Название *</Label>
                <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Категория</Label>
                <Select value={form.category} onValueChange={(v) => updateField('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ORDER.map((cat) => (
                      <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Единица</Label>
                <Select value={form.unit} onValueChange={(v) => updateField('unit', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="шт">шт</SelectItem>
                    <SelectItem value="кг">кг</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Начинка / Вкус</Label>
                <Input value={form.flavor} onChange={(e) => updateField('flavor', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Размер</Label>
                <Input value={form.size} onChange={(e) => updateField('size', e.target.value)} placeholder="S, M, L" />
              </div>
              <div className="space-y-1.5">
                <Label>Цена (руб) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Вес (г)</Label>
                <Input
                  type="number"
                  value={form.weightGrams}
                  onChange={(e) => updateField('weightGrams', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Макс. в день</Label>
                <Input
                  type="number"
                  value={form.maxPerDay}
                  onChange={(e) => updateField('maxPerDay', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Изображение</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Описание</Label>
                <Input value={form.description} onChange={(e) => updateField('description', e.target.value)} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={form.available}
                  onChange={(e) => updateField('available', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="available">Доступен для заказа</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Отмена
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
