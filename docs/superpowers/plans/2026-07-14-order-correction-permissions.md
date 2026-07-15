# Order Correction Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用两个可配置权限实现订单纠错——强制改状态（默认只改状态）与编辑已提交生产数据；回收站不动。

**Architecture:** 权限种子新增 `orders_force_status` / `production_admin_edit`；强制改状态接口从 `AdminRoleGuard` 改为 `@RequirePermission('orders_force_status')`，UI 按 `hasPermission` 显示；生产各模块在已完成编辑路径上增加 `production_admin_edit`（裁床已有 edit API，改为纠错权限或并列校验）。

**Tech Stack:** NestJS + TypeORM · Vue 3 + Pinia authStore · 既有 `seed-permissions` / `PermissionGuard`

**Spec:** `docs/superpowers/specs/2026-07-14-order-correction-permissions-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/src/database/seed-permissions.ts` | 新增两权限码 |
| `backend/src/orders/orders.controller.ts` | force-status 改权限守卫 |
| `backend/src/orders/order-admin-override.service.ts` | 默认不重置；返回调和警告 |
| `frontend/src/composables/useOrderListSelection.ts` | `canForceOrderStatus` |
| `frontend/src/composables/useOrderEditPage.ts` | 同上 |
| `frontend/src/views/orders/list.vue` / `edit.vue` | 入口条件 |
| `frontend/src/components/orders/OrderAdminForceStatusDialog.vue` | 隐藏重置勾选；强化提示 |
| `docs/ORDER_STATUS_FLOW_DESIGN.md` / `PRODUCTION_PERMISSION_AND_RECOVERY.md` | 文档同步 |
| 各 `production-*-*.controller.ts` + mutation + 前端页 | P1：已完成可编辑 |

---

### Task 1: Seed permissions

**Files:**
- Modify: `backend/src/database/seed-permissions.ts`

- [ ] **Step 1:** 在 `orders_restore` 旁增加：

```ts
{ code: 'orders_force_status', name: '订单列表-强制改状态', routePath: '/orders/list', type: 'action' },
{ code: 'production_admin_edit', name: '生产管理-编辑已提交数据', routePath: '/production', type: 'action' },
```

- [ ] **Step 2:** 确认 `seedPermissions` 仍会给 `admin` 角色补齐全部权限（现有逻辑勿破坏）。

---

### Task 2: Backend force-status permission + default no reset

**Files:**
- Modify: `backend/src/orders/orders.controller.ts`
- Modify: `backend/src/orders/order-admin-override.service.ts`
- Modify: `backend/src/orders/orders.module.ts`（若可移除仅用于本接口的 `AdminRoleGuard` 注册则清理）

- [ ] **Step 1:** `POST :id/admin/force-status`：去掉 `@UseGuards(AdminRoleGuard)`，改为 `@RequirePermission('orders_force_status')`。

- [ ] **Step 2:** `forceStatus` 中 `resetSubsequent` 仅当显式 `dto.resetSubsequent === true` 时执行（已是）；确保前端默认传 `false`。警告文案在未重置时始终返回。

- [ ] **Step 3:** 本地调用无权限用户应 403；有 `orders_force_status` 的角色可 200/201。

---

### Task 3: Frontend force-status UX

**Files:**
- Modify: `frontend/src/composables/useOrderListSelection.ts`
- Modify: `frontend/src/composables/useOrderEditPage.ts`
- Modify: `frontend/src/views/orders/list.vue`
- Modify: `frontend/src/views/orders/edit.vue`
- Modify: `frontend/src/components/orders/OrderAdminForceStatusDialog.vue`

- [ ] **Step 1:** `canForceOrderStatus = authStore.hasPermission('orders_force_status')`，列表/编辑入口改用它（可保留 `isSuperAdmin` 给其他逻辑如全状态编辑）。

- [ ] **Step 2:** 弹窗：隐藏「重置后续工序」；`resetSubsequent` 默认 `false`；提交传 `false`；alert 文案强调只改状态、不自动清数据、可能被调和推回、需用生产纠错权限改数据。

- [ ] **Step 3:** 标题可改为「强制改状态」（去掉仅超管字样）。

---

### Task 4: Docs P0

**Files:**
- Modify: `docs/ORDER_STATUS_FLOW_DESIGN.md` §6.2
- Modify: `docs/PRODUCTION_PERMISSION_AND_RECOVERY.md`

- [ ] **Step 1:** 写明双权限码、强制改状态改为权限控制、默认不重置、回收站不变。

---

### Task 5: P1 — Cutting gate on admin edit permission

**Files:**
- Modify: `backend/src/production-cutting/production-cutting.controller.ts`（`items/:orderId/edit`）
- Modify: frontend cutting drawer / page canEdit 条件

- [ ] **Step 1:** edit 接口改为 `@RequirePermission(['production_admin_edit', 'production_cutting_complete'])` **或** 按产品收紧为仅 `production_admin_edit`。  
  **定稿（实现时采用）：** edit 仅 `production_admin_edit`（纠错权限）；complete 仍用 `production_cutting_complete`。这样「登记完成」与「改已提交」分离。

- [ ] **Step 2:** 前端已完成卡「编辑」按钮：`hasPermission('production_admin_edit')`。

---

### Task 6: P1 — Sewing / purchase / pattern / craft / finishing

**Files:** 各模块 mutation + controller + 对应 Vue 页

- [ ] **Step 1:** 对尚无「已完成再保存」路径的模块，增加或放宽 update：当记录已 completed 时要求 `production_admin_edit`（服务内断言或接口级权限）。
- [ ] **Step 2:** 保存写操作日志（module 区分）。
- [ ] **Step 3:** 不自动改 `orders.status`。
- [ ] **Step 4:** 按裁床 → 车缝 → 采购 → 纸样/工艺 → 尾部顺序落地；每模块可独立验收。

---

### Task 7: Verify

- [ ] **Step 1:** `scripts/check.ps1` 健康。
- [ ] **Step 2:** 角色只勾 `orders_force_status`：列表可见强制改状态；改状态成功；生产已完成编辑 403/按钮隐藏。
- [ ] **Step 3:** 角色只勾 `production_admin_edit`：可改裁床已完成数据；强制改状态不可用。
- [ ] **Step 4:** 回收站删除原因/恢复仍可用。

---

## Spec coverage check

| Spec | Task |
|------|------|
| `orders_force_status` / `production_admin_edit` 种子 | T1 |
| 强制改状态改权限、默认不重置 | T2–T3 |
| 强提示调和 | T3 |
| 生产已完成编辑 | T5–T6 |
| 文档 | T4 |
| 回收站不动 | 无任务（显式不改） |
| 不做撤销完成 | 无任务 |
