import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';

@ApiExcludeController()
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Webhook endpoint for Telegram Bot API.
   * Register it once with:
   *   POST https://api.telegram.org/bot<TOKEN>/setWebhook
   *   { "url": "https://yourapi.com/telegram/webhook" }
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() update: any): Promise<void> {
    const message = update?.message;
    if (!message) return;

    const chatId = String(message.chat.id);

    if (message?.text?.startsWith('/start ')) {
      const token = message.text.split(' ')[1];
      if (token) {
        await this.telegramService.handleStartCommand(token, message.from);
        return;
      }
    }

    if (message.contact) {
      // User shared their phone via the "Share Contact" button
      const phone = message.contact.phone_number as string;
      await this.telegramService.handleContactUpdate(chatId, phone);
      return;
    }

    // Any other message → prompt user to share contact
    await this.telegramService.sendShareContactPrompt(chatId);
  }
}
