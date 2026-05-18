import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { AddressesService } from './addresses.service';
import { UpsertAddressDto } from './dto/upsert-address.dto';

@ApiTags('addresses')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List user delivery addresses' })
  list(@Req() req: any) {
    return this.addressesService.list(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Save a new delivery address' })
  create(@Req() req: any, @Body() dto: UpsertAddressDto) {
    return this.addressesService.create(req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update saved address' })
  update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertAddressDto,
  ) {
    return this.addressesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete saved address' })
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.addressesService.remove(req.user.id, id);
  }
}
