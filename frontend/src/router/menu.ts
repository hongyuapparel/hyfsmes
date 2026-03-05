export interface MenuItem {
  path: string
  title: string
  icon?: string
  children?: MenuItem[]
}

export const menuConfig: MenuItem[] = [
  { path: '/', title: '主页', icon: 'HomeFilled' },
  { path: '/customers', title: '客户管理', icon: 'UserFilled' },
  {
    path: '/orders',
    title: '订单管理',
    icon: 'ShoppingCart',
    children: [
      { path: '/orders/products', title: '产品列表' },
      { path: '/orders/list', title: '订单列表' },
    ],
  },
  {
    path: '/production',
    title: '生产管理',
    icon: 'OfficeBuilding',
    children: [
      { path: '/production/purchase', title: '采购管理' },
      { path: '/production/pattern', title: '纸样管理' },
      { path: '/production/cutting', title: '裁床管理' },
      { path: '/production/sewing', title: '车缝管理' },
      { path: '/production/finishing', title: '尾部管理' },
    ],
  },
  {
    path: '/inventory',
    title: '库存管理',
    icon: 'Box',
    children: [
      { path: '/inventory/finished', title: '成品库存' },
      { path: '/inventory/accessories', title: '辅料库存' },
      { path: '/inventory/fabric', title: '面料库存' },
    ],
  },
  { path: '/finance', title: '财务管理', icon: 'Coin' },
  { path: '/suppliers', title: '供应商管理', icon: 'Shop' },
  { path: '/hr', title: '人事管理', icon: 'Briefcase' },
  {
    path: '/settings',
    title: '系统设置',
    icon: 'Setting',
    children: [
      { path: '/settings/users', title: '用户管理' },
      { path: '/settings/roles', title: '角色与权限' },
      { path: '/settings/orders', title: '订单设置' },
    ],
  },
]
