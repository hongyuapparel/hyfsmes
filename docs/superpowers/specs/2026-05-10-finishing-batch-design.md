# 尾部管理 — 分批入库与发货设计

日期：2026-05-10
作者：业务方 + Claude
状态：待实现

## 背景

当前「生产管理 / 尾部管理」假设一个订单的尾部流程一次性走完：

```
登记收货(100) → 登记包装完成(100) → 待仓处理(100) → 发货(100)
```

实际业务中常出现"工厂一次送 100 件，但尾部分两次包装入库 + 发货"的场景：第 1 天先入库 50 件并发走，过几天再入库剩下 50 件并发走。希望系统支持这种分批，并在每个相关页面清楚地呈现批次信息，且数据不会因分批而错乱。

## 目标

1. 同一订单允许多次「登记入库」，每次只填本批数量。
2. 「尾部中」列表能一眼分辨哪些订单是分批进行中。
3. 详情抽屉新增「批次记录」时间轴，看到何时入库、何时发货、操作人。
4. 不破坏现有"一次性走完"流程的体验。
5. 改动尽量小：复用现有 `inbound_pending` / `finished_goods_outbound` 数据，不新建批次流水表。

## 非目标

- 不引入"批次"作为独立实体（不挂照片、不挂批次级备注）。
- 不改造「待仓处理」页（已天然按记录展示）。
- 不调整订单状态机定义（仍由 `tailing_inbound_completed` 触发推进）。
- 不回填历史数据。新逻辑只对未来订单生效。

## 关键约束（来自 CLAUDE.md）

- 字号统一使用设计变量。
- 不用补丁 CSS / `!important` 覆盖 Element Plus 组件。
- 不出现 `any`；新代码使用具体类型或 `unknown`+守卫。
- 修改触碰的代码不留技术债。
- `views/finishing.vue` 已 638 行，接近警戒线（500），新逻辑下沉到 composable，不增厚视图。

## 现状梳理

### 数据模型

`order_finishing`（一订单一行汇总）
- `tail_received_qty` 尾部收货数（一次性登记，本设计不变）
- `tail_inbound_qty` 累计入库数
- `tail_shipped_qty` 累计发货数（实际未由尾部模块累加，发货由仓库模块负责）
- `defect_quantity` 累计次品数
- `tail_received_qty_row` / `tail_inbound_qty_row` / `defect_quantity_row` 按尺码明细
- `status`：`pending_assign` / `pending_ship` / `inbound` / `shipped`

`inbound_pending`（多行，每行一笔待仓批次）
- `id, order_id, sku_code, quantity, source_type, status, created_at`

`finished_goods_outbound`（多行，发货流水）
- `id, order_id, quantity, pickup_user_name, operator_username, remark, created_at, ...`

### 现有问题

1. `registerPackagingComplete` 校验 `inbound + defect === received`，强制首次填满 100，挡住分批。
2. `inbound()` 方法虽然累加 `tailInboundQty`，但 INSERT pending 时用累加值（`finishing.tailInboundQty`）而不是本次量，导致第二批写入待仓的数量错乱。
3. `inbound_pending` 没有 `operator_username`，看不到是谁入的库。

## 设计

### 一、操作流程（以收货 100、分两批为例）

```
Day 1  登记收货 100                       order_finishing.tailReceivedQty=100
Day 1  弹「登记入库」→ 填 50 → 点"部分入库"  tailInboundQty=50；订单留在「尾部中」+「部分入库」标签
       系统 INSERT inbound_pending(id=A, qty=50)
Day 1  待仓 doOutbound(A, 50)             pending A → completed；finished_goods_outbound 写一条
Day 4  弹「登记入库」→ 弹窗提示"第 2 批，剩余 50" → 填 50 → 点"全部入库"
       tailInboundQty=100；累计==received → 推进到「尾部完成」
       系统 INSERT inbound_pending(id=B, qty=50)
Day 4  待仓 doOutbound(B, 50)             pending B → completed
```

判定订单从「尾部中」推进到「尾部完成」的条件：

```
tailInboundQty + defectQuantity === tailReceivedQty
```

发货是否完成不影响"尾部完成"，发货归仓库管。

### 二、列表展示（「尾部中」tab）

不新增列。在 `FinishingTable.vue` 的「尾部入库数」单元格内，当 `0 < tailInboundQty + defectQuantity < tailReceivedQty` 时，数字旁追加一个 `el-tag` chip：

```
50  [部分入库]      ← orange/warning chip
```

判定与展示：

| 状态 | 判定条件 | 单元格展示 |
|---|---|---|
| 未登记 | `tailInboundQty + defect === 0` | `0` |
| 部分入库 | `0 < tailInboundQty + defect < tailReceivedQty` | `<数字>` + `部分入库` chip |
| 已完成 | `tailInboundQty + defect === tailReceivedQty` | 订单已进入「尾部完成」tab，不在此处 |

不引入新字段；判定纯由前端基于已有字段计算。

### 三、登记入库弹窗

#### 文案与按钮

- 弹窗标题：`登记包装完成` → **`登记入库`**（amend 模式标题保持`修改入库/次品`）
- 表头说明从"登记包装完成后将默认全部入库"改为：

  > 可选「部分入库」分批登记，或「全部入库」一次性补齐剩余。

- 底部按钮（仅 register 模式）：

  | 按钮 | mode 入参 | 前端校验 | 行为 |
  |---|---|---|---|
  | 取消 | — | — | 关闭 |
  | **部分入库** | `partial` | `本次inbound + defect ≤ 剩余可登记` 且 `> 0` | 提交 |
  | **全部入库** | `full` | `本次inbound + defect === 剩余可登记` | 提交 |

  - 用户点「部分入库」但实际填满了剩余 → 后端正常执行，自动推进到尾部完成（不打扰用户）。
  - 用户点「全部入库」但没填满 → 前端校验失败，提示 `全部入库需要填满剩余 N 件，当前差 X 件`。

- amend 模式按钮文案保持 `保存修改` 不变。

#### 弹窗内信息区（register 模式）

```
订单号：xxx    SKU：xxx
尾部收货数：100
已登记入库：<已累计>      （仅当 > 0 时显示）
本次为第 <N> 批入库       （仅当已累计 > 0 时显示）
剩余可登记：<received - 累计>

[尺码矩阵：本次入库数 / 本次次品数]
```

按尺码的累计逻辑：`tail_inbound_qty_row` / `defect_quantity_row` 改为 `已累计 + 本次` 后入库。

### 四、详情抽屉 — 新增「批次记录」页签

新增 `GET /production-finishing/:orderId/batches` 接口，返回按时间倒序的事件流：

```ts
type BatchEvent = {
  type: 'receive' | 'inbound' | 'outbound'
  batchNo: number | null      // 入库/发货批次序号；receive 为 null
  quantity: number             // 正数；展示时按 type 加 +/-
  sourceType?: 'normal' | 'defect'   // inbound 时携带
  operatorUsername: string
  pickupUserName?: string      // outbound 时携带
  remark: string
  occurredAt: string           // ISO 字符串
}
```

数据来源：
- `receive`：`order_finishing.arrived_at` + `tail_received_qty`（一条）
- `inbound`：`inbound_pending` where `order_id = ?`（包含 pending/completed 全部状态，不限 status）
- `outbound`：`finished_goods_outbound` where `order_id = ?`

`batchNo` 计算方式：在数据库里给 `inbound_pending` 加 `batch_no` 列；后端 INSERT 时取 `MAX(batch_no) + 1`（同 order）。`finished_goods_outbound` 不加列，前端按时间顺序计算"第 N 次发货"。

前端展示（详情抽屉新增 `BatchTimelineSection.vue` 子组件）：

```
2026-05-13 14:23  入库登记 第2批  +50 件  操作：王某
2026-05-10 09:15  待仓发货 第1批  -50 件  领取：业务员张某  操作：李某
2026-05-10 08:40  入库登记 第1批  +50 件  操作：王某
2026-05-09 10:00  尾部收货         100 件  操作：王某
```

如订单未登记任何入库 / 发货，仅显示一条 `尾部收货` 事件。

### 五、后端改动

#### 1. `inbound-pending.entity.ts` 新增两列

```ts
@Column({ name: 'operator_username', length: 64, default: '' })
operatorUsername: string;

@Column({ name: 'batch_no', type: 'int', nullable: true })
batchNo: number | null;
```

迁移：`ALTER TABLE inbound_pending ADD COLUMN operator_username VARCHAR(64) NOT NULL DEFAULT '', ADD COLUMN batch_no INT NULL;`

#### 2. `production-finishing-mutation.service.ts`

- `registerPackagingComplete(orderId, mode: 'partial' | 'full', tailInboundQty, defectQuantity, ...)`
  - 入参新增 `mode`。
  - 校验：
    - `mode === 'full'`：`本次inbound + defect === 剩余可登记数`
    - `mode === 'partial'`：`0 < 本次inbound + defect ≤ 剩余可登记数`
  - 累加：`finishing.tailInboundQty += inbound; finishing.defectQuantity += defect`；按尺码行同样累加。
  - INSERT pending：用本次新增量（不是累加值），`batchNo` = `MAX(batch_no) + 1`，`operatorUsername` = 当前用户。
  - 状态推进：当 `tailInboundQty + defectQuantity === tailReceivedQty` 时走 `tailing_inbound_completed`，否则保留 `pending_assign`（"尾部中"语义）。
  - amend 路径限制：仅当 `status === 'inbound'`（已全部完成）才允许 amend。分批进行中 `status` 仍为 `pending_assign`，禁用 amend 通路（前端按钮也对应隐藏）。

- `inbound()` 方法（status='shipped' 时的追加路径）
  - 修 bug：INSERT pending 用本次 `qty`，不用累加值。
  - 写 `batchNo` + `operatorUsername`。
  - 该路径与新方案重叠（也是分批的另一种形态），保留它向后兼容；首选路径仍是 `registerPackagingComplete(mode=partial)`。

#### 3. `production-finishing-query.service.ts`

新增方法 `getBatches(orderId): Promise<BatchEvent[]>`：
- 一次查 `order_finishing`、`inbound_pending`（全状态）、`finished_goods_outbound`，合并排序。
- 操作人字段：`order_finishing` 当前没存 receive/packaging 操作人 — 对 `receive` 事件返回空字符串；不在本次范围内回填。

#### 4. `production-finishing.controller.ts`

新增 `GET /production-finishing/:orderId/batches`，权限沿用尾部管理读权限。

### 六、前端改动

#### 1. `api/production-finishing.ts`

- `registerPackagingComplete` 入参增加 `mode: 'partial' | 'full'`。
- 新增 `fetchFinishingBatches(orderId): Promise<BatchEvent[]>`。

#### 2. `composables/useFinishingPackaging.ts`

- `submitPackagingComplete` 接受 `mode`。
- 暴露 `remainingQty`（computed：`received - 已累计`）、`alreadyInboundQty`、`batchNo`（已累计 > 0 时为 N+1）。
- 校验逻辑分模式实现。

#### 3. `views/production/finishing.vue`

- 弹窗标题改 `登记入库`。
- 表头说明改写。
- 弹窗信息区按"已登记 > 0"显示 `本次为第 N 批 / 已登记 / 剩余可登记`。
- footer 按钮替换为 `[取消] [部分入库] [全部入库]`，分别绑定 `submitPackagingComplete('partial')` / `('full')`。
- amend 模式 footer 保持 `[取消] [保存修改]` 不变。

#### 4. `components/production/FinishingTable.vue`

- 「尾部入库数」单元格：用 inline `<el-tag size="small" type="warning">部分入库</el-tag>` 在数字右侧条件渲染。
- 判定 computed 下沉到列表数据 composable，避免在模板里重复计算。

#### 5. 详情抽屉

新增 `BatchTimelineSection.vue` 子组件，用 Element Plus `el-timeline`/`el-table` 展示批次事件。
挂在现有详情抽屉的 tab 列表里（与"基本信息""操作记录"等并列）。

### 七、单元测试

- `production-finishing-mutation.service.spec.ts`
  - 首次 partial 50 → 累计 50；订单留在 `pending_assign`；pending 一条 50。
  - partial 后再 partial 30 → 累计 80；订单仍 `pending_assign`；pending 两条。
  - partial 50 后再 full 50 → 累计 100；订单推进到完成；pending 两条。
  - full 模式数量不足 → 抛错。
  - partial 模式数量超额 → 抛错。
  - 已完成订单走 amend → 仍按原逻辑可改。
  - 分批进行中调 amend → 抛错"分批进行中不可修改，请撤销末次批次后重登"。

- 前端 `useFinishingPackaging.spec.ts`：mode 校验、`remainingQty`/`batchNo` computed。

## 风险与回滚

| 风险 | 应对 |
|---|---|
| 历史数据兼容 | 新增列均允许空 / 默认值；旧记录 `batch_no = null`、`operator_username = ''`，详情时间线降级展示。 |
| 并发：两个人同时点登记 | service 内开事务，`SELECT ... FOR UPDATE` 锁 `order_finishing` 行后再校验累计与写入。 |
| `inbound()` 旧路径与新路径冲突 | 保留旧路径但修 pending 数量 bug；不再作为前端首选入口。后续可视情况下线。 |
| 前端没识别出"部分入库"标签的视觉过强 | 使用 Element Plus `type="warning"` `size="small"`；CSS 走主题 token，不写私有样式。 |

回滚：本次改动均为加列 + 加方法 + 校验放宽 + UI 增量。回滚仅需恢复后端 mutation 校验等式与前端按钮，不影响已落库的 `inbound_pending` 行。

## 改动清单总览

后端：
- `entities/inbound-pending.entity.ts`（+2 列）
- 迁移脚本（按项目规则放置）
- `production-finishing/production-finishing-mutation.service.ts`（核心）
- `production-finishing/production-finishing-query.service.ts`（新方法）
- `production-finishing/production-finishing.controller.ts`（新接口）
- `production-finishing/production-finishing.types.ts`（新增 `BatchEvent`）
- 单测 spec

前端：
- `api/production-finishing.ts`
- `composables/useFinishingPackaging.ts`
- `views/production/finishing.vue`
- `components/production/FinishingTable.vue`
- 详情抽屉新增 `BatchTimelineSection.vue`
- 单测 spec

预估净增代码 ~250 行（含测试）。

## 不在本设计内的事项

- 收货环节的操作人留痕（`order_finishing` 暂未记录登记收货人）。如需要，独立任务。
- 待仓页的批次序号展示（前端可后续基于 `batch_no` 增强）。
- 旧 `inbound()` 路径下线（保留作为兼容入口）。
