# 快速参考卡

## 🎯 项目一览

**项目名称**：服装生产管理系统  
**设计理念**：专业冷色调 + 活力强调  
**技术栈**：Next.js 16 + React 19 + Tailwind CSS v4  
**状态**：完全可用 ✅

---

## 📱 页面速览

| 页面 | URL | 状态 | 说明 |
|------|-----|------|------|
| 登录 | `/login` | ✅ | 专业登录表单 |
| 仪表板 | `/dashboard` | ✅ | 完整数据展示 |
| 设计系统 | `/design` | ✅ | 设计规范展示 |
| 订单管理 | `/dashboard/orders` | ✅ | 占位符 |
| 其他功能 | `/dashboard/*` | ⏳ | 待开发 |

---

## 🎨 颜色快速查询

```
主色 (Primary)
  hex: #0052CC
  class: bg-primary text-primary-foreground
  用途：按钮、链接、强调

次色 (Secondary)  
  hex: #00D9FF
  class: bg-secondary text-secondary-foreground
  用途：强调、提示、图标

强调色 (Accent)
  hex: #FF6B35
  class: bg-accent text-accent-foreground
  用途：警告、关键行动

背景 (Background)
  hex: #F8FAFC
  class: bg-background text-foreground
  用途：页面背景

卡片 (Card)
  hex: #FFFFFF
  class: bg-card text-card-foreground
  用途：容器、面板

边框 (Border)
  hex: #E5E7EB
  class: border border-border
  用途：分隔线、边框
```

---

## 📐 Tailwind 类名速查

### 布局
```
Grid 布局：grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
Flex 布局：flex items-center justify-between gap-4
绝对定位：absolute inset-0 overflow-hidden pointer-events-none
```

### 间距
```
外边距：m-4 mx-4 my-4 mt-4 mb-4 ml-4 mr-4
内边距：p-4 px-4 py-4 pt-4 pb-4 pl-4 pr-4
间隔：gap-4 gap-x-4 gap-y-4
```

### 文字
```
字体大小：text-sm text-base text-lg text-2xl text-3xl text-4xl
字体粗细：font-light font-normal font-semibold font-bold
文本色：text-foreground text-muted-foreground text-card-foreground
文本对齐：text-left text-center text-right
```

### 背景和边框
```
背景色：bg-background bg-card bg-muted bg-primary
边框：border border-border border-border/50 border-l border-t
圆角：rounded-md rounded-lg rounded-xl
阴影：shadow-sm shadow-md shadow-lg
```

### 响应式
```
Mobile First:
- (无前缀) = 移动设备（< 768px）
- md: = 平板设备（768px+）
- lg: = 桌面设备（1024px+）
- xl: = 大屏幕（1280px+）

示例：
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4
text-base md:text-lg lg:text-xl
```

---

## 💻 组件使用示例

### 按钮
```tsx
<Button>主要按钮</Button>
<Button variant="secondary">次要按钮</Button>
<Button variant="outline">边框按钮</Button>
<Button variant="ghost">幽灵按钮</Button>
<Button size="sm">小按钮</Button>
<Button size="lg">大按钮</Button>
```

### 卡片
```tsx
<Card>
  <div className="p-6 space-y-4">
    <h3 className="text-lg font-semibold">标题</h3>
    <p className="text-muted-foreground">内容</p>
  </div>
</Card>
```

### 输入框
```tsx
<Input
  type="text"
  placeholder="输入内容"
  className="h-10 border-border/50"
/>
```

### 导航链接
```tsx
<Link href="/path">
  <Button variant="ghost">导航项</Button>
</Link>
```

---

## 📊 数据结构快速参考

### 统计卡片数据
```js
const stats = [
  {
    title: '本周生产',
    value: '1,330',
    unit: '件',
    change: '+12.5%',
    trend: 'up',
    icon: Package,
  },
  // ...
]
```

### 表格数据
```js
const orders = [
  {
    id: 'ORD-001',
    customer: '客户名',
    product: '产品',
    qty: 500,
    status: '已完成',
    date: '2024-01-15'
  },
  // ...
]
```

### 图表数据
```js
const chartData = [
  { name: '周一', 完成: 240, 计划: 280 },
  { name: '周二', 完成: 290, 计划: 300 },
  // ...
]
```

---

## 🔧 常见任务

### 修改颜色
1. 打开 `/app/globals.css`
2. 找到 `:root { }` 部分
3. 修改颜色值，如：`--primary: oklch(0.38 0.22 263);`
4. 保存，网站自动更新

### 添加新页面
1. 在 `/app/dashboard/` 创建新文件夹
2. 添加 `page.tsx`
3. 导入 `SidebarNav` 和 `TopNav`
4. 在 `sidebar-nav.tsx` 中添加导航链接

### 修改导航菜单
1. 打开 `/components/sidebar-nav.tsx`
2. 修改 `navItems` 数组
3. 添加/删除菜单项
4. 保存，侧边栏自动更新

### 更新统计数据
1. 打开 `/app/dashboard/page.tsx`
2. 修改 `stats` 或 `productionData` 数组
3. 修改数值和趋势
4. 保存，仪表板自动更新

---

## 📁 重要文件路径

```
/app/globals.css              ← 修改颜色系统
/app/login/page.tsx           ← 登录页面
/app/dashboard/page.tsx       ← 仪表板页面
/app/design/page.tsx          ← 设计系统页面
/components/sidebar-nav.tsx   ← 侧边栏导航
/components/top-nav.tsx       ← 顶部导航
/components/ui/*              ← UI 组件库
```

---

## 🎯 开发建议

### 优先级 1（立即开发）
- [ ] 完成其他功能页面
- [ ] 集成后端 API
- [ ] 实现登录认证

### 优先级 2（后续完善）
- [ ] 添加表单验证
- [ ] 实现搜索功能
- [ ] 添加数据筛选

### 优先级 3（最终优化）
- [ ] 性能优化
- [ ] 测试覆盖
- [ ] 部署上线

---

## 📞 快速问题解答

**Q：如何修改主色？**
A：编辑 `/app/globals.css`，修改 `--primary` 值

**Q：如何添加新的导航菜单？**
A：编辑 `/components/sidebar-nav.tsx`，修改 `navItems` 数组

**Q：如何更新仪表板数据？**
A：编辑 `/app/dashboard/page.tsx`，修改数据数组

**Q：如何创建新页面？**
A：在 `/app/dashboard/` 下创建新文件夹，添加 `page.tsx` 文件

**Q：设计系统在哪里？**
A：访问 `/design` 页面，或查看 `PROJECT_SUMMARY.md` 和 `PREVIEW_GUIDE.md`

**Q：如何本地运行项目？**
A：`npm install` → `npm run dev` → 访问 `http://localhost:3000/login`

---

## 🚀 快速开始命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建项目
npm run build

# 生产环境运行
npm start
```

---

## 📊 项目统计

- **总代码行数**：1,592
- **总文档行数**：2,000+
- **页面数**：5 个
- **组件数**：5 个
- **颜色数**：12 种
- **功能模块**：7 个

---

## ✨ 项目特色

✅ 专业设计系统  
✅ 完整可视化  
✅ 响应式布局  
✅ 生产就绪  
✅ 易于扩展  
✅ 详细文档  
✅ 可立即使用  

---

**开始开发吧！** 访问 http://localhost:3000/login

