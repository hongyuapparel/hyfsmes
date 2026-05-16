# 纸样编辑按钮改图标 + 清理 .e2e-tmp — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把纸样物料段的「编辑」按钮从实心大按钮改为右上角小图标文字按钮（仿库存 `FinishedDetailBasicInfoSection` 的样式）；把 Cursor 自建的 `.e2e-tmp/` 加入 `.gitignore` 防止意外提交。

**Architecture:** ① 给 `ProductionDetailSection` 加 `actions` slot（标题右侧）；② pattern.vue 把「编辑」按钮挪到 slot，改用 icon + 文字 + `text type="primary"` 风格（与库存对齐）；③ 根 `.gitignore` 追加一行。

**Tech Stack:** Vue 3 + Element Plus。

**参考样式（库存现有）**：
```vue
<el-button v-if="!metaEditing" size="small" text type="primary" class="detail-head-btn" @click="...">
  <el-icon><Edit /></el-icon>
  <span>编辑</span>
</el-button>
```

---

## Task 1：`ProductionDetailSection` 加 `actions` slot

**Files:**
- Modify: `frontend/src/components/production/ProductionDetailSection.vue`

**目的：** 让 section 标题行右侧能放任意按钮（首期只供纸样使用，但接口通用，未来其他抽屉若需要也可复用）。

- [ ] **Step 1: 替换文件内容**

把 `frontend/src/components/production/ProductionDetailSection.vue` **整体替换**为：

```vue
<template>
  <section class="production-detail-section">
    <div v-if="title || hasActions" class="production-detail-section__head">
      <div v-if="title" class="production-detail-section__title">{{ title }}</div>
      <div v-if="hasActions" class="production-detail-section__actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="production-detail-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useSlots, computed } from 'vue'

defineProps<{
  title?: string
}>()

const slots = useSlots()
const hasActions = computed(() => !!slots.actions)
</script>

<style scoped>
.production-detail-section {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  padding: 10px 12px;
}

.production-detail-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.production-detail-section__title {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.production-detail-section__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.production-detail-section__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
```

要点：
- 加 `__head` 行：title 左 + actions 右，flex `space-between`
- `actions` slot 仅在使用方提供时渲染（避免空 div 留白）
- 无 title 但有 actions 的极端情况也支持（虽然本期不用，但 API 完备）

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npm run build
```

期望：成功。其他 5 个使用 `ProductionDetailSection` 但不传 `actions` slot 的地方，视觉应**完全不变**（`__head` 在 title 存在时仍渲染，但因为没有 actions div，flex `space-between` 退化为单元素左对齐，与原标题位置一致）。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/production/ProductionDetailSection.vue
git commit -m "feat(production): ProductionDetailSection 加 actions slot

- 标题行右侧支持放按钮（仿库存 FinishedBasicInfoGrid #actions 模式）
- 仅在使用方提供 slot 时渲染，不影响现有 5 处无 slot 使用"
```

---

## Task 2：纸样编辑按钮改图标 + 挪到 section actions

**Files:**
- Modify: `frontend/src/views/production/pattern.vue`

**目的：** 编辑按钮变小图标 + 文字，从 section 内顶部 actions div 挪到 section 标题右侧。

- [ ] **Step 1: import Edit 图标**

在 `pattern.vue` 的 `<script setup>` 区中找到现有 `import` 区，追加一行（如已有则跳过）：

```typescript
import { Edit } from '@element-plus/icons-vue'
```

定位附近：约 `:478` 的 `import type { PatternListItem, PatternMaterialRow }` 那块附近。

- [ ] **Step 2: 模板层 — 把「编辑」按钮挪到 section 标题右侧的 `#actions` slot**

找到 `:250` 处的 `<ProductionDetailSection title="纸样物料/裁片清单">`：

```vue
        <ProductionDetailSection title="纸样物料/裁片清单">
          <div class="materials-actions">
            <template v-if="!materialsEditMode">
              <el-button
                v-if="canEditPatternMaterials"
                type="primary"
                size="small"
                :disabled="detailDrawer.loading"
                @click="enterMaterialsEdit"
              >
                编辑
              </el-button>
            </template>
            <template v-else>
              <el-button
                link
                type="primary"
                size="small"
                :disabled="detailDrawer.loading"
                @click="addMaterialRow"
              >
                新增
              </el-button>
              <el-button
                size="small"
                :disabled="detailDrawer.saving"
                @click="cancelMaterialsEdit"
              >
                取消
              </el-button>
              <el-button
                type="primary"
                size="small"
                :loading="detailDrawer.saving"
                :disabled="detailDrawer.loading"
                @click="handleSubmitMaterials"
              >
                保存
              </el-button>
            </template>
          </div>
```

整体替换为：

```vue
        <ProductionDetailSection title="纸样物料/裁片清单">
          <template #actions>
            <el-button
              v-if="!materialsEditMode && canEditPatternMaterials"
              size="small"
              text
              type="primary"
              class="materials-head-btn"
              :disabled="detailDrawer.loading"
              @click="enterMaterialsEdit"
            >
              <el-icon><Edit /></el-icon>
              <span>编辑</span>
            </el-button>
            <template v-if="materialsEditMode">
              <el-button
                size="small"
                :disabled="detailDrawer.saving"
                @click="cancelMaterialsEdit"
              >
                取消
              </el-button>
              <el-button
                type="primary"
                size="small"
                :loading="detailDrawer.saving"
                :disabled="detailDrawer.loading"
                @click="handleSubmitMaterials"
              >
                保存
              </el-button>
            </template>
          </template>

          <div v-if="materialsEditMode" class="materials-actions">
            <el-button
              link
              type="primary"
              size="small"
              :disabled="detailDrawer.loading"
              @click="addMaterialRow"
            >
              新增
            </el-button>
          </div>
```

要点：
- **编辑按钮**：从实心大按钮 → 小图标文字按钮（`size="small" text type="primary"`），与库存 `detail-head-btn` 样式对齐；通过 `#actions` slot 放在 section 标题最右
- **取消 / 保存**：编辑态时也放在 `#actions` slot 的标题右侧（与编辑按钮同一位置，编辑态切换显示）
- **新增**：保留在 section 内部顶部的 `materials-actions` div，但仅编辑态显示（`v-if="materialsEditMode"`）
- 查看态：标题右侧只有「编辑」一个小图标按钮，内部无 `materials-actions` div
- 编辑态：标题右侧有「取消 / 保存」，内部有「新增」link

- [ ] **Step 3: 添加按钮样式**

定位 `pattern.vue` 底部 `<style scoped>` 区块（如果是分离的 `pattern.css` 文件，在那里加）。追加：

```css
.materials-head-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

要点：
- 让图标与"编辑"文字之间有 4px 间距，与库存 `detail-head-btn` 视觉一致
- 不指定字号，沿用 el-button `size="small"` 默认

如果 `pattern.css` 中已经有类似规则，对齐即可。

- [ ] **Step 4: 类型检查 + 重启**

```bash
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

期望：成功，无类型错误。

- [ ] **Step 5: 浏览器手测**

打开纸样抽屉验证：

1. 查看态：「纸样物料/裁片清单」标题最右侧出现**小图标 + "编辑" 文字**的按钮（不再是实心大按钮），section 内部无任何 actions
2. 点「编辑」→ 标题右侧变为「取消 / 保存」两个按钮；section 内部顶部出现「新增」link 按钮
3. 点「取消」或「保存」→ 回到查看态，标题右侧再次只显示小「编辑」图标按钮

- [ ] **Step 6: 提交**

```bash
git add frontend/src/views/production/pattern.vue
git commit -m "fix(pattern): 编辑按钮改为右上角小图标文字按钮

- 编辑按钮：实心大按钮 → text + Edit 图标 + 文字（与库存 detail-head-btn 对齐）
- 通过 ProductionDetailSection 的 #actions slot 放在标题最右
- 编辑态下「取消/保存」也挪到标题右侧；「新增」link 留在 section 内部"
```

---

## Task 3：`.e2e-tmp/` 加入 `.gitignore`

**Files:**
- Modify: `.gitignore`（仓库根目录）

**目的：** Cursor 实测时自建的 Playwright 测试目录不该被 commit；本地保留以便重跑。

- [ ] **Step 1: 加 .gitignore 条目**

打开仓库根目录的 `.gitignore`。在文件**末尾**追加：

```gitignore

# Cursor / agentic worker 临时端到端测试目录（含 node_modules，本地保留不提交）
.e2e-tmp/
```

如 `.gitignore` 文件不存在，整文件创建为：

```gitignore
# Cursor / agentic worker 临时端到端测试目录（含 node_modules，本地保留不提交）
.e2e-tmp/
```

- [ ] **Step 2: 验证未追踪状态消失**

```bash
git status
```

期望：`.e2e-tmp/` 不再在 "Untracked files" 列表里。

- [ ] **Step 3: 提交**

```bash
git add .gitignore
git commit -m "chore(gitignore): 忽略 agentic worker 临时端到端测试目录 .e2e-tmp/"
```

---

## Task 4：端到端验收

- [ ] **Step 1: 重启前端 + 全局类型检查**

```bash
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

期望：零错误。

- [ ] **Step 2: 纸样抽屉视觉**

1. 默认查看态：标题最右侧**只有一个小图标 + "编辑" 文字**按钮（视觉上轻巧不抢眼）
2. 进入编辑态：标题右侧变「取消 / 保存」，内部上方出现「新增」link
3. 三态切换流畅，没有按钮位置跳变

- [ ] **Step 3: 其他 5 个生产抽屉回归**

打开采购 / 工艺 / 裁床 / 车缝 / 尾部抽屉，确认 section 标题视觉**无变化**（这些没用 `#actions` slot）。

- [ ] **Step 4: 库存抽屉回归**

打开「成品库存详情」抽屉，确认其编辑按钮（已有 `detail-head-btn` 样式）视觉与本期纸样新按钮**视觉一致**。

- [ ] **Step 5: 提交 PROJECT_CONTEXT 更新（可选，本期改动较小）**

如改动需要记录到 PROJECT_CONTEXT，在 `docs/PROJECT_CONTEXT.md` 第四节追加一行：

```markdown
- `2026-05-16`：纸样抽屉编辑按钮改为右上角小图标 + 文字（与库存 detail-head-btn 对齐）；ProductionDetailSection 新增 actions slot；`.e2e-tmp/` 加入 .gitignore。
```

如认为改动微小不值得记录，跳过本步。

- [ ] **Step 6: 提交（如执行 Step 5）**

```bash
git add docs/PROJECT_CONTEXT.md
git commit -m "docs(context): 同步纸样编辑按钮图标化"
```

---

## 附录 — Cursor 执行约定

- Task 1 → Task 2 → Task 3 顺序执行；Task 4 是验收
- 改动量很小（3 个文件 + 1 个 .gitignore），全程预计 < 15 分钟
- 完成后回报 `git log --oneline -8`
