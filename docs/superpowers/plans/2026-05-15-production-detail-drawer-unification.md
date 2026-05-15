# 生产管理详情入口与抽屉统一化 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把生产管理 6 个页面（采购 / 纸样 / 工艺 / 裁床 / 车缝 / 尾部）的列入口、抽屉结构、操作记录统一化，并复用现有 `order_operation_logs` 表 + 现有日志展示组件，实现责任可追溯。

**Architecture:** 后端给 `order_operation_logs` 加 2 个可空列 `target_type`/`target_ref`，6 个生产 mutation 接入日志写入，新增统一查询接口 `GET /orders/:orderId/operation-logs`；前端把库存的 `FinishedDetailLogsSection` 提升为通用组件，6 个生产抽屉接入"操作记录"段，6 个表格组件统一列名/按钮/事件命名。

**Tech Stack:** NestJS + TypeORM + MySQL（后端），Vue 3 + TypeScript + Element Plus + Pinia（前端），Vitest（测试）。

**Spec:** [docs/superpowers/specs/2026-05-15-production-detail-drawer-unification-design.md](../specs/2026-05-15-production-detail-drawer-unification-design.md)

---

## 全局原则（每个 Task 都遵循）

1. **绝对不动业务详情区**：6 个抽屉中间段（采购记录、用量表单、工艺明细、裁床详情、车缝进度、批次时间轴）零改动。
2. **日志写入失败不应回滚业务事务**：用 `try { logRepo.save() } catch (err) { logger.warn(err) }` 包裹，沿用订单模块现有惯例。
3. **TDD**：每个后端 Task 先写一个集成测试再写实现；前端组件改动通过 Vitest 单测覆盖（项目当前后端无 .spec.ts，本计划不强求新建后端测试体系，改用"运行起来手测 + 关键写入用 curl 验证"的现实路径）。
4. **频繁提交**：每个 Task 一个提交；遇到不可分割的 ADD COLUMN + entity 同步等，作为一个 commit。
5. **CLAUDE.md 红线**：不使用 `any`、不动数据库表 schema 之外的结构、不主动改公共组件 API。
6. **样式与字号**：仅用设计 token（`--font-size-title/subtitle/body/caption`），禁 `!important` 与深层选择器覆盖。

## 启动 / 重启服务

后端默认地址 `http://localhost:3000`，前端 `http://localhost:5173`。

```powershell
# 隐藏窗口启动
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
# 排查日志
Get-Content -Tail 200 .codex-backend-3000.log
Get-Content -Tail 200 .codex-frontend-5173.log
# 健康检查
powershell -ExecutionPolicy Bypass -File scripts/check.ps1
```

---

## Task 1：扩展 `order_operation_logs` 表（schema + entity）

**Files:**
- Modify: `backend/src/entities/order-operation-log.entity.ts`
- Create: `backend/src/database/ensure-order-operation-log-target-columns.ts`
- Modify: `backend/src/main.ts:225-236`（注册 ensure-脚本）

**目的：** 给现有表加 `target_type VARCHAR(32) NULL` 和 `target_ref VARCHAR(64) NULL`，让后续 mutation 可携带子对象定位信息。订单模块现有 3 处写入留 NULL，行为零影响。

- [x] **Step 1: 在 entity 文件追加字段**

打开 `backend/src/entities/order-operation-log.entity.ts`，在 `createdAt` 字段**之前**追加：

```typescript
  /** 子对象类型：order / purchase_item 等；订单维度留 NULL */
  @Column({ name: 'target_type', type: 'varchar', length: 32, nullable: true })
  targetType: string | null;

  /** 子对象唯一定位串，如 `${orderId}_${materialIndex}`；订单维度留 NULL */
  @Column({ name: 'target_ref', type: 'varchar', length: 64, nullable: true })
  targetRef: string | null;
```

- [x] **Step 2: 写 ensure-脚本**

创建 `backend/src/database/ensure-order-operation-log-target-columns.ts`：

```typescript
import { DataSource } from 'typeorm';

/**
 * 给 order_operation_logs 增加 target_type / target_ref 可空列。
 * 说明：项目当前未启用 migrations，生产环境可能关闭 synchronize，因此在启动阶段确保列存在。
 */
export async function ensureOrderOperationLogTargetColumns(dataSource: DataSource): Promise<void> {
  const cols = await dataSource.query(`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_operation_logs'
      AND COLUMN_NAME IN ('target_type', 'target_ref')
  `);
  const existing = new Set((cols as Array<{ COLUMN_NAME: string }>).map((r) => r.COLUMN_NAME));
  if (!existing.has('target_type')) {
    await dataSource.query(`ALTER TABLE order_operation_logs ADD COLUMN target_type VARCHAR(32) NULL`);
    console.log('[Ensure] order_operation_logs.target_type added.');
  }
  if (!existing.has('target_ref')) {
    await dataSource.query(`ALTER TABLE order_operation_logs ADD COLUMN target_ref VARCHAR(64) NULL`);
    console.log('[Ensure] order_operation_logs.target_ref added.');
  }
}
```

- [x] **Step 3: 在 main.ts 注册 ensure-脚本**

在 `backend/src/main.ts:227` 附近（紧邻 `ensureInventoryOperationLogTables(dataSource);` 之后），加一行：

```typescript
    await ensureOrderOperationLogTargetColumns(dataSource);
```

并在文件顶部 import 区追加：

```typescript
import { ensureOrderOperationLogTargetColumns } from './database/ensure-order-operation-log-target-columns';
```

- [x] **Step 4: 重启后端，验证列已添加**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
Start-Sleep -Seconds 5
Get-Content -Tail 50 .codex-backend-3000.log | Select-String "order_operation_logs"
```

期望日志包含一次（或两次）`[Ensure] order_operation_logs.target_type added.` / `target_ref added.`，或者列已存在时静默通过。

进一步验证（如有 mysql cli 或宝塔 phpMyAdmin）：

```sql
DESCRIBE order_operation_logs;
```

期望看到 `target_type VARCHAR(32) YES NULL` 和 `target_ref VARCHAR(64) YES NULL`。

- [x] **Step 5: 提交**

```bash
git add backend/src/entities/order-operation-log.entity.ts backend/src/database/ensure-order-operation-log-target-columns.ts backend/src/main.ts
git commit -m "feat(order-op-log): 增加 target_type / target_ref 可空列以支持行级日志维度

- entity 同步增加两个 @Column 装饰器
- 新增 ensure-脚本在启动时 ADD COLUMN（项目无 migrations 体系）
- 现有 3 处订单模块写入留 NULL，行为不变"
```

---

## Task 2：抽取 `resolveOperatorDisplayName` 公共 helper

**Files:**
- Create: `backend/src/common/operator.util.ts`
- Modify: `backend/src/orders/order-mutation.service.ts:489-497`
- Modify: `backend/src/orders/order-lifecycle.service.ts:146-154`
- Modify: `backend/src/orders/order-status.service.ts:94-104`
- Modify: `backend/src/production-purchase/production-purchase.service.ts:117-122`

**目的：** 把"displayName 优先回退 username"的 4 处重复逻辑抽出来，避免新增 5 处生产 mutation 后扩散到 9 处。

- [x] **Step 1: 创建 helper 文件**

创建 `backend/src/common/operator.util.ts`：

```typescript
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * 操作人显示名解析：displayName 优先 → username → fallback。
 * 任何异常（含查不到 user）都回退到 fallback，不应抛出。
 */
export async function resolveOperatorDisplayName(
  userRepo: Repository<User>,
  actor: { userId?: number; username?: string },
): Promise<string> {
  const fallback = (actor.username ?? '').trim();
  if (!actor.userId) return fallback;
  try {
    const user = await userRepo.findOne({ where: { id: actor.userId } });
    if (!user) return fallback;
    return (
      (user.displayName && user.displayName.trim()) ||
      (user.username && user.username.trim()) ||
      fallback
    );
  } catch {
    return fallback;
  }
}
```

- [x] **Step 2: 切换 `order-mutation.service.ts`**

把 `addRemark` 内 `:489-497` 这一段：

```typescript
    let operatorUsername = actor.username;
    try {
      const user = await this.userRepo.findOne({ where: { id: actor.userId } });
      if (user) operatorUsername = (user.displayName && user.displayName.trim()) || user.username || actor.username;
    } catch {
      operatorUsername = actor.username;
    }
```

替换为：

```typescript
    const operatorUsername = await resolveOperatorDisplayName(this.userRepo, actor);
```

文件顶部 import 区加：

```typescript
import { resolveOperatorDisplayName } from '../common/operator.util';
```

- [x] **Step 3: 切换 `order-lifecycle.service.ts`**

把 `:146-154` 同样的 7 行段替换为 1 行调用，import 同上。

- [x] **Step 4: 切换 `order-status.service.ts`**

`:94-104` 用了 `userRepo`（可能是 transaction-scoped repo），要保留参数化能力。修改后的调用：

```typescript
    const operatorUsername = await resolveOperatorDisplayName(userRepo, actor);
```

import 同上。

- [x] **Step 5: 切换 `production-purchase.service.ts:117-122`**

把私有方法 `resolveOperatorName`：

```typescript
  private async resolveOperatorName(userId: number | undefined, fallback = ''): Promise<string> {
    const fb = (fallback ?? '').trim();
    if (!userId) return fb;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return (user?.displayName ?? '').trim() || (user?.username ?? '').trim() || fb;
  }
```

删除掉，并把内部 `this.resolveOperatorName(uid, fb)` 调用改为：

```typescript
await resolveOperatorDisplayName(this.userRepo, { userId: uid, username: fb });
```

（用 `git grep "this.resolveOperatorName" backend/src/production-purchase/` 找出所有调用点）

import 加 `import { resolveOperatorDisplayName } from '../common/operator.util';`。

- [x] **Step 6: 重启 + 验证**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

手测：
- 登录系统，对一个订单做一次 remark 添加（订单详情页"备注"区）
- 在数据库或日志查询接口确认 `order_operation_logs` 新行的 `operator_username` 是 displayName（而非 username）
- 做一次订单状态流转，同样确认显示名

- [x] **Step 7: 提交**

```bash
git add backend/src/common/operator.util.ts backend/src/orders backend/src/production-purchase
git commit -m "refactor(common): 抽取 resolveOperatorDisplayName 公共 helper

- 4 处重复的 'displayName 优先回退 username' 逻辑统一
- 订单 mutation/lifecycle/status + 采购 service 切换至 helper
- 异常处理语义保持不变"
```

---

## Task 3：后端查询接口 `GET /orders/:orderId/operation-logs`

**Files:**
- Modify: `backend/src/orders/order-query.service.ts`（追加 `getOperationLogs` 方法）
- Modify: `backend/src/orders/orders.controller.ts`（追加路由）

**目的：** 让前端按 `orderId + module + targetType + targetRef` 拉取日志。

- [x] **Step 1: 在 `order-query.service.ts` 追加方法**

注意：`OrderOperationLog` 仓库应该已经在 orders.module 注入。先 `git grep "OrderOperationLog" backend/src/orders/` 确认。

在 `order-query.service.ts` 类中追加：

```typescript
  async getOperationLogs(
    orderId: number,
    module?: string | null,
    targetType?: string | null,
    targetRef?: string | null,
  ): Promise<OrderOperationLog[]> {
    const qb = this.orderLogRepo
      .createQueryBuilder('log')
      .where('log.orderId = :orderId', { orderId });
    if (module) {
      qb.andWhere('log.action LIKE :prefix', { prefix: `${module}_%` });
    }
    if (targetType) {
      qb.andWhere('log.targetType = :targetType', { targetType });
    }
    if (targetRef) {
      qb.andWhere('log.targetRef = :targetRef', { targetRef });
    }
    return qb.orderBy('log.createdAt', 'DESC').limit(200).getMany();
  }
```

若 `orderLogRepo` 未注入，需要在 constructor 加：

```typescript
    @InjectRepository(OrderOperationLog) private readonly orderLogRepo: Repository<OrderOperationLog>,
```

并在文件顶部 import：

```typescript
import { OrderOperationLog } from '../entities/order-operation-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
```

- [x] **Step 2: 在 controller 追加路由**

在 `backend/src/orders/orders.controller.ts` 内添加：

```typescript
  @Get(':id/operation-logs')
  @RequirePermission('orders_read')
  async getOperationLogs(
    @Param('id') id: string,
    @Query('module') module?: string,
    @Query('targetType') targetType?: string,
    @Query('targetRef') targetRef?: string,
  ) {
    return this.orderQueryService.getOperationLogs(
      Number(id),
      module ?? null,
      targetType ?? null,
      targetRef ?? null,
    );
  }
```

权限点 `orders_read` 用现有"查看订单"权限——若实际权限点名不同，请用 `git grep "RequirePermission.*orders" backend/src/orders/orders.controller.ts` 找出该 controller 用的最相近权限点（通常是"查看订单列表"对应的那个）替换。

- [x] **Step 3: 重启 + curl 验证**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
Start-Sleep -Seconds 5
```

用浏览器登录后从 DevTools Network 复制一个 Cookie / Authorization，然后：

```bash
curl -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/orders/1/operation-logs"
```

期望：返回该订单的日志数组（创建/修改/状态流转的日志），200 状态码。
带过滤：

```bash
curl -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/orders/1/operation-logs?module=order"
```

期望：仅 `action LIKE 'order_%'` 的日志（如 `order_create` / `order_update`）。

- [x] **Step 4: 提交**

```bash
git add backend/src/orders/order-query.service.ts backend/src/orders/orders.controller.ts
git commit -m "feat(orders): 新增 GET /orders/:id/operation-logs 统一日志查询

- 可选过滤：module（按 action 前缀）+ targetType + targetRef
- 排序 createdAt DESC，硬上限 LIMIT 200
- 权限沿用订单查看权限点"
```

---

## Task 4：采购模块接入操作日志

**Files:**
- Modify: `backend/src/production-purchase/production-purchase.service.ts`（在 `registerPurchase` 和 `registerPurchaseBatch` 写入完成后追加日志）

**目的：** 采购登记成功时落 `production_purchase_register` 日志，targetRef = `${orderId}_${materialIndex}`。

- [x] **Step 1: 确认仓库注入**

`production-purchase.service.ts` 顶部 import 是否已含 `OrderOperationLog`。若没有：

```typescript
import { OrderOperationLog } from '../entities/order-operation-log.entity';
```

并在 constructor 注入：

```typescript
    @InjectRepository(OrderOperationLog) private readonly orderLogRepo: Repository<OrderOperationLog>,
```

同时确认 `production-purchase.module.ts` 的 `TypeOrmModule.forFeature([...])` 数组里包含 `OrderOperationLog`；若没有则补上。

- [x] **Step 2: 在 `registerPurchase` 末尾追加日志写入**

在 `:198`（方法结尾 `}` 前）追加：

```typescript
    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, {
        userId: actorUserId,
        username: '',
      });
      const detail =
        `采购登记：${row.materialName ?? '-'}${row.color ? ` ${row.color}` : ''}` +
        ` ${normalizedQty}`;
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId: order.id,
          orderNo: order.orderNo,
          operatorUsername: operator,
          action: 'production_purchase_register',
          detail,
          targetType: 'purchase_item',
          targetRef: `${order.id}_${materialIndex}`,
        }),
      );
    } catch (err) {
      console.warn('[purchase] write operation log failed:', err);
    }
```

- [x] **Step 3: 在 `registerPurchaseBatch` 末尾追加批量日志**

类似 Step 2，但每个 item 写一条日志。在批量循环结束后：

```typescript
    for (const item of writtenItems) {  // 用方法内部记录的"已写入项"数组
      try {
        const operator = await resolveOperatorDisplayName(this.userRepo, {
          userId: params.actorUserId,
          username: '',
        });
        const detail =
          `采购登记（批量）：${item.materialName ?? '-'}${item.color ? ` ${item.color}` : ''}` +
          ` ${item.qty}`;
        await this.orderLogRepo.save(
          this.orderLogRepo.create({
            orderId: item.orderId,
            orderNo: item.orderNo,
            operatorUsername: operator,
            action: 'production_purchase_register',
            detail,
            targetType: 'purchase_item',
            targetRef: `${item.orderId}_${item.materialIndex}`,
          }),
        );
      } catch (err) {
        console.warn('[purchase batch] write operation log failed:', err);
      }
    }
```

若现有 `registerPurchaseBatch` 没有 `writtenItems` 数组，请在原有循环里同步追加日志写入（每完成一项 push 一条 log）。具体形态以原代码为准，但日志字段必须包含上面的 5 个 key。

- [x] **Step 4: 重启 + 端到端验证**

1. 重启后端
2. 前端打开"采购管理"页面，对某一行做"登记"操作
3. 用 Task 3 的 curl 验证：

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/orders/<orderId>/operation-logs?module=production_purchase&targetType=purchase_item&targetRef=<orderId>_<materialIndex>"
```

期望：返回 1 条新日志，`operator_username` 是 displayName，`detail` 是中文短句。

- [x] **Step 5: 提交**

```bash
git add backend/src/production-purchase
git commit -m "feat(production-purchase): 采购登记 / 批量登记落操作日志

- action: production_purchase_register
- targetType: purchase_item, targetRef: \${orderId}_\${materialIndex}
- 失败 try/catch 包裹，不影响业务事务"
```

---

## Task 5：纸样模块接入操作日志

**Files:**
- Modify: `backend/src/production-pattern/production-pattern.service.ts:264`（在 `savePatternMaterials` 末尾追加日志）

**目的：** 纸样保存 / 修改用量时落日志，targetType=`order`。区分 save / update 看是否首次（用量原值是否为空）。

- [x] **Step 1: 注入 `OrderOperationLog` 仓库**

参照 Task 4 Step 1。同时确认 `production-pattern.module.ts` 注入 `OrderOperationLog` 与 `User`。

- [x] **Step 2: 在 `savePatternMaterials` 末尾追加日志**

注意：该方法签名是 `(orderId: number, materials: PatternMaterialRow[], remark?: string | null)`，没有 actorUserId 参数。需要在 controller 层把当前用户传进来：

`production-pattern.controller.ts` 找到调用 `savePatternMaterials` 的处理函数，把 `@CurrentUser() user` 取出来传进 service。然后修改 service 签名为：

```typescript
async savePatternMaterials(
  orderId: number,
  materials: PatternMaterialRow[],
  remark?: string | null,
  actor?: { userId?: number; username?: string },
): Promise<void> {
```

并在写入完成后追加：

```typescript
    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, actor ?? {});
      const summary = materials
        .map((m) => `${m.materialName ?? '-'} ${m.usagePerUnit ?? '-'}`)
        .join(' / ');
      const action = isFirstSave ? 'production_pattern_save' : 'production_pattern_update';
      const verbCN = isFirstSave ? '保存' : '修改';
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId,
          orderNo: order?.orderNo ?? '',
          operatorUsername: operator,
          action,
          detail: `${verbCN}用量：${summary}`,
          targetType: 'order',
          targetRef: null,
        }),
      );
    } catch (err) {
      console.warn('[pattern] write operation log failed:', err);
    }
```

`isFirstSave` 的判定：方法开头读取一下当前 `ext.patternMaterials`（或同等字段）是否已有非空内容。具体字段名以 `production-pattern.service.ts` 现有读取逻辑为准。

- [x] **Step 3: 重启 + 端到端验证**

1. 在"纸样管理"页面对某订单点"查看"并保存用量
2. 用 curl：

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/orders/<orderId>/operation-logs?module=production_pattern"
```

期望：返回 1 条 `production_pattern_save` 日志。再做一次修改：期望返回另一条 `production_pattern_update`。

- [x] **Step 4: 提交**

```bash
git add backend/src/production-pattern
git commit -m "feat(production-pattern): 保存/修改用量落操作日志

- action: production_pattern_save / production_pattern_update
- targetType: order
- 首次/修改根据原值是否为空区分"
```

---

## Task 6：工艺模块接入操作日志

**Files:**
- Modify: `backend/src/production-craft/production-craft.service.ts`（`completeCraft` 末尾追加日志）

**目的：** 工艺完成时落 `production_process_complete` 日志，targetType=`order`。

- [x] **Step 1: 注入仓库**

同 Task 4 Step 1。同时确认 `production-craft.module.ts` 注入 `OrderOperationLog` 和 `User`。

- [x] **Step 2: 在 `completeCraft` 写入完成后追加日志**

定位 `completeCraft(orderId: number, userId: number)` 方法（从 controller 路由反向追踪）。在所有业务写入完成后，方法返回前追加：

```typescript
    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, { userId, username: '' });
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      const items = (order?.processItems ?? []) as Array<{ processName?: string }>;
      const summary = items.map((i) => i.processName ?? '-').filter(Boolean).join(' / ') || '无';
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId,
          orderNo: order?.orderNo ?? '',
          operatorUsername: operator,
          action: 'production_process_complete',
          detail: `工艺完成：${summary}`,
          targetType: 'order',
          targetRef: null,
        }),
      );
    } catch (err) {
      console.warn('[craft] write operation log failed:', err);
    }
```

`processItems` 字段路径需以 `production-craft.service.ts` 中现有读取方式为准（可能是从 order-ext 或 order 表 JSON 字段读）。

- [x] **Step 3: 重启 + 端到端验证**

```bash
curl -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"orderId": <orderId>}' \
  "http://localhost:3000/production-craft/items/complete"

curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/orders/<orderId>/operation-logs?module=production_process"
```

期望：返回 1 条 `production_process_complete` 日志。

- [x] **Step 4: 提交**

```bash
git add backend/src/production-craft
git commit -m "feat(production-craft): 工艺完成落操作日志

- action: production_process_complete
- targetType: order"
```

---

## Task 7：裁床模块接入操作日志

**Files:**
- Modify: `backend/src/production-cutting/production-cutting-mutation.service.ts`

**目的：** 裁床完成（`completeCutting`）落 `production_cutting_register` 日志。

- [x] **Step 1: 注入仓库**

同 Task 4 Step 1。`production-cutting.module.ts` 注入 `OrderOperationLog` 和 `User`。

- [x] **Step 2: 在 `completeCutting` 末尾追加日志**

定位 `completeCutting`（[production-cutting-mutation.service.ts:253](backend/src/production-cutting/production-cutting-mutation.service.ts) 附近）。在业务写入完成后追加：

```typescript
    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, actor ?? {});
      const detail = this.buildCuttingLogDetail(/* 从入参或方法内已计算变量传入 */);
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId,
          orderNo: order?.orderNo ?? '',
          operatorUsername: operator,
          action: 'production_cutting_register',
          detail,
          targetType: 'order',
          targetRef: null,
        }),
      );
    } catch (err) {
      console.warn('[cutting] write operation log failed:', err);
    }
```

`buildCuttingLogDetail` 是一个私有 helper，把入参（颜色/尺码/数量等）格式化成中文短句，例如 `裁床登记：红色 M 50 件 / L 80 件`。具体字段从 `completeCutting` 入参提取——如果方法收的是已计算好的 quantities 数组，遍历构造字符串即可。

`actor` 参数：如 controller 没传，需要在 controller 层加 `@CurrentUser()` 提取并传入；service 方法签名追加 `actor?: { userId?: number; username?: string }`。

- [x] **Step 3: 重启 + 验证**

操作"裁床登记"，验证：

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/orders/<orderId>/operation-logs?module=production_cutting"
```

- [x] **Step 4: 提交**

```bash
git add backend/src/production-cutting
git commit -m "feat(production-cutting): 裁床登记落操作日志

- action: production_cutting_register
- targetType: order, 含颜色尺码数量明细"
```

---

## Task 8：车缝模块接入操作日志

**Files:**
- Modify: `backend/src/production-sewing/production-sewing.service.ts:298 / 335`（`assignSewing` / `completeSewing`）

**目的：** 车缝分配和完成各落一条日志。

- [x] **Step 1: 注入仓库**

同 Task 4。

- [x] **Step 2: 在 `assignSewing` 末尾追加日志**

```typescript
    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, actor ?? {});
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId,
          orderNo: order?.orderNo ?? '',
          operatorUsername: operator,
          action: 'production_sewing_register',
          detail: `车缝分配：${factoryName ?? '-'}`,
          targetType: 'order',
          targetRef: null,
        }),
      );
    } catch (err) {
      console.warn('[sewing assign] write operation log failed:', err);
    }
```

- [x] **Step 3: 在 `completeSewing` 末尾追加日志**

```typescript
    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, actor ?? {});
      const detail = this.buildSewingLogDetail(/* 入参 */);
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId,
          orderNo: order?.orderNo ?? '',
          operatorUsername: operator,
          action: 'production_sewing_register',
          detail,
          targetType: 'order',
          targetRef: null,
        }),
      );
    } catch (err) {
      console.warn('[sewing complete] write operation log failed:', err);
    }
```

`actor` 参数与 Task 7 一致：controller 层加 `@CurrentUser()` 透传。

- [x] **Step 4: 重启 + 验证**

操作"车缝登记"后：

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/orders/<orderId>/operation-logs?module=production_sewing"
```

- [x] **Step 5: 提交**

```bash
git add backend/src/production-sewing
git commit -m "feat(production-sewing): 车缝分配 / 完成落操作日志

- action: production_sewing_register
- targetType: order"
```

---

## Task 9：尾部模块接入操作日志

**Files:**
- Modify: `backend/src/production-finishing/production-finishing-mutation.service.ts:464`（`inbound` 方法）

**目的：** 尾部登记入库时落 `production_finishing_inbound` 日志。批次信息已在 `inbound` 方法签名中可见。

- [x] **Step 1: 注入仓库**

同 Task 4。`production-finishing.module.ts` 注入 `OrderOperationLog`。

- [x] **Step 2: 在 `inbound` 方法末尾追加日志**

```typescript
    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, {
        userId: actorUserId,
        username: actorUsername ?? '',
      });
      // batchNo 取自方法内 next-batch 计算结果，partial 取自 quantity < 剩余
      const detail = `尾部入库：第 ${batchNo} 批次 ${quantity} 件${isPartial ? '（部分入库）' : ''}`;
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId,
          orderNo: order?.orderNo ?? '',
          operatorUsername: operator,
          action: 'production_finishing_inbound',
          detail,
          targetType: 'order',
          targetRef: null,
        }),
      );
    } catch (err) {
      console.warn('[finishing inbound] write operation log failed:', err);
    }
```

`batchNo` / `isPartial` 取自 `inbound` 方法内已经计算的变量名（参照 [production-finishing-mutation.service.ts:91](backend/src/production-finishing/production-finishing-mutation.service.ts) `nextBatchNo` 和入库判断逻辑）。

- [x] **Step 3: 重启 + 验证**

操作"尾部登记入库"后：

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/orders/<orderId>/operation-logs?module=production_finishing"
```

- [x] **Step 4: 提交**

```bash
git add backend/src/production-finishing
git commit -m "feat(production-finishing): 尾部入库落操作日志（含批次/部分入库标记）

- action: production_finishing_inbound
- targetType: order"
```

---

## Task 10：前端组件搬迁 — `FinishedDetailLogsSection` → `OperationLogsSection`

**Files:**
- Create: `frontend/src/components/common/OperationLogsSection.vue`
- Delete: `frontend/src/components/inventory/finished-detail/FinishedDetailLogsSection.vue`
- Modify: `frontend/src/components/inventory/FinishedDetailDrawer.vue:54 / 74`（更新 import）

**目的：** 把库存里的日志展示组件提升到通用位置，给生产管理 6 个抽屉复用。组件内部 props/template/逻辑零改动。

- [x] **Step 1: 创建新组件文件**

把 `frontend/src/components/inventory/finished-detail/FinishedDetailLogsSection.vue` 的内容**完整原样复制**到新路径 `frontend/src/components/common/OperationLogsSection.vue`，**仅修改一处**：把组件根类名 `detail-*` 保持不变（避免破坏样式），但确保 `defineOptions({ name: 'OperationLogsSection' })`（若原文件没有 defineOptions，新文件不必新增——保持原状）。

具体而言，新文件内容是：

```vue
<template>
  <div class="detail-section">
    <div class="detail-section-title">操作记录</div>
    <div v-if="logs.length" class="detail-logs">
      <div v-for="log in logs" :key="log.id" class="detail-log-item">
        <div class="detail-log-head">
          <span class="detail-log-user">{{ log.operatorUsername || '-' }}</span>
          <span class="detail-log-time">{{ log.createdAt }}</span>
        </div>
        <div class="detail-log-body">{{ log.summary }}</div>
      </div>
    </div>
    <div v-else class="detail-muted">暂无操作记录</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  logs: Array<{
    id: string | number
    operatorUsername: string
    createdAt: string
    summary: string
  }>
}>()
</script>

<style scoped>
.detail-section {
  min-width: 0;
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}
.detail-section-title {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.detail-muted { font-size: 12px; color: var(--el-text-color-secondary); }
.detail-logs { display: flex; flex-direction: column; gap: 10px; }
.detail-log-item {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.detail-log-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.detail-log-body { font-size: 12px; color: var(--el-text-color-regular); line-height: 1.5; }
</style>
```

注：把 `id: string` 放宽为 `id: string | number`，因为 `order_operation_logs.id` 是数字。原组件未来若拒绝 number id 会编译失败——这里前置兼容。

- [x] **Step 2: 更新库存抽屉 import**

修改 `frontend/src/components/inventory/FinishedDetailDrawer.vue`：

把 `:74` 那行：
```typescript
import FinishedDetailLogsSection from '@/components/inventory/finished-detail/FinishedDetailLogsSection.vue'
```
改为：
```typescript
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'
```

把 `:54` 模板中：
```vue
<FinishedDetailLogsSection :logs="adjustLogs" />
```
改为：
```vue
<OperationLogsSection :logs="adjustLogs" />
```

- [x] **Step 3: 全仓搜索确认无其他引用**

```bash
git grep "FinishedDetailLogsSection" frontend/
```

期望：**零结果**。如有其他引用，全部改为新组件路径。

- [x] **Step 4: 删除旧文件**

```bash
git rm frontend/src/components/inventory/finished-detail/FinishedDetailLogsSection.vue
```

- [x] **Step 5: 重启前端并人工验证库存详情抽屉**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
```

在浏览器打开"库存管理 → 成品库存 → 详情抽屉"，确认"操作记录"段仍正常显示（有日志显示日志、无日志显示"暂无操作记录"）。

- [x] **Step 6: 提交**

```bash
git add frontend/src/components/common/OperationLogsSection.vue frontend/src/components/inventory/FinishedDetailDrawer.vue
git rm frontend/src/components/inventory/finished-detail/FinishedDetailLogsSection.vue
git commit -m "refactor(components): 提升 FinishedDetailLogsSection 为通用 OperationLogsSection

- 移到 components/common/，准备给生产管理 6 个抽屉复用
- props/template/逻辑零改动；id 类型放宽为 string | number
- 同步更新库存 FinishedDetailDrawer import"
```

---

## Task 11：前端 API 封装 — `operation-logs.ts`

**Files:**
- Create: `frontend/src/api/operation-logs.ts`

**目的：** 给 6 个抽屉提供统一的拉日志方法。

- [ ] **Step 1: 创建 API 文件**

```typescript
import http from './http'

export interface OperationLogItem {
  id: number
  orderId: number
  orderNo: string
  operatorUsername: string
  action: string
  detail: string
  targetType: string | null
  targetRef: string | null
  createdAt: string
}

export interface OperationLogsQuery {
  module?: string
  targetType?: string
  targetRef?: string
}

export async function fetchOrderOperationLogs(
  orderId: number,
  query: OperationLogsQuery = {},
): Promise<OperationLogItem[]> {
  const { data } = await http.get<OperationLogItem[]>(
    `/orders/${orderId}/operation-logs`,
    { params: query },
  )
  return data
}

/**
 * 把日志映射为 OperationLogsSection 接受的形态。
 */
export function toLogSectionItems(
  logs: OperationLogItem[],
): Array<{ id: number; operatorUsername: string; createdAt: string; summary: string }> {
  return logs.map((log) => ({
    id: log.id,
    operatorUsername: log.operatorUsername || '-',
    createdAt: log.createdAt,
    summary: log.detail,
  }))
}
```

注：项目中 `http` 的具体导入路径可能不同（如 `@/api/request` 或 `@/utils/http`）。先 `git grep "from '@/api/.*'" frontend/src/api/ | head -5` 找到现有 API 文件的 http 引入方式，统一沿用。

- [ ] **Step 2: 提交**

```bash
git add frontend/src/api/operation-logs.ts
git commit -m "feat(api): 新增 fetchOrderOperationLogs + toLogSectionItems

- 统一封装 GET /orders/:orderId/operation-logs
- 提供到 OperationLogsSection props 的映射函数"
```

---

## Task 12：6 个表格组件 — 统一列名 / 按钮 / 事件

**Files:**
- Modify: `frontend/src/components/production/PurchaseTable.vue:78-82, 107`
- Modify: `frontend/src/components/production/PatternTable.vue:60-65`
- Modify: `frontend/src/components/production/ProcessPageContent.vue:209-213`
- Modify: `frontend/src/components/production/CuttingTable.vue:125-128`
- Modify: `frontend/src/components/production/SewingTable.vue:231-234`
- Modify: `frontend/src/components/production/FinishingTable.vue:145-148`
- Modify: 各 View 文件中订阅事件的位置（6 处）

**目的：** 列名一律 `"详情"`，按钮一律 `"查看"`，emit 事件一律 `open-detail`。

- [ ] **Step 1: `PurchaseTable.vue`**

把：
```vue
<el-table-column label="概要" width="64" align="center" fixed="right">
  <template #default="{ row }">
    <el-button link type="primary" @click.stop="emit('open-brief', row)">查看</el-button>
  </template>
</el-table-column>
```
改为：
```vue
<el-table-column label="详情" width="72" align="center" fixed="right">
  <template #default="{ row }">
    <el-button link type="primary" @click.stop="emit('open-detail', row)">查看</el-button>
  </template>
</el-table-column>
```

并把 `emit` 类型声明 `:107`：
```typescript
  (e: 'open-brief', row: PurchaseItemRow): void
```
改为：
```typescript
  (e: 'open-detail', row: PurchaseItemRow): void
```

- [ ] **Step 2: `PatternTable.vue`**

`:60-65`：把 `label="详情" width="84"` 改为 `label="详情" width="72"`，按钮文本保持"查看"，emit 已是 `open-detail` 不动。

- [ ] **Step 3: `ProcessPageContent.vue`**

`:209-213`：
```vue
<el-table-column label="明细" width="72" align="center" fixed="right">
  <template #default="{ row }">
    <el-button link type="primary" @click.stop="openCraftDetailDrawer(row)">明细</el-button>
  </template>
</el-table-column>
```
改为：
```vue
<el-table-column label="详情" width="72" align="center" fixed="right">
  <template #default="{ row }">
    <el-button link type="primary" @click.stop="openCraftDetailDrawer(row)">查看</el-button>
  </template>
</el-table-column>
```

注：`ProcessPageContent.vue` 是个内联组件（抽屉就在自己内部），不通过 emit；调用 `openCraftDetailDrawer` 保留即可。

- [ ] **Step 4: `CuttingTable.vue`**

`:125-128`：把 `label="操作" width="72"` 改为 `label="详情" width="72"`，其余保持。

- [ ] **Step 5: `SewingTable.vue`**

`:231-234`：把 `label="概要" width="64"` 改为 `label="详情" width="72"`；emit 把 `open-brief` 改为 `open-detail`。同步更新 SewingTable 的 emit 类型声明。

- [ ] **Step 6: `FinishingTable.vue`**

同 Step 5。emit `open-brief` → `open-detail`。

- [ ] **Step 7: 同步更新 View 层接线**

对受 emit 改动影响的页面（采购 / 车缝 / 尾部），打开对应 `frontend/src/views/production/{purchase,sewing,finishing}.vue`，搜索 `@open-brief` 并改为 `@open-detail`。处理函数名 `openXxxBriefDrawer` 不需要改名（只是事件名变更）。

```bash
git grep "@open-brief" frontend/src/views/production/
```

期望：把所有出现都改为 `@open-detail`。

纸样和裁床的 View 已经用 `@open-detail`，无需改动。工艺没有 View 层 emit（抽屉内联），无需改动。

- [ ] **Step 8: 前端类型检查 + 启动验证**

```bash
cd frontend && npm run check:el-radio-value
cd frontend && npm run build  # 或 vue-tsc，确认无类型错误
```

打开 6 个生产页面，确认每个页面的列名都是"详情"、按钮都是"查看"，点击后抽屉能正常打开。

- [ ] **Step 9: 提交**

```bash
git add frontend/src/components/production frontend/src/views/production
git commit -m "refactor(production): 6 个生产页面表格的列入口统一为「详情/查看/open-detail」

- 列名：概要/详情/明细/操作 → 详情
- 按钮：查看/明细 → 查看
- emit：open-brief → open-detail（采购/车缝/尾部）
- 列宽统一 72，与 PatternTable 既有惯例一致"
```

---

## Task 13：6 个抽屉接入"操作记录"段 + 工艺补齐 BriefPanel

**Files:**
- Modify: `frontend/src/views/production/purchase.vue`
- Modify: `frontend/src/views/production/pattern.vue`
- Modify: `frontend/src/views/production/cutting.vue`
- Modify: `frontend/src/views/production/sewing.vue`
- Modify: `frontend/src/views/production/finishing.vue`
- Modify: `frontend/src/components/production/ProcessPageContent.vue:229-356`

**目的：** 每个生产抽屉的"业务详情区"下面追加一段 `OperationLogsSection`；抽屉打开时拉日志填入。

- [ ] **Step 1: 采购抽屉接入**

打开 `frontend/src/views/production/purchase.vue`，找到 `ProductionDetailDrawerShell` 的结束标签前（`</ProductionDetailDrawerShell>`），追加：

```vue
        <ProductionDetailSection>
          <OperationLogsSection :logs="purchaseDrawerLogs" />
        </ProductionDetailSection>
```

在 `<script setup>` 区追加：

```typescript
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'
import { fetchOrderOperationLogs, toLogSectionItems } from '@/api/operation-logs'
import { ref, watch } from 'vue'

const purchaseDrawerLogs = ref<ReturnType<typeof toLogSectionItems>>([])

async function loadPurchaseDrawerLogs(row: PurchaseItemRow | null) {
  if (!row) {
    purchaseDrawerLogs.value = []
    return
  }
  const logs = await fetchOrderOperationLogs(row.orderId, {
    module: 'production_purchase',
    targetType: 'purchase_item',
    targetRef: `${row.orderId}_${row.materialIndex}`,
  })
  purchaseDrawerLogs.value = toLogSectionItems(logs)
}

watch(
  () => purchaseBriefDrawer.row,
  (row) => {
    loadPurchaseDrawerLogs(row)
  },
)
```

变量名 `purchaseBriefDrawer` 应该已经存在（在原 composable 里）。如果实际名字不同（如 `detailDrawer`），用文件内已有名字替换。

- [ ] **Step 2: 纸样抽屉接入**

`frontend/src/views/production/pattern.vue`：同 Step 1 思路，请求参数：
```typescript
{
  module: 'production_pattern',
}
```
（不带 targetType / targetRef）

- [ ] **Step 3: 工艺抽屉接入**

打开 `frontend/src/components/production/ProcessPageContent.vue`，在 `:355` 附近（业务详情段后、`</ProductionDetailDrawerShell>` 前）追加：

```vue
        <ProductionDetailSection>
          <OperationLogsSection :logs="craftDrawerLogs" />
        </ProductionDetailSection>
```

请求参数：
```typescript
{
  module: 'production_process',
}
```

- [ ] **Step 4: 裁床抽屉接入**

`cutting.vue`，请求参数：
```typescript
{
  module: 'production_cutting',
}
```

- [ ] **Step 5: 车缝抽屉接入**

`sewing.vue`，请求参数：
```typescript
{
  module: 'production_sewing',
}
```

- [ ] **Step 6: 尾部抽屉接入**

`finishing.vue`，请求参数：
```typescript
{
  module: 'production_finishing',
}
```

- [ ] **Step 7: 端到端验证**

对每个生产页面：
1. 打开任一行的抽屉 → 检查"操作记录"段位于业务详情区下方
2. 在抽屉里执行该模块的写动作（如采购登记 / 纸样保存 / 工艺完成 / 裁床完成 / 车缝完成 / 尾部入库）
3. 关闭抽屉重开 → 期望"操作记录"段出现刚才的那条日志，显示账号显示名 + 时间 + 中文短句

- [ ] **Step 8: 提交**

```bash
git add frontend/src/views/production frontend/src/components/production/ProcessPageContent.vue
git commit -m "feat(production): 6 个抽屉接入「操作记录」段，复用 OperationLogsSection

- 每个抽屉的业务详情区下方追加日志列表
- 采购按 purchase_item + targetRef 精确过滤；其他 5 个按 module 过滤
- 抽屉行变化时 watch 重新拉取"
```

---

## Task 14：端到端验收

- [ ] **Step 1: 全局检查**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restart.ps1
Start-Sleep -Seconds 5
powershell -ExecutionPolicy Bypass -File scripts/check.ps1
```

- [ ] **Step 2: 列表统一性检查**

打开 6 个生产页面，**每个**都肉眼确认：
- 最右列名是 **"详情"**
- 按钮文字是 **"查看"**
- 点击按钮抽屉能打开，且不报错

- [ ] **Step 3: 抽屉三段式检查**

对每个抽屉：
- 顶部「订单基本信息」（ProductionOrderBriefPanel）正常显示
- 中部「业务详情区」保留原有内容（采购记录 / 用量表单 / 工艺明细 / 裁床详情 / 车缝进度 / 批次时间轴）
- 底部「操作记录」段存在

- [ ] **Step 4: 责任追溯端到端检查**

为每个模块跑一遍：
1. 用账号 A 登录 → 在该模块执行一次写动作
2. 切换到账号 B 登录 → 打开同一行抽屉 → 期望操作记录段显示账号 A 的 displayName + 时间 + 中文短句

特别检查：
- 采购的两条日志（不同 materialIndex 行）**不会**串到对方抽屉里
- 工艺一个订单一条 `production_process_complete` 日志，所有工艺项目行抽屉都看到这同一条
- 尾部"部分入库"detail 中含「（部分入库）」字样

- [ ] **Step 5: 回归检查 — 库存详情抽屉**

打开"库存管理 → 成品库存 → 详情抽屉"，确认操作记录段仍正常显示。

- [ ] **Step 6: 回归检查 — 订单操作日志**

打开任一订单详情页，确认订单的 create/update/submit/review 日志写入仍正常（订单 helper 切换后行为不变）。

- [ ] **Step 7: 类型 / lint 检查**

```bash
cd frontend && npm run build
cd frontend && npm run check:el-radio-value
cd backend && npm run build  # 若 backend 有 build 命令
```

期望全部零错误零警告（或不超过之前 baseline）。

- [ ] **Step 8: 更新 PROJECT_CONTEXT.md**

在 `docs/PROJECT_CONTEXT.md` 第四节"已完成的重要功能与决策记录"追加一条：

```markdown
- `2026-05-15`：生产管理 6 个页面（采购/纸样/工艺/裁床/车缝/尾部）列入口与抽屉结构统一化：列名「详情」+ 按钮「查看」+ emit `open-detail`；抽屉统一三段式（订单基本信息 / 业务详情 / 操作记录）；操作记录复用 `order_operation_logs`，新增 target_type/target_ref 两个可空列承载行级维度（采购按 `purchase_item` + `${orderId}_${materialIndex}` 精确过滤）。
```

- [ ] **Step 9: 收尾提交**

```bash
git add docs/PROJECT_CONTEXT.md
git commit -m "docs(context): 同步生产管理详情入口与操作记录统一化"
```

---

## 附录 A — 错误隔离策略

所有日志写入都用 `try { ... } catch (err) { console.warn('[xxx] write operation log failed:', err) }` 包裹，**不要**让日志写入失败导致业务事务回滚。这是为了满足"日志故障不能拖垮业务"的全局原则。

若业务方法本身用 `@Transaction` 装饰或 `queryRunner` 手动事务，注意把日志写入放在**事务 commit 之后**或放在 try/catch 内，避免事务回滚撤掉日志（虽然反过来也无所谓，但顺序上日志应跟随业务写入成功）。

## 附录 B — Cursor 执行约定

每完成一个 Task：
1. 跑该 Task 的 Step "验证 / 端到端检查"步骤
2. 把改动作为一个 git commit 提交（commit 信息按 Task 末尾给出的模板）
3. 用 `git log --oneline -5` 自查最近 5 个 commit
4. 切到下一个 Task

遇到约束冲突（如某个 service 已有 transaction 包裹、某个字段名与本计划设想不符）：
- **不要凭猜测继续**，先打开实际代码确认
- 若与本计划 minor 出入（如方法名 `register` vs `complete`），按实际代码调整 + 在 commit message 备注
- 若与本计划主线冲突（如某个模块根本没有 mutation 入口），**停下来回报**

完成全部 14 个 Task 后，回报本计划。
