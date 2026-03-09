import {
  Body,
  Controller,
  Delete,
  Get,
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
    @Query('department') department?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.hrService.getList({
      name,
      department,
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  /** 关联用户下拉（仅 id/username/displayName），供人事页使用 */
  @Get('user-options')
  getUserOptions() {
    return this.hrService.getUserOptions();
  }

  @Get('items/:id')
  getOne(@Param('id') id: string) {
    return this.hrService.getOne(Number(id));
  }

  @Post('items')
  create(
    @Body('employeeNo') employeeNo?: string,
    @Body('name') name?: string,
    @Body('department') department?: string,
    @Body('jobTitle') jobTitle?: string,
    @Body('entryDate') entryDate?: string,
    @Body('contactPhone') contactPhone?: string,
    @Body('status') status?: string,
    @Body('userId') userId?: number,
    @Body('remark') remark?: string,
  ) {
    return this.hrService.create({
      employeeNo,
      name: name ?? '',
      department,
      jobTitle,
      entryDate,
      contactPhone,
      status,
      userId: userId ?? null,
      remark,
    });
  }

  @Put('items/:id')
  update(
    @Param('id') id: string,
    @Body('employeeNo') employeeNo?: string,
    @Body('name') name?: string,
    @Body('department') department?: string,
    @Body('jobTitle') jobTitle?: string,
    @Body('entryDate') entryDate?: string,
    @Body('contactPhone') contactPhone?: string,
    @Body('status') status?: string,
    @Body('userId') userId?: number | null,
    @Body('remark') remark?: string,
  ) {
    return this.hrService.update(Number(id), {
      employeeNo,
      name,
      department,
      jobTitle,
      entryDate,
      contactPhone,
      status,
      userId: userId ?? null,
      remark,
    });
  }

  @Delete('items/:id')
  remove(@Param('id') id: string) {
    return this.hrService.remove(Number(id));
  }
}
