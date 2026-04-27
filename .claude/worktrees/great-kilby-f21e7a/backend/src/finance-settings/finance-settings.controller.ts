import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { FinanceSettingsService } from './finance-settings.service';

@Controller('finance-settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/settings/finance')
export class FinanceSettingsController {
  constructor(private readonly svc: FinanceSettingsService) {}

  // ── 下拉选项（供收入/支出流水页使用，权限复用 finance/income） ──
  @Get('options')
  @RequirePermission('/finance/income')
  getOptions() {
    return this.svc.getDropdownOptions();
  }

  // ── 资金账户 ──────────────────────────────────────────────
  @Get('fund-accounts')
  listFundAccounts() { return this.svc.getAllFundAccounts(); }

  @Post('fund-accounts')
  createFundAccount(@Body() body: any) {
    return this.svc.createFundAccount({
      name: body.name?.trim(),
      accountType: body.accountType,
      owner: body.owner?.trim() ?? '',
      isEnabled: body.isEnabled ?? true,
      sortOrder: body.sortOrder ?? 0,
    });
  }

  @Patch('fund-accounts/:id')
  updateFundAccount(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const dto: any = {};
    if (body.name !== undefined) dto.name = body.name?.trim();
    if (body.accountType !== undefined) dto.accountType = body.accountType;
    if (body.owner !== undefined) dto.owner = body.owner?.trim() ?? '';
    if (body.isEnabled !== undefined) dto.isEnabled = body.isEnabled;
    if (body.sortOrder !== undefined) dto.sortOrder = body.sortOrder;
    return this.svc.updateFundAccount(id, dto);
  }

  @Delete('fund-accounts/:id')
  async removeFundAccount(@Param('id', ParseIntPipe) id: number) {
    await this.svc.removeFundAccount(id);
  }

  // ── 收入类型 ──────────────────────────────────────────────
  @Get('income-types')
  listIncomeTypes() { return this.svc.getAllIncomeTypes(); }

  @Post('income-types')
  createIncomeType(@Body() body: any) {
    return this.svc.createIncomeType({
      name: body.name?.trim(),
      isEnabled: body.isEnabled ?? true,
      sortOrder: body.sortOrder ?? 0,
    });
  }

  @Patch('income-types/:id')
  updateIncomeType(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const dto: any = {};
    if (body.name !== undefined) dto.name = body.name?.trim();
    if (body.isEnabled !== undefined) dto.isEnabled = body.isEnabled;
    if (body.sortOrder !== undefined) dto.sortOrder = body.sortOrder;
    return this.svc.updateIncomeType(id, dto);
  }

  @Delete('income-types/:id')
  async removeIncomeType(@Param('id', ParseIntPipe) id: number) {
    await this.svc.removeIncomeType(id);
  }

  // ── 支出类型 ──────────────────────────────────────────────
  @Get('expense-types')
  listExpenseTypes() { return this.svc.getAllExpenseTypes(); }

  @Post('expense-types')
  createExpenseType(@Body() body: any) {
    return this.svc.createExpenseType({
      name: body.name?.trim(),
      isEnabled: body.isEnabled ?? true,
      sortOrder: body.sortOrder ?? 0,
    });
  }

  @Patch('expense-types/:id')
  updateExpenseType(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const dto: any = {};
    if (body.name !== undefined) dto.name = body.name?.trim();
    if (body.isEnabled !== undefined) dto.isEnabled = body.isEnabled;
    if (body.sortOrder !== undefined) dto.sortOrder = body.sortOrder;
    return this.svc.updateExpenseType(id, dto);
  }

  @Delete('expense-types/:id')
  async removeExpenseType(@Param('id', ParseIntPipe) id: number) {
    await this.svc.removeExpenseType(id);
  }
}
