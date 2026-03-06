import { DataSource } from 'typeorm';
import { Permission } from '../entities/permission.entity';

const PERMISSIONS: { code: string; name: string; routePath: string; type: 'menu' | 'action' }[] = [
  { code: 'menu_home', name: '主页', routePath: '/', type: 'menu' },
  { code: 'menu_customers', name: '客户管理', routePath: '/customers', type: 'menu' },
  { code: 'menu_orders', name: '订单管理', routePath: '/orders', type: 'menu' },
  { code: 'menu_orders_products', name: '产品列表', routePath: '/orders/products', type: 'menu' },
  { code: 'menu_orders_list', name: '订单列表', routePath: '/orders/list', type: 'menu' },
  { code: 'menu_production', name: '生产管理', routePath: '/production', type: 'menu' },
  { code: 'menu_production_purchase', name: '采购管理', routePath: '/production/purchase', type: 'menu' },
  { code: 'menu_production_pattern', name: '纸样管理', routePath: '/production/pattern', type: 'menu' },
  { code: 'menu_production_cutting', name: '裁床管理', routePath: '/production/cutting', type: 'menu' },
  { code: 'menu_production_sewing', name: '车缝管理', routePath: '/production/sewing', type: 'menu' },
  { code: 'menu_production_finishing', name: '尾部管理', routePath: '/production/finishing', type: 'menu' },
  { code: 'menu_inventory', name: '库存管理', routePath: '/inventory', type: 'menu' },
  { code: 'menu_inventory_finished', name: '成品库存', routePath: '/inventory/finished', type: 'menu' },
  { code: 'menu_inventory_accessories', name: '辅料库存', routePath: '/inventory/accessories', type: 'menu' },
  { code: 'menu_inventory_fabric', name: '面料库存', routePath: '/inventory/fabric', type: 'menu' },
  { code: 'menu_finance', name: '财务管理', routePath: '/finance', type: 'menu' },
  { code: 'menu_suppliers', name: '供应商管理', routePath: '/suppliers', type: 'menu' },
  { code: 'menu_hr', name: '人事管理', routePath: '/hr', type: 'menu' },
  { code: 'menu_settings', name: '系统设置', routePath: '/settings', type: 'menu' },
  { code: 'menu_settings_users', name: '用户管理', routePath: '/settings/users', type: 'menu' },
  { code: 'menu_settings_roles', name: '角色管理', routePath: '/settings/roles', type: 'menu' },
  { code: 'menu_settings_permissions', name: '权限配置', routePath: '/settings/permissions', type: 'menu' },
  { code: 'menu_settings_products', name: '产品设置', routePath: '/settings/products', type: 'menu' },
  // 操作级权限：订单列表勾选后的批量操作
  { code: 'orders_delete', name: '订单列表-删除订单', routePath: '/orders/list', type: 'action' },
  { code: 'orders_review', name: '订单列表-审核待审单', routePath: '/orders/list', type: 'action' },
];

export async function seedPermissions(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Permission);
  for (const p of PERMISSIONS) {
    const exists = await repo.findOne({ where: { code: p.code } });
    if (!exists) {
      await repo.save(
        repo.create({
          code: p.code,
          name: p.name,
          type: p.type,
          routePath: p.routePath,
        }),
      );
    }
  }
  console.log('[Seed] Permissions seeded.');
}
