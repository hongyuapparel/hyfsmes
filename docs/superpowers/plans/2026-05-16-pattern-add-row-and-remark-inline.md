# 纸样新增按钮挪位 + 备注 label/textarea 同行 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ① 把「新增」按钮从表格上方独占一行挪到表格下方做"+ 新增一行"链接，不再抢镜；② 「总体备注」label 与 textarea 改为同一行 flex 布局。

**Architecture:** 仅前端 `pattern.vue` + `pattern.css` 改动；零业务逻辑/接口/数据库影响。

**Tech Stack:** Vue 3 + Element Plus。

---

## Task 1：「新增」按钮挪到表格下方做"+ 新增一行"链接

**Files:**
- Modify: `frontend/src/views/production/pattern.vue`
- Modify: `frontend/src/views/production/pattern.css`

**目的：** 当前编辑态下表格上方独占一行的「新增」按钮视觉突兀；挪到表格末尾做成"+ 新增一行"链接，符合表格录入的常见认知。

- [ ] **Step 1: 删除表格上方的 `materials-actions` div**

打开 `frontend/src/views/production/pattern.vue`，找到约 :281-294 处：

```vue
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

**整段删除**（删除整个 `<div v-if="materialsEditMode" class="materials-actions">...</div>`）。

- [ ] **Step 2: 在表格 `</el-table>` 之后追加"新增一行"链接**

找到 `</el-table>` 结束位置（约 :359）。在它**之后**、`<div class="materials-remark">`（约 :361）**之前**，加入：

```vue
          <div v-if="materialsEditMode" class="materials-add-row">
            <el-button
              link
              type="primary"
              size="small"
              :disabled="detailDrawer.loading"
              @click="addMaterialRow"
            >
              <el-icon><Plus /></el-icon>
              <span>新增一行</span>
            </el-button>
          </div>
```

要点：
- 仅编辑态显示（`v-if="materialsEditMode"`）
- 用 `Plus` 图标 + "新增一行" 文字，比单纯"新增"更明确表达"为表格加一行"
- 用 `el-button link`，视觉极轻

- [ ] **Step 3: import Plus 图标**

找到 `pattern.vue` 中现有的 `import { Edit } from '@element-plus/icons-vue'`（约 :485）。

把这一行改为：

```typescript
import { Edit, Plus } from '@element-plus/icons-vue'
```

- [ ] **Step 4: pattern.css 删旧样式 + 加新样式**

打开 `frontend/src/views/production/pattern.css`。

定位约 :121-128 的 `.materials-actions` 规则块：

```css
.materials-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  justify-content: flex-end;
  margin-bottom: var(--space-sm);
  font-size: var(--el-font-size-base);
}
```

**整块删除**。

在原位（或文件任意合适位置）加入新规则：

```css
.materials-add-row {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
  border: 1px dashed var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
}

.materials-add-row .el-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

要点：
- 虚线边框 + 浅背景 = 表格的延伸感，但视觉很轻不抢镜
- 居中放置「+ 新增一行」link 按钮
- icon 与文字间距 4px

- [ ] **Step 5: 类型检查 + 重启**

```bash
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

期望：构建成功。

- [ ] **Step 6: 浏览器手测**

打开纸样抽屉 → 点「编辑」进入编辑态 →
1. 表格上方**不再有**独占一行的「新增」按钮 ✓
2. 表格下方出现一条"+ 新增一行"链接（带虚线边框）✓
3. 点击「+ 新增一行」→ 表格新增一行空白行 ✓
4. 退出编辑态（取消/保存）→「+ 新增一行」链接消失 ✓

- [ ] **Step 7: 提交**

```bash
git add frontend/src/views/production/pattern.vue frontend/src/views/production/pattern.css
git commit -m "fix(pattern): 新增按钮挪到表格下方做「+ 新增一行」链接

- 删除表格上方独占一行的 materials-actions div
- 表格末尾追加 materials-add-row 虚线边框链接按钮（仅编辑态）
- import Plus 图标"
```

---

## Task 2：「总体备注」label 与 textarea 改同一行

**Files:**
- Modify: `frontend/src/views/production/pattern.vue` 约 :361-370 处
- Modify: `frontend/src/views/production/pattern.css` 约 :151-159 的 `.materials-remark*` 规则

**目的：** label 「总体备注」从独占一行（在 textarea 上方）改为与 textarea 同一行（label 左、textarea 右），节省纵向空间。

- [ ] **Step 1: pattern.vue 模板包一层 field 容器**

找到 `pattern.vue` 约 :361-370 处的「总体备注」块：

```vue
          <div class="materials-remark">
            <div class="materials-remark-label">总体备注</div>
            <el-input
              v-model="materialsForm.remark"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 8 }"
              placeholder="可选"
              :disabled="!canEditPatternMaterials || !materialsEditMode"
            />
          </div>
```

替换为：

```vue
          <div class="materials-remark">
            <div class="materials-remark-label">总体备注</div>
            <div class="materials-remark-field">
              <el-input
                v-model="materialsForm.remark"
                type="textarea"
                :autosize="{ minRows: 1, maxRows: 8 }"
                placeholder="可选"
                :disabled="!canEditPatternMaterials || !materialsEditMode"
              />
            </div>
          </div>
```

要点：
- 给 textarea 外包一层 `.materials-remark-field` div，让它能 `flex: 1` 撑满 label 右侧空间
- 包一层是为了避免用 `:deep(.el-textarea)` 覆盖组件机制（CLAUDE.md 第 5 节"禁深层选择器覆盖原组件机制"）

- [ ] **Step 2: pattern.css 改 `.materials-remark*` 规则为 flex 横向**

定位 `pattern.css` 约 :151-159 的现有规则：

```css
.materials-remark {
  margin-top: var(--space-sm);
}

.materials-remark-label {
  margin-bottom: 6px;
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-base);
}
```

替换为：

```css
.materials-remark {
  margin-top: var(--space-sm);
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.materials-remark-label {
  flex: 0 0 auto;
  width: 72px;
  padding-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-base);
}

.materials-remark-field {
  flex: 1;
  min-width: 0;
}
```

要点：
- `.materials-remark` 改 flex 横向，items `flex-start` 让 label 与 textarea 顶部对齐
- `.materials-remark-label` 固定 72px 宽（足以放下"总体备注"4 字 + 留白）；`padding-top: 6px` 让 label 文字与 textarea 第一行视觉对齐
- `.materials-remark-field { flex: 1; min-width: 0 }` 占满剩余空间，`min-width: 0` 防止 textarea 内容过长把容器撑出网格

紧随其后的 `.materials-remark :deep(.el-textarea__inner)` 规则**保持不动**。

- [ ] **Step 3: 类型检查 + 重启**

```bash
cd frontend && npm run build
```

- [ ] **Step 4: 浏览器手测**

打开纸样抽屉编辑态：
1. 「总体备注」label 在左，textarea 在右，同一行 ✓
2. textarea 空时只占 1 行高，label 与该行垂直对齐 ✓
3. textarea 自动撑大到多行时，label 仍贴在顶部不动 ✓

- [ ] **Step 5: 提交**

```bash
git add frontend/src/views/production/pattern.vue frontend/src/views/production/pattern.css
git commit -m "fix(pattern): 总体备注 label 与 textarea 改同一行布局

- materials-remark 改 flex 横向，label 在左固定 72px，textarea 撑满右侧
- 给 textarea 外包 materials-remark-field 容器，避免 :deep 覆盖
- 节省纵向空间，与表格上方信息密度更协调"
```

---

完成两个 Task 后回报 `git log --oneline -4`。
