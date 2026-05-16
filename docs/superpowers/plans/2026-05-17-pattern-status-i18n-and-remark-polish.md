# 纸样状态中文化 + 备注命名/行高对齐 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ① 纸样状态从原始英文（`completed` 等）改为对应中文（"样品完成"等），复用项目已有的 PATTERN_TABS 命名；② 「总体备注」改为「备注」与全站统一；③ 备注 textarea 行高与表格内 `size="small"` 输入框对齐。

**Architecture:** 仅前端，3 处小改：① `usePatternList.ts` export 派生映射 + helper；② `pattern.vue` 用 helper + 改 label 文案；③ textarea 加 `size="small"`。零业务/接口/数据库改动。

**Tech Stack:** Vue 3 + Element Plus + TypeScript。

---

## Task 1：纸样状态映射为中文

**Files:**
- Modify: `frontend/src/composables/usePatternList.ts`（追加映射 + helper）
- Modify: `frontend/src/views/production/pattern.vue:233`（调用 helper）

**目的：** 纸样状态从 `completed` 等原始值映射为「样品完成」等中文，复用 [PATTERN_TABS](frontend/src/composables/usePatternList.ts) 已定义的中英文对照。

- [ ] **Step 1: 在 usePatternList.ts 派生映射 + export helper**

打开 `frontend/src/composables/usePatternList.ts`，找到第 9-14 行的 `PATTERN_TABS` 定义：

```typescript
export const PATTERN_TABS = [
  { label: '全部', value: 'all' },
  { label: '待分单', value: 'pending_assign' },
  { label: '打样中', value: 'in_progress' },
  { label: '样品完成', value: 'completed' },
] as const
```

**保留不动**，在其紧接的下一行后追加：

```typescript
const PATTERN_STATUS_LABEL: Record<string, string> = PATTERN_TABS.reduce(
  (acc, tab) => {
    if (tab.value !== 'all') acc[tab.value] = tab.label
    return acc
  },
  {} as Record<string, string>,
)

export function patternStatusLabel(status: string | null | undefined): string {
  const key = (status ?? '').trim()
  if (!key) return '—'
  return PATTERN_STATUS_LABEL[key] ?? key
}
```

要点：
- 从 PATTERN_TABS 自动派生，避免重复维护两份映射
- 排除 `all`（它是"全部"过滤选项，不是真实状态）
- 未知状态值保底显示原值（不抛错也不显示空白）
- 空值显示 `—`（与项目其他 dash 风格一致）

- [ ] **Step 2: pattern.vue 调用 helper**

打开 `frontend/src/views/production/pattern.vue`。

找到约 :479-481 的 import 块（含 `import { PATTERN_TABS, usePatternList } from '@/composables/usePatternList'`）：

```typescript
import { PATTERN_TABS, usePatternList } from '@/composables/usePatternList'
```

把它改为：

```typescript
import { PATTERN_TABS, patternStatusLabel, usePatternList } from '@/composables/usePatternList'
```

找到 :232-234 的状态显示模板：

```vue
            <el-descriptions-item label="纸样状态">
              {{ detailDrawer.row.patternStatus }}
            </el-descriptions-item>
```

改为：

```vue
            <el-descriptions-item label="纸样状态">
              {{ patternStatusLabel(detailDrawer.row.patternStatus) }}
            </el-descriptions-item>
```

- [ ] **Step 3: 类型检查 + 重启**

```bash
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

期望：成功。

- [ ] **Step 4: 浏览器手测**

打开纸样抽屉验证「纸样状态」字段：
- 状态原值 `completed` → 显示「样品完成」 ✓
- 状态原值 `in_progress` → 显示「打样中」 ✓
- 状态原值 `pending_assign` → 显示「待分单」 ✓
- 状态为空 → 显示「—」 ✓

- [ ] **Step 5: 提交**

```bash
git add frontend/src/composables/usePatternList.ts frontend/src/views/production/pattern.vue
git commit -m "fix(pattern): 纸样状态显示中文标签

- 派生 PATTERN_STATUS_LABEL 自 PATTERN_TABS（避免重复维护）
- export patternStatusLabel(status) helper
- pattern.vue 抽屉的「纸样状态」字段调用 helper"
```

---

## Task 2：「总体备注」改为「备注」+ textarea 与表格 input 行高对齐

**Files:**
- Modify: `frontend/src/views/production/pattern.vue`（label 文案 + textarea size 属性）
- Modify: `frontend/src/views/production/pattern.css`（如有必要微调 textarea padding）

**目的：** ① 字段名与全站「备注」统一；② textarea 视觉与表格内 `size="small"` 输入框对齐，不再突兀。

- [ ] **Step 1: pattern.vue label 文案改名**

找到 `pattern.vue` 约 :362-363 处：

```vue
          <div class="materials-remark">
            <div class="materials-remark-label">总体备注</div>
```

把 `总体备注` 改为 `备注`：

```vue
          <div class="materials-remark">
            <div class="materials-remark-label">备注</div>
```

- [ ] **Step 2: textarea 加 `size="small"`**

找到同一处约 :364-372 的 textarea：

```vue
            <div class="materials-remark-field">
              <el-input
                v-model="materialsForm.remark"
                type="textarea"
                :autosize="{ minRows: 1, maxRows: 8 }"
                placeholder="可选"
                :disabled="!canEditPatternMaterials || !materialsEditMode"
              />
            </div>
```

在 `type="textarea"` 后面追加 `size="small"`：

```vue
            <div class="materials-remark-field">
              <el-input
                v-model="materialsForm.remark"
                type="textarea"
                size="small"
                :autosize="{ minRows: 1, maxRows: 8 }"
                placeholder="可选"
                :disabled="!canEditPatternMaterials || !materialsEditMode"
              />
            </div>
```

要点：
- Element Plus 的 `el-input size="small"` 对 textarea 同样有效（字号 + padding 都向 small 对齐）
- `autosize` / `placeholder` / `disabled` 保持不动

- [ ] **Step 3: pattern.css 微调 label 与 textarea 对齐**

打开 `frontend/src/views/production/pattern.css`，找到约 :157-163 的 `.materials-remark-label` 规则：

```css
.materials-remark-label {
  flex: 0 0 auto;
  width: 72px;
  padding-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-base);
}
```

把 `padding-top: 6px` 改为 `padding-top: 4px`（textarea 改 small 后高度变小，label 顶部对齐需要相应减少），并把 `width: 72px` 改为 `width: 48px`（"备注"2 字比"总体备注"4 字短，减少占位）：

```css
.materials-remark-label {
  flex: 0 0 auto;
  width: 48px;
  padding-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-base);
}
```

- [ ] **Step 4: 类型检查 + 重启**

```bash
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

- [ ] **Step 5: 浏览器手测**

打开纸样抽屉编辑态：
1. 字段名显示「备注」（不是「总体备注」） ✓
2. textarea 空时高度与表格内 input（如"物料名称"列的 input）**视觉一致** ✓
3. label 文字与 textarea 第一行水平居中对齐（或顶部对齐自然，不偏移） ✓
4. textarea 自动撑大到多行时，label 仍贴顶不动 ✓

如果 Step 5 项 2 仍发现 textarea 比表格内 input **明显**高，再回到 Step 3 微调 `padding-top` 或在 pattern.css 加入：

```css
.materials-remark-field :deep(.el-textarea__inner) {
  min-height: 24px;
}
```

（24px 是 size="small" input 的默认行高；这是兜底微调，仅在 size="small" 不够小时启用，不属于常规情况）

- [ ] **Step 6: 提交**

```bash
git add frontend/src/views/production/pattern.vue frontend/src/views/production/pattern.css
git commit -m "fix(pattern): 备注命名与行高对齐表格内输入框

- 「总体备注」label 改名「备注」（与全站统一）
- textarea 加 size=small，行高/字号/padding 与表格内 input 对齐
- pattern.css 调小 label 宽度（48px）与 padding-top（4px）"
```

---

完成 2 个 Task 后回报 `git log --oneline -4`。
