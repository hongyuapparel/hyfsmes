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
import { SystemOptionsService } from '../system-options/system-options.service';
import { SuppliersService } from './suppliers.service';

const SUPPLIER_TYPE_OPTION_TYPE = 'supplier_types';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  /**
   * 供应商类型下拉选项（一级节点，来自系统设置-供应商设置）
   * GET /suppliers/options
   */
  @Get('options')
  getTypeOptions() {
    return this.systemOptionsService.findRootsByType(SUPPLIER_TYPE_OPTION_TYPE);
  }

  /**
   * 某供应商类型下的业务范围下拉选项（该类型下的二级节点）
   * GET /suppliers/options/business-scope?type=面料
   */
  @Get('options/business-scope')
  getBusinessScopeOptions(@Query('type') type: string) {
    return this.systemOptionsService.findChildrenValuesByParentValue(
      SUPPLIER_TYPE_OPTION_TYPE,
      type || '',
    );
  }

  /**
   * 某供应商类型下的业务范围树（父分组可展开到子分组，父子都可选）
   * GET /suppliers/options/business-scope/tree?type=工艺供应商
   */
  @Get('options/business-scope/tree')
  async getBusinessScopeTree(@Query('type') type: string) {
    const tree = await this.systemOptionsService.findTreeByType(SUPPLIER_TYPE_OPTION_TYPE);
    const root = tree.find((n) => n.parentId == null && n.value === (type || '').trim());
    return root?.children ?? [];
  }

  /**
   * 下拉搜索供应商（订单编辑等调用，需具备 /suppliers 权限）
   * GET /suppliers?keyword=&page=&pageSize=
   */
  @Get()
  search(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.suppliersService.search(
      keyword,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  /**
   * 供应商管理页：列表。支持按类型名称 type（如「生产加工厂」）或 supplierTypeId 筛选。
   */
  @Get('items')
  async getList(
    @Query('name') name?: string,
    @Query('supplierTypeId') supplierTypeIdStr?: string,
    @Query('type') typeValue?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    let supplierTypeId: number | undefined =
      supplierTypeIdStr != null && supplierTypeIdStr !== ''
        ? Number(supplierTypeIdStr)
        : undefined;
    if (supplierTypeId == null && typeValue?.trim()) {
      const resolvedId = await this.systemOptionsService.findRootIdByValue(
        SUPPLIER_TYPE_OPTION_TYPE,
        typeValue.trim(),
      );
      if (resolvedId != null) supplierTypeId = resolvedId;
    }
    return this.suppliersService.getList({
      name,
      supplierTypeId,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get('items/:id')
  getOne(@Param('id') id: string) {
    return this.suppliersService.getOne(Number(id));
  }

  /** 供应商最近合作记录（按订单引用） */
  @Get('items/:id/recent-records')
  getRecentRecords(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.suppliersService.getRecentOrderRecords(
      Number(id),
      limit ? Number(limit) : 10,
    );
  }

  @Post('items')
  create(
    @Body('name') name: string,
    @Body('supplierTypeId') supplierTypeId?: number | null,
    @Body('businessScopeId') businessScopeId?: number | null,
    @Body('businessScopeIds') businessScopeIds?: number[] | null,
    @Body('contactPerson') contactPerson?: string,
    @Body('contactInfo') contactInfo?: string,
    @Body('factoryAddress') factoryAddress?: string,
    @Body('settlementTime') settlementTime?: string,
  ) {
    return this.suppliersService.create({
      name,
      supplierTypeId,
      businessScopeId,
      businessScopeIds,
      contactPerson,
      contactInfo,
      factoryAddress,
      settlementTime,
    });
  }

  @Put('items/:id')
  update(
    @Param('id') id: string,
    @Body('name') name?: string,
    @Body('supplierTypeId') supplierTypeId?: number | null,
    @Body('businessScopeId') businessScopeId?: number | null,
    @Body('businessScopeIds') businessScopeIds?: number[] | null,
    @Body('contactPerson') contactPerson?: string,
    @Body('contactInfo') contactInfo?: string,
    @Body('factoryAddress') factoryAddress?: string,
    @Body('settlementTime') settlementTime?: string,
  ) {
    return this.suppliersService.update(Number(id), {
      name,
      supplierTypeId,
      businessScopeId,
      businessScopeIds,
      contactPerson,
      contactInfo,
      factoryAddress,
      settlementTime,
    });
  }

  @Delete('items/:id')
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(Number(id));
  }
}

