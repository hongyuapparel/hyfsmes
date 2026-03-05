import { Body, Controller, Get, Patch, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { FieldDefinitionsService } from './field-definitions.service';

@Controller('field-definitions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/orders/products')
export class FieldDefinitionsController {
  constructor(private service: FieldDefinitionsService) {}

  @Get()
  findByModule(@Query('module') module: string) {
    return this.service.findByModule(module || '');
  }

  @Patch('batch/order')
  batchUpdateOrder(@Body() body: { module: string; items: { id: number; order: number }[] }) {
    return this.service.batchUpdateOrder(body.module || '', body.items || []);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { order?: number; visible?: boolean },
  ) {
    if (body.visible !== undefined) {
      return this.service.updateVisible(id, body.visible);
    }
    if (typeof body.order === 'number') {
      return this.service.updateOrder(id, body.order);
    }
    return this.service.findByModule('');
  }
}
