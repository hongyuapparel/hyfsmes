# 纸样总体备注 textarea 自适应高度 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「总体备注」textarea 从固定 3 行高度改为自动撑高（空时 1 行，输入多了自动变大，最多 8 行）。

**Architecture:** 单行 props 改动：`:rows="3"` → `:autosize="{ minRows: 1, maxRows: 8 }"`。Element Plus 原生支持。

**Tech Stack:** Vue 3 + Element Plus。

---

## Task 1：改 textarea props

**Files:**
- Modify: `frontend/src/views/production/pattern.vue` 约 :339-345 处

- [ ] **Step 1: 改一处 props**

定位 `pattern.vue` 中的「总体备注」`<el-input>`（紧跟在 `<div class="materials-remark-label">总体备注</div>` 之后）：

```vue
            <el-input
              v-model="materialsForm.remark"
              type="textarea"
              :rows="3"
              placeholder="可选"
              :disabled="!canEditPatternMaterials || !materialsEditMode"
            />
```

把 `:rows="3"` 这一行改为 `:autosize="{ minRows: 1, maxRows: 8 }"`：

```vue
            <el-input
              v-model="materialsForm.remark"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 8 }"
              placeholder="可选"
              :disabled="!canEditPatternMaterials || !materialsEditMode"
            />
```

要点：
- 仅替换一行；其他属性（`v-model / type / placeholder / disabled`）保持不动
- `autosize` 是 Element Plus 原生支持的 textarea 自适应配置，无需额外引入
- minRows: 1 让空 textarea 只占 1 行高度
- maxRows: 8 让输入超 8 行后 textarea 自身出现滚动条，不再继续撑高

- [ ] **Step 2: 类型检查 + 重启**

```bash
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

期望：成功。

- [ ] **Step 3: 浏览器手测 3 个状态**

打开纸样抽屉，进入编辑态，定位「总体备注」区：

1. **空状态**：textarea 只有 1 行高（明显比之前 3 行小）
2. **输入少量文本**（如 2-3 行）：textarea 自动撑到对应行高
3. **输入大量文本**（> 8 行）：textarea 高度停在 8 行，内部出现滚动条

查看态（非编辑）下也确认：如果原数据较短 textarea 显示 1 行；如果原数据较长会撑大显示。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/views/production/pattern.vue
git commit -m "fix(pattern): 总体备注 textarea 改为自适应高度

- :rows=3 → :autosize={minRows:1, maxRows:8}
- 空时 1 行节省占位；输入多时自动撑高最多 8 行"
```

---

完成后回报 `git log --oneline -3`。
