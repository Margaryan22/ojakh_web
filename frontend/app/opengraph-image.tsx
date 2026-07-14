import { ImageResponse } from 'next/og';

// Глобальная OG-картинка (1200×630) для превью ссылок в соцсетях и мессенджерах.
// Страницы товаров используют собственные фото (см. catalog/[id]/page.tsx).
export const alt = 'Оджах — армянская домашняя кухня, торты на заказ, Нижний Новгород';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #faf8f3 0%, #f3ead9 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 96 }}>🫓</div>
        <div
          style={{
            display: 'flex',
            fontSize: 104,
            fontWeight: 700,
            color: '#8a5a2b',
            marginTop: 8,
          }}
        >
          Оджах
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 38,
            color: '#6b5b45',
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          Армянская домашняя кухня и торты на заказ
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            color: '#ffffff',
            background: '#d4a574',
            borderRadius: 999,
            padding: '12px 32px',
            marginTop: 36,
          }}
        >
          Доставка по Нижнему Новгороду
        </div>
      </div>
    ),
    size,
  );
}
