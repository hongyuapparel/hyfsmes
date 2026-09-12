import { FinanceLedgerService, LedgerBody } from '../finance-dashboard/finance-ledger.service';
import { FinanceControlService, FinanceActor } from '../finance-dashboard/finance-control.service';
import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { FinanceExpenseService } from './finance-expense.service';

@Controller('finance/expense')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/finance/expense')
export class FinanceExpenseController {
  constructor(private readonly service: FinanceExpenseService, private readonly ledger: FinanceLedgerService, private readonly control: FinanceControlService) {}

  @Get()
  getList(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('expenseTypeId') expenseTypeIdStr?: string,
    @Query('fundAccountId') fundAccountIdStr?: string,
    @Query('departmentId') departmentIdStr?: string,
    @Query('payeeKeyword') payeeKeyword?: string,
    @Query('orderNo') orderNo?: string,
    @Query('cashKind') cashKind?: string,
    @Query('deleted') deleted?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const expenseTypeId = expenseTypeIdStr ? parseInt(expenseTypeIdStr, 10) : undefined;
    const fundAccountId = fundAccountIdStr ? parseInt(fundAccountIdStr, 10) : undefined;
    return this.service.getList({
      cashKind, deleted: deleted === 'true',
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      expenseTypeId: Number.isNaN(expenseTypeId!) ? undefined : expenseTypeId,
      fundAccountId: Number.isNaN(fundAccountId!) ? undefined : fundAccountId,
      departmentId: departmentIdStr && /^\d+$/.test(departmentIdStr) ? Number(departmentIdStr) : undefined,
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

  @Get(':id/history')
  history(@Param('id', ParseIntPipe) id: number) { return this.control.history('expense', id); }
  @Post()
  @RequirePermission('finance_expense_create')
  create(@Body() body: LedgerBody, @Req() req: { user: FinanceActor }) {
    return this.ledger.save('expense', null, body, req.user);
  }
  @Patch(':id')
  @RequirePermission('finance_expense_edit')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: LedgerBody, @Req() req: { user: FinanceActor }) {
    return this.ledger.save('expense', id, body, req.user);
  }
  @Delete(':id')
  @RequirePermission('finance_expense_delete')
  remove(@Param('id', ParseIntPipe) id: number, @Body() body: { version?: number; reason?: string }, @Req() req: { user: FinanceActor }) {
    return this.ledger.remove('expense', id, body.version, body.reason, req.user);
  }
  @Post(':id/restore')
  @RequirePermission('finance_expense_delete')
  restore(@Param('id', ParseIntPipe) id: number, @Body() body: { version?: number; reason?: string }, @Req() req: { user: FinanceActor }) {
    return this.ledger.remove('expense', id, body.version, body.reason, req.user, true);
  }
}
