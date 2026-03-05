import { DataSource } from 'typeorm';
import { Permission } from '../entities/permission.entity';

const MENU_PERMISSIONS: { code: string; name: string; routePath: string }[] = [
  { code: 'menu_home', name: '主页', routePath: '/' },
  { code: 'menu_customers', name: '客户管理', routePath: '/customers' },
  { code: 'menu_orders', name: '订单管理', routePath: '/orders' },
  { code: 'menu_orders_products', name: '产品列表', routePath: '/orders/products' },
  { code: 'menu_orders_list', name: '订单列表', routePath: '/orders/list' },
  { code: 'menu_production', name: '生产管理', routePath: '/production' },
  { code: 'menu_production_purchase', name: '采购管理', routePath: '/production/purchase' },
  { code: 'menu_production_pattern', name: '纸样管理', routePath: '/production/pattern' },
  { code: 'menu_production_cutting', name: '裁床管理', routePath: '/production/cutting' },
  { code: 'menu_production_sewing', name: '车缝管理', routePath: '/production/sewing' },
  { code: 'menu_production_finishing', name: '尾部管理', routePath: '/production/finishing' },
  { code: 'menu_inventory', name: '库存管理', routePath: '/inventory' },
  { code: 'menu_inventory_finished', name: '成品库存', routePath: '/inventory/finished' },
  { code: 'menu_inventory_accessories', name: '辅料库存', routePath: '/inventory/accessories' },
  { code: 'menu_inventory_fabric', name: '面料库存', routePath: '/inventory/fabric' },
  { code: 'menu_finance', name: '财务管理', routePath: '/finance' },
  { code: 'menu_suppliers', name: '供应商管理', routePath: '/suppliers' },
  { code: 'menu_hr', name: '人事管理', routePath: '/hr' },
  { code: 'menu_settings', name: '系统设置', routePath: '/settings' },
  { code: 'menu_settings_users', name: '用户管理', routePath: '/settings/users' },
  { code: 'menu_settings_roles', name: '角色管理', routePath: '/settings/roles' },
  { code: 'menu_settings_permissions', name: '权限配置', routePath: '/settings/permissions' },
  { code: 'menu_settings_orders', name: '订单设置', routePath: '/settings/orders' },
  // 订单列表内操作级权限（用于角色配置）
  { code: 'orders_delete', name: '订单列表-删除订单', routePath: '/orders/list:delete' },
  { code: 'orders_review', name: '订单列表-审单', routePath: '/orders/list:review' },
];

export async function seedPermissions(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Permission);
  for (const p of MENU_PERMISSIONS) {
    const exists = await repo.findOne({ where: { code: p.code } });
    if (!exists) {
      await repo.save(repo.create({ code: p.code, name: p.name, type: 'menu', routePath: p.routePath }));
    }
  }
  console.log('[Seed] Permissions seeded.');
}
