import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
  Patch,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { HrService } from './hr.service';

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get('items')
  getList(
    @Query('name') name?: string,
    @Query('departmentId') departmentId?: string,
    @Query('jobTitleId') jobTitleId?: string,
    @Query('status') status?: string,
    @Query('entryDateStart') entryDateStart?: string,
    @Query('entryDateEnd') entryDateEnd?: string,
    @Query('leaveDateStart') leaveDateStart?: string,
    @Query('leaveDateEnd') leaveDateEnd?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.hrService.getList({
      name,
      departmentId: departmentId ? parseInt(departmentId, 10) : undefined,
      jobTitleId: jobTitleId ? parseInt(jobTitleId, 10) : undefined,
      status,
      entryDateStart: entryDateStart?.trim() || undefined,
      entryDateEnd: entryDateEnd?.trim() || undefined,
      leaveDateStart: leaveDateStart?.trim() || undefined,
      leaveDateEnd: leaveDateEnd?.trim() || undefined,
      sortBy: sortBy?.trim() || undefined,
      sortOrder: sortOrder === 'desc' ? 'desc' : sortOrder === 'asc' ? 'asc' : undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  /** 关联用户下拉（仅 id/username/displayName），供人事页使用 */
  @Get('user-options')
  getUserOptions() {
    return this.hrService.getUserOptions();
  }

  /** 员工基础选项（仅姓名/部门/岗位/状态），供生产各模块下拉使用，无需人事权限 */
  @Get('staff-options')
  @RequirePermission(['/hr', '/production/cutting', '/production/pattern', '/production/sewing', '/production/finishing', '/production/purchase'])
  getStaffOptions() {
    return this.hrService.getStaffOptions();
  }

  @Get('items/:id')
  getOne(@Param('id') id: string) {
    return this.hrService.getOne(Number(id));
  }

  @Get('exists-name')
  async existsName(
    @Query('name') name?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    const exists = await this.hrService.checkNameExists(
      name ?? '',
      excludeId ? parseInt(excludeId, 10) : undefined,
    );
    return { exists };
  }

  @Post('items')
  create(
    @Body('employeeNo') employeeNo?: string,
    @Body('name') name?: string,
    @Body('gender') gender?: string,
    @Body('departmentId') departmentId?: number | null,
    @Body('jobTitleId') jobTitleId?: number | null,
    @Body('entryDate') entryDate?: string,
    @Body('contactPhone') contactPhone?: string,
    @Body('education') education?: string,
    @Body('dormitory') dormitory?: string,
    @Body('idCardNo') idCardNo?: string,
    @Body('nativePlace') nativePlace?: string,
    @Body('homeAddress') homeAddress?: string,
    @Body('emergencyContact') emergencyContact?: string,
    @Body('emergencyPhone') emergencyPhone?: string,
    @Body('leaveDate') leaveDate?: string,
    @Body('leaveReason') leaveReason?: string,
    @Body('status') status?: string,
    @Body('userId') userId?: number,
    @Body('remark') remark?: string,
    @Body('photoUrl') photoUrl?: string,
  ) {
    return this.hrService.create({
      employeeNo,
      name: name ?? '',
      gender,
      departmentId: departmentId ?? null,
      jobTitleId: jobTitleId ?? null,
      entryDate,
      contactPhone,
      education,
      dormitory,
      idCardNo,
      nativePlace,
      homeAddress,
      emergencyContact,
      emergencyPhone,
      leaveDate,
      leaveReason,
      status,
      userId: userId ?? null,
      remark,
      photoUrl,
    });
  }

  @Put('items/:id')
  update(
    @Param('id') id: string,
    @Body('employeeNo') employeeNo?: string,
    @Body('name') name?: string,
    @Body('gender') gender?: string,
    @Body('departmentId') departmentId?: number | null,
    @Body('jobTitleId') jobTitleId?: number | null,
    @Body('entryDate') entryDate?: string,
    @Body('contactPhone') contactPhone?: string,
    @Body('education') education?: string,
    @Body('dormitory') dormitory?: string,
    @Body('idCardNo') idCardNo?: string,
    @Body('nativePlace') nativePlace?: string,
    @Body('homeAddress') homeAddress?: string,
    @Body('emergencyContact') emergencyContact?: string,
    @Body('emergencyPhone') emergencyPhone?: string,
    @Body('leaveDate') leaveDate?: string,
    @Body('leaveReason') leaveReason?: string,
    @Body('status') status?: string,
    @Body('userId') userId?: number | null,
    @Body('remark') remark?: string,
    @Body('photoUrl') photoUrl?: string,
  ) {
    return this.hrService.update(Number(id), {
      employeeNo,
      name,
      gender,
      departmentId: departmentId ?? null,
      jobTitleId: jobTitleId ?? null,
      entryDate,
      contactPhone,
      education,
      dormitory,
      idCardNo,
      nativePlace,
      homeAddress,
      emergencyContact,
      emergencyPhone,
      leaveDate,
      leaveReason,
      status,
      userId: userId ?? null,
      remark,
      photoUrl,
    });
  }

  @Delete('items/:id')
  remove(@Param('id') id: string) {
    return this.hrService.remove(Number(id));
  }

  @Patch('batch/order')
  batchUpdateOrder(
    @Body() body: { items: { id: number; sort_order: number }[] },
  ) {
    const items = (body.items ?? []).map((i) => ({
      id: Number(i.id),
      sortOrder: Number(i.sort_order),
    }));
    return this.hrService.batchUpdateOrder(items);
  }

  @Patch('items/:id/sort-order')
  updateSortOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body('sort_order') sortOrder?: number,
  ) {
    const nextOrder = Number(sortOrder);
    if (!Number.isFinite(nextOrder) || nextOrder < 1) {
      throw new BadRequestException('sort_order 必须为大于 0 的整数');
    }
    return this.hrService.moveSortOrder(id, Math.floor(nextOrder));
  }
}
