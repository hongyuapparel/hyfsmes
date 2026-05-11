# 尾部管理 — 分批入库与发货 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让尾部管理支持同一订单分批登记入库（partial / full），列表与详情清楚展示批次状态，数据不因分批错乱。

**Architecture:** 复用现有 `inbound_pending`（多行）+ `finished_goods_outbound`（多行）作为批次数据源；`order_finishing` 一订单一行的汇总表不变。后端放宽 `registerPackagingComplete` 校验、累加而非覆盖、修 `inbound()` 的 pending 数量 bug。前端弹窗用「部分入库 / 全部入库」双按钮表达意图；列表加「部分入库」inline chip；详情抽屉新增「批次记录」时间轴。

**Tech Stack:**
- 后端：NestJS + TypeORM + MySQL。新表结构变更走 `src/database/seed-*.ts` 启动期同步脚本（项目既有模式）。后端无单元测试框架，本计划后端用「实现 + 手动 curl/UI 验证」替代单测。
- 前端：Vue 3 + TS + Element Plus + Pinia + Vitest。前端 composable 用 Vitest 做 TDD（参考 `src/views/settings/supplier-settings.spec.ts`）。
- 设计文档：`docs/superpowers/specs/2026-05-10-finishing-batch-design.md`。

**关键约束（来自 CLAUDE.md）：**
- 禁止 `any` / `as any`；用具体类型或 `unknown` + 守卫。
- 不使用补丁 CSS、`!important`；只用设计 token。
- `views/finishing.vue` 已 638 行（≥ 500 警戒线），新逻辑下沉到 composable，不增厚视图。
- 重启前后端用 `scripts/start.ps1` / `scripts/restart.ps1`，看日志 `.codex-backend-3000.log` / `.codex-frontend-5173.log`。

---

## 文件结构

新增：
- `backend/src/database/seed-inbound-pending-batch-columns.ts` — 启动期同步加列脚本
- `backend/src/production-finishing/finishing-batch.types.ts` — `BatchEvent` 类型与守卫
- `frontend/src/components/production/BatchTimelineSection.vue` — 详情抽屉中的批次时间轴
- `frontend/src/composables/useFinishingBatchTimeline.ts` — 批次接口请求与排序
- `frontend/src/composables/useFinishingPackaging.spec.ts` — composable Vitest 测试

修改：
- `backend/src/entities/inbound-pending.entity.ts` — 加 `operatorUsername`、`batchNo`
- `backend/src/main.ts` — 启动期调用新 seed
- `backend/src/production-finishing/production-finishing-mutation.service.ts` — `registerPackagingComplete` 支持 `mode: 'partial' \| 'full'`；累加；修 `inbound()` bug
- `backend/src/production-finishing/production-finishing-query.service.ts` — 新增 `getBatches`
- `backend/src/production-finishing/production-finishing.controller.ts` — 新增 `mode` 入参；新增 `GET /:orderId/batches`
- `frontend/src/api/production-finishing.ts` — `registerFinishingPackagingComplete` 入参加 `mode`；新增 `fetchFinishingBatches`
- `frontend/src/composables/useFinishingPackaging.ts` — 支持 `partial` / `full`；暴露 `remainingQty` / `alreadyInboundQty` / `batchNoHint`
- `frontend/src/views/production/finishing.vue` — 弹窗标题/说明/信息区/三按钮
- `frontend/src/components/production/FinishingTable.vue` — 「尾部入库数」单元格加 `部分入库` chip
- 详情抽屉相关组件 — 挂载 `BatchTimelineSection.vue`

---

## Task 1 — 后端：`inbound_pending` 加列 + 启动期 seed

**Files:**
- Modify: `backend/src/entities/inbound-pending.entity.ts`
- Create: `backend/src/database/seed-inbound-pending-batch-columns.ts`
- Modify: `backend/src/main.ts:9-14`（imports）、`backend/src/main.ts:229-234`（调用）

- [ ] **Step 1: 修改实体加两列**

打开 `backend/src/entities/inbound-pending.entity.ts`，在 `status` 列后追加两列：

```ts
@Column({ name: 'operator_username', length: 128, default: '' })
operatorUsername: string;

@Column({ name: 'batch_no', type: 'int', nullable: true })
batchNo: number | null;
```

- [ ] **Step 2: 新建 seed 脚本**

新建 `backend/src/database/seed-inbound-pending-batch-columns.ts`：

```ts
import { DataSource } from 'typeorm';

/**
 * 确保 inbound_pending 存在 operator_username / batch_no 列，用于尾部分批登记的操作人留痕与批次序号展示。
 */
export async function seedInboundPendingBatchColumns(dataSource: DataSource): Promise<void> {
  let dbName = (dataSource.options as { database?: string }).database;
  if (!dbName) {
    const rows = await dataSource.query<{ db: string }[]>('SELECT DATABASE() AS db');
    dbName = rows?.[0]?.db;
  }
  if (!dbName) return;

  const hasColumn = async (col: string): Promise<boolean> => {
    const rows = await dataSource.query<{ cnt: number }[]>(
      `SELECT COUNT(1) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inbound_pending' AND COLUMN_NAME = ?`,
      [dbName, col],
    );
    return (rows?.[0]?.cnt ?? 0) > 0;
  };

  if (!(await hasColumn('operator_username'))) {
    await dataSource.query(
      `ALTER TABLE inbound_pending ADD COLUMN operator_username VARCHAR(128) NOT NULL DEFAULT ''`,
    );
    console.log('[Seed] inbound_pending.operator_username column added.');
  }
  if (!(await hasColumn('batch_no'))) {
    await dataSource.query(`ALTER TABLE inbound_pending ADD COLUMN batch_no INT NULL`);
    console.log('[Seed] inbound_pending.batch_no column added.');
  }
}
```

- [ ] **Step 3: 在 main.ts 注册 seed**

在 `backend/src/main.ts` 文件顶部 import 区追加：

```ts
import { seedInboundPendingBatchColumns } from './database/seed-inbound-pending-batch-columns';
```

在 `seedOrderSewingQuantityRow(dataSource);` 后面追加一行：

```ts
await seedInboundPendingBatchColumns(dataSource);
```

- [ ] **Step 4: 重启后端验证日志输出**

在项目根目录运行：

```powershell
pwsh scripts/restart.ps1
```

观察 `.codex-backend-3000.log`，期望看到：
```
[Seed] inbound_pending.operator_username column added.
[Seed] inbound_pending.batch_no column added.
```

再次重启时这两行不应再出现（幂等）。

- [ ] **Step 5: 提交**

```bash
git add backend/src/entities/inbound-pending.entity.ts backend/src/database/seed-inbound-pending-batch-columns.ts backend/src/main.ts
git commit -m "feat(finishing): inbound_pending 增加 operator_username 与 batch_no 列"
```

---

## Task 2 — 后端：`registerPackagingComplete` 支持 partial / full 模式

**Files:**
- Modify: `backend/src/production-finishing/production-finishing-mutation.service.ts:142-274`
- Modify: `backend/src/production-finishing/production-finishing.controller.ts:141-163`

- [ ] **Step 1: service 改入参签名 + 拆分模式分支**

打开 `backend/src/production-finishing/production-finishing-mutation.service.ts`，把现有 `registerPackagingComplete` 整体替换为：

```ts
async registerPackagingComplete(
  orderId: number,
  mode: 'partial' | 'full',
  tailInboundQtyThisBatch: number,
  defectQuantityThisBatch: number,
  remark?: string | null,
  actorUserId?: number,
  actorUsername?: string,
  tailInboundQuantitiesThisBatch?: number[] | null,
  defectQuantitiesThisBatch?: number[] | null,
): Promise<void> {
  const order = await this.orderRepo.findOne({ where: { id: orderId } });
  if (!order) throw new NotFoundException('订单不存在');
  const finishing = await this.finishingRepo.findOne({ where: { orderId } });
  if (!finishing) throw new NotFoundException('请先登记收货');

  const received = Number(finishing.tailReceivedQty) || 0;
  if (received <= 0) throw new NotFoundException('尾部收货数无效，请先登记收货');

  const alreadyInbound = Number(finishing.tailInboundQty) || 0;
  const alreadyDefect = Number(finishing.defectQuantity) || 0;
  const remaining = received - alreadyInbound - alreadyDefect;

  // 已完成订单（status='inbound'）走 amend 分支，沿用旧语义
  if (finishing.status === 'inbound') {
    await this.amendPackagingComplete(
      order,
      finishing,
      tailInboundQtyThisBatch,
      defectQuantityThisBatch,
      remark,
      tailInboundQuantitiesThisBatch,
      defectQuantitiesThisBatch,
    );
    return;
  }

  if (finishing.status !== 'pending_assign') {
    throw new BadRequestException('仅「待登记包装」或「尾部完成且待仓未处理」的订单可操作');
  }

  const inboundThis = Number(tailInboundQtyThisBatch) || 0;
  const defectThis = Number(defectQuantityThisBatch) || 0;
  if (inboundThis < 0 || defectThis < 0) {
    throw new BadRequestException('入库数 / 次品数不可为负');
  }
  const sumThis = inboundThis + defectThis;
  if (sumThis <= 0) throw new BadRequestException('本次入库数 + 次品数必须大于 0');
  if (sumThis > remaining) {
    throw new BadRequestException(`本次入库数 + 次品数(${sumThis}) 超过剩余可登记数(${remaining})`);
  }
  if (mode === 'full' && sumThis !== remaining) {
    throw new BadRequestException(`「全部入库」需要填满剩余 ${remaining} 件，当前差 ${remaining - sumThis} 件`);
  }

  const ext = await this.orderExtRepo.findOne({ where: { orderId } });
  const headers =
    Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0
      ? [...ext.colorSizeHeaders, '合计']
      : ['合计'];
  const sizeCount = headers.length > 1 ? headers.length - 1 : 1;

  // 计算按尺码累加后的行（若提供本批按尺码）
  if (await this.hasPackagingQtyRows()) {
    const tin = tailInboundQuantitiesThisBatch;
    const tdq = defectQuantitiesThisBatch;
    if (Array.isArray(tin) && Array.isArray(tdq) && tin.length >= sizeCount && tdq.length >= sizeCount) {
      const perInThis = tin.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
      const perDefThis = tdq.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
      const sumIn = perInThis.reduce((a, b) => a + b, 0);
      const sumDef = perDefThis.reduce((a, b) => a + b, 0);
      if (sumIn !== inboundThis || sumDef !== defectThis) {
        throw new BadRequestException('按尺码填写的入库数 / 次品数合计与汇总不一致');
      }

      // 累加现有 inboundRow / defectRow
      const oldInRow = await this.fetchTailInboundQtyRow(orderId);
      const oldDefRow = await this.fetchDefectQuantityRow(orderId);
      const newInRow: number[] = [];
      const newDefRow: number[] = [];
      for (let i = 0; i < sizeCount; i++) {
        newInRow.push((Number(oldInRow?.[i]) || 0) + perInThis[i]);
        newDefRow.push((Number(oldDefRow?.[i]) || 0) + perDefThis[i]);
      }
      const newInTotal = alreadyInbound + inboundThis;
      const newDefTotal = alreadyDefect + defectThis;
      const tailInboundQtyRow = headers.length === 1 ? [newInTotal] : [...newInRow, newInTotal];
      const defectQuantityRow = headers.length === 1 ? [newDefTotal] : [...newDefRow, newDefTotal];
      (finishing as { tailInboundQtyRow?: number[] }).tailInboundQtyRow = tailInboundQtyRow;
      (finishing as { defectQuantityRow?: number[] }).defectQuantityRow = defectQuantityRow;
    }
  }

  const newInboundTotal = alreadyInbound + inboundThis;
  const newDefectTotal = alreadyDefect + defectThis;
  const willComplete = newInboundTotal + newDefectTotal === received;

  let nextStatus: string | null = null;
  if (willComplete) {
    nextStatus = await this.orderWorkflowService.resolveNextStatus({
      order,
      triggerCode: 'tailing_inbound_completed',
      actorUserId: actorUserId ?? 0,
    });
    if (!nextStatus) {
      throw new BadRequestException('未匹配到"入库完成"流转规则，请先在订单设置中检查流程链路配置');
    }
  }

  finishing.tailShippedQty = 0;
  finishing.tailInboundQty = newInboundTotal;
  finishing.defectQuantity = newDefectTotal;
  if (remark !== undefined) finishing.remark = remark?.trim() || null;

  if (willComplete) {
    finishing.completedAt = new Date();
    finishing.status = 'inbound';
  }
  await this.finishingRepo.save(finishing);

  if (willComplete && nextStatus && nextStatus !== order.status) {
    order.status = nextStatus;
    order.statusTime = new Date();
    await this.orderRepo.save(order);
  }

  // INSERT 本次 pending 记录（本次量，不是累加量）
  const nextBatchNo = await this.nextBatchNo(order.id);
  const opUser = (actorUsername ?? '').trim();
  const pendingRows: InboundPending[] = [];
  if (inboundThis > 0) {
    pendingRows.push(
      this.inboundPendingRepo.create({
        orderId: order.id,
        skuCode: order.skuCode ?? '',
        quantity: inboundThis,
        sourceType: 'normal',
        status: 'pending',
        batchNo: nextBatchNo,
        operatorUsername: opUser,
      }),
    );
  }
  if (defectThis > 0) {
    pendingRows.push(
      this.inboundPendingRepo.create({
        orderId: order.id,
        skuCode: order.skuCode ?? '',
        quantity: defectThis,
        sourceType: 'defect',
        status: 'pending',
        batchNo: nextBatchNo,
        operatorUsername: opUser,
      }),
    );
  }
  if (pendingRows.length) await this.inboundPendingRepo.save(pendingRows);
}

/** 取该订单下一个批次序号；现有最大值 + 1，从 1 起算 */
private async nextBatchNo(orderId: number): Promise<number> {
  const rows = await this.inboundPendingRepo.query(
    'SELECT COALESCE(MAX(batch_no), 0) AS m FROM inbound_pending WHERE order_id = ?',
    [orderId],
  );
  const max = Number((rows as { m?: number | string }[])?.[0]?.m ?? 0) || 0;
  return max + 1;
}

private async fetchTailInboundQtyRow(orderId: number): Promise<number[] | null> {
  if (!(await this.hasPackagingQtyRows())) return null;
  const rows = await this.finishingRepo.query(
    'SELECT tail_inbound_qty_row AS tailInboundQtyRow FROM `order_finishing` WHERE order_id = ? LIMIT 1',
    [orderId],
  );
  const raw =
    Array.isArray(rows) && rows.length > 0
      ? (rows[0] as { tailInboundQtyRow?: unknown }).tailInboundQtyRow
      : null;
  return this.parseQtyRow(raw);
}

private async fetchDefectQuantityRow(orderId: number): Promise<number[] | null> {
  if (!(await this.hasPackagingQtyRows())) return null;
  const rows = await this.finishingRepo.query(
    'SELECT defect_quantity_row AS defectQuantityRow FROM `order_finishing` WHERE order_id = ? LIMIT 1',
    [orderId],
  );
  const raw =
    Array.isArray(rows) && rows.length > 0
      ? (rows[0] as { defectQuantityRow?: unknown }).defectQuantityRow
      : null;
  return this.parseQtyRow(raw);
}

private parseQtyRow(raw: unknown): number[] | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    return Array.isArray(parsed) ? (parsed as unknown[]).map((v) => Number(v) || 0) : null;
  } catch {
    return null;
  }
}

/** 已完成订单的修正路径，行为对齐旧实现（覆盖式 + 重建 pending） */
private async amendPackagingComplete(
  order: Order,
  finishing: OrderFinishing,
  tailInboundQty: number,
  defectQuantity: number,
  remark: string | null | undefined,
  tailInboundQuantities?: number[] | null,
  defectQuantities?: number[] | null,
): Promise<void> {
  // 原 amend 逻辑保持不变（覆盖式写汇总 + 清旧 pending + INSERT 新 pending）
  // 复用本服务原有的 assertCanAmendPackagingPending、按尺码校验逻辑
  // 实现细节：从原 registerPackagingComplete 中 isAmend 分支整体抽离到此方法
  // … 见下方 Step 2
}
```

- [ ] **Step 2: 把旧 isAmend 分支搬到 `amendPackagingComplete`**

把原 `registerPackagingComplete` 中 `if (isAmend) ...` 之后那段（包括按尺码校验、清 pending、INSERT 新 pending、`finishing.tailInboundQty = inbound;` 等）整体搬到 `amendPackagingComplete` 私有方法体内。amend 时 `tailInboundQty` 与 `defectQuantity` 是「目标累计值」（覆盖式），不是「本次新增」，校验仍是 `inbound + defect === received`。INSERT 新 pending 时也写 `batchNo = await this.nextBatchNo(orderId)`、`operatorUsername = ''`（amend 路径暂不补操作人，留作后续扩展）。

不要新增、不要删除 amend 的旧行为；只是把它从巨型 if 里抽出来，让主流程清爽。

- [ ] **Step 3: 控制器入参加 mode + actorUsername**

打开 `backend/src/production-finishing/production-finishing.controller.ts`，把 `registerPackagingComplete` 整体替换为：

```ts
@Post('items/register-packaging-complete')
@RequirePermission('production_finishing_packaging')
registerPackagingComplete(
  @Body('orderId') orderId: number,
  @Body('mode') mode: string,
  @Body('tailInboundQty') tailInboundQty: number,
  @Body('defectQuantity') defectQuantity: number,
  @Body('remark') remark?: string,
  @Body('tailInboundQuantities') tailInboundQuantities?: number[],
  @Body('defectQuantities') defectQuantities?: number[],
  @CurrentUser() user?: { userId: number; username: string },
) {
  const normalizedMode: 'partial' | 'full' = mode === 'partial' ? 'partial' : 'full';
  return this.finishingMutationService.registerPackagingComplete(
    Number(orderId),
    normalizedMode,
    Number(tailInboundQty ?? 0),
    Number(defectQuantity ?? 0),
    remark ?? null,
    user?.userId,
    user?.username,
    Array.isArray(tailInboundQuantities) ? tailInboundQuantities : null,
    Array.isArray(defectQuantities) ? defectQuantities : null,
  );
}
```

旧请求体里的 `tailShippedQty` 不再使用，删掉以避免误传。

- [ ] **Step 4: 手动验证 partial 路径（curl 或 UI）**

启动一份测试订单：尾部收货 100，状态 `pending_assign`，未登记入库。

```bash
curl -X POST http://localhost:3000/api/production/finishing/items/register-packaging-complete \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"orderId":<id>,"mode":"partial","tailInboundQty":50,"defectQuantity":0}'
```

期望：
1. 返回 200。
2. `order_finishing.tail_inbound_qty = 50`，`status` 仍为 `pending_assign`。
3. `inbound_pending` 多一行：`quantity=50, batch_no=1, operator_username=<当前用户>`。
4. 订单状态没变。

- [ ] **Step 5: 手动验证 full 路径补齐**

接着对同一订单调：

```bash
curl ... -d '{"orderId":<id>,"mode":"full","tailInboundQty":50,"defectQuantity":0}'
```

期望：
1. 返回 200。
2. `order_finishing.tail_inbound_qty = 100`，`status = 'inbound'`，`completed_at` 已填。
3. 订单状态推进到下一阶段（按工作流配置）。
4. `inbound_pending` 再多一行 `quantity=50, batch_no=2`。

- [ ] **Step 6: 验证非法用例**

```bash
# 超额：剩余 100，传 120
curl ... -d '{"orderId":<新订单id>,"mode":"partial","tailInboundQty":120,"defectQuantity":0}'
# 期望 400 "本次入库数+次品数(120) 超过剩余可登记数(100)"

# full 模式没填满
curl ... -d '{"orderId":<新订单id>,"mode":"full","tailInboundQty":50,"defectQuantity":0}'
# 期望 400 "「全部入库」需要填满剩余 100 件，当前差 50 件"

# 零数量
curl ... -d '{"orderId":<新订单id>,"mode":"partial","tailInboundQty":0,"defectQuantity":0}'
# 期望 400 "本次入库数 + 次品数必须大于 0"
```

- [ ] **Step 7: 提交**

```bash
git add backend/src/production-finishing/production-finishing-mutation.service.ts \
        backend/src/production-finishing/production-finishing.controller.ts
git commit -m "feat(finishing): registerPackagingComplete 支持 partial/full 双模式，累加而非覆盖"
```

---

## Task 3 — 后端：修 `inbound()` 写 pending 数量 bug + 加新列字段

**Files:**
- Modify: `backend/src/production-finishing/production-finishing-mutation.service.ts:305-351`

- [ ] **Step 1: 把 `inbound()` 内 INSERT pending 改为本次量**

定位 `async inbound(orderId, quantity, actorUserId)` 内的：

```ts
const pending = this.inboundPendingRepo.create({
  orderId: order.id,
  skuCode: order.skuCode ?? '',
  quantity: finishing.tailInboundQty ?? 0,   // ❌ 累加值，bug
  sourceType: 'normal',
  status: 'pending',
});
```

替换为：

```ts
const nextBatchNo = await this.nextBatchNo(order.id);
const pending = this.inboundPendingRepo.create({
  orderId: order.id,
  skuCode: order.skuCode ?? '',
  quantity: qty,   // ✅ 本次新增量
  sourceType: 'normal',
  status: 'pending',
  batchNo: nextBatchNo,
  operatorUsername: '',  // 旧入口暂不带 username，扩展时再补
});
```

注意：原代码这一段在 `if (total === received)` 内，意味着只在「补完最后一笔」时 INSERT，导致中间批次根本没 INSERT pending。把 INSERT 移出 if 块，每次都 INSERT。改造后形如：

```ts
finishing.tailInboundQty = newInbound;
const total = shipped + newInbound + defect;

const nextBatchNo = await this.nextBatchNo(order.id);
const pending = this.inboundPendingRepo.create({
  orderId: order.id,
  skuCode: order.skuCode ?? '',
  quantity: qty,
  sourceType: 'normal',
  status: 'pending',
  batchNo: nextBatchNo,
  operatorUsername: '',
});
await this.inboundPendingRepo.save(pending);

if (total === received) {
  const next = await this.orderWorkflowService.resolveNextStatus({
    order,
    triggerCode: 'tailing_inbound_completed',
    actorUserId: actorUserId ?? 0,
  });
  if (!next) throw new BadRequestException('未匹配到"入库完成"流转规则');
  finishing.status = 'inbound';
  await this.finishingRepo.save(finishing);
  if (next !== order.status) {
    order.status = next;
    order.statusTime = new Date();
    await this.orderRepo.save(order);
  }
} else {
  await this.finishingRepo.save(finishing);
}
```

- [ ] **Step 2: 控制器把 username 传给 service（顺手修）**

打开 `backend/src/production-finishing/production-finishing.controller.ts`，把 `inbound()` 改为传 `user?.username`：

```ts
@Post('items/inbound')
@RequirePermission('production_finishing_inbound')
inbound(
  @Body('orderId') orderId: number,
  @Body('quantity') quantity: number,
  @CurrentUser() user?: { userId: number; username: string },
) {
  return this.finishingMutationService.inbound(
    Number(orderId),
    Number(quantity ?? 0),
    user?.userId,
    user?.username,
  );
}
```

service 端 `inbound()` 签名追加 `actorUsername?: string` 入参，把 `operatorUsername: ''` 改为 `operatorUsername: (actorUsername ?? '').trim()`。

- [ ] **Step 3: 手动验证（如有可达此分支的订单）**

此分支需要订单先到 `status='shipped'` 才走得到。不易构造时，可跳过手动验证；core 路径在 Task 2 已覆盖。

- [ ] **Step 4: 提交**

```bash
git add backend/src/production-finishing/production-finishing-mutation.service.ts \
        backend/src/production-finishing/production-finishing.controller.ts
git commit -m "fix(finishing): inbound() 修正 pending 数量与批次落库，并写入操作人/批次号"
```

---

## Task 4 — 后端：批次记录查询 `getBatches`

**Files:**
- Create: `backend/src/production-finishing/finishing-batch.types.ts`
- Modify: `backend/src/production-finishing/production-finishing-query.service.ts`

- [ ] **Step 1: 新增类型文件**

新建 `backend/src/production-finishing/finishing-batch.types.ts`：

```ts
export type FinishingBatchEventType = 'receive' | 'inbound' | 'outbound';

export interface FinishingBatchEvent {
  type: FinishingBatchEventType;
  batchNo: number | null;
  quantity: number;
  sourceType: 'normal' | 'defect' | null;
  operatorUsername: string;
  pickupUserName: string;
  remark: string;
  occurredAt: string; // ISO
}
```

- [ ] **Step 2: query service 加方法**

打开 `backend/src/production-finishing/production-finishing-query.service.ts`，在类内追加：

```ts
async getBatches(orderId: number): Promise<FinishingBatchEvent[]> {
  if (!Number.isInteger(orderId) || orderId <= 0) return [];
  const events: FinishingBatchEvent[] = [];

  const finishing = await this.finishingRepo.findOne({ where: { orderId } });
  if (finishing?.arrivedAt && (finishing.tailReceivedQty ?? 0) > 0) {
    events.push({
      type: 'receive',
      batchNo: null,
      quantity: finishing.tailReceivedQty ?? 0,
      sourceType: null,
      operatorUsername: '',
      pickupUserName: '',
      remark: '',
      occurredAt: new Date(finishing.arrivedAt).toISOString(),
    });
  }

  const pendings = await this.pendingRepo.find({
    where: { orderId },
    order: { createdAt: 'ASC', id: 'ASC' },
  });
  for (const p of pendings) {
    events.push({
      type: 'inbound',
      batchNo: p.batchNo ?? null,
      quantity: p.quantity ?? 0,
      sourceType: (p.sourceType === 'defect' ? 'defect' : 'normal'),
      operatorUsername: p.operatorUsername ?? '',
      pickupUserName: '',
      remark: '',
      occurredAt: new Date(p.createdAt).toISOString(),
    });
  }

  const outboundRows = await this.pendingRepo.manager
    .createQueryBuilder()
    .from('finished_goods_outbound', 'fo')
    .where('fo.order_id = :orderId', { orderId })
    .orderBy('fo.created_at', 'ASC')
    .select([
      'fo.id AS id',
      'fo.quantity AS quantity',
      'fo.pickup_user_name AS pickupUserName',
      'fo.operator_username AS operatorUsername',
      'fo.remark AS remark',
      'fo.created_at AS createdAt',
    ])
    .getRawMany<{
      id: number;
      quantity: number | string;
      pickupUserName: string | null;
      operatorUsername: string | null;
      remark: string | null;
      createdAt: Date | string;
    }>();
  outboundRows.forEach((row, idx) => {
    events.push({
      type: 'outbound',
      batchNo: idx + 1,
      quantity: Number(row.quantity) || 0,
      sourceType: null,
      operatorUsername: row.operatorUsername ?? '',
      pickupUserName: row.pickupUserName ?? '',
      remark: row.remark ?? '',
      occurredAt: new Date(row.createdAt).toISOString(),
    });
  });

  events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return events.reverse(); // 倒序：最近事件在前
}
```

如果 `pendingRepo` 未注入到该 service，在 service 构造器和模块里补齐 `@InjectRepository(InboundPending)`。

- [ ] **Step 3: 模块依赖检查**

如果 query service 还没有 `InboundPending` 仓库注入，在 `production-finishing.module.ts` 的 `TypeOrmModule.forFeature([...])` 里确认 `InboundPending` 已经在列表中（Task 1 完成后应已存在）。如未注入到 query service 构造器，补：

```ts
constructor(
  @InjectRepository(OrderFinishing) private readonly finishingRepo: Repository<OrderFinishing>,
  // ... existing
  @InjectRepository(InboundPending) private readonly pendingRepo: Repository<InboundPending>,
) {}
```

- [ ] **Step 4: 提交**

```bash
git add backend/src/production-finishing/finishing-batch.types.ts \
        backend/src/production-finishing/production-finishing-query.service.ts \
        backend/src/production-finishing/production-finishing.module.ts
git commit -m "feat(finishing): 新增 getBatches 联合查询接口数据来源"
```

---

## Task 5 — 后端：批次接口控制器

**Files:**
- Modify: `backend/src/production-finishing/production-finishing.controller.ts`

- [ ] **Step 1: 加路由**

在 controller 末尾追加：

```ts
@Get('items/:orderId/batches')
@RequirePermission('/production/finishing')
async getBatches(@Param('orderId') orderId: string) {
  return this.finishingQueryService.getBatches(Number(orderId));
}
```

确保文件顶部已 import `Param`、`finishingQueryService`、类型 `FinishingBatchEvent`（用于返回类型注释，可选）。

- [ ] **Step 2: 启动后端，curl 验证**

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/production/finishing/items/<orderId>/batches
```

对一个已经经历过分批的订单，期望按时间倒序返回 receive / inbound / outbound 多条事件。

- [ ] **Step 3: 提交**

```bash
git add backend/src/production-finishing/production-finishing.controller.ts
git commit -m "feat(finishing): 新增 GET items/:orderId/batches 路由"
```

---

## Task 6 — 前端：API 客户端更新

**Files:**
- Modify: `frontend/src/api/production-finishing.ts`

- [ ] **Step 1: 更新 `registerFinishingPackagingComplete` 入参**

找到现有的 `registerFinishingPackagingComplete` 函数。它的入参类型加上 `mode`：

```ts
export interface RegisterFinishingPackagingCompletePayload {
  orderId: number
  mode: 'partial' | 'full'
  tailInboundQty: number
  defectQuantity: number
  remark?: string
  tailInboundQuantities?: number[]
  defectQuantities?: number[]
}

export function registerFinishingPackagingComplete(payload: RegisterFinishingPackagingCompletePayload) {
  return request.post('/production/finishing/items/register-packaging-complete', payload)
}
```

把原来携带 `tailShippedQty: 0` 的字段删掉。

- [ ] **Step 2: 新增 `fetchFinishingBatches`**

在同文件末尾追加：

```ts
export type FinishingBatchEventType = 'receive' | 'inbound' | 'outbound'

export interface FinishingBatchEvent {
  type: FinishingBatchEventType
  batchNo: number | null
  quantity: number
  sourceType: 'normal' | 'defect' | null
  operatorUsername: string
  pickupUserName: string
  remark: string
  occurredAt: string
}

export function fetchFinishingBatches(orderId: number) {
  return request.get<FinishingBatchEvent[]>(`/production/finishing/items/${orderId}/batches`)
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/api/production-finishing.ts
git commit -m "feat(finishing): 前端 API 增加 mode 入参与 fetchFinishingBatches"
```

---

## Task 7 — 前端：`useFinishingPackaging` composable 改造（TDD）

**Files:**
- Create: `frontend/src/composables/useFinishingPackaging.spec.ts`
- Modify: `frontend/src/composables/useFinishingPackaging.ts`

- [ ] **Step 1: 写失败测试**

新建 `frontend/src/composables/useFinishingPackaging.spec.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('@/api/production-finishing', () => ({
  registerFinishingPackagingComplete: vi.fn(async () => ({ data: { ok: true } })),
  getFinishingRegisterFormData: vi.fn(async () => ({
    data: {
      headers: ['合计'],
      orderRow: [100],
      cutRow: [100],
      sewingRow: [100],
      tailReceivedRow: [100],
      tailInboundRow: null,
      defectRow: null,
    },
  })),
}))

vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/api/request', () => ({
  getErrorMessage: (_: unknown, fallback: string) => fallback,
  isErrorHandled: () => false,
}))

import { useFinishingPackaging } from './useFinishingPackaging'
import { registerFinishingPackagingComplete } from '@/api/production-finishing'

const makeRow = (overrides: Partial<{ tailInboundQty: number; defectQuantity: number }> = {}) => ({
  orderId: 1,
  orderNo: 'O-1',
  skuCode: 'SKU-1',
  imageUrl: '',
  customerName: '',
  salesperson: '',
  merchandiser: '',
  quantity: 100,
  customerDueDate: null,
  arrivedAt: null,
  completedAt: null,
  finishingStatus: 'pending_assign',
  cutTotal: 100,
  sewingQuantity: 100,
  factoryName: null,
  tailReceivedQty: 100,
  tailShippedQty: 0,
  tailInboundQty: overrides.tailInboundQty ?? 0,
  tailInboundRow: null,
  defectQuantity: overrides.defectQuantity ?? 0,
  remark: null,
  timeRating: '',
})

describe('useFinishingPackaging — partial / full', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('全部入库：本次合计等于剩余 → mode=full 调接口', async () => {
    const selectedRows = ref([makeRow()])
    const composable = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await composable.openPackagingCompleteDialog()
    composable.packagingCompleteDialog.items[0].inboundQuantities[0] = 100
    await composable.submitPackagingComplete('full')
    expect(registerFinishingPackagingComplete).toHaveBeenCalledTimes(1)
    expect(registerFinishingPackagingComplete).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 1, mode: 'full', tailInboundQty: 100, defectQuantity: 0 }),
    )
  })

  it('部分入库：本次合计小于剩余 → mode=partial 调接口', async () => {
    const selectedRows = ref([makeRow()])
    const composable = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await composable.openPackagingCompleteDialog()
    composable.packagingCompleteDialog.items[0].inboundQuantities[0] = 50
    await composable.submitPackagingComplete('partial')
    expect(registerFinishingPackagingComplete).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 1, mode: 'partial', tailInboundQty: 50, defectQuantity: 0 }),
    )
  })

  it('全部入库未填满：报错且不调接口', async () => {
    const selectedRows = ref([makeRow()])
    const composable = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await composable.openPackagingCompleteDialog()
    composable.packagingCompleteDialog.items[0].inboundQuantities[0] = 50
    await composable.submitPackagingComplete('full')
    expect(registerFinishingPackagingComplete).not.toHaveBeenCalled()
  })

  it('部分入库超过剩余：报错且不调接口', async () => {
    const selectedRows = ref([makeRow({ tailInboundQty: 70 })])
    const composable = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await composable.openPackagingCompleteDialog()
    // 剩余 30，填 50 应被拦截
    composable.packagingCompleteDialog.items[0].inboundQuantities[0] = 50
    await composable.submitPackagingComplete('partial')
    expect(registerFinishingPackagingComplete).not.toHaveBeenCalled()
  })

  it('remainingQty 暴露给视图', async () => {
    const selectedRows = ref([makeRow({ tailInboundQty: 30, defectQuantity: 5 })])
    const composable = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await composable.openPackagingCompleteDialog()
    const item = composable.packagingCompleteDialog.items[0]
    expect(composable.remainingQty(item)).toBe(100 - 30 - 5)
    expect(composable.alreadyInboundQty(item)).toBe(30)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
cd frontend; npx vitest run src/composables/useFinishingPackaging.spec.ts
```

期望失败：`submitPackagingComplete` 不接受参数 / 不存在 `remainingQty`、`alreadyInboundQty`。

- [ ] **Step 3: 改 composable 让测试通过**

打开 `frontend/src/composables/useFinishingPackaging.ts`。主要改动：

1. 顶部 import 增补 `computed`：`import { reactive, computed, type Ref } from 'vue'`
2. `openPackagingCompleteDialog` 内 `packagingSetInboundToReceived(item)` 一行**改为** `packagingSetZero(item)`（首次进入不再自动填满）。
3. 在返回对象前新增：

```ts
function alreadyInboundQty(item: PackagingCompleteItem): number {
  return Number(item.row.tailInboundQty ?? 0)
}

function alreadyDefectQty(item: PackagingCompleteItem): number {
  return Number(item.row.defectQuantity ?? 0)
}

function remainingQty(item: PackagingCompleteItem): number {
  const received = Number(item.row.tailReceivedQty ?? 0)
  return received - alreadyInboundQty(item) - alreadyDefectQty(item)
}

function batchNoHint(item: PackagingCompleteItem): number | null {
  // 已有累计 > 0 时本次为第 N 批；否则 null
  return alreadyInboundQty(item) + alreadyDefectQty(item) > 0 ? null : null
}
```

`batchNoHint` 第二阶段才需要（详情接口返回 batchNo），先以 null 占位但保留接口。

4. **重写** `submitPackagingComplete`，签名加入 `mode: 'partial' | 'full'`：

```ts
async function submitPackagingComplete(mode: 'partial' | 'full') {
  if (packagingCompleteDialog.items.length === 0) return
  // amend 模式仍走旧校验（inbound + defect === received，覆盖式）
  if (packagingCompleteDialog.mode === 'amend') {
    for (const item of packagingCompleteDialog.items) {
      const perMsg = assertPackagingPerSize(item)
      if (perMsg) {
        ElMessage.warning(perMsg)
        return
      }
      const received = item.row.tailReceivedQty ?? 0
      const sumI = item.inboundQuantities.reduce((a, b) => a + (Number(b) || 0), 0)
      const sumD = defectTotal(item)
      if (sumI + sumD !== received) {
        ElMessage.warning(
          `订单 ${item.row.orderNo}：入库数合计(${sumI})+次品数(${sumD}) 须等于尾部收货数(${received})`,
        )
        return
      }
    }
  } else {
    // register 模式（含分批继续）
    for (const item of packagingCompleteDialog.items) {
      const remaining = remainingQty(item)
      const sumI = item.inboundQuantities.reduce((a, b) => a + (Number(b) || 0), 0)
      const sumD = defectTotal(item)
      const sumThis = sumI + sumD
      if (sumThis <= 0) {
        ElMessage.warning(`订单 ${item.row.orderNo}：本次入库数 + 次品数必须大于 0`)
        return
      }
      if (sumThis > remaining) {
        ElMessage.warning(
          `订单 ${item.row.orderNo}：本次合计(${sumThis})超过剩余可登记数(${remaining})`,
        )
        return
      }
      if (mode === 'full' && sumThis !== remaining) {
        ElMessage.warning(
          `订单 ${item.row.orderNo}：「全部入库」需要填满剩余 ${remaining} 件，当前差 ${remaining - sumThis} 件`,
        )
        return
      }
    }
  }

  packagingCompleteDialog.submitting = true
  try {
    for (const item of packagingCompleteDialog.items) {
      const sumI = item.inboundQuantities.reduce((a, b) => a + (Number(b) || 0), 0)
      const sumD = defectTotal(item)
      await registerFinishingPackagingComplete({
        orderId: item.row.orderId,
        mode: packagingCompleteDialog.mode === 'amend' ? 'full' : mode,
        tailInboundQty: sumI,
        defectQuantity: sumD,
        remark: item.remark?.trim() || undefined,
        tailInboundQuantities: [...item.inboundQuantities],
        defectQuantities: [...item.defectQuantities],
      })
    }
    ElMessage.success(
      packagingCompleteDialog.mode === 'amend'
        ? '已更新入库/次品登记'
        : mode === 'full'
          ? '已登记全部入库，订单进入下一阶段'
          : '已登记本次入库，订单保留在「尾部中」继续等待下一批',
    )
    packagingCompleteDialog.visible = false
    resetPackagingCompleteDialog()
    await reloadList()
    await reloadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '登记入库失败'))
  } finally {
    packagingCompleteDialog.submitting = false
  }
}
```

5. 返回对象暴露 `submitPackagingComplete`、`remainingQty`、`alreadyInboundQty`。

- [ ] **Step 4: 运行测试确认通过**

```powershell
npx vitest run src/composables/useFinishingPackaging.spec.ts
```

期望全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/composables/useFinishingPackaging.ts \
        frontend/src/composables/useFinishingPackaging.spec.ts
git commit -m "feat(finishing): composable 支持 partial/full 双模式与剩余可登记暴露"
```

---

## Task 8 — 前端：弹窗 UI 改造

**Files:**
- Modify: `frontend/src/views/production/finishing.vue:97-100`（按钮文案）、`:276-376`（弹窗）

- [ ] **Step 1: 列表上方按钮文案改名**

把按钮 `登记包装完成` 改为 `登记入库`：

```vue
<el-button @click="openPackagingCompleteDialog">登记入库</el-button>
```

修正模式入口按钮 `修改入库/次品` 文案保持不变。

- [ ] **Step 2: 弹窗标题与说明改写**

```vue
<el-dialog
  v-model="packagingCompleteDialog.visible"
  :title="packagingCompleteDialog.mode === 'amend' ? '修改入库/次品' : '登记入库'"
  width="900px"
  @close="resetPackagingCompleteDialog"
>
  <p v-if="packagingCompleteDialog.mode === 'register'" class="dialog-tip">
    可分多次登记。「部分入库」保留在「尾部中」等待下一批；「全部入库」补齐剩余并推进到「尾部完成」。
  </p>
```

- [ ] **Step 3: 信息区加"已登记 / 剩余"提示**

在每个 item 的渲染块顶部，订单号、SKU 之后追加：

```vue
<div v-if="packagingCompleteDialog.mode === 'register'" class="register-info">
  <div>尾部收货数：{{ item.row.tailReceivedQty ?? 0 }}</div>
  <div v-if="alreadyInboundQty(item) > 0">
    已登记入库：{{ alreadyInboundQty(item) }}
    <el-tag size="small" type="warning">本次为分批续登</el-tag>
  </div>
  <div>剩余可登记：{{ remainingQty(item) }}</div>
</div>
```

在 `<script setup>` 里把 `useFinishingPackaging` 解构出 `alreadyInboundQty`、`remainingQty`，绑定到模板。

- [ ] **Step 4: footer 三按钮替换**

```vue
<template #footer>
  <el-button @click="packagingCompleteDialog.visible = false">取消</el-button>
  <template v-if="packagingCompleteDialog.mode === 'amend'">
    <el-button
      type="primary"
      :loading="packagingCompleteDialog.submitting"
      @click="submitPackagingComplete('full')"
    >保存修改</el-button>
  </template>
  <template v-else>
    <el-button
      :loading="packagingCompleteDialog.submitting"
      @click="submitPackagingComplete('partial')"
    >部分入库</el-button>
    <el-button
      type="primary"
      :loading="packagingCompleteDialog.submitting"
      @click="submitPackagingComplete('full')"
    >全部入库</el-button>
  </template>
</template>
```

- [ ] **Step 5: 启动前后端，浏览器手动验证**

```powershell
pwsh scripts/restart.ps1
```

打开 http://localhost:5173/production/finishing：
1. 选一行「尾部中」状态、`tailInboundQty=0` 的订单 → 点「登记入库」。
2. 弹窗内"剩余可登记 = 100"。
3. 在尺码矩阵填 50 → 点「部分入库」→ 弹窗关闭，列表「尾部入库数」变 50（标签将在 Task 9 出现）。
4. 再选同一行 → 点「登记入库」→ 弹窗提示"已登记入库 50 / 剩余 50" → 填 50 → 点「全部入库」→ 订单消失，出现在「尾部完成」tab。
5. 在另一行尝试 partial 100 → 点「部分入库」→ 系统正常提交并直接推进到「尾部完成」（spec 中"用户填满剩余但点部分入库不打扰"的行为）。
6. 填 50 点「全部入库」→ 警告"全部入库需要填满剩余 100 件"。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/views/production/finishing.vue
git commit -m "feat(finishing): 登记入库弹窗改名并加入部分/全部入库双按钮"
```

---

## Task 9 — 前端：列表「部分入库」标签

**Files:**
- Modify: `frontend/src/components/production/FinishingTable.vue:115-128`

- [ ] **Step 1: 单元格改造**

定位「尾部入库数」列的 cell template，把：

```vue
<el-table-column label="尾部入库数" width="100" align="right">
  <template #default="{ row }">
    <span>{{ row.tailInboundQty != null ? formatDisplayNumber(row.tailInboundQty) : '-' }}</span>
  </template>
</el-table-column>
```

改为：

```vue
<el-table-column label="尾部入库数" width="140" align="right">
  <template #default="{ row }">
    <span>{{ row.tailInboundQty != null ? formatDisplayNumber(row.tailInboundQty) : '-' }}</span>
    <el-tag
      v-if="isPartialBatch(row)"
      size="small"
      type="warning"
      effect="light"
      style="margin-left: 6px"
    >部分入库</el-tag>
  </template>
</el-table-column>
```

在该组件 `<script setup>` 加入：

```ts
import type { FinishingListItem } from '@/api/production-finishing'

function isPartialBatch(row: FinishingListItem): boolean {
  const received = Number(row.tailReceivedQty ?? 0)
  if (received <= 0) return false
  const inb = Number(row.tailInboundQty ?? 0)
  const def = Number(row.defectQuantity ?? 0)
  return inb + def > 0 && inb + def < received
}
```

`margin-left: 6px` 是行内样式，遵守 CLAUDE.md（不动主题、不动私有 CSS 文件）。如需更严格，可挪到组件 `<style scoped>` 块用 class，但 6px 行内对范围最小。

- [ ] **Step 2: 浏览器验证**

回到尾部管理「尾部中」tab。已经分批进行中的订单，「尾部入库数」单元格里数字后应出现橙色 `部分入库` 小标签；未登记和已完成的订单都不显示。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/production/FinishingTable.vue
git commit -m "feat(finishing): 尾部入库数单元格新增「部分入库」标签"
```

---

## Task 10 — 前端：批次记录时间轴

**Files:**
- Create: `frontend/src/composables/useFinishingBatchTimeline.ts`
- Create: `frontend/src/components/production/BatchTimelineSection.vue`
- Modify: 详情抽屉组件（具体文件下一步定位）

- [ ] **Step 1: composable 封装请求**

新建 `frontend/src/composables/useFinishingBatchTimeline.ts`：

```ts
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchFinishingBatches, type FinishingBatchEvent } from '@/api/production-finishing'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export function useFinishingBatchTimeline() {
  const events = ref<FinishingBatchEvent[]>([])
  const loading = ref(false)

  async function load(orderId: number): Promise<void> {
    loading.value = true
    try {
      const res = await fetchFinishingBatches(orderId)
      events.value = Array.isArray(res.data) ? res.data : []
    } catch (e: unknown) {
      events.value = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载批次记录失败'))
    } finally {
      loading.value = false
    }
  }

  return { events, loading, load }
}
```

- [ ] **Step 2: 时间轴展示组件**

新建 `frontend/src/components/production/BatchTimelineSection.vue`：

```vue
<template>
  <div class="batch-timeline">
    <div v-if="loading" class="timeline-loading">加载中...</div>
    <el-empty v-else-if="!events.length" description="暂无批次记录" />
    <el-table v-else :data="events" size="small" border>
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ formatTime(row.occurredAt) }}</template>
      </el-table-column>
      <el-table-column label="动作" width="120">
        <template #default="{ row }">
          <el-tag :type="actionTagType(row.type)" size="small">{{ actionLabel(row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="批次" width="80" align="center">
        <template #default="{ row }">{{ row.batchNo != null ? `第${row.batchNo}批` : '—' }}</template>
      </el-table-column>
      <el-table-column label="数量" width="100" align="right">
        <template #default="{ row }">
          {{ row.type === 'outbound' ? '-' : row.type === 'receive' ? '' : '+' }}{{ row.quantity }}
        </template>
      </el-table-column>
      <el-table-column label="操作人" width="120">
        <template #default="{ row }">{{ row.operatorUsername || '—' }}</template>
      </el-table-column>
      <el-table-column label="领取人" width="120">
        <template #default="{ row }">{{ row.pickupUserName || '—' }}</template>
      </el-table-column>
      <el-table-column label="备注" min-width="160">
        <template #default="{ row }">{{ row.remark || '—' }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import type { FinishingBatchEvent } from '@/api/production-finishing'
import { useFinishingBatchTimeline } from '@/composables/useFinishingBatchTimeline'

const props = defineProps<{ orderId: number | null; active: boolean }>()
const { events, loading, load } = useFinishingBatchTimeline()

watch(
  () => [props.orderId, props.active],
  () => {
    if (props.active && props.orderId != null) {
      void load(props.orderId)
    }
  },
  { immediate: true },
)

function actionLabel(row: FinishingBatchEvent): string {
  if (row.type === 'receive') return '尾部收货'
  if (row.type === 'inbound') return row.sourceType === 'defect' ? '次品入库' : '入库登记'
  return '待仓发货'
}

function actionTagType(type: FinishingBatchEvent['type']): 'success' | 'warning' | 'info' {
  if (type === 'inbound') return 'success'
  if (type === 'outbound') return 'warning'
  return 'info'
}

function formatTime(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.batch-timeline {
  padding: 8px 0;
}
.timeline-loading {
  text-align: center;
  color: var(--el-text-color-secondary);
  padding: 16px 0;
}
</style>
```

- [ ] **Step 3: 接入详情抽屉**

定位尾部管理详情抽屉。先通过 grep 找到展开详情的组件：

```bash
grep -rn "ProductionDetailDrawerShell\|finishing" "E:/1.Cursor-Project/6. hyfsmes/frontend/src/views/production/finishing.vue"
```

在抽屉的 tab 列表（如使用 `<el-tabs>`），增加一个 `pane`：

```vue
<el-tab-pane label="批次记录" name="batches">
  <BatchTimelineSection :order-id="drawerOrderId" :active="activeTab === 'batches'" />
</el-tab-pane>
```

import：

```ts
import BatchTimelineSection from '@/components/production/BatchTimelineSection.vue'
```

如详情抽屉当前没有 tabs 而是平铺，则把 `BatchTimelineSection` 作为一个新分块挂在底部，传入 `:order-id` 和 `:active="true"`。

- [ ] **Step 4: 浏览器验证**

打开尾部管理「尾部完成」或「尾部中」的任意行 → 点「查看」 → 详情抽屉新增「批次记录」页签 → 看到一份倒序时间线（收货、入库、发货依次出现）。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/composables/useFinishingBatchTimeline.ts \
        frontend/src/components/production/BatchTimelineSection.vue \
        frontend/src/views/production/finishing.vue
git commit -m "feat(finishing): 详情抽屉新增「批次记录」时间轴"
```

---

## Task 11 — 端到端验收与文档同步

- [ ] **Step 1: 端到端验收清单**

构造一个新订单走完整流程，逐条勾选：

| # | 步骤 | 期望 |
|---|---|---|
| 1 | 登记收货 100 | `tail_received_qty=100`，订单状态变「尾部中」 |
| 2 | 在「尾部中」选中，点「登记入库」 | 弹窗标题为"登记入库"，剩余 100 |
| 3 | 填 50 → 点「部分入库」 | 列表「尾部入库数」=50 并显示`部分入库`标签；订单仍在「尾部中」 |
| 4 | 待仓处理列表 | 多一条 quantity=50 的 pending |
| 5 | 待仓发货 50 | finished_goods_outbound 多一条；订单仍在「尾部中」 |
| 6 | 再选中该订单点「登记入库」 | 弹窗显示已登记 50、剩余 50、"分批续登"标签 |
| 7 | 填 50 → 点「全部入库」 | 订单从「尾部中」消失，进入「尾部完成」 |
| 8 | 待仓发货剩余 50 | 时间轴完整：收货→入库1→发货1→入库2→发货2，倒序 |
| 9 | full 不填满 | 提示「全部入库需要填满剩余 N 件」 |
| 10 | partial 填 0 | 提示「本次入库数 + 次品数必须大于 0」 |
| 11 | partial 超额 | 提示「本次合计超过剩余可登记数」 |
| 12 | 已完成订单走 amend | 行为同改造前（覆盖式修改） |

- [ ] **Step 2: 更新项目上下文文档**

按 CLAUDE.md 第 8 条「需求级变更完成后轻量同步文档」：在 `docs/PROJECT_CONTEXT.md` 的「四、已完成的重要功能与决策记录」末尾追加一行：

```markdown
- `2026-05-11`：尾部管理支持「分批入库」：同一订单可多次「登记入库」，按本次量累加并写入 inbound_pending 批次行（含 operator_username / batch_no）；列表「尾部入库数」加`部分入库`标签；详情抽屉新增「批次记录」时间轴；已完成订单的修正路径保持原覆盖式语义。
```

- [ ] **Step 3: 提交**

```bash
git add docs/PROJECT_CONTEXT.md
git commit -m "docs: 同步尾部分批入库变更到项目上下文"
```

---

## 自检（执行前由你过一遍）

### Spec 覆盖

| Spec 章节 | 对应 Task |
|---|---|
| §一 操作流程 | Task 2 / Task 7 / Task 8 |
| §二 列表展示 | Task 9 |
| §三 登记入库弹窗 | Task 7 / Task 8 |
| §四 批次记录页签 | Task 4 / Task 5 / Task 10 |
| §五 后端改动 | Task 1 / Task 2 / Task 3 / Task 4 / Task 5 |
| §六 前端改动 | Task 6 / Task 7 / Task 8 / Task 9 / Task 10 |
| §七 测试 | Task 7（前端 composable Vitest）；后端用手动验证替代单测（项目无后端测试框架，Task 2 / Task 5 中含 curl 验证） |

### 占位符扫描

无 TBD / TODO；每个代码步骤都有具体替换内容。

### 类型一致性

- 后端 `'partial' | 'full'` 字面量在 service、controller、前端 API、composable 中统一。
- `FinishingBatchEvent` 前后端字段一一对应。
- `mode` 入参在 controller normalize（非 `'partial'` 默认 `'full'`），前端只传两种合法值。

### 边界与风险

- 历史 `inbound_pending` 行 `batch_no=null` / `operatorUsername=''`：时间线降级展示 `—`。
- 并发：本 plan 未加事务锁，依赖前端按钮 loading 串行化提交（短期可接受）。如出现并发数据竞争，后续单独任务给 `registerPackagingComplete` 加 `SELECT ... FOR UPDATE`。
- 旧 `inbound()` 路径已修 bug，但仍保留作兼容入口。前端不再调用它。

---

## 执行选项

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-finishing-batch.md`.** 两种执行方式：

**1. Subagent-Driven（推荐）** — 我每个 task 派一个 fresh subagent，两阶段 review 后再进下一 task。隔离干净，回归小。

**2. Inline Execution** — 本会话里按 task 顺序执行，分阶段 checkpoint 给你看。

你想选哪种？或者你先看一遍 plan 再决定？
