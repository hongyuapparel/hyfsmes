import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CustomersService } from './customers.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(private customersService: CustomersService) {}

  @Get()
  findAll(
    @Query('companyName') companyName?: string,
    @Query('salesperson') salesperson?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.customersService.findAll({
      companyName,
      salesperson,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      sortBy,
      sortOrder,
    });
  }

  @Get('next-id')
  getNextCustomerId() {
    return this.customersService.getNextCustomerId();
  }

  @Get('options/salespeople')
  getSalespeople() {
    return this.customersService.getSalespeople();
  }

  @Get('options/merchandisers')
  getMerchandisers() {
    return this.customersService.getMerchandisers();
  }

  @Get('options/product-groups')
  getProductGroups() {
    return this.customersService.getProductGroups();
  }

  @Get('xiaoman/list')
  async getXiaomanList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    try {
      return await this.customersService.getXiaomanList(
        page ? parseInt(page, 10) : 1,
        pageSize ? parseInt(pageSize, 10) : 20,
        keyword?.trim() || undefined,
      );
    } catch (e) {
      let msg =
        e instanceof Error ? e.message : '小满列表获取失败';
      if (e instanceof Error && e.message.toLowerCase().includes('fetch failed')) {
        msg = '无法连接小满接口，请检查服务器网络或 XIAOMAN_API_BASE_URL 配置';
      }
      this.logger.warn(`小满列表请求失败: ${msg}`);
      throw new BadRequestException(msg);
    }
  }

  @Post('xiaoman/import')
  async importFromXiaoman(
    @Body('companyIds') companyIds: number[],
    @CurrentUser() user: { userId: number; username: string },
  ) {
    try {
      return await this.customersService.importFromXiaoman(companyIds ?? [], user);
    } catch (e) {
      let msg =
        e instanceof Error ? e.message : '导入失败';
      if (e instanceof Error && e.message.toLowerCase().includes('fetch failed')) {
        msg = '无法连接小满接口，请检查服务器网络或 XIAOMAN_API_BASE_URL 配置';
      }
      throw new BadRequestException(msg);
    }
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.findOne(id);
  }

  @Post()
  create(
    @Body()
    body: {
      customer_id?: string;
      country?: string;
      company_name: string;
      contact_person?: string;
      contact_info?: string;
      cooperation_date?: string;
      salesperson?: string;
      product_group_id?: number | null;
    },
  ) {
    return this.customersService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      country?: string;
      company_name?: string;
      contact_person?: string;
      contact_info?: string;
      cooperation_date?: string;
      salesperson?: string;
      product_group_id?: number | null;
    },
  ) {
    return this.customersService.update(id, body);
  }

  @Post('batch-delete')
  removeMany(@Body('ids') ids: number[]) {
    return this.customersService.removeMany(ids ?? []);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.remove(id);
  }
}
