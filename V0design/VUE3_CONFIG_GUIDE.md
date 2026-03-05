# Vue 3 + Element Plus 项目配置完全指南

## 一、项目初始化

### 1. 创建 Vue 3 + Vite 项目

```bash
# 使用 Vite 官方模板创建项目
npm create vite@latest clothing-management -- --template vue-ts

# 进入项目目录
cd clothing-management

# 安装依赖
pnpm install
```

### 2. 安装核心依赖

```bash
# Element Plus
pnpm add element-plus
pnpm add @element-plus/icons-vue

# 路由、状态管理、HTTP
pnpm add vue-router pinia axios

# 开发依赖
pnpm add -D typescript @types/node
```

---

## 二、主题配置

### 1. 创建主题 CSS 文件

**文件路径：** `src/styles/theme.css`

```css
:root {
  /* ==================== 色彩系统 ==================== */
  
  /* 品牌色 */
  --el-color-primary: #0052CC;
  --el-color-primary-light-1: #1968E6;
  --el-color-primary-light-2: #3280F0;
  --el-color-primary-light-3: #4D94F7;
  --el-color-primary-light-4: #66A8FF;
  --el-color-primary-light-5: #80BFFF;
  --el-color-primary-light-6: #99D5FF;
  --el-color-primary-light-7: #B3EBFF;
  --el-color-primary-light-8: #CCF5FF;
  --el-color-primary-light-9: #E6FAFF;

  /* 语义色 */
  --el-color-success: #10B981;
  --el-color-warning: #F59E0B;
  --el-color-danger: #EF4444;
  --el-color-info: #3B82F6;

  /* 中性色 */
  --el-color-text-primary: #1F2937;
  --el-color-text-regular: #374151;
  --el-color-text-secondary: #6B7280;
  --el-color-text-disabled: #D1D5DB;

  --el-fill-color-blank: #FFFFFF;
  --el-fill-color: #F5F7FA;
  --el-fill-color-light: #F3F4F6;
  --el-fill-color-lighter: #F9FAFB;
  --el-fill-color-extra-light: #FFFFFF;

  --el-border-color: #E5E7EB;
  --el-border-color-light: #E5E7EB;
  --el-border-color-lighter: #F3F4F6;
  --el-border-color-extra-light: #F9FAFB;

  /* ==================== 字体系统 ==================== */

  --el-font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --el-font-weight-primary: 600;
  --el-font-weight-bold: 700;

  --el-font-size-extra-large: 16px;
  --el-font-size-large: 14px;
  --el-font-size-base: 14px;
  --el-font-size-small: 12px;
  --el-font-size-extra-small: 11px;

  --el-line-height: 1.5;
  --el-line-height-primary: 1.5;

  /* ==================== 间距系统 ==================== */

  --el-component-size-large: 40px;
  --el-component-size: 32px;
  --el-component-size-small: 24px;

  /* ==================== 圆角系统 ==================== */

  --el-border-radius-base: 6px;
  --el-border-radius-small: 4px;
  --el-border-radius-round: 9999px;

  /* ==================== 阴影系统 ==================== */

  --el-box-shadow-base: 0 1px 3px rgba(0, 0, 0, 0.1);
  --el-box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  --el-box-shadow-dark: 0 10px 15px rgba(0, 0, 0, 0.1);

  /* ==================== 过渡动画 ==================== */

  --el-transition-duration: 0.3s;
  --el-transition-duration-fade: 0.3s;
  --el-transition-function-ease-in-out-bezier: cubic-bezier(0.4, 0, 0.2, 1);
}

/* ==================== 全局样式 ==================== */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: var(--el-font-family-base);
  font-size: var(--el-font-size-base);
  line-height: var(--el-line-height);
  color: var(--el-color-text-primary);
  background-color: #F9FAFB;
}

#app {
  width: 100%;
  height: 100%;
}

/* ==================== 滚动条样式 ==================== */

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #D1D5DB;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #9CA3AF;
}

/* ==================== 选中文本样式 ==================== */

::selection {
  background-color: rgba(0, 82, 204, 0.2);
  color: var(--el-color-text-primary);
}
```

### 2. 创建全局样式文件

**文件路径：** `src/styles/globals.css`

```css
/* 便捷间距工具类 */

.p-xs { padding: 4px; }
.p-sm { padding: 8px; }
.p-md { padding: 12px; }
.p-lg { padding: 16px; }
.p-xl { padding: 20px; }
.p-2xl { padding: 24px; }
.p-3xl { padding: 32px; }

.px-lg { padding-left: 16px; padding-right: 16px; }
.py-lg { padding-top: 16px; padding-bottom: 16px; }

.m-xs { margin: 4px; }
.m-sm { margin: 8px; }
.m-md { margin: 12px; }
.m-lg { margin: 16px; }
.m-xl { margin: 20px; }
.m-2xl { margin: 24px; }
.m-3xl { margin: 32px; }

.mx-auto { margin-left: auto; margin-right: auto; }
.my-auto { margin-top: auto; margin-bottom: auto; }

.gap-xs { gap: 4px; }
.gap-sm { gap: 8px; }
.gap-md { gap: 12px; }
.gap-lg { gap: 16px; }
.gap-xl { gap: 20px; }

/* 便捷布局工具类 */

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flex-start {
  display: flex;
  align-items: flex-start;
}

.flex-col {
  display: flex;
  flex-direction: column;
}

.flex-col-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.grid {
  display: grid;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* 便捷文本工具类 */

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.text-primary { color: var(--el-color-text-primary); }
.text-secondary { color: var(--el-color-text-secondary); }
.text-disabled { color: var(--el-color-text-disabled); }

.text-sm { font-size: var(--el-font-size-small); }
.text-base { font-size: var(--el-font-size-base); }
.text-lg { font-size: var(--el-font-size-large); }
.text-xl { font-size: 16px; }

.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }

.line-clamp-1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 便捷背景色工具类 */

.bg-white { background-color: #FFFFFF; }
.bg-light { background-color: #F9FAFB; }
.bg-lighter { background-color: #F3F4F6; }
.bg-primary { background-color: var(--el-color-primary); }
.bg-success { background-color: var(--el-color-success); }
.bg-warning { background-color: var(--el-color-warning); }
.bg-danger { background-color: var(--el-color-danger); }

/* 边框相关 */

.border { border: 1px solid var(--el-border-color); }
.border-b { border-bottom: 1px solid var(--el-border-color); }
.border-t { border-top: 1px solid var(--el-border-color); }
.border-l { border-left: 1px solid var(--el-border-color); }
.border-r { border-right: 1px solid var(--el-border-color); }

.rounded-md { border-radius: var(--el-border-radius-base); }
.rounded-sm { border-radius: var(--el-border-radius-small); }
.rounded-lg { border-radius: 8px; }

/* 阴影 */

.shadow-sm { box-shadow: var(--el-box-shadow-base); }
.shadow-md { box-shadow: var(--el-box-shadow); }
.shadow-lg { box-shadow: var(--el-box-shadow-dark); }

/* 响应式 */

@media (max-width: 768px) {
  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }
}
```

---

## 三、项目结构配置

### 1. vite.config.ts

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@views': path.resolve(__dirname, './src/views'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@api': path.resolve(__dirname, './src/api'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
})
```

### 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skip": [],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@views/*": ["./src/views/*"],
      "@stores/*": ["./src/stores/*"],
      "@api/*": ["./src/api/*"],
      "@utils/*": ["./src/utils/*"],
      "@types/*": ["./src/types/*"],
      "@styles/*": ["./src/styles/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 3. main.ts

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

import App from './App.vue'
import router from './router'
import '@styles/theme.css'
import '@styles/globals.css'

const app = createApp(App)

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
```

---

## 四、路由配置

**文件路径：** `src/router/index.ts`

```typescript
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/production',
    name: 'Production',
    component: () => import('@views/Production/List.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('@views/Orders/List.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@views/NotFound.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('token')

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
```

---

## 五、状态管理（Pinia）

### 1. 认证存储

**文件路径：** `src/stores/auth.ts`

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UserInfo {
  id: string
  username: string
  email: string
  roles: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string>('')
  const isLoading = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  const setUser = (userData: UserInfo) => {
    user.value = userData
  }

  const setToken = (newToken: string) => {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  const logout = () => {
    user.value = null
    token.value = ''
    localStorage.removeItem('token')
  }

  const login = async (username: string, password: string) => {
    try {
      isLoading.value = true
      // API 调用示例
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json()
      setToken(data.token)
      setUser(data.user)
      return data
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    setUser,
    setToken,
    logout,
    login,
  }
})
```

### 2. APP 存储

**文件路径：** `src/stores/app.ts`

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const currentPage = ref('dashboard')

  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const setCurrentPage = (page: string) => {
    currentPage.value = page
  }

  return {
    sidebarCollapsed,
    currentPage,
    toggleSidebar,
    setCurrentPage,
  }
})
```

---

## 六、API 请求封装

**文件路径：** `src/api/client.ts`

```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@stores/auth'
import { ElMessage } from 'element-plus'

class ApiClient {
  private instance: AxiosInstance

  constructor() {
    this.instance = axios.create({
      baseURL: '/api',
      timeout: 10000,
    })

    // 请求拦截器
    this.instance.interceptors.request.use((config) => {
      const authStore = useAuthStore()
      if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`
      }
      return config
    })

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response?.status === 401) {
          const authStore = useAuthStore()
          authStore.logout()
          window.location.href = '/login'
        }
        ElMessage.error(error.response?.data?.message || '请求失败')
        return Promise.reject(error)
      }
    )
  }

  get<T>(url: string, config?: AxiosRequestConfig) {
    return this.instance.get<T>(url, config)
  }

  post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.post<T>(url, data, config)
  }

  put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.put<T>(url, data, config)
  }

  delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.instance.delete<T>(url, config)
  }
}

export default new ApiClient()
```

---

## 七、类型定义

**文件路径：** `src/types/index.ts`

```typescript
// 分页相关
export interface PageQuery {
  page: number
  pageSize: number
  sortBy?: string
  order?: 'asc' | 'desc'
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// API 响应
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// 用户相关
export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    id: string
    username: string
    email: string
    roles: string[]
  }
}

// 生产管理相关
export interface Product {
  id: string
  name: string
  sku: string
  category: string
  price: number
  stock: number
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  orderNo: string
  customerId: string
  totalAmount: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export interface ProductionPlan {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'draft' | 'active' | 'completed'
  items: ProductionPlanItem[]
}

export interface ProductionPlanItem {
  productId: string
  quantity: number
  completedQuantity: number
  status: 'pending' | 'in_progress' | 'completed'
}
```

---

## 八、使用注意事项

### 1. 组件命名规范

```
- 页面组件：PascalCase（如 Dashboard.vue）
- 通用组件：PascalCase（如 Header.vue）
- 业务组件：PascalCase（如 ProductForm.vue）
```

### 2. 样式隔离

```vue
<style scoped>
/* 所有样式自动作用于当前组件 */
</style>
```

### 3. 定义组件 Props

```typescript
interface Props {
  id: string
  title: string
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  disabled: false,
})
```

---

## 九、快速启动命令

```bash
# 开发环境运行
pnpm dev

# 生产环境构建
pnpm build

# 预览构建结果
pnpm preview

# 类型检查
pnpm type-check
```

---

## 十、常见问题

### Q: 如何修改 Element Plus 组件主题？
A: 修改 `src/styles/theme.css` 中的 CSS 变量即可，所有组件会自动应用新样式。

### Q: 如何添加自定义字体？
A: 在 `index.html` 中添加字体链接，然后在 `theme.css` 更新 `--el-font-family-base` 变量。

### Q: 如何实现国际化（i18n）？
A: 安装 `vue-i18n`，配置多语言文件，在 `main.ts` 中注册即可。

### Q: 生产环境如何优化性能？
A: 使用路由懒加载、组件异步加载、代码分割等 Vite 内置优化。

---

**更新时间：** 2026-03-02
