import {
  Controller,
  MessageEvent,
  Query,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Observable, interval, map, merge } from 'rxjs';
import { EventsService } from './events.service';

// Heartbeat должен быть чаще, чем proxy_read_timeout nginx (60с),
// иначе прокси разорвёт «молчащее» соединение.
const HEARTBEAT_MS = 25_000;

@ApiTags('events')
// Длинные переподключающиеся соединения не должны съедать общий rate limit.
@SkipThrottle()
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * SSE-поток realtime-событий (уведомления, чат, новые заказы для админа).
   * EventSource не умеет слать заголовки, поэтому access-токен передаётся
   * query-параметром и валидируется тем же секретом, что в JwtGuard.
   * Токен короткоживущий; в логи nginx запросы к /events не пишутся особо
   * чувствительными — но при желании их можно исключить из access_log.
   */
  @Sse('stream')
  @ApiOperation({ summary: 'SSE-поток событий (auth: ?token=<accessToken>)' })
  @ApiQuery({ name: 'token', required: true })
  stream(@Query('token') token?: string): Observable<MessageEvent> {
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    let user: { id: number; role?: string };
    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      user = { id: payload.sub, role: payload.role };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const events = this.events
      .streamFor(user)
      .pipe(map((e) => ({ type: e.type, data: e.data ?? {} }) as MessageEvent));

    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map(() => ({ type: 'ping', data: 'ping' }) as MessageEvent),
    );

    return merge(events, heartbeat);
  }
}
