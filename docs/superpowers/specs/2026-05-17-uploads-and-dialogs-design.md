# 设计文档：图片上传压缩 / 孤立图片清理 / 弹窗默认行为统一

- 日期：2026-05-17
- 范围：前后端
- 触发来源：用户反馈四点 ——（1）大图上传偶发 5MB 超限；（2）担心 `uploads/` 目录无引用图片堆积；（3）弹窗误点背景关闭；（4）希望弹窗可拖动、可调大小

---

## 一、目标

在不改动业务逻辑的前提下，统一以下四项基础能力：

1. **图片上传自动压缩**：上传前在浏览器端按阈值自动压缩，避免 5MB 限制误伤手机大图，同时减少服务器存储。
2. **孤立图片清理**：管理员页面手动触发扫描 → 预览 → 删除 `uploads/` 目录下数据库中已无引用的文件。
3. **弹窗默认禁用背景点击关闭**：消除误触关闭弹窗的体验问题。
4. **弹窗默认可拖动 + 基础缩放**：提升弹窗排版灵活度。

四项均要求：**改动收敛在公共层**，业务代码侧零侵入或一次性批量替换。

---

## 二、当前现状

- 后端：3 个上传接口 `/uploads/image`、`/uploads/finance-image`、`/uploads/outbound-image`，单文件上限 5MB，上传后用 `sharp` 生成 `small_*` 400px 缩略图（[backend/src/uploads/uploads.controller.ts](backend/src/uploads/uploads.controller.ts)、[backend/src/uploads/thumbnail.util.ts](backend/src/uploads/thumbnail.util.ts)）。
- 前端：图片上传集中在 [frontend/src/api/uploads.ts](frontend/src/api/uploads.ts) 三个函数，共 19 处调用，主要通过 [frontend/src/components/ImageUploadArea.vue](frontend/src/components/ImageUploadArea.vue) 复用。**目前无客户端压缩**。
- 弹窗：40 个文件使用 `<el-dialog>`，仅 2 处显式禁用了背景点击；9 处使用 `ElMessageBox`；项目无 `AppDialog` 公共组件（CLAUDE.md 提到但实际未建）。
- Element Plus 2.4.x：`<el-dialog>` 内置 `draggable` 属性，无内置 resize。

---

## 三、设计方案

### 1. 图片自动压缩

**引入依赖**：`browser-image-compression`（npm，约 30KB gzip，MIT，活跃维护）。

**选型理由**：
- 自动处理 EXIF orientation（手机拍照上传场景必需，否则压完会变横躺）
- 内置 Web Worker，大图压缩不阻塞主线程
- 内置迭代压缩到目标大小，无需自写循环

**新增文件**：`frontend/src/utils/imageCompress.ts`

```ts
import imageCompression from 'browser-image-compression'

const COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024 // 1.5MB 以上才压缩
const MAX_SIZE_MB = 1.5
const MAX_WIDTH_OR_HEIGHT = 2400
const INITIAL_QUALITY = 0.85

/**
 * 上传前自动压缩。小文件 / 非图片 / gif 直接返回原文件。
 * 压缩失败时降级返回原文件，由后端 5MB 拦截兜底。
 */
export async function maybeCompressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/gif') return file
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return file
  try {
    return await imageCompression(file, {
      maxSizeMB: MAX_SIZE_MB,
      maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      initialQuality: INITIAL_QUALITY,
    })
  } catch (e) {
    console.warn('[imageCompress] 压缩失败，使用原文件', e)
    return file
  }
}
```

**改动**：[frontend/src/api/uploads.ts](frontend/src/api/uploads.ts) 三个函数在 `FormData` 前调用 `maybeCompressImage(file)`。19 处业务调用无需改动。

**UI**：`ImageUploadArea.vue` 中 `uploading` 状态自然覆盖压缩耗时（典型 < 1s）。无需新增提示。

**验证**：
- 上传 < 1.5MB 图：原样上传（验证压缩跳过）
- 上传 5-10MB 手机图：成功上传，压缩后 < 1.5MB
- 上传 gif：原样上传
- 上传非图片：原样上传（已有 fileFilter 拦截）

---

### 2. 孤立图片清理

**后端**

新增 `backend/src/uploads/cleanup.service.ts` + `cleanup.controller.ts`，并在 [backend/src/uploads/uploads.module.ts](backend/src/uploads/uploads.module.ts) 注册。

接口：

| Method | Path | 权限 | 说明 |
|---|---|---|---|
| POST | `/uploads/cleanup/scan` | 仅 admin 角色 | 扫描孤立图片，返回列表 |
| POST | `/uploads/cleanup/delete` | 仅 admin 角色 | 入参 `{ filenames: string[] }`，删除指定文件 |

**扫描逻辑**：
1. `readdirSync(UPLOAD_DIR)` 列出全部文件；排除 `small_*` 缩略图（缩略图跟随原图判定，原图无引用则一起删）
2. 用 MySQL `INFORMATION_SCHEMA.COLUMNS` 查当前 schema 所有 `DATA_TYPE` 为 `varchar` / `text` / `mediumtext` / `longtext` 的字段
3. 对每个文件名，构造单条 `SELECT 1 FROM <table> WHERE <col> LIKE '%<filename>%' LIMIT 1`；任一命中即视为有引用
4. **安全过滤**：`stat.mtime` 早于当前时间 30 天的才算孤立候选（避免误删刚上传未提交的图）
5. 返回 `{ orphans: [{ filename, sizeBytes, mtime, hasThumbnail }], totalSize, totalCount, scanDurationMs }`

**删除逻辑**：
1. 校验入参 filenames 都在 `UPLOAD_DIR` 内，无路径穿越（`path.resolve` 后必须仍在 UPLOAD_DIR 下）
2. 删前再跑一次单文件引用检查（防扫描和删除之间被引用）
3. 删除主文件 + 对应 `small_<filename>`（如存在）
4. 写后端日志记录删除操作
5. 返回 `{ deleted: string[], skipped: { filename: string, reason: string }[] }`

**性能**：N 个文件 × M 个 VARCHAR 列，对每个 (文件, 列) 一条 SQL。可优化为：对每列一次 `WHERE col REGEXP 'pattern1|pattern2|...'` 批量匹配，但首版先用最朴素方式，能跑通就行。预计千级图片 + 几十个列在 10s 内返回。

**前端**

新增 [frontend/src/views/settings/image-cleanup.vue](frontend/src/views/settings/image-cleanup.vue)，路由 `/settings/image-cleanup`，挂在「系统设置」菜单下，权限仅 admin。

页面结构：
- 顶部 banner：说明 + 「扫描」按钮（加载状态）
- 扫描结果区：表格列「缩略图 / 文件名 / 大小 / 修改时间 / 选择」，顶部统计「共 X 个孤立文件，合计 Y MB」
- 顶部操作：「全选」「反选」「删除选中」（二次确认弹窗）
- 空状态：「未发现孤立图片」

API 函数加在 [frontend/src/api/uploads.ts](frontend/src/api/uploads.ts)：`scanOrphanImages()`、`deleteOrphanImages(filenames)`。

菜单 / 路由注册：跟随项目现有「系统设置」菜单组的写法（参考 [frontend/src/views/settings/finance-settings.vue](frontend/src/views/settings/finance-settings.vue) 的注册位置）。

**验证**：
- 故意上传一张图但不引用，等 mtime 改成 31 天前（或临时下调阈值到 1 分钟），扫描应能列出
- 上传 + 立即关联到订单：扫描不应列出
- 上传刚 1 小时的孤立图：30 天阈值下不应列出（安全过滤）
- 删除一张图后再扫描：不应再出现，且 `small_xxx` 也被删

---

### 3. 弹窗默认禁用背景点击关闭（+ 拖动 + 缩放）

**新增** [frontend/src/components/AppDialog.vue](frontend/src/components/AppDialog.vue)：

```vue
<template>
  <el-dialog
    v-bind="$attrs"
    :close-on-click-modal="false"
    :draggable="true"
    class="app-dialog"
  >
    <template v-for="(_, name) in $slots" #[name]="slotData">
      <slot :name="name" v-bind="slotData ?? {}" />
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineOptions({ name: 'AppDialog', inheritAttrs: false })
</script>
```

**全局样式**（追加到 [frontend/src/styles/design-system.css](frontend/src/styles/design-system.css) 末尾）：

```css
.app-dialog.el-dialog {
  resize: both;
  overflow: auto;
  min-width: 320px;
  min-height: 200px;
  max-width: 95vw;
  max-height: 95vh;
}
```

**全局注册** [frontend/src/main.ts](frontend/src/main.ts)：

```ts
import AppDialog from './components/AppDialog.vue'
app.component('AppDialog', AppDialog)
```

**批量迁移 40 个 `<el-dialog>` 调用点**：

- `<el-dialog ...>` → `<AppDialog ...>`
- `</el-dialog>` → `</AppDialog>`
- 已有 `:close-on-click-modal="false"` 的两处删除该 prop（默认已是 false）
- 若有 `:draggable` 显式设值，保留（个别页面可能要关闭）
- 不需要 import（已全局注册）

**ElMessageBox 同样处理**：

新增 [frontend/src/utils/message-box.ts](frontend/src/utils/message-box.ts)：

```ts
import { ElMessageBox } from 'element-plus'
import type { ElMessageBoxOptions } from 'element-plus'

const DEFAULTS: Partial<ElMessageBoxOptions> = {
  closeOnClickModal: false,
  closeOnPressEscape: true,
}

export function appConfirm(message: string, title?: string, options?: ElMessageBoxOptions) {
  return ElMessageBox.confirm(message, title, { ...DEFAULTS, ...options })
}

export function appAlert(message: string, title?: string, options?: ElMessageBoxOptions) {
  return ElMessageBox.alert(message, title, { ...DEFAULTS, ...options })
}

export function appPrompt(message: string, title?: string, options?: ElMessageBoxOptions) {
  return ElMessageBox.prompt(message, title, { ...DEFAULTS, ...options })
}
```

9 处 `ElMessageBox.confirm/alert/prompt` 调用迁移到 `appConfirm/appAlert/appPrompt`。

**验证**：
- 任意弹窗：点击灰色背景应不再关闭，按 ESC 仍可关闭
- 任意弹窗：鼠标按住标题栏可拖动
- 任意弹窗：右下角应出现拖动手柄，可调整大小
- 关弹窗再开：大小还原成默认值（非持久化）
- 已有显式覆盖默认值的弹窗（如个别页面要 close-on-click-modal=true）：覆盖仍生效

---

## 四、文件改动清单

### 新增文件

| 文件 | 用途 |
|---|---|
| `frontend/src/utils/imageCompress.ts` | 压缩工具函数 |
| `frontend/src/components/AppDialog.vue` | el-dialog 薄包装 |
| `frontend/src/utils/message-box.ts` | ElMessageBox 默认值封装 |
| `frontend/src/views/settings/image-cleanup.vue` | 图片清理管理页 |
| `backend/src/uploads/cleanup.service.ts` | 清理业务逻辑 |
| `backend/src/uploads/cleanup.controller.ts` | 清理接口 |

### 修改文件

| 文件 | 改动 |
|---|---|
| `frontend/package.json` | +1 依赖 `browser-image-compression` |
| `frontend/src/api/uploads.ts` | 三个上传函数接入压缩；新增 2 个清理 API 函数 |
| `frontend/src/main.ts` | 全局注册 AppDialog |
| `frontend/src/styles/design-system.css` | 追加 `.app-dialog` 样式 |
| `frontend/src/router/**` | 注册 `/settings/image-cleanup` 路由（仅 admin） |
| 菜单配置（找现有系统设置菜单注册处） | 加「图片清理」菜单项 |
| 40 个 `<el-dialog>` 文件 | 标签替换为 `<AppDialog>` |
| 9 个 `ElMessageBox` 调用文件 | 改用 `appConfirm/appAlert/appPrompt` |
| `backend/src/uploads/uploads.module.ts` | 注册 cleanup service / controller |

### 估算

- 新增 6 个文件，约 350 行
- 标签替换 49 处，机械工作
- 总改动 ~50 文件

---

## 五、权限 / 安全

- `/uploads/cleanup/scan`、`/uploads/cleanup/delete` 仅 admin 可访问，受 `JwtAuthGuard` + `PermissionGuard` 保护
- 删除接口入参做路径穿越校验：`path.resolve(UPLOAD_DIR, filename)` 后必须仍在 `UPLOAD_DIR` 下
- 30 天 mtime 阈值保护，避免误删近期上传

---

## 六、不在本次范围内（YAGNI）

- 缩放大小持久化到 localStorage（每个弹窗需要唯一 key，工作量翻倍）
- 定时自动清理（管理员手动触发已够，自动出错难发现）
- 后端转码 / 服务端二次压缩（前端已压完）
- ElNotification / ElPopconfirm 等其他弹层组件的默认值改造（背景点击关闭对这类组件不构成误操作风险）
- 历史已上传的大图回填压缩（一次性运维操作，需要时单独做）

---

## 七、风险与回滚

- **风险 1**：压缩失败导致上传中断 → 已降级为返回原文件，由后端 5MB 拦截兜底
- **风险 2**：扫描误判活跃图片为孤立 → 删除前二次校验 + 30 天 mtime 阈值 + 管理员人工二次确认三重保护
- **风险 3**：AppDialog 透传 slot 漏掉某些场景 → `v-for $slots` 已覆盖具名 / 默认 slot；具名 slot 的 scoped slot 也支持
- **风险 4**：批量替换标签时漏掉嵌套或动态生成的 dialog → 用 ripgrep `<el-dialog\b` 在 `.vue` 文件中确认替换前后数量一致

回滚：
- 压缩问题：注释 `uploads.ts` 中的 `maybeCompressImage` 调用即可
- 弹窗问题：全局 `<AppDialog>` 还原为 `<el-dialog>`（git revert 即可）
- 清理问题：删除路由 + 后端接口，不影响其他功能
