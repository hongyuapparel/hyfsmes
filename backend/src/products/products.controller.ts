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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/orders/products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  /**
   * SKU 下拉（供订单编辑页 remote 下拉使用）
   * GET /products/skus?keyword=&pageSize=
   *
   * 注意：订单编辑页属于订单模块场景，因此只要求 /orders/list 权限
   */
  @Get('skus')
  @RequirePermission('/orders/list')
  async findSkus(
    @Query('keyword') keyword?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const size = pageSize ? parseInt(pageSize, 10) : 20;
    const res = await this.productsService.findAll({
      skuCode: keyword?.trim() || undefined,
      page: 1,
      pageSize: Number.isFinite(size) && size > 0 ? size : 20,
      sortBy: 'id',
      sortOrder: 'desc',
    });
    const list = (res.list ?? []).map((p) => ({
      id: p.id,
      skuCode: p.skuCode,
      customerId: p.customerId ?? null,
      customerName: p.customer?.companyName ?? '',
      imageUrl: p.imageUrl ?? '',
    }));
    return { list };
  }

  @Get()
  findAll(
    @Query('companyName') companyName?: string,
    @Query('skuCode') skuCode?: string,
    @Query('productGroup') productGroup?: string,
    @Query('salesperson') salesperson?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.productsService.findAll({
      companyName,
      skuCode,
      productGroup,
      salesperson,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      sortBy,
      sortOrder,
    });
  }

  @Get('next-sku')
  getNextSkuCode() {
    return this.productsService.getNextSkuCode();
  }

  @Get('check-sku')
  checkSku(@Query('sku') sku: string) {
    return this.productsService.checkSkuExists(sku?.trim() || '');
  }

  @Get('options/product-groups')
  getProductGroups() {
    return this.productsService.getProductGroups();
  }

  @Get('options/group-counts')
  getGroupCounts() {
    return this.productsService.getGroupCounts();
  }

  @Get('options/salespeople')
  getSalespeople() {
    return this.productsService.getSalespeople();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(
    @Body()
    body: {
      sku_code?: string;
      image_url?: string;
      product_group?: string;
      customer_id?: number | null;
      salesperson?: string;
    },
  ) {
    return this.productsService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      image_url?: string;
      product_group?: string;
      customer_id?: number | null;
      salesperson?: string;
    },
  ) {
    return this.productsService.update(id, body);
  }

  @Post('batch-delete')
  removeMany(@Body('ids') ids: number[]) {
    return this.productsService.removeMany(ids ?? []);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
