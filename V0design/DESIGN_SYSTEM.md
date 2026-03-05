# 服装生产管理系统 - 完整设计系统

## 🎯 设计理念

**专业 + 冷色调 + 有活力 + 简洁 + 清爽亮色**

这是一个为服装生产企业量身定制的管理系统设计，采用深蓝和青色为主的冷色系搭配干净清爽的亮色背景，传达专业感和可信度，同时通过活力的强调色和简洁的界面设计，确保高效的用户体验。

---

## 🎨 色彩系统

### 核心色彩（3-5色原则）

| 颜色 | 值 | OKLch | 用途 |
|------|-----|-------|------|
| **主色 (Primary)** | `#1F4A8F` | oklch(0.35 0.12 255) | 按钮、链接、品牌元素 |
| **次色 (Secondary)** | `#3D5C7F` | oklch(0.42 0.08 250) | 次要操作、辅助信息 |
| **强调色 (Accent)** | `#475E7F` | oklch(0.45 0.06 250) | 重要数据、关键提示 |
| **警告色** | `#FF5C5C` | oklch(0.63 0.25 25) | 删除、危险操作 |
| **背景色** | `#F9F9FB` | oklch(0.99 0.001 0) | 页面背景（极浅） |
| **卡片色** | `#FFFFFF` | oklch(1 0 0) | 内容容器（纯白） |
| **文字色** | `#2D3D50` | oklch(0.2 0.01 250) | 主要文本 |
| **辅文字** | `#7F8B99` | oklch(0.5 0.01 250) | 次要文本 |
| **边框色** | `#E8EAED` | oklch(0.92 0 0) | 分割线 |
| **侧边栏** | `#F5F6F8` | oklch(0.96 0.001 0) | 导航背景 |

### 设计特点
- ✅ **干净清爽**：极浅背景和纯白卡片，视觉清晰舒适
- ✅ **专业冷色调**：深蓝主导，传达稳定性和信任感
- ✅ **活力融合**：沉稳蓝灰系强调，专业不突兀
- ✅ **高对比度**：深色文字和浅色背景确保易读性和无障碍访问
- ✅ **长时间办公友好**：亮色模式更适合白天办公环境

---

## ✍️ 字体系统

### 字体选择
```
Primary: Inter (Google Fonts)
用途: 标题、正文、UI元素
特点: 现代、清晰、支持多语言
```

### 字体层级（4 档精简）

| 层级 | 尺寸 | 变量 | 应用 |
|------|------|------|------|
| **标题** | 20px | `--font-size-title` | 页面主标题、板块标题、品牌名 |
| **副标题** | 16px | `--font-size-subtitle` | 卡片标题、弹窗标题 |
| **正文** | 14px | `--font-size-body` | 正文、表格、表单、按钮 |
| **辅助** | 12px | `--font-size-caption` | 标签、提示、次要信息 |

---

## 📏 间距系统

基准单位：**4px**

```
xs:  0.5rem (8px)
sm:  1rem   (16px)    ← 标准间距
md:  1.5rem (24px)    ← 卡片内边距
lg:  2rem   (32px)    ← 大块间距
xl:  3rem   (48px)    ← 超大间距
```

### 常用规则
- 卡片内边距: `p-6` (24px)
- 页面边距: `px-6 py-8`
- 元素间距: `gap-4` 或 `gap-6`
- 行间距: `mb-4` (16px)

---

## 🎛️ 核心组件

### 按钮
```jsx
// 主要
<button className="bg-primary text-white">保存</button>

// 次要
<button className="bg-secondary text-white">取消</button>

// 边框
<button className="border border-border text-foreground">删除</button>
```

### 输入框
```jsx
<input className="bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary" />
```

### 卡片
```jsx
<div className="bg-card border border-border rounded-xl p-6">
  内容
</div>
```

### 状态标签
```jsx
// 生产中
<span className="bg-primary/20 text-primary">生产中</span>

// 已完成
<span className="bg-accent/20 text-accent">已完成</span>

// 待处理
<span className="bg-muted text-muted-foreground">待处理</span>
```

---

## 📊 数据可视化

### 图表色彩序列
```css
--chart-1: oklch(0.35 0.12 255);  /* 主色 */
--chart-2: oklch(0.42 0.08 250);  /* 次色 */
--chart-3: oklch(0.45 0.06 250);  /* 强调色 */
--chart-4: oklch(0.50 0.08 245);  /* 浅蓝灰 */
--chart-5: oklch(0.55 0.06 240);  /* 淡蓝灰 */
```

---

## 🎯 核心设计原则

### 1️⃣ 专业第一
- 冷色主导传达稳定感
- 严谨的信息架构
- 清晰的视觉层级

### 2️⃣ 活力融合
- 适度的蓝灰系强调
- 避免过度装饰
- 流畅的交互反馈

### 3️⃣ 简洁至上
- 最小化设计原则
- 每个元素有其目的
- 直观的交互

### 4️⃣ 易用至上
- WCAG AA 色彩对比度
- 清晰的焦点状态
- 响应式布局

---

## 📱 响应式设计

```jsx
// Mobile-First 策略
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* 单列 → md: 双列 → lg: 四列 */}
</div>
```

### 断点
- `sm`: 640px
- `md`: 768px  
- `lg`: 1024px
- `xl`: 1280px

---

## 🏗️ 项目结构

```
/app
├── page.tsx                    # 主仪表板
├── design-system/
│   └── page.tsx               # 设计系统演示
├── index/
│   └── page.tsx               # 导航索引
├── layout.tsx                 # 根布局（已配置亮色模式）
└── globals.css                # 全局样式 & 设计令牌

/public
└── design-system-overview.jpg # 设计系统总览图

/components/ui/                # shadcn/ui 组件库
```

---

## 🚀 快速开始

### 查看设计系统

1. **主仪表板** → `/` 
   - 完整的生产管理界面演示
   - 实时互动的仪表板组件
   
2. **设计系统文档** → `/design-system`
   - 所有组件的完整展示
   - 色彩、字体、间距详解
   - 设计原则说明

### 使用设计令牌

所有颜色已定义为 CSS 变量，直接使用 Tailwind 类名：

```jsx
// 色彩
<div className="bg-primary text-primary-foreground">...</div>

// 间距
<div className="p-6 mb-4 gap-4">...</div>

// 圆角
<div className="rounded-xl">...</div>

// 渐变
<div className="bg-gradient-to-r from-primary to-accent">...</div>
```

---

## 📖 CSS 变量参考

在 `globals.css` 中已预定义所有设计令牌：

```css
:root {
  /* 颜色 - 亮色模式 */
  --primary: oklch(0.35 0.12 255);      /* 主色 */
  --secondary: oklch(0.42 0.08 250);   /* 次色 */
  --accent: oklch(0.45 0.06 250);      /* 强调色 */
  
  /* 背景 */
  --background: oklch(0.99 0.001 0);    /* 极浅 */
  --card: oklch(1 0 0);                 /* 纯白 */
  
  /* 文字 */
  --foreground: oklch(0.2 0.01 250);    /* 深灰 */
  --muted-foreground: oklch(0.5 0.01 250); /* 浅灰 */
  
  /* 圆角 */
  --radius: 0.5rem;
}
```

---

## 🎨 自定义扩展

### 修改主色

编辑 `globals.css`：

```css
:root {
  --primary: oklch(0.38 0.22 263);  /* ← 改这里 */
}
```

### 添加新颜色

```css
:root {
  --custom: oklch(0.5 0.15 200);
}
```

在 `tailwind.config.ts` 中：

```ts
theme: {
  extend: {
    colors: {
      custom: 'var(--custom)',
    }
  }
}
```

---

## ♿ 无障碍访问

✅ **WCAG AA 标准**
- 所有文本对比度 ≥ 4.5:1
- 关键操作不仅依赖颜色
- 清晰的焦点状态
- 语义化 HTML

---

## 📞 技术栈

- **框架**: Next.js 16 (App Router)
- **样式**: Tailwind CSS v4
- **UI 组件**: shadcn/ui
- **字体**: Inter (Google Fonts)
- **色彩空间**: OKLch
- **图标**: Lucide React

---

## 🔗 资源链接

- [Tailwind CSS 文档](https://tailwindcss.com)
- [Next.js 文档](https://nextjs.org)
- [Inter 字体](https://fonts.google.com/specimen/Inter)
- [OKLch 颜色](https://oklch.com)
- [WCAG 无障碍](https://www.w3.org/WAI/WCAG21/quickref/)

---

## 📝 更新历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.2.0 | 2026-03-03 | 字号精简为 4 档：标题 20px、副标题 16px、正文 14px、辅助 12px |
| 1.1.0 | 2026-03-02 | 调整为亮色主题：清爽的浅色背景，改善长时间办公体验 |
| 1.0.0 | 2026-03-02 | 初版发布：完整设计系统、仪表板、文档 |

---

**最后更新**: 2026-03-03  
**设计原则**: 专业 · 冷色调 · 有活力 · 简洁 · 清爽亮色

