import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { FinanceExpenseService } from './finance-expense.service';

interface FinanceExpenseBody {
  occurDate: string;
  amount: number | string;
  expenseTypeId?: number | string | null;
  fundAccountId?: number | string | null;
  objectType?: string;
  payeeName?: string;
  orderNo?: string;
  departmentId?: number | string | null;
  operator?: string;
  remark?: string;
  attachments?: string[] | null;
}

@Controller('finance/expense')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/finance/expense')
export class FinanceExpenseController {
  constructor(private readonly service: FinanceExpenseService) {}

  @Get()
  getList(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('expenseTypeId') expenseTypeIdStr?: string,
    @Query('fundAccountId') fundAccountIdStr?: string,
    @Query('payeeKeyword') payeeKeyword?: string,
    @Query('orderNo') orderNo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const expenseTypeId = expenseTypeIdStr ? parseInt(expenseTypeIdStr, 10) : undefined;
    const fundAccountId = fundAccountIdStr ? parseInt(fundAccountIdStr, 10) : undefined;
    return this.service.getList({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      expenseTypeId: Number.isNaN(expenseTypeId!) ? undefined : expenseTypeId,
      fundAccountId: Number.isNaN(fundAccountId!) ? undefined : fundAccountId,
      payeeKeyword: payeeKeyword || undefined,
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
  create(@Body() body: FinanceExpenseBody) {
    return this.service.create({
      occurDate: body.occurDate,
      amount: body.amount,
      expenseTypeId: body.expenseTypeId != null ? Number(body.expenseTypeId) : null,
      fundAccountId: body.fundAccountId != null ? Number(body.fundAccountId) : null,
      objectType: body.objectType,
      payeeName: body.payeeName,
      orderNo: body.orderNo,
      departmentId: body.departmentId != null ? Number(body.departmentId) : null,
      operator: body.operator,
      remark: body.remark,
      attachments: body.attachments,
    });
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<FinanceExpenseBody>) {
    return this.service.update(id, {
      occurDate: body.occurDate,
      amount: body.amount,
      expenseTypeId: body.expenseTypeId !== undefined ? (body.expenseTypeId != null ? Number(body.expenseTypeId) : null) : undefined,
      fundAccountId: body.fundAccountId !== undefined ? (body.fundAccountId != null ? Number(body.fundAccountId) : null) : undefined,
      objectType: body.objectType,
      payeeName: body.payeeName,
      orderNo: body.orderNo,
      departmentId: body.departmentId !== undefined ? (body.departmentId != null ? Number(body.departmentId) : null) : undefined,
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
