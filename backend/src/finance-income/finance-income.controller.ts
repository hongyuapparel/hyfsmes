import { FinanceLedgerService, LedgerBody } from '../finance-dashboard/finance-ledger.service';
import { FinanceControlService, FinanceActor } from '../finance-dashboard/finance-control.service';
import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { FinanceIncomeService } from './finance-income.service';

@Controller('finance/income')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/finance/income')
export class FinanceIncomeController {
  constructor(private readonly service: FinanceIncomeService, private readonly ledger: FinanceLedgerService, private readonly control: FinanceControlService) {}

  @Get()
  getList(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('incomeTypeId') incomeTypeIdStr?: string,
    @Query('fundAccountId') fundAccountIdStr?: string,
    @Query('departmentId') departmentIdStr?: string,
    @Query('sourceNameKeyword') sourceNameKeyword?: string,
    @Query('orderNo') orderNo?: string,
    @Query('cashKind') cashKind?: string,
    @Query('deleted') deleted?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const incomeTypeId = incomeTypeIdStr ? parseInt(incomeTypeIdStr, 10) : undefined;
    const fundAccountId = fundAccountIdStr ? parseInt(fundAccountIdStr, 10) : undefined;
    const departmentId = departmentIdStr ? parseInt(departmentIdStr, 10) : undefined;
    return this.service.getList({
      cashKind, deleted: deleted === 'true',
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      incomeTypeId: Number.isNaN(incomeTypeId!) ? undefined : incomeTypeId,
      fundAccountId: Number.isNaN(fundAccountId!) ? undefined : fundAccountId,
      departmentId: Number.isNaN(departmentId!) ? undefined : departmentId,
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

  @Get(':id/history')
  history(@Param('id', ParseIntPipe) id: number) { return this.control.history('income', id); }
  @Post()
  @RequirePermission('finance_income_create')
  create(@Body() body: LedgerBody, @Req() req: { user: FinanceActor }) {
    return this.ledger.save('income', null, body, req.user);
  }
  @Patch(':id')
  @RequirePermission('finance_income_edit')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: LedgerBody, @Req() req: { user: FinanceActor }) {
    return this.ledger.save('income', id, body, req.user);
  }
  @Delete(':id')
  @RequirePermission('finance_income_delete')
  remove(@Param('id', ParseIntPipe) id: number, @Body() body: { version?: number; reason?: string }, @Req() req: { user: FinanceActor }) {
    return this.ledger.remove('income', id, body.version, body.reason, req.user);
  }
  @Post(':id/restore')
  @RequirePermission('finance_income_delete')
  restore(@Param('id', ParseIntPipe) id: number, @Body() body: { version?: number; reason?: string }, @Req() req: { user: FinanceActor }) {
    return this.ledger.remove('income', id, body.version, body.reason, req.user, true);
  }
}
