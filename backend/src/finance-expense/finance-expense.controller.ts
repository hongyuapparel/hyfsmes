import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { FinanceExpenseService } from './finance-expense.service';

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
    @Query('departmentId') departmentIdStr?: string,
    @Query('orderId') orderIdStr?: string,
    @Query('supplierId') supplierIdStr?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const expenseTypeId =
      expenseTypeIdStr != null && expenseTypeIdStr !== '' ? parseInt(expenseTypeIdStr, 10) : undefined;
    const departmentId =
      departmentIdStr != null && departmentIdStr !== '' ? parseInt(departmentIdStr, 10) : undefined;
    const orderId =
      orderIdStr != null && orderIdStr !== '' ? parseInt(orderIdStr, 10) : undefined;
    const supplierId =
      supplierIdStr != null && supplierIdStr !== '' ? parseInt(supplierIdStr, 10) : undefined;
    return this.service.getList({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      expenseTypeId: Number.isNaN(expenseTypeId!) ? undefined : expenseTypeId,
      departmentId: Number.isNaN(departmentId!) ? undefined : departmentId,
      orderId: Number.isNaN(orderId!) ? undefined : orderId,
      supplierId: Number.isNaN(supplierId!) ? undefined : supplierId,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get('options')
  getOptions() {
    return this.service.getOptions();
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  create(
    @Body('occurDate') occurDate: string,
    @Body('amount') amount: number | string,
    @Body('expenseTypeId') expenseTypeId?: number | null,
    @Body('departmentId') departmentId?: number | null,
    @Body('bankAccountId') bankAccountId?: number | null,
    @Body('payee') payee?: string,
    @Body('styleNo') styleNo?: string,
    @Body('orderId') orderId?: number | null,
    @Body('supplierId') supplierId?: number | null,
    @Body('detail') detail?: string,
    @Body('attachments') attachments?: string[] | null,
  ) {
    return this.service.create({
      occurDate: occurDate!,
      amount: amount!,
      expenseTypeId,
      departmentId,
      bankAccountId,
      payee,
      styleNo,
      orderId,
      supplierId,
      detail,
      attachments,
    });
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body('occurDate') occurDate?: string,
    @Body('amount') amount?: number | string,
    @Body('expenseTypeId') expenseTypeId?: number | null,
    @Body('departmentId') departmentId?: number | null,
    @Body('bankAccountId') bankAccountId?: number | null,
    @Body('payee') payee?: string,
    @Body('styleNo') styleNo?: string,
    @Body('orderId') orderId?: number | null,
    @Body('supplierId') supplierId?: number | null,
    @Body('detail') detail?: string,
    @Body('attachments') attachments?: string[] | null,
  ) {
    return this.service.update(id, {
      occurDate,
      amount,
      expenseTypeId,
      departmentId,
      bankAccountId,
      payee,
      styleNo,
      orderId,
      supplierId,
      detail,
      attachments,
    });
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
  }
}
