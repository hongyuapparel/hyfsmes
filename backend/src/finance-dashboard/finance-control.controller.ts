import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { FinanceActor, FinanceControlService } from './finance-control.service';

@Controller('finance/control')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/finance/dashboard')
export class FinanceControlController {
  constructor(private readonly service: FinanceControlService) {}
  @Get('accounts')
  accounts(@Query('through') through?: string) { return this.service.accounts(through); }
  @Post('accounts/:id/opening')
  @RequirePermission('finance_accounts_manage')
  opening(@Param('id', ParseIntPipe) id: number, @Body() body: { date?: string; amount?: string; reason?: string }, @Req() req: { user: FinanceActor }) {
    return this.service.setOpening(id, body, req.user);
  }
  @Post('accounts/:id/reconcile')
  @RequirePermission('finance_accounts_manage')
  reconcile(@Param('id', ParseIntPipe) id: number, @Body() body: { date?: string; amount?: string }, @Req() req: { user: FinanceActor }) {
    return this.service.reconcile(id, body, req.user);
  }
  @Post('accounts/:id/reopen')
  @RequirePermission('finance_accounts_manage')
  reopen(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Req() req: { user: FinanceActor }) {
    return this.service.reopen(id, body.reason, req.user);
  }
  @Get('transfers')
  transfers(@Query() query: { page?: string; pageSize?: string; status?: string; keyword?: string }) { return this.service.transfers(query); }
  @Post('transfers')
  @RequirePermission('finance_transfer_create')
  transfer(@Body() body: { date?: string; amount?: string; fromId?: number; toId?: number; reference?: string; remark?: string }, @Req() req: { user: FinanceActor }) {
    return this.service.transfer(body, req.user);
  }
  @Post('transfers/:id/void')
  @RequirePermission('finance_transfer_void')
  cancelTransfer(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Req() req: { user: FinanceActor }) {
    return this.service.cancelTransfer(id, body.reason, req.user);
  }
  @Get('history/:kind/:id')
  history(@Param('kind') kind: string, @Param('id', ParseIntPipe) id: number) { if (!['account','transfer'].includes(kind)) throw new BadRequestException('流水操作记录请从对应流水页面查看'); return this.service.history(kind, id); }
}
