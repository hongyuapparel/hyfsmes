import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { InventoryAccessoriesService } from './inventory-accessories.service';

@Controller('inventory/accessories')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/inventory/accessories')
export class InventoryAccessoriesController {
  constructor(private readonly service: InventoryAccessoriesService) {}

  @Get('items')
  getList(
    @Query('name') name?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getList({
      name,
      category,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get('items/:id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(Number(id));
  }

  @Post('items')
  create(
    @Body('name') name: string,
    @Body('category') category?: string,
    @Body('quantity') quantity?: number,
    @Body('unit') unit?: string,
    @Body('remark') remark?: string,
    @Body('imageUrl') imageUrl?: string,
  ) {
    return this.service.create({ name, category, quantity, unit, remark, imageUrl });
  }

  @Put('items/:id')
  update(
    @Param('id') id: string,
    @Body('name') name?: string,
    @Body('category') category?: string,
    @Body('quantity') quantity?: number,
    @Body('unit') unit?: string,
    @Body('remark') remark?: string,
    @Body('imageUrl') imageUrl?: string,
  ) {
    return this.service.update(Number(id), {
      name,
      category,
      quantity,
      unit,
      remark,
      imageUrl,
    });
  }

  @Delete('items/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
