import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@ApiTags('feedback')
@Controller()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('feedback')
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({ summary: 'Submit feedback (guest or authenticated)' })
  create(@Req() req: any, @Body() dto: CreateFeedbackDto) {
    const userId = req.user?.id ?? null;
    return this.feedbackService.create(userId, dto);
  }

  @Get('admin/feedback')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'List feedback (admin)' })
  list(
    @Query('unreadOnly', new DefaultValuePipe(false), ParseBoolPipe) unreadOnly: boolean,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.feedbackService.listForAdmin({
      unreadOnly,
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
    });
  }

  @Get('admin/feedback/unread-count')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Unread feedback count for admin badge' })
  unreadCount() {
    return this.feedbackService.unreadCount();
  }

  @Patch('admin/feedback/:id/read')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Mark feedback as read' })
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.feedbackService.markRead(id);
  }
}
