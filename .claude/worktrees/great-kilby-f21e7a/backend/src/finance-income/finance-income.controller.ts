import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { FinanceIncomeService } from './finance-income.service';

@Controller('finance/income')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/finance/income')
export class FinanceIncomeController {
  constructor(private readonly service: FinanceIncomeService) {}

  @Get()
  getList(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('incomeTypeId') incomeTypeIdStr?: string,
    @Query('fundAccountId') fundAccountIdStr?: string,
    @Query('sourceNameKeyword') sourceNameKeyword?: string,
    @Query('orderNo') orderNo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const incomeTypeId = incomeTypeIdStr ? parseInt(incomeTypeIdStr, 10) : undefined;
    const fundAccountId = fundAccountIdStr ? parseInt(fundAccountIdStr, 10) : undefined;
    return this.service.getList({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      incomeTypeId: Number.isNaN(incomeTypeId!) ? undefined : incomeTypeId,
      fundAccountId: Number.isNaN(fundAccountId!) ? undefined : fundAccountId,
      sourceNameKeyword: sourceNameKeyword || undefined,
      orderNo: orderNo || undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create({
      occurDate: body.occurDate,
      amount: body.amount,
      incomeTypeId: body.incomeTypeId != null ? Number(body.incomeTypeId) : null,
      fundAccountId: body.fundAccountId != null ? Number(body.fundAccountId) : null,
      sourceName: body.sourceName,
      orderNo: body.orderNo,
      operator: body.operator,
      remark: body.remark,
      attachments: body.attachments,
    });
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.update(id, {
      occurDate: body.occurDate,
      amount: body.amount,
      incomeTypeId: body.incomeTypeId !== undefined ? (body.incomeTypeId != null ? Number(body.incomeTypeId) : null) : undefined,
      fundAccountId: body.fundAccountId !== undefined ? (body.fundAccountId != null ? Number(body.fundAccountId) : null) : undefined,
      sourceName: body.sourceName,
      orderNo: body.orderNo,
      operator: body.operator,
      remark: body.remark,
      attachments: body.attachments,
    });
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
  }
}
