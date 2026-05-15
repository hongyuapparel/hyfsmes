# 生产管理「详情入口 + 抽屉结构 + 操作记录」统一化 — 设计稿

- 日期：2026-05-15
- 范围：生产管理下 6 个页面（采购 / 纸样 / 工艺 / 裁床 / 车缝 / 尾部）
- 类型：UI 一致性 + 责任追溯能力补齐
- 风格定位：最大化复用既有组件、不动数据库结构、零功能回归风险

## 一、问题陈述

生产管理 6 个页面的"打开此行详情"入口在列表头、按钮文字、emit 事件命名上各不相同：

| 模块 | 文件 | 列名 | 按钮 | emit 事件 |
|---|---|---|---|---|
| 采购 | `PurchaseTable.vue:78` | 概要 | 查看 | `open-brief` |
| 纸样 | `PatternTable.vue:60` | 详情 | 查看 | `open-detail` |
| 工艺 | `ProcessPageContent.vue:209` | 明细 | 明细 | `openCraftDetailDrawer` |
| 裁床 | `CuttingTable.vue:125` | 操作 | 查看 | `open-detail` |
| 车缝 | `SewingTable.vue:231` | 概要 | 查看 | `open-brief` |
| 尾部 | `FinishingTable.vue:145` | 概要 | 查看 | `open-brief` |

同时各抽屉内部缺乏「操作记录」段：当多人对同一行有写权限（采购登记、纸样保存、裁床登记…）时，无法追溯"谁在什么时间做了什么改动"，存在责任不清风险。

## 二、目标

1. 6 个入口的列名 / 按钮文字 / emit 事件命名完全一致。
2. 6 个抽屉内部统一为「基本信息 / 业务详情区 / 操作记录」三段式。
3. 引入「操作记录」段，覆盖每个模块各自的写动作（按订单 + 按模块过滤显示）。
4. 全程**复用已有组件**，不新建抽屉壳、不新建基本信息面板、不新建日志展示组件。
5. **复用已存在的 `order_operation_logs` 表**：仅追加 2 个可空 VARCHAR 列（`target_type` / `target_ref`），不改类型 / 约束 / 索引；现有写入与读取行为不变。
6. **不影响现有功能**：业务详情区原样保留，列入口语义不变，纸样的编辑能力不变。

## 三、非目标

- 不做新的统一日志表（`production_logs`）。已有 `order_operation_logs` 足够覆盖。
- 不回填历史数据。操作记录从上线那一刻起累积。
- 不做日志的分页 / 搜索 / 导出。单订单单模块日志量小，本期无需。
- 不改动业务详情区的现有交互（采购明细表、批次时间轴、工艺明细表等保持原样）。
- 不动权限模型，不新增权限点。

## 四、设计

### 4.1 列入口统一

| 维度 | 统一为 |
|---|---|
| 列名 | **「详情」** |
| 按钮文字 | **「查看」** |
| emit 事件 | **`open-detail`** |
| 列宽 | `width="72"` align="center" fixed="right" |

理由：
- 「详情」最准确，避免「概要」（轻）、「操作」（歧义）、「明细」（易与"列表明细"混淆）。
- 「查看」覆盖所有场景（纸样的"再编辑"在抽屉内独立按钮触发，不暴露在列入口）。
- `open-detail` 已是 3/6 表格在用的事件名，改动量最小。

### 4.2 抽屉三段式结构

```
┌─ 基本信息（ProductionOrderBriefPanel，已有组件，复用）
├─ 业务详情区（各模块原样保留：采购记录表 / 用量表单 / 工艺明细表 / 裁床详情 / 车缝进度 / 批次时间轴）
└─ 操作记录（搬迁后的 OperationLogsSection，复用，新挂载点）
```

约束：
- 抽屉外壳：复用 `ProductionDetailDrawerShell`（已统一）。
- 基本信息：6 个页面均接入 `ProductionOrderBriefPanel`（5/6 已接入，工艺补齐）。工艺管理的 row 经核实也带订单字段（customerName / merchandiser / customerDueDate / quantity 等），适用。
- 业务详情区：本期不动，沿用各页面现有 `ProductionDetailSection` 编排。
- 操作记录：见 4.4。

### 4.3 纸样的"编辑能力"保留

- 列入口仍是「查看」，与其他 5 个模块一致。
- 抽屉内部保留现有的用量编辑入口（不在本期变更其交互）。
- 用量保存 / 修改时，写一条操作日志（见 4.4 表格）。

### 4.4 操作记录 — 数据流

#### 复用的表 + 字段扩展

`order_operation_logs`（[order-operation-log.entity.ts](backend/src/entities/order-operation-log.entity.ts)）：

| 字段 | 来源 | 用途 |
|---|---|---|
| `orderId` / `orderNo` | 已有 | 关联订单 |
| `operatorUsername` | 已有 | 操作人（实际存"displayName 优先、回退 username"，沿用现有惯例） |
| `action` | 已有 | 操作类型，按 4.4.1 规范命名 |
| `detail` | 已有 | 中文短句，"做了什么"一眼看清 |
| `createdAt` | 已有 | 时间 |
| **`targetType`** | **新增可空 VARCHAR(32)** | 子对象类型：`order` / `purchase_item` / `craft_item`；订单维度的写入留 NULL |
| **`targetRef`** | **新增可空 VARCHAR(64)** | 子对象唯一定位串：见 4.4.2 |

##### 4.4.1.x 为什么要加 target_type / target_ref

采购、工艺两个页面的列表 row 不是"订单"维度而是"订单 × 子对象"维度（采购 row = `orderId + materialIndex`；工艺 row = `orderId + processItemId`）。若日志只挂 orderId，同一抽屉会显示该订单全部本模块日志，违背 Q2=a 的"只显示本模块的操作"语义。加这两列后可精确过滤到行级。

约束：
- 两列均为可空，订单模块现有 3 处写入留 NULL，行为不变。
- 不加索引（按 orderId 已有索引足以；本期数据量小）。
- 项目当前无 migrations 体系；schema 落地采用现有惯例：在 `OrderOperationLog` entity 加 `@Column` 装饰器（dev 环境 `TYPEORM_SYNCHRONIZE=true` 自动生效），并在 `backend/src/database/` 下新增一段 ensure-脚本（沿用 `seed-order-cost-snapshots.ts` 的"未启用 migrations 时手动 ALTER"模式），生产部署时一次性执行。

#### 4.4.1 action 命名规范（`production_<模块>_<动作>`）

| 模块 | action | 触发时机 | targetType | targetRef |
|---|---|---|---|---|
| 采购 | `production_purchase_register` | 采购登记接口成功后 | `purchase_item` | `${orderId}_${materialIndex}` |
| 纸样 | `production_pattern_save` | 首次保存用量/图片 | `order` | NULL |
| 纸样 | `production_pattern_update` | 修改用量/图片 | `order` | NULL |
| 工艺 | `production_process_complete` | 工艺完成（订单级一次性动作） | `order` | NULL |
| 裁床 | `production_cutting_register` | 裁床登记成功后 | `order` | NULL |
| 车缝 | `production_sewing_register` | 车缝登记成功后 | `order` | NULL |
| 尾部 | `production_finishing_inbound` | 尾部登记入库（含批次） | `order` | NULL |

注：
- 6 个模块除纸样外均「登记一次后只可查看」，无修改 / 删除动作，故 action 列表无 update/delete 变体。
- 纸样虽然有 save/update 两个 action，但纸样列表 row 是订单维度（非展开），targetType 用 `order`。
- 工艺管理虽然列表 row 按"订单 × 工艺项目"展开，但写动作 `completeCraft(orderId)` 是订单级一次性完成，所以 targetType=`order`，所有工艺项目行的抽屉显示同一条日志，可接受。

#### 4.4.2 target_ref 格式约定

| targetType | targetRef 格式 | 说明 |
|---|---|---|
| `order` | NULL | 订单维度（纸样 / 工艺 / 裁床 / 车缝 / 尾部 / 订单本身） |
| `purchase_item` | `${orderId}_${materialIndex}` | 仅采购用；materialIndex 为 0-based |

未来若新增子对象维度，沿用 `${orderId}_${subId}` 模式。

#### 4.4.3 detail 文案规范（中文短句）

| 场景 | 文案示例 |
|---|---|
| 采购登记 | `采购登记：A 面料 200 米 / B 辅料 50 卷` |
| 纸样保存 | `保存用量：80 cm/件` |
| 纸样修改 | `修改用量：80 → 85 cm/件` |
| 工艺保存 | `保存工艺：领口 1cm 双明线 / 袖口 3cm 单针` |
| 裁床登记 | `裁床登记：红色 M 50 件 / L 80 件` |
| 车缝登记 | `车缝登记：红色 M 30 件` |
| 尾部入库 | `尾部入库：第 2 批次 120 件（部分入库）` |

#### 4.4.4 查询接口

`GET /orders/:orderId/operation-logs?module=<production_xxx>&targetType=<type>&targetRef=<ref>`

- 表归属订单（外键 orderId），接口归在 orders 模块下，符合 REST 资源归属
- `module` 可选：按 `action LIKE '${module}_%'` 过滤
- `targetType` 可选：精确匹配 `target_type`
- `targetRef` 可选：精确匹配 `target_ref`（必须配合 `targetType` 使用）
- 三个过滤参数互不强制；空时返回该订单全部日志（保留订单原有用法）
- 排序：`createdAt DESC`
- 后端写死 `LIMIT 200` 保底，避免极端场景慢查询
- 权限：用户能打开某模块的抽屉（即能看到该行），则可拉取该订单 + 该模块的日志；不新增权限点

##### 各模块抽屉的请求形态

| 模块 | 请求参数 |
|---|---|
| 采购 | `module=production_purchase&targetType=purchase_item&targetRef=${orderId}_${materialIndex}` |
| 纸样 | `module=production_pattern` |
| 工艺 | `module=production_process` |
| 裁床 | `module=production_cutting` |
| 车缝 | `module=production_sewing` |
| 尾部 | `module=production_finishing` |

### 4.5 组件复用 / 搬迁清单

| 区块 | 复用组件 | 动作 |
|---|---|---|
| 抽屉外壳 | `ProductionDetailDrawerShell` | 不动 |
| 基本信息 | `ProductionOrderBriefPanel` | 工艺抽屉补齐挂载（已有 `craftBriefFromRow` 适配） |
| 业务详情区 | 各模块现有 `ProductionDetailSection` 编排 | 不动 |
| 操作记录展示 | 现 `FinishedDetailLogsSection.vue` | 搬迁到 `components/common/OperationLogsSection.vue` 并重命名；库存 finished 抽屉的 import 同步更新；生产 6 个抽屉接入 |

搬迁约束（用户红线：不影响实际使用逻辑/功能）：
- 仅改文件位置 + 文件名 + 两处 import 路径；组件 props/template/逻辑零改动
- 搬迁后必须人工验证库存详情抽屉的「操作记录」段仍正常显示
- 单步提交，方便回滚

### 4.6 后端 helper 抽取

现状：`order-mutation.service.ts:491-497` / `order-lifecycle.service.ts:148-154` / `order-status.service.ts:98-103` / `production-purchase.service.ts:117-122`（采购模块的私有 `resolveOperatorName`）四处重复同一段「displayName 优先回退 username」逻辑。新增 5 个生产 mutation（除采购外）若不抽取，则同段代码扩散至 9 处。

抽取方案：
- 新增 `backend/src/common/operator.util.ts`，提供 `resolveOperatorDisplayName(userRepo, actor): Promise<string>`。
- 订单模块上述 3 处切换为调用 helper（含异常回退语义不变）。
- 6 个新增生产 mutation 调用同一 helper。

### 4.7 6 个 mutation 接入点

| 模块 | Service 文件 | 注入 | 调用位置 |
|---|---|---|---|
| 采购 | `production-purchase.service.ts`（或 query/mutation 拆分后的对应文件） | `OrderOperationLog` repo + helper | 采购登记接口成功提交事务后 |
| 纸样 | `production-pattern.service.ts` | 同上 | 用量/图片 save / update 成功后 |
| 工艺 | `production-craft.service.ts` 的 `completeCraft(orderId, userId)` | 同上 | 工艺完成接口成功后 |
| 裁床 | `production-cutting-mutation.service.ts` | 同上 | 裁床登记成功后 |
| 车缝 | `production-sewing.service.ts` | 同上 | 车缝登记成功后 |
| 尾部 | `production-finishing-mutation.service.ts` | 同上 | 登记入库（含批次）成功后 |

错误隔离：日志写入失败不应回滚业务事务。建议采用「业务事务提交后再写日志」的顺序，或在事务内 `try { logRepo.save() } catch { logger.warn() }` 包裹，避免日志故障拖垮业务。具体策略沿用现有订单模块惯例（订单模块当前是在同事务内 try/catch 包裹的）。

## 五、影响面 / 改动量

| 维度 | 改动量 |
|---|---|
| 数据库 | 1 个 migration：`ALTER TABLE order_operation_logs ADD COLUMN target_type VARCHAR(32) NULL, ADD COLUMN target_ref VARCHAR(64) NULL`；同时更新 `OrderOperationLog` entity 加两个可空字段 |
| 后端文件 | 6 个生产 service 各加 ~3 行日志写入；新增 1 个 helper（~10 行）；订单 3 处切换为调 helper；新增 1 个查询路由 + service 方法（含 module/targetType/targetRef 三个可选过滤参数） |
| 前端文件 | 6 个表格组件各改 ~3 行（列名/按钮/事件）；6 个 View 抽屉各接入操作记录段 + 接线调整；1 个组件搬迁（路径 + 名字 + 2 处 import） |
| 数据迁移 | 仅 ADD COLUMN，不回填、不变换 |
| 历史数据 | 不回填，上线起累积；新列默认 NULL，订单模块旧日志在新接口下 targetType/targetRef 均为空 |

## 六、风险 / 验证

风险列表：
1. 组件搬迁可能误改 import → 验证：搬迁前后均在库存详情抽屉手测一次操作记录展示。
2. 6 个 mutation 接入日志可能误改业务返回 → 验证：每个模块的登记/保存接口走一次端到端验证。
3. 采购 / 工艺日志加 target_ref 精确定位行级；其他 4 模块 targetType=`order`、targetRef=NULL，抽屉仅按 `module + orderId` 过滤，已满足 Q2=a。
4. 现有 5/6 已用 `ProductionOrderBriefPanel`，工艺补齐时需要确认 `craftBriefFromRow` 给出的字段完整 → 验证：工艺抽屉打开时 BriefPanel 显示无缺字段。

验证清单（最终验收）：
- 6 个页面列名均显示「详情」，按钮均显示「查看」
- 6 个抽屉打开均展示三段式
- 在每个模块各执行一次写动作（登记 / 保存），抽屉的操作记录段出现一条新日志，操作人显示为"账号显示名"
- 库存详情抽屉的操作记录段功能保持
- 订单模块的 create/update/submit/review/delete/copy_to_draft 日志写入不变（订单 helper 切换后）

## 七、决策日志

- 操作记录数据源 → 复用 `order_operation_logs`，不新建表（Q1 收敛）
- 视野范围 → 抽屉只显示本模块的操作（Q2=a）
- 操作记录展示组件 → 搬迁 `FinishedDetailLogsSection` 到 `components/common/OperationLogsSection.vue`（Q3=b）
- 显示名实现 → 复用现有"displayName 优先"惯例，抽 helper（含订单模块 3 处也切换）
- 工艺 / 采购的日志维度 → 因列表 row 为"订单 × 子对象"，OrderOperationLog 加 `target_type` + `target_ref` 两列（可空），其他 4 模块仍按订单维度
- 接口路径 → `GET /orders/:orderId/operation-logs?module=xxx&targetType=xxx&targetRef=xxx`，归 orders 模块
