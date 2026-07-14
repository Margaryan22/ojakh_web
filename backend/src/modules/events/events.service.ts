import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter } from 'rxjs';

/**
 * Внутренняя шина realtime-событий для SSE (GET /events/stream).
 *
 * Каждое событие адресовано либо конкретному пользователю (userId),
 * либо всем администраторам (admin: true). Осознанно без Redis/EventEmitter2:
 * один процесс на одном VPS — достаточно RxJS Subject.
 */
export interface AppEvent {
  /** Тип события — фронт использует его как имя EventSource-события. */
  type: 'notification' | 'order-message' | 'new-order';
  /** Адресат-пользователь (например, новое уведомление или ответ админа в чате). */
  userId?: number;
  /** Адресовано администраторам (новый заказ, сообщение покупателя). */
  admin?: boolean;
  /** Небольшая полезная нагрузка (id заказа и т.п.). */
  data?: Record<string, unknown>;
}

@Injectable()
export class EventsService {
  private readonly bus = new Subject<AppEvent>();

  emit(event: AppEvent): void {
    this.bus.next(event);
  }

  /** Поток событий, видимых данному пользователю. */
  streamFor(user: { id: number; role?: string }): Observable<AppEvent> {
    return this.bus.asObservable().pipe(
      filter(
        (e) =>
          (e.userId != null && e.userId === user.id) ||
          (e.admin === true && user.role === 'admin'),
      ),
    );
  }
}
