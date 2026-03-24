import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import RouterViewWrapper from '@/layouts/RouterViewWrapper.vue'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/no-permission',
    name: 'NoPermission',
    component: () => import('@/views/no-permission.vue'),
    meta: { title: '无权限', public: true },
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/',
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/home/index.vue'),
        meta: { title: '主页', permissionPath: '/' },
      },
      {
        path: 'home',
        redirect: '/',
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('@/views/customers/index.vue'),
        meta: { title: '客户管理', permissionPath: '/customers' },
      },
      {
        path: 'orders',
        component: RouterViewWrapper,
        redirect: '/orders/list',
        meta: { title: '订单管理', permissionPath: '/orders' },
        children: [
          {
            path: 'products',
            name: 'OrdersProducts',
            component: () => import('@/views/orders/products.vue'),
            meta: { title: '产品列表', permissionPath: '/orders/products' },
          },
          {
            path: 'list',
            name: 'OrdersList',
            component: () => import('@/views/orders/list.vue'),
            meta: { title: '订单列表', permissionPath: '/orders/list' },
          },
          {
            path: 'detail/:id',
            name: 'OrdersDetail',
            component: () => import('@/views/orders/detail.vue'),
            meta: { title: '订单详情', permissionPath: '/orders/list' },
          },
          {
            path: 'edit/:id?',
            name: 'OrdersEdit',
            component: () => import('@/views/orders/edit.vue'),
            // 复用订单列表的菜单权限，避免额外配置独立菜单项
            meta: { title: '订单编辑', permissionPath: '/orders/list' },
          },
          {
            path: 'cost/:id',
            name: 'OrdersCost',
            component: () => import('@/views/orders/cost.vue'),
            meta: { title: '订单成本', permissionPath: '/orders/list' },
          },
        ],
      },
      {
        path: 'production',
        component: RouterViewWrapper,
        redirect: '/production/purchase',
        meta: { title: '生产管理', permissionPath: '/production' },
        children: [
          {
            path: 'purchase',
            name: 'ProductionPurchase',
            component: () => import('@/views/production/purchase.vue'),
            meta: { title: '采购管理', permissionPath: '/production/purchase' },
          },
          {
            path: 'pattern',
            name: 'ProductionPattern',
            component: () => import('@/views/production/pattern.vue'),
            meta: { title: '纸样管理', permissionPath: '/production/pattern' },
          },
          {
            path: 'process',
            name: 'ProductionProcess',
            component: () => import('@/views/production/process.vue'),
            meta: { title: '工艺管理', permissionPath: '/production/process' },
          },
          {
            path: 'cutting',
            name: 'ProductionCutting',
            component: () => import('@/views/production/cutting.vue'),
            meta: { title: '裁床管理', permissionPath: '/production/cutting' },
          },
          {
            path: 'sewing',
            name: 'ProductionSewing',
            component: () => import('@/views/production/sewing.vue'),
            meta: { title: '车缝管理', permissionPath: '/production/sewing' },
          },
          {
            path: 'finishing',
            name: 'ProductionFinishing',
            component: () => import('@/views/production/finishing.vue'),
            meta: { title: '尾部管理', permissionPath: '/production/finishing' },
          },
        ],
      },
      {
        path: 'inventory',
        component: RouterViewWrapper,
        redirect: '/inventory/pending',
        meta: { title: '库存管理', permissionPath: '/inventory' },
        children: [
          {
            path: 'pending',
            name: 'InventoryPending',
            component: () => import('@/views/inventory/pending.vue'),
            meta: { title: '待仓处理', permissionPath: '/inventory/pending' },
          },
          {
            path: 'finished',
            name: 'InventoryFinished',
            component: () => import('@/views/inventory/finished.vue'),
            meta: { title: '成品库存', permissionPath: '/inventory/finished' },
          },
          {
            path: 'accessories',
            name: 'InventoryAccessories',
            component: () => import('@/views/inventory/accessories.vue'),
            meta: { title: '辅料库存', permissionPath: '/inventory/accessories' },
          },
          {
            path: 'fabric',
            name: 'InventoryFabric',
            component: () => import('@/views/inventory/fabric.vue'),
            meta: { title: '面料库存', permissionPath: '/inventory/fabric' },
          },
        ],
      },
      {
        path: 'finance',
        component: RouterViewWrapper,
        redirect: '/finance/dashboard',
        meta: { title: '财务管理', permissionPath: '/finance' },
        children: [
          {
            path: 'dashboard',
            name: 'FinanceDashboard',
            component: () => import('@/views/finance/dashboard.vue'),
            meta: { title: '财务看板', permissionPath: '/finance/dashboard' },
          },
          {
            path: 'income',
            name: 'FinanceIncome',
            component: () => import('@/views/finance/income.vue'),
            meta: { title: '收入流水', permissionPath: '/finance/income' },
          },
          {
            path: 'expense',
            name: 'FinanceExpense',
            component: () => import('@/views/finance/expense.vue'),
            meta: { title: '支出流水', permissionPath: '/finance/expense' },
          },
          {
            path: 'order-sla-report',
            name: 'FinanceOrderSlaReport',
            component: () => import('@/views/finance/order-sla-report.vue'),
            meta: { title: '订单时效', permissionPath: '/finance/order-sla-report' },
          },
        ],
      },
      {
        path: 'suppliers',
        name: 'Suppliers',
        component: () => import('@/views/suppliers/index.vue'),
        meta: { title: '供应商管理', permissionPath: '/suppliers' },
      },
      {
        path: 'hr',
        name: 'Hr',
        component: () => import('@/views/hr/index.vue'),
        meta: { title: '人事管理', permissionPath: '/hr' },
      },
      {
        path: 'settings',
        component: RouterViewWrapper,
        redirect: '/settings/users',
        meta: { title: '系统设置', permissionPath: '/settings' },
        children: [
          {
            path: '',
            redirect: '/settings/users',
          },
          {
            path: 'users',
            name: 'SettingsUsers',
            component: () => import('@/views/settings/users.vue'),
            meta: { title: '用户管理', permissionPath: '/settings/users' },
          },
          {
            path: 'roles',
            name: 'SettingsRoles',
            component: () => import('@/views/settings/roles.vue'),
            meta: { title: '角色与权限', permissionPath: '/settings/roles' },
          },
          {
            path: 'orders',
            name: 'SettingsOrders',
            component: () => import('@/views/settings/order-settings.vue'),
            meta: { title: '订单设置', permissionPath: '/settings/orders' },
          },
          {
            path: 'suppliers',
            name: 'SettingsSuppliers',
            component: () => import('@/views/settings/supplier-settings.vue'),
            meta: { title: '供应商设置', permissionPath: '/settings/suppliers' },
          },
          {
            path: 'inventory',
            name: 'SettingsInventory',
            component: () => import('@/views/settings/inventory-settings.vue'),
            meta: { title: '库存设置', permissionPath: '/settings/inventory' },
          },
          {
            path: 'hr',
            name: 'SettingsHr',
            component: () => import('@/views/settings/hr-settings.vue'),
            meta: { title: '组织与人事', permissionPath: '/settings/hr' },
          },
          {
            path: 'finance',
            name: 'SettingsFinance',
            component: () => import('@/views/settings/finance-settings.vue'),
            meta: { title: '财务设置', permissionPath: '/settings/finance' },
          },
        ],
      },
      {
        path: 'settings-legacy',
        name: 'Settings',
        redirect: '/settings/users',
      },
      {
        path: 'tools/foreign-tool',
        name: 'ForeignTool',
        component: () => import('@/views/tools/foreign-tool.vue'),
        meta: { title: '外贸小工具', permissionPath: '/tools/foreign-tool' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  if (to.meta.public) {
    const auth = useAuthStore()
    if (to.path === '/login' && auth.isLoggedIn) return next('/')
    return next()
  }
  const auth = useAuthStore()
  if (!auth.token) return next('/login')
  if (!auth.user) {
    try {
      await auth.fetchUser()
    } catch {
      return next('/login')
    }
  }
  const leaf = to.matched[to.matched.length - 1]
  const permissionPath = (leaf?.meta?.permissionPath as string) || (to.meta?.permissionPath as string)
  if (permissionPath && !auth.hasRoutePermission(permissionPath)) return next('/no-permission')
  next()
})

export default router
