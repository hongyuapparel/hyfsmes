# 快速参考 - 服装生产管理系统设计规范

## 🎨 色彩快速参考

```
品牌蓝（主色）        #0052CC    RGB(0, 82, 204)
活力青（辅色）        #00D9FF    RGB(0, 217, 255)
成功绿                #10B981    RGB(16, 185, 129)
警告橙                #F59E0B    RGB(245, 158, 11)
错误红                #EF4444    RGB(239, 68, 68)
信息蓝                #3B82F6    RGB(59, 130, 246)

深灰（主文字）        #1F2937    RGB(31, 41, 55)
灰（次文字）          #374151    RGB(55, 65, 81)
浅灰（辅助）          #6B7280    RGB(107, 114, 128)
禁用灰                #D1D5DB    RGB(209, 213, 219)
边框灰                #E5E7EB    RGB(229, 231, 235)
极浅灰                #F3F4F6    RGB(243, 244, 246)
更浅灰                #F9FAFB    RGB(249, 250, 251)
白色                  #FFFFFF    RGB(255, 255, 255)
```

## 📐 间距系统

```
xs  4px      /* 极小间距 */
sm  8px      /* 小间距 */
md  12px     /* 中间距 */
lg  16px     /* 标准间距 */
xl  20px     /* 大间距 */
2xl 24px     /* 很大间距 */
3xl 32px     /* 特大间距 */
4xl 40px     /* 超大间距 */
```

常用组合：
- 容器内边距：20px 或 24px
- 卡片间距：16px
- 页面边距：24px（PC）/ 16px（Mobile）

## 🔤 字体系统

```
字体家族：Inter（Google Font）

标题字体  Inter Bold（700）
- H1: 32px / 40px line-height
- H2: 24px / 32px line-height
- H3: 20px / 28px line-height

正文字体  Inter Regular（400）
- 大文本：16px / 24px line-height
- 正文：14px / 20px line-height
- 小文本：12px / 18px line-height
- 超小：11px / 16px line-height
```

## 📐 圆角规范

```
none   0       /* 直角 */
sm     4px     /* 小按钮、标签 */
md     6px     /* 卡片、输入框（推荐） */
lg     8px     /* 大按钮、模态框 */
xl     12px    /* 特殊组件 */
full   9999px  /* 圆形、徽章 */
```

## 🎭 阴影规范

```
xs  0 1px 2px rgba(0,0,0,0.05)        /* 轻微 */
sm  0 1px 3px rgba(0,0,0,0.1)         /* 小 */
md  0 4px 6px rgba(0,0,0,0.1)         /* 标准 */
lg  0 10px 15px rgba(0,0,0,0.1)       /* 卡片 */
xl  0 20px 25px rgba(0,0,0,0.1)       /* 弹窗 */
```

## 🔘 按钮设计

```
类型：primary / success / warning / danger / info / default
尺寸：large(40px) / default(32px) / small(24px)

主按钮：蓝色 + solid
次按钮：默认 + plain
禁用：透明度 50%
Loading：显示加载图标
```

## 📊 表格设计

```
表头背景：#F9FAFB
表头文字：#374151（权重600）
表头边框：2px solid #E5E7EB
行高：44px
行边框：1px solid #E5E7EB
hover 背景：#F3F4F6
```

## 📝 输入框设计

```
默认边框：1px solid #D1D5DB
焦点边框：1px solid #0052CC
焦点阴影：0 0 0 3px rgba(0, 82, 204, 0.1)
禁用背景：#F9FAFB
禁用文字：#D1D5DB
高度：32px
内边距：0 12px
圆角：6px
```

## 🎯 响应式断点

```
手机     < 640px
平板     640px - 1024px
PC 桌面  > 1024px

常见调整：
- < 768px：单列布局、隐藏边栏
- >= 1024px：多列网格、显示完整导航
```

## 📦 Element Plus 常用组件

### 表单组件
```
el-input        输入框
el-select       下拉选择
el-datepicker   日期选择
el-checkbox     复选框
el-radio        单选框
el-switch       开关
el-textarea     多行输入
el-form         表单容器
el-form-item    表单项
```

### 展示组件
```
el-card         卡片
el-table        表格
el-pagination   分页
el-badge        徽章
el-tag          标签
el-alert        警告/提示
el-divider      分割线
el-progress     进度条
```

### 交互组件
```
el-button       按钮
el-dialog       对话框
el-dropdown     下拉菜单
el-popover      弹出框
el-tooltip      工具提示
el-menu         菜单
el-tabs         标签页
```

### 反馈组件
```
el-message      消息
el-notification 通知
el-loading      加载
el-confirm      确认框
```

## 🚀 项目启动流程

### 前端
```bash
# 1. 创建项目
npm create vite@latest --template vue-ts

# 2. 安装依赖
pnpm install
pnpm add element-plus @element-plus/icons-vue vue-router pinia axios

# 3. 配置主题 CSS
# 创建 src/styles/theme.css 和 globals.css

# 4. 配置 main.ts
# 导入 Element Plus 和 CSS 变量

# 5. 启动开发
pnpm dev
```

### 后端
```bash
# 1. 创建项目
nest new backend

# 2. 安装依赖
npm install typeorm mysql2 bcrypt class-validator @nestjs/jwt @nestjs/passport

# 3. 配置数据库
# 修改 src/database/data-source.ts

# 4. 创建模块
nest generate module modules/auth
nest generate service modules/auth
nest generate controller modules/auth

# 5. 启动开发
npm run start:dev
```

## ✅ 常见代码模板

### Vue 3 组件基础

```vue
<template>
  <div class="component">
    <!-- 内容 -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// 数据
const count = ref(0)

// 计算属性
const doubled = computed(() => count.value * 2)

// 方法
const increment = () => {
  count.value++
}
</script>

<style scoped>
.component {
  padding: 20px;
  border-radius: 8px;
  background: white;
}
</style>
```

### API 调用示例

```typescript
import apiClient from '@api/client'

// GET 请求
const response = await apiClient.get('/products')

// POST 请求
const response = await apiClient.post('/orders', {
  productId: '123',
  quantity: 10,
})

// PUT 请求
const response = await apiClient.put('/orders/1', {
  status: 'shipped',
})

// DELETE 请求
await apiClient.delete('/orders/1')
```

### 表单验证

```typescript
const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '长度 3-20 字符', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式错误', trigger: 'blur' },
  ],
}
```

## 🐛 常见问题排查

### Element Plus 样式未应用？
- ✓ 检查是否在 main.ts 导入 Element Plus
- ✓ 检查是否在 index.html 导入字体
- ✓ 检查 CSS 变量是否在 theme.css 中定义

### API 请求 401？
- ✓ 检查 token 是否存在
- ✓ 检查 token 是否过期
- ✓ 检查请求头是否包含 Authorization

### 样式冲突？
- ✓ 使用 scoped 样式隔离
- ✓ 使用 CSS 变量而不是硬编码颜色
- ✓ 检查 z-index 层级

### 性能问题？
- ✓ 使用路由懒加载
- ✓ 使用 v-show 而不是 v-if（频繁切换）
- ✓ 使用计算属性缓存数据
- ✓ 使用虚拟滚动（大列表）

## 📚 文档导航

| 文档 | 描述 |
|------|------|
| DESIGN_SYSTEM.md | 完整设计系统规范 |
| VUE3_CONFIG_GUIDE.md | Vue 3 项目配置指南 |
| EXAMPLE_PAGES.md | 登录页、仪表板代码示例 |
| BACKEND_ARCHITECTURE.md | NestJS 后端架构设计 |
| QUICK_REFERENCE.md | 本快速参考卡片 |

## 🎯 下一步行动

### 优先级 1（立即开始）
1. ✓ 理解设计系统规范
2. ✓ 初始化 Vue 3 + Vite 项目
3. ✓ 配置 Element Plus 主题
4. ✓ 创建登录页面

### 优先级 2（完成基础）
1. ✓ 搭建后端 NestJS 项目
2. ✓ 实现认证模块（登录、注册）
3. ✓ 创建仪表板页面
4. ✓ 集成数据库

### 优先级 3（功能扩展）
1. ✓ 产品管理模块
2. ✓ 订单管理模块
3. ✓ 生产计划模块
4. ✓ 库存管理模块

---

**最后更新：** 2026-03-02
**创建者：** v0 AI Assistant
**版本：** 1.0.0
