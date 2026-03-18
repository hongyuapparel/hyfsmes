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
    @Query('departmentId') departmentIdStr?: string,
    @Query('bankAccountId') bankAccountIdStr?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const departmentId =
      departmentIdStr != null && departmentIdStr !== '' ? parseInt(departmentIdStr, 10) : undefined;
    const bankAccountId =
      bankAccountIdStr != null && bankAccountIdStr !== ''
        ? parseInt(bankAccountIdStr, 10)
        : undefined;
    return this.service.getList({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      departmentId: Number.isNaN(departmentId) ? undefined : departmentId,
      bankAccountId: Number.isNaN(bankAccountId) ? undefined : bankAccountId,
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
    @Body('payer') payer?: string,
    @Body('departmentId') departmentId?: number | null,
    @Body('bankAccountId') bankAccountId?: number | null,
    @Body('remark') remark?: string,
    @Body('attachments') attachments?: string[] | null,
  ) {
    return this.service.create({
      occurDate: occurDate!,
      amount: amount!,
      payer,
      departmentId,
      bankAccountId,
      remark,
      attachments,
    });
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body('occurDate') occurDate?: string,
    @Body('amount') amount?: number | string,
    @Body('payer') payer?: string,
    @Body('departmentId') departmentId?: number | null,
    @Body('bankAccountId') bankAccountId?: number | null,
    @Body('remark') remark?: string,
    @Body('attachments') attachments?: string[] | null,
  ) {
    return this.service.update(id, {
      occurDate,
      amount,
      payer,
      departmentId,
      bankAccountId,
      remark,
      attachments,
    });
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
  }
}
