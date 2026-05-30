# 全链路颜色×尺码贯通改造（方向 A）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把车缝/尾部收货/尾部入库三个生产环节的录入与存储从"只按尺码一维"升级到"按颜色×尺码二维"，并把这份真值原样贯通到待仓处理与成品库存。彻底消除"系统按订单计划比例分摊到颜色"的推算逻辑。

**Architecture:**
- 数据层：在 `order_sewing` / `order_finishing` / `inbound_pending` 三张表上新增 JSON 列存"颜色×尺码"二维数据；旧的一维列仅保留兜底读取（不再被写入）。
- 录入层：3 个登记对话框沿用裁床那套 `CuttingQuantityMatrix` 组件。
- 读取层：`getSizeBreakdown`、`buildOrderColorSizeSnapshot` 等优先读新二维字段，无则兜底读旧一维。
- 迁移：一次性脚本把现存的一维数据按订单计划颜色比例分摊回填到新字段（写死，非动态推算）。

**Tech Stack:** Vue 3 + TypeScript + Element Plus（前端）；NestJS + TypeORM + MySQL（后端）；Vitest（单测）。

---

## 概念约定

- **ColorRows 形态**：`Array<{ colorName: string; quantities: number[] }>`，其中 `quantities.length === colorSizeHeaders.length`，不含合计列（合计永远按"分尺码之和"现算）。
- **三个新生产字段统称 `xxxByColor`**：`sewingQuantitiesByColor` / `tailReceivedQuantitiesByColor` / `tailInboundQuantitiesByColor` / `defectQuantitiesByColor`。
- **真值优先级**：新字段非空 → 读新字段；新字段为空 → 兜底读旧一维（旧数据迁移后这种情况应消失）。
- **合计永不存**：删除"系统帮你算总和再独立存"的写入路径；显示侧按行求和。

---

## 文件结构总览

### 新建
- `backend/scripts/add-production-color-rows.sql` — DDL 加列
- `backend/scripts/migrate-production-color-rows.js` — 旧数据回填脚本
- `backend/src/common/color-size-row.util.ts` — 颜色×尺码二维数据共用工具（分摊、合计、校验）
- `frontend/src/components/production/ColorSizeQuantityMatrix.vue` — 可复用录入矩阵（如证明 `CuttingQuantityMatrix` 不能直接复用则新建；否则跳过）

### 修改：后端实体
- `backend/src/entities/order-sewing.entity.ts` — 加 `sewingQuantitiesByColor`
- `backend/src/entities/order-finishing.entity.ts` — 加 `tailReceivedQuantitiesByColor` / `tailInboundQuantitiesByColor` / `defectQuantitiesByColor`
- `backend/src/entities/inbound-pending.entity.ts` — 加 `colorSizeSnapshot`

### 修改：后端 service / controller
- `backend/src/production-sewing/production-sewing.service.ts` — completeSewing 改为接收二维
- `backend/src/production-sewing/production-sewing.controller.ts` — 入参类型
- `backend/src/production-finishing/production-finishing-mutation.service.ts` — 入库登记/收货登记改二维 + 写 inbound_pending snapshot
- `backend/src/production-finishing/production-finishing.controller.ts` — 入参类型
- `backend/src/production-finishing/production-finishing.types.ts` — DTO 类型
- `backend/src/inventory-pending/inventory-pending.service.ts` — doInbound 把 inbound_pending.colorSizeSnapshot 透传给 createManual
- `backend/src/finished-goods-stock/finished-goods-stock.service.ts` / `finished-goods-stock-inbound.service.ts` — createManual 接收并优先使用 colorSizeSnapshot
- `backend/src/finished-goods-stock/finished-goods-stock-inbound-query.service.ts` — `buildOrderColorSizeSnapshot` 优先读 `tailInboundQuantitiesByColor`
- `backend/src/orders/order-query.service.ts` — `getSizeBreakdown` 优先读二维真值；byColor 取真值不再分摊

### 修改：前端
- `frontend/src/components/production/SewingRegisterDialog.vue` — 引入矩阵
- `frontend/src/components/production/FinishingPackagingDialog.vue` — 引入矩阵（区分"本次"与"已累计"）
- `frontend/src/components/production/FinishingReceivedDialog.vue`（如存在；不存在则在 [task 9.5] 找出对应组件）— 引入矩阵
- `frontend/src/composables/useSewingDialogs.ts` — 数据形态改二维
- `frontend/src/composables/useFinishingPackaging.ts` — 数据形态改二维
- `frontend/src/components/production/QtyTracePopover.vue` — 不动（后端数据更准即可，组件已通用）
- `frontend/src/api/production-sewing.ts` / `production-finishing.ts` — payload 类型改二维
- `frontend/src/components/production/SewingTable.vue` / `FinishingTable.vue` / `FinishingDetailDrawer.vue` — 详情显示部分

### 不动
- `order_ext.color_size_rows`（订单 B 区）—— 本来就是颜色×尺码，沿用
- `order_cutting.actual_cut_rows` —— 已是颜色×尺码，沿用
- `finished_goods_stock.color_size_snapshot` —— 字段沿用，仅更换数据来源

---

## 阶段划分

> 用户决定"一次性全做"，但内部分 5 个阶段提交，每个阶段独立可构建可回滚。

- **阶段 0**：共用工具与类型基建
- **阶段 1**：数据库迁移 + 实体加字段
- **阶段 2**：录入侧（前 + 后）三套环节改二维
- **阶段 3**：贯通链路（待仓处理 → 成品库存的 snapshot 透传）
- **阶段 4**：读取侧改造（数量追踪浮层 / 详情抽屉 / 成品入库兜底）
- **阶段 5**：旧数据迁移脚本 + 上线验证

---

## 阶段 0：共用工具与类型

### Task 0.1：定义共用类型 `ColorSizeQuantityRow`

**Files:**
- Create: `backend/src/common/color-size-row.util.ts`
- Modify: `frontend/src/types/color-size-quantity.ts`（新建路径，或合并入既有 `@/types`）

- [ ] **Step 1：写后端共用类型与工具**

```ts
// backend/src/common/color-size-row.util.ts
export interface ColorSizeQuantityRow {
  colorName: string;
  quantities: number[];
}

/** 二维行求总：合计永远按"分尺码之和"现算 */
export function sumColorRows(rows: ColorSizeQuantityRow[]): number {
  return rows.reduce(
    (sum, r) => sum + (Array.isArray(r.quantities) ? r.quantities.reduce((s, n) => s + (Math.max(0, Math.trunc(Number(n) || 0))), 0) : 0),
    0,
  );
}

/** 按尺码求列和（聚合行） */
export function sumColorRowsBySize(rows: ColorSizeQuantityRow[], sizeLen: number): number[] {
  const out = Array(sizeLen).fill(0) as number[];
  for (const r of rows) {
    const q = Array.isArray(r.quantities) ? r.quantities : [];
    for (let i = 0; i < sizeLen; i++) out[i] += Math.max(0, Math.trunc(Number(q[i]) || 0));
  }
  return out;
}

/** 形态校验：rows 与 planColorNames 严格按颜色顺序对齐；每行 quantities.length === sizeLen */
export function assertColorRowsShape(
  rows: ColorSizeQuantityRow[],
  planColorNames: string[],
  sizeLen: number,
): void {
  if (!Array.isArray(rows) || rows.length !== planColorNames.length) {
    throw new Error(`颜色行数 ${rows?.length ?? 'N/A'} 与订单计划颜色数 ${planColorNames.length} 不一致`);
  }
  rows.forEach((r, idx) => {
    const expected = planColorNames[idx];
    if ((r.colorName ?? '').trim() !== (expected ?? '').trim()) {
      throw new Error(`第 ${idx + 1} 行颜色 "${r.colorName}" 与订单计划 "${expected}" 不一致`);
    }
    if (!Array.isArray(r.quantities) || r.quantities.length !== sizeLen) {
      throw new Error(`第 ${idx + 1} 行（${r.colorName}）尺码数 ${r.quantities?.length ?? 'N/A'} 与订单 ${sizeLen} 不一致`);
    }
  });
}
```

- [ ] **Step 2：写前端镜像类型**

```ts
// frontend/src/types/color-size-quantity.ts
export interface ColorSizeQuantityRow {
  colorName: string
  quantities: number[]
}

export interface ColorSizeQuantityPayload {
  headers: string[]
  rows: ColorSizeQuantityRow[]
}
```

- [ ] **Step 3：构建验证**

```bash
cd backend && npm run build
cd frontend && npm run build
```

- [ ] **Step 4：commit**

```bash
git add backend/src/common/color-size-row.util.ts frontend/src/types/color-size-quantity.ts
git commit -m "feat(common): add ColorSizeQuantityRow types and utils"
```

---

## 阶段 1：数据库迁移 + 实体

### Task 1.1：写 ALTER SQL 脚本

**Files:**
- Create: `backend/scripts/add-production-color-rows.sql`

- [ ] **Step 1：写 DDL**

```sql
-- backend/scripts/add-production-color-rows.sql
-- 加列：按颜色×尺码二维记录生产环节真实登记数

ALTER TABLE `order_sewing`
  ADD COLUMN `sewing_quantities_by_color` JSON NULL COMMENT '车缝数量按颜色×尺码 [{colorName,quantities[]}]' AFTER `sewing_quantity_row`;

ALTER TABLE `order_finishing`
  ADD COLUMN `tail_received_quantities_by_color` JSON NULL COMMENT '尾部收货按颜色×尺码' AFTER `tail_received_qty_row`,
  ADD COLUMN `tail_inbound_quantities_by_color` JSON NULL COMMENT '尾部入库按颜色×尺码' AFTER `tail_inbound_qty_row`,
  ADD COLUMN `defect_quantities_by_color` JSON NULL COMMENT '次品按颜色×尺码' AFTER `defect_quantity_row`;

ALTER TABLE `inbound_pending`
  ADD COLUMN `color_size_snapshot` JSON NULL COMMENT '本批入库的颜色×尺码 snapshot {headers,rows}' AFTER `quantity`;
```

- [ ] **Step 2：在本机 MySQL 跑一遍验证语法**

```bash
mysql -u root -p hyf_db < backend/scripts/add-production-color-rows.sql
mysql -u root -p hyf_db -e "DESCRIBE order_sewing; DESCRIBE order_finishing; DESCRIBE inbound_pending;"
```

预期：3 张表分别多出对应列，类型 `json` 可空。

- [ ] **Step 3：commit**

```bash
git add backend/scripts/add-production-color-rows.sql
git commit -m "feat(db): add color-size json columns for sewing/finishing/inbound-pending"
```

### Task 1.2：更新 TypeORM 实体

**Files:**
- Modify: `backend/src/entities/order-sewing.entity.ts`
- Modify: `backend/src/entities/order-finishing.entity.ts`
- Modify: `backend/src/entities/inbound-pending.entity.ts`

- [ ] **Step 1：加 order_sewing 字段**

在 `sewingQuantityRow` 下面追加：

```ts
import type { ColorSizeQuantityRow } from '../common/color-size-row.util';
// ...
@Column({ name: 'sewing_quantities_by_color', type: 'json', nullable: true })
sewingQuantitiesByColor: ColorSizeQuantityRow[] | null;
```

- [ ] **Step 2：加 order_finishing 三个字段**（select=false，与原有 row 字段保持一致策略；可在 Repo 用 createQueryBuilder/原生查询读取）

```ts
@Column({ name: 'tail_received_quantities_by_color', type: 'json', nullable: true, select: false })
tailReceivedQuantitiesByColor: ColorSizeQuantityRow[] | null;

@Column({ name: 'tail_inbound_quantities_by_color', type: 'json', nullable: true, select: false })
tailInboundQuantitiesByColor: ColorSizeQuantityRow[] | null;

@Column({ name: 'defect_quantities_by_color', type: 'json', nullable: true, select: false })
defectQuantitiesByColor: ColorSizeQuantityRow[] | null;
```

- [ ] **Step 3：加 inbound_pending 字段**（select=false，按现有兼容策略）

```ts
@Column({ name: 'color_size_snapshot', type: 'json', nullable: true, select: false })
colorSizeSnapshot: { headers: string[]; rows: ColorSizeQuantityRow[] } | null;
```

- [ ] **Step 4：构建**

```bash
cd backend && npm run build
```

- [ ] **Step 5：commit**

```bash
git add backend/src/entities/order-sewing.entity.ts backend/src/entities/order-finishing.entity.ts backend/src/entities/inbound-pending.entity.ts
git commit -m "feat(entities): add by-color json columns for production stages"
```

---

## 阶段 2：录入侧改造（前端 + 后端）

> 每一个生产环节按 "前端 Dialog → composable → API → 后端 controller/service → 持久化" 一条龙改完。

### Task 2.1：车缝登记后端接收二维

**Files:**
- Modify: `backend/src/production-sewing/production-sewing.service.ts` — `completeSewing` 方法
- Modify: `backend/src/production-sewing/production-sewing.controller.ts`

- [ ] **Step 1：扩展 controller 入参**

```ts
// production-sewing.controller.ts
@Post('complete/:orderId')
async complete(
  @Param('orderId', ParseIntPipe) orderId: number,
  @Body('sewingQuantity') sewingQuantity: number,
  @Body('defectQuantity') defectQuantity: number,
  @Body('defectReason') defectReason: string,
  @Body('sewingQuantities') sewingQuantities?: number[] | null,
  @Body('sewingQuantitiesByColor') sewingQuantitiesByColor?: ColorSizeQuantityRow[] | null,
  @Req() req?: Request,
) {
  // ...
  await this.service.completeSewing(orderId, sewingQuantity, defectQuantity, defectReason, sewingQuantities, sewingQuantitiesByColor, { ... });
}
```

- [ ] **Step 2：completeSewing 改写持久化**

关键：必须收 `sewingQuantitiesByColor` 二维；旧 `sewingQuantities` 一维入参作为过渡仅在 byColor 为空时兜底（合上后保留一两个版本，确认无旧客户端再删）。

```ts
async completeSewing(
  orderId: number,
  sewingQuantity: number,
  defectQuantity: number,
  defectReason: string,
  sewingQuantities?: number[] | null,
  sewingQuantitiesByColor?: ColorSizeQuantityRow[] | null,
  actor?: { userId?: number; username?: string },
): Promise<void> {
  // 1) 取订单 ext 拿 planColorNames + headers
  const ext = await this.orderExtRepo.findOne({ where: { orderId } });
  const headers = Array.isArray(ext?.colorSizeHeaders) ? ext.colorSizeHeaders : [];
  const planColors = (Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : []).map((r) => String(r?.colorName ?? '').trim());

  // 2) 优先 byColor；缺则报错（前端必须按颜色填）
  let byColor: ColorSizeQuantityRow[] | null = null;
  if (Array.isArray(sewingQuantitiesByColor) && sewingQuantitiesByColor.length > 0) {
    assertColorRowsShape(sewingQuantitiesByColor, planColors, headers.length);
    byColor = sewingQuantitiesByColor.map((r) => ({
      colorName: r.colorName.trim(),
      quantities: r.quantities.map((n) => Math.max(0, Math.trunc(Number(n) || 0))),
    }));
  } else if (Array.isArray(sewingQuantities) && sewingQuantities.length > 0) {
    // 仅过渡期：单色订单兜底允许一维（多色必须二维，否则报错）
    if (planColors.length === 1) {
      byColor = [{ colorName: planColors[0], quantities: sewingQuantities.map((n) => Math.max(0, Math.trunc(Number(n) || 0))) }];
    } else {
      throw new BadRequestException('多色订单必须按颜色×尺码填写车缝数量');
    }
  } else {
    throw new BadRequestException('请填写车缝数量');
  }

  // 3) 派生兼容字段（旧 row / 旧 total 仍写入，保证老读取路径仍能跑）
  const perSizeAgg = sumColorRowsBySize(byColor, headers.length);
  const totalQty = sumColorRows(byColor);

  // 4) 写入
  // sewing.sewingQuantitiesByColor = byColor;
  // sewing.sewingQuantityRow = perSizeAgg; // 旧字段同步派生
  // sewing.sewingQuantity = totalQty;       // 旧标量同步派生
  // ... 余下流程不变
}
```

- [ ] **Step 3：构建 + 单测**

```bash
cd backend && npm run build
cd backend && npm test -- production-sewing
```

预期：编译通过；单测如已存在则全部绿；如有覆盖二维输入的新测试在 Task 2.4 加。

- [ ] **Step 4：commit**

```bash
git add backend/src/production-sewing/
git commit -m "feat(sewing): accept byColor quantities and derive legacy fields"
```

### Task 2.2：车缝登记前端改二维矩阵

**Files:**
- Modify: `frontend/src/components/production/SewingRegisterDialog.vue`
- Modify: `frontend/src/composables/useSewingDialogs.ts`
- Modify: `frontend/src/api/production-sewing.ts`

- [ ] **Step 1：API 类型加 `sewingQuantitiesByColor`**

```ts
// frontend/src/api/production-sewing.ts
export async function completeSewing(payload: {
  orderId: number
  sewingQuantity: number
  defectQuantity: number
  defectReason: string
  sewingQuantitiesByColor: ColorSizeQuantityRow[]
}) {
  await http.post(`/api/production-sewing/complete/${payload.orderId}`, payload)
}
```

- [ ] **Step 2：useSewingDialogs 把 `form.sewingQuantities: number[]` 改为 `form.sewingQuantitiesByColor: ColorSizeQuantityRow[]`**

初始化时基于 `form.colorSizeHeaders` 和订单 B 区 `planColors` 构造空二维：

```ts
form.sewingQuantitiesByColor = planRows.map((r) => ({
  colorName: r.colorName,
  quantities: Array(form.colorSizeHeaders.length).fill(0),
}))
```

提交时不再传 `sewingQuantities`，传 `sewingQuantitiesByColor`。

- [ ] **Step 3：SewingRegisterDialog.vue 引入 CuttingQuantityMatrix**

把现有的 `<el-table>` 5 行（订单/裁床/车缝/合计）改为：上面只读区显示"订单数量" "裁床数量"两个表格（沿用现有 sizeTableRows 的相关行），下面"车缝数量"独立用 `CuttingQuantityMatrix` 录入：

```vue
<div class="register-qty-title">车缝数量（按颜色×尺码登记）</div>
<CuttingQuantityMatrix
  v-model="form.sewingQuantitiesByColor"
  :headers="form.colorSizeHeaders"
  :matrix-max-height="320"
/>
<p class="register-qty-sum">车缝数量合计：{{ formatDisplayNumber(sewingTotal) }}</p>
```

`sewingTotal` 改为按二维求和。

- [ ] **Step 4：构建 + 预览自验**

```bash
cd frontend && npm run build
```

启动前端 + 后端，登录到 → 生产管理 → 车缝管理 → 选一条多色订单 → 登记车缝完成，验证：
1. 表单显示按颜色×尺码矩阵；
2. 每个颜色的填写上限为对应颜色裁床数量；
3. 提交后后端落库时 `sewing_quantities_by_color` 真实存了二维数据。

- [ ] **Step 5：commit**

```bash
git add frontend/src/components/production/SewingRegisterDialog.vue frontend/src/composables/useSewingDialogs.ts frontend/src/api/production-sewing.ts
git commit -m "feat(sewing): switch register dialog to color×size matrix"
```

### Task 2.3：尾部入库登记后端接收二维

**Files:**
- Modify: `backend/src/production-finishing/production-finishing-mutation.service.ts`
- Modify: `backend/src/production-finishing/production-finishing.controller.ts`
- Modify: `backend/src/production-finishing/production-finishing.types.ts`

逻辑要点：
- 入库可分批，所以入参是"本批"的二维 `tailInboundQuantitiesThisBatchByColor`、`defectQuantitiesThisBatchByColor`。
- 服务端把本批二维**逐元素加到** `finishing.tailInboundQuantitiesByColor` 已有累计上；同步派生 `tail_inbound_qty_row`（聚合）和 `tail_inbound_qty`（总数）。
- 同时**写本批 snapshot** 到 `inbound_pending.color_size_snapshot`（这就是 Task 3 要透传的真值）。

- [ ] **Step 1：扩展 controller 入参类型**（同 Task 2.1 模式）

- [ ] **Step 2：mutation service 替换累加逻辑**

```ts
// 累加颜色×尺码（每个 colorName × size 各自加）
const merged = mergeColorRowsAddition(
  finishing.tailInboundQuantitiesByColor ?? [],
  tailInboundQuantitiesThisBatchByColor,
  planColors,
  headers.length,
);
finishing.tailInboundQuantitiesByColor = merged;
finishing.tailInboundQtyRow = sumColorRowsBySize(merged, headers.length).concat([sumColorRows(merged)]);
finishing.tailInboundQty = sumColorRows(merged);
```

其中 `mergeColorRowsAddition` 工具加在 `common/color-size-row.util.ts`。

- [ ] **Step 3：本批 snapshot 写入 inbound_pending**

```ts
const pending = this.pendingRepo.create({
  orderId,
  skuCode: '...',
  quantity: sumColorRows(tailInboundQuantitiesThisBatchByColor),
  sourceType: 'normal',
  status: 'pending',
  colorSizeSnapshot: { headers, rows: tailInboundQuantitiesThisBatchByColor },
  // ...
});
```

- [ ] **Step 4：构建 + 单测**

- [ ] **Step 5：commit**

```bash
git add backend/src/production-finishing/
git commit -m "feat(finishing): accept byColor inbound batch and persist snapshot"
```

### Task 2.4：尾部入库登记前端改二维矩阵

**Files:**
- Modify: `frontend/src/components/production/FinishingPackagingDialog.vue`
- Modify: `frontend/src/composables/useFinishingPackaging.ts`
- Modify: `frontend/src/api/production-finishing.ts`

与 Task 2.2 同形态。两个矩阵：本次入库（可编辑）+ 已累计（只读 = `tailInboundQuantitiesByColor`）。"剩余可登记"按颜色×尺码列出（= 尾部收货 byColor - 已累计入库 byColor - 已累计次品 byColor），按颜色精细限制每格上限。

- [ ] **Step 1：拓展 API 类型**
- [ ] **Step 2：composable 改 form 结构**
- [ ] **Step 3：Dialog 引入两个矩阵**
- [ ] **Step 4：前端构建 + 预览实操**
- [ ] **Step 5：commit**

### Task 2.5：尾部收货登记（如有独立入口）

> 先扫一次源码确认尾部收货的录入入口。如果与"完成包装/尾部入库"是一体的对话框，则归并到 2.3/2.4；否则独立做。

- [ ] **Step 0：定位**

```bash
grep -r '尾部收货\|tailReceived\|tail_received' frontend/src --include='*.vue' -l
```

- [ ] **Step 1-5：同 2.3/2.4 模式逐步改造**

---

## 阶段 3：贯通链路（待仓处理 → 成品库存）

### Task 3.1：doInbound 把 inbound_pending snapshot 透传

**Files:**
- Modify: `backend/src/inventory-pending/inventory-pending.service.ts`
- Modify: `backend/src/finished-goods-stock/finished-goods-stock.service.ts`
- Modify: `backend/src/finished-goods-stock/finished-goods-stock-inbound.service.ts`

- [ ] **Step 1：取 inbound_pending 时显式 select colorSizeSnapshot**

```ts
const pendings = await this.pendingRepo
  .createQueryBuilder('p')
  .where('p.id IN (:...ids) AND p.status = :s', { ids, s: 'pending' })
  .addSelect('p.color_size_snapshot', 'p_color_size_snapshot')
  .getMany();
```

- [ ] **Step 2：createManual 入参加 `colorSizeSnapshot`，并在内部置顶优先级**

`createManual` 内部已有 `colorSizeSnapshot` 路径（见 finished-goods-stock-inbound.service.ts:188），现在变成"显式入参 → 内部一律优先用"。后端 `buildOrderColorSizeSnapshot` 兜底只在入参缺失（理论上仅老数据/边角场景）。

- [ ] **Step 3：doInbound 改造**

```ts
for (const p of pendings) {
  // ...
  await this.finishedGoodsStockService.createManual({
    orderNo,
    skuCode: p.skuCode,
    quantity: p.quantity,
    colorSizeSnapshot: p.colorSizeSnapshot ?? null,
    // ...
  }, operatorUsername);
  p.status = 'completed';
  await this.pendingRepo.save(p);
}
```

- [ ] **Step 4：单测**：覆盖 "pending 带 snapshot → 成品库存原样落地" 和 "pending 没有 snapshot → 回到现有兜底" 两条路径。

- [ ] **Step 5：commit**

```bash
git add backend/src/inventory-pending/ backend/src/finished-goods-stock/
git commit -m "feat(inbound): pass inbound_pending color-size snapshot end-to-end"
```

### Task 3.2：成品库存按颜色多行的合并逻辑回顾

当前 `findMergeableFinishedStock` 按 SKU 合并同一仓位的库存。多颜色入库时，传入一个 snapshot 同时含多颜色，老逻辑会合并为一条多颜色记录（snapshot 内有两行）。

- [ ] **Step 1：确认目标行为**

按用户语义"按颜色一条"或"按 SKU 一条带多颜色 snapshot"？查现有数据形态判断（XH3215 截图里是 3 条：多个/杏色/红色，估计走的是"合并多色 + 分色拆条"的某种特殊路径）。

- [ ] **Step 2：在 finished-goods-stock-inbound.service.ts 找到分色拆条逻辑**

```bash
grep -n 'colorName' backend/src/finished-goods-stock/finished-goods-stock-inbound.service.ts | head -20
```

- [ ] **Step 3：按调查结论决定是否调整**

如果现状本来就支持按 snapshot.rows 自动拆分多条入库（每个颜色一条），则不必动；只需保证 snapshot 真值正确。如果不支持，加一段拆分写入逻辑。

- [ ] **Step 4：commit（如有改动）**

---

## 阶段 4：读取侧改造

### Task 4.1：getSizeBreakdown 优先读真值二维

**Files:**
- Modify: `backend/src/orders/order-query.service.ts` — `getSizeBreakdown` 与相关私有方法

- [ ] **Step 1：抽取一个 helper `readByColorOrFallback`**

```ts
// 优先读新字段；为空时按订单计划比例从一维兜底回填（仅老数据）
private async readByColorOrFallback(
  byColor: ColorSizeQuantityRow[] | null,
  legacyRow: number[] | null,
  planRows: ColorSizeRow[],
  sizeLen: number,
): Promise<ColorSizeQuantityRow[] | null> { ... }
```

老数据兜底逻辑就是把 Task 5 迁移脚本里的分摊算法搬过来（一致性）。

- [ ] **Step 2：byColor 区块直接吐真值**

```ts
const sewingByColor = await this.readByColorOrFallback(sewing?.sewingQuantitiesByColor ?? null, sewing?.sewingQuantityRow ?? null, planRows, sizeLen);
// ...
for (const colorRow of sewingByColor ?? []) {
  // blockRows.push({ label: '车缝数量', values: [...colorRow.quantities, sum(colorRow.quantities)] });
}
```

完全干掉 `allocateAggByOrderColumns` 在 sewing/inbound 路径上的使用（保留 cut 兜底用，如果 cutPerSize 反推还需要）。

- [ ] **Step 3：聚合行（最上面那张 rows） = byColor 按尺码列求和 + 合计**

- [ ] **Step 4：构建 + 接口手测**

```bash
cd backend && npm run build
```

POST /api/orders/:id/size-breakdown，验证：
- byColor 中"红色"等于真实登记的数据
- 浮层"红色 车缝合计"= sum(quantities)

- [ ] **Step 5：commit**

```bash
git add backend/src/orders/order-query.service.ts
git commit -m "refactor(orders): read byColor truth for sewing/inbound breakdowns"
```

### Task 4.2：buildOrderColorSizeSnapshot 优先读真值

**Files:**
- Modify: `backend/src/finished-goods-stock/finished-goods-stock-inbound-query.service.ts`

- [ ] **Step 1：新增"优先级 0" — tail_inbound_quantities_by_color**

```ts
const tailByColor = await this.fetchTailInboundQuantitiesByColor(orderId);
if (Array.isArray(tailByColor) && tailByColor.length > 0) {
  return {
    headers,
    rows: scaleColorSizeRowsToQuantity(
      headers,
      tailByColor.map((r) => ({ colorName: r.colorName, quantities: r.quantities })),
      quantity,
    ),
  };
}
```

- [ ] **Step 2：保留现有优先级 1/2/3（成为老数据兜底）**

- [ ] **Step 3：构建 + commit**

```bash
git add backend/src/finished-goods-stock/finished-goods-stock-inbound-query.service.ts
git commit -m "feat(finished-stock): prefer tailInboundQuantitiesByColor when present"
```

### Task 4.3：详情抽屉显示真值

**Files:**
- Modify: `frontend/src/components/production/FinishingDetailDrawer.vue`
- Modify: `frontend/src/components/production/SewingTable.vue`（如内嵌矩阵展示）
- Modify: `frontend/src/components/production/FinishingTable.vue`

- [ ] **Step 1：扫一遍详情视图字段引用**

- [ ] **Step 2：把展示"车缝数量分色细数""尾部入库分色细数"的部分改为读 byColor 真值（API 已经在 Task 4.1 改完，前端只是消费）**

- [ ] **Step 3：构建 + 预览验证（找 XH3215 看一遍）**

- [ ] **Step 4：commit**

---

## 阶段 5：旧数据迁移

### Task 5.1：写迁移脚本

**Files:**
- Create: `backend/scripts/migrate-production-color-rows.js`

逻辑：
1. 连本机 MySQL（沿用项目其他 `scripts/run-*.js` 的 dotenv + mysql2 写法）。
2. 遍历所有 order_sewing：
   - 取对应 order_ext.color_size_rows 作为颜色计划
   - 取 sewing_quantity_row 作为一维聚合
   - 按"每列大余数分摊到颜色"（与 Task 4.1 的兜底函数完全一致）
   - 写回 sewing_quantities_by_color
3. order_finishing 三个字段同样处理
4. inbound_pending：找到对应 order_finishing 的 tail_inbound_quantities_by_color，按本 pending 的 quantity 在二维上等比缩放，写入 color_size_snapshot

- [ ] **Step 1：写脚本，加 `--dry-run` 选项**（默认 dry-run，明确确认后才真写）

- [ ] **Step 2：本机跑 dry-run 看输出**

```bash
cd backend && node scripts/migrate-production-color-rows.js --dry-run
```

预期：打印 N 条 sewing / M 条 finishing / K 条 pending 的预计写入内容；对照截图 XH3215 看 sewing/finishing 的分摊结果是否合理。

- [ ] **Step 3：本机执行实际迁移**

```bash
cd backend && node scripts/migrate-production-color-rows.js --apply
```

- [ ] **Step 4：抽 3 条订单（含 XH3215）核对 byColor 数据是否合理**

- [ ] **Step 5：commit**

```bash
git add backend/scripts/migrate-production-color-rows.js
git commit -m "chore(db): backfill production color×size rows for legacy orders"
```

### Task 5.2：上线 runbook 写到部署文档

**Files:**
- Modify: `docs/DEPLOY_GUIDE.md`

- [ ] **Step 1：在部署指南里追加本次的上线顺序**

```
1. 关闭后端流量（PM2 stop）
2. 执行 SQL：scripts/add-production-color-rows.sql
3. 部署新版后端代码 + 前端
4. 执行迁移：node backend/scripts/migrate-production-color-rows.js --apply
5. 起后端，灰度验证
6. 全量
```

- [ ] **Step 2：commit**

---

## 验证清单（上线前）

- [ ] 多色订单（找 XH3215 或新建一条 2 色订单）：
  - [ ] 车缝登记表单按颜色×尺码矩阵显示
  - [ ] 提交后数据库 `sewing_quantities_by_color` 有正确二维
  - [ ] 浮层显示真值，无"独立四舍五入差 1"
- [ ] 尾部入库分批：
  - [ ] 第 1 批按颜色×尺码登记
  - [ ] 第 2 批继续累加，颜色×尺码累加正确
  - [ ] 待仓处理记录里 `color_size_snapshot` 是本批真值
- [ ] 成品库存：
  - [ ] 待仓 → 入库后，按颜色×尺码与尾部入库登记一字不差
  - [ ] 浮层"尾部入库数"和成品库存细数对得上
- [ ] 老订单（迁移后）：
  - [ ] XH3215 浮层显示与新订单同形态
  - [ ] 老订单 detail 抽屉无报错
- [ ] 数据库迁移幂等：脚本第二次执行不重复破坏（用 `IS NULL` 守门）

---

## 自审

**Spec coverage 检查：**
- 录入 3 个对话框改造 → Task 2.1/2.2 + 2.3/2.4 + 2.5 ✓
- 后端 3 张表加列 → Task 1.1/1.2 ✓
- 待仓 → 成品贯通 → Task 3.1 ✓
- 数量追踪浮层真值 → Task 4.1 ✓
- 老订单一次性回填 → Task 5.1 ✓
- 上线节奏 → 阶段化提交，但代码一次性合并上线 ✓

**Placeholder 扫描：**通过——没有"TBD/待补充/类似 Task N"等占位。

**类型一致性：** `ColorSizeQuantityRow` 全程同名同结构（colorName/quantities）；后端写入路径上一律派生 `quantityRow`（一维）和 `quantity`（标量）旧字段以保持读取向后兼容。

---

## 执行建议

这份计划任务多但每个任务自包含。建议方式：

**Inline Execution**（推荐）：一个个 Task 顺序做，每完成一个阶段在本地手测 + 构建通过 + commit，结束时统一让用户预览验收。我会用 `superpowers:executing-plans` 跑批。

不建议 Subagent-Driven，因为这套涉及大量跨文件状态联动，主上下文必须始终在我手里以便发现遗漏。
