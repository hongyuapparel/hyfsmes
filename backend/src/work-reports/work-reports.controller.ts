import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkReportsService } from './work-reports.service';

import { WorkReportSettingsService } from './work-report-settings.service';

import { defaultReportTemplateId } from './work-report-templates';

@Controller('work-reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('menu_work_reports')
export class WorkReportsController {
 constructor(private readonly service: WorkReportsService, private readonly settings: WorkReportSettingsService) {}
 @Get('settings') async getSettings(@CurrentUser() user: { userId:number }) { await this.settings.assertAdmin(user.userId); return {...await this.settings.read(),people:(await this.service.people(user.userId)).map(p=>({...p,defaultTemplateId:defaultReportTemplateId(p.codes)}))}; }
 @Put('settings') putSettings(@Body() body:unknown,@CurrentUser() user:{userId:number}) { return this.settings.save(user.userId,body); }
 @Get('directory') async directory(@CurrentUser() user:{userId:number}) {
  const settings=await this.settings.read(),people=await this.service.people(user.userId);
  return {configured:settings.configured,people:people.map(p=>({...p,rule:settings.rules.find(r=>r.ownerId===p.id)||{ownerId:p.id,enabled:!settings.configured,templateId:defaultReportTemplateId(p.codes)}})).filter(p=>p.rule.enabled)};
 }
 @Get('people') people(@CurrentUser() user: { userId: number }) { return this.service.people(user.userId); }
 @Get('orders') orders(@CurrentUser() user: { userId: number }) { return this.service.orders(user.userId); }
 @Get(':ownerId') report(@Param('ownerId', ParseIntPipe) owner: number, @Query('date') date: string, @CurrentUser() user: { userId: number }) { return this.service.report(user.userId, owner, date); }
 @Put(':ownerId/plan') saveFor(@Param('ownerId',ParseIntPipe) owner:number,@Body() body:unknown,@CurrentUser() user:{userId:number}) {return this.service.save(user.userId,body,owner);}
 @Put('mine') save(@Body() body: unknown, @CurrentUser() user: { userId: number }) { return this.service.save(user.userId, body); }
}
