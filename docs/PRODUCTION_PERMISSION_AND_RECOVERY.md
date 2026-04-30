# 生产管理权限与隐藏数据恢复说明

## 1. SQL 要不要在本地和线上都执行

`backend/scripts/find-hidden-production-records.sql` 是只读排查 SQL，只做 `SELECT`，不会修改数据。

- 本地库：只有想验证本地是否有同类异常时才需要执行。
- 生产库：要在生产数据库执行同一个 SQL，才能查到线上真实被隐藏或状态不一致的订单。
- 建议顺序：先部署权限修复代码，再执行 SQL 复查。这样可以避免继续产生新的异常记录。

## 2. SQL 结果怎么看

SQL 会列出两类问题：

- 子记录已经完成，但 `orders.status` 仍停在当前生产环节，例如纸样完成但主订单仍是 `pending_pattern`。
- 旧车缝列表隐藏问题：`order_sewing.status='completed'`，但主订单已经走到后续状态，旧代码没有把它展示出来。

字段说明：

- `issue`：问题类型。
- `order_id` / `order_no` / `sku_code`：定位订单。
- `order_status`：主订单当前状态。
- `module_status` / `sewing_status`：生产子表状态。
- `module_completed_at` / `sewing_completed_at`：子环节完成时间。

## 3. 怎么恢复这些订单

优先使用代码恢复，不建议直接手写 `UPDATE`。

1. 车缝完成后在车缝管理查不到：
   - 这是列表展示条件问题。
   - 部署本次代码后会重新显示，不需要改数据库。

2. 子记录完成但主订单状态没推进：
   - 部署本次代码后，后台定时任务每 2 分钟会按 `order_status_transitions` 流程配置自动调和。
   - 调和成功后会更新 `orders.status`、`orders.status_time`，并写入 `order_status_history`。
   - 等 2 分钟后重新执行排查 SQL，确认结果是否清空。

3. 如果仍然查到记录：
   - 先检查“订单设置 -> 流程链路”是否存在对应触发动作的规则。
   - 对应关系如下：
     - 采购/领料全部完成：`purchase_all_completed`
     - 纸样完成：`pattern_completed`
     - 工艺完成：`craft_completed`
     - 裁床完成：`cutting_completed`
     - 车缝完成：`sewing_completed`
     - 尾部入库完成：`tailing_inbound_completed`
   - 补好流程链路后，等待定时任务再次调和。

紧急手工恢复时，必须先确认每条订单只有一个正确目标状态。示例：

```sql
SELECT id, from_status, to_status, trigger_code, conditions_json
FROM order_status_transitions
WHERE enabled = 1
  AND from_status = '<当前 order_status>'
  AND trigger_code = '<对应 trigger_code>';
```

确认目标状态后再事务更新：

```sql
START TRANSACTION;

UPDATE orders
SET status = '<确认后的 to_status>',
    status_time = COALESCE('<子记录完成时间>', NOW())
WHERE id = <order_id>
  AND status = '<当前 order_status>';

INSERT INTO order_status_history (order_id, status_id, entered_at)
SELECT <order_id>, os.id, COALESCE('<子记录完成时间>', NOW())
FROM order_statuses os
WHERE os.code = '<确认后的 to_status>';

COMMIT;
```

如果不能确认目标状态，不要手工更新，先修流程链路配置。

## 4. 权限规则现在分层

系统里有三类权限/规则，不应混在一起：

1. 页面和按钮权限：
   - 数据表：`permissions`、`role_permissions`
   - 后台入口：角色权限配置
   - 后端拦截：`@RequirePermission(...)` + `PermissionGuard`
   - 前端按钮：`authStore.hasPermission(...)`

2. 订单编辑/删除/审核可操作状态：
   - 数据表：`role_order_policies`
   - 后台入口：角色权限配置里的订单状态策略
   - 用于控制“订单列表”的编辑、删除、审核在什么订单状态下可操作。

3. 订单流程链路：
   - 数据表：`order_status_transitions`
   - 后台入口：订单设置 -> 流程链路
   - 只负责“当前状态 + 触发动作 + 订单类型/合作方式/是否有工艺”应该流转到哪个状态。
   - 不再负责判断哪个角色能操作。

## 5. 本次新增的生产动作权限

这些权限会被种子脚本写入 `permissions` 表，并可在角色权限配置中勾选：

- `production_purchase_register`：采购管理-登记采购/领料
- `production_pattern_assign`：纸样管理-分配纸样
- `production_pattern_complete`：纸样管理-纸样完成
- `production_pattern_materials`：纸样管理-维护纸样物料
- `production_process_complete`：工艺管理-工艺完成
- `production_cutting_complete`：裁床管理-裁床登记
- `production_sewing_assign`：车缝管理-分单
- `production_sewing_complete`：车缝管理-登记车缝完成
- `production_finishing_receive`：尾部管理-登记收货
- `production_finishing_packaging`：尾部管理-登记包装完成
- `production_finishing_inbound`：尾部管理-入库

## 6. 上线后的后台配置建议

- 车缝账号：只勾选 `menu_production_sewing`、`production_sewing_assign`、`production_sewing_complete`，不要勾选采购、纸样、裁床、尾部动作。
- 采购账号：勾选 `menu_production_purchase`、`production_purchase_register`。
- 纸样账号：勾选 `menu_production_pattern`，按需要勾选纸样分配、纸样完成、纸样物料维护。
- 裁床账号：勾选 `menu_production_cutting`、`production_cutting_complete`。
- 尾部账号：勾选 `menu_production_finishing`，按岗位勾选收货、包装完成等动作。
- 尾部不再配置「发货」和「财务审批发货」动作权限；尾部发货/财务放货旧权限已废弃并会被权限种子清理。
- 超级管理员：由系统自动补齐全部 `permissions`，仍建议在后台核对。

## 7. 已移除的冗余控制

- 生产流程流转不再读取 `order_status_transitions.allow_roles`。
- 订单设置的流程链路界面不再展示或保存角色字段。
- 生产动作接口全部改为角色权限项控制。
- 前端生产动作按钮全部改为读取角色权限项显示。

数据库表里的 `allow_roles` 字段暂时保留，用于兼容旧表结构；代码会把新保存的流程规则写成 `NULL`，且不再用它判断权限。

## 8. 当前代码里的权限入口清单

这些是后端接口和前端按钮引用的权限码/路径。它们不是“某角色写死可操作”，而是连接到后台角色权限配置的入口。

后端页面/模块入口：

- `/customers`：客户管理
- `/suppliers`：供应商管理
- `/hr`：人事管理
- `/orders/list`：订单列表及订单相关基础查询
- `/orders/products`：产品列表、字段定义、订单上传
- `/production/purchase`：采购管理
- `/production/pattern`：纸样管理
- `/production/process`：工艺管理
- `/production/cutting`：裁床管理
- `/production/sewing`：车缝管理
- `/production/finishing`：尾部管理
- `/inventory/pending`：待仓处理
- `/inventory/finished`：成品库存
- `/inventory/accessories`：辅料库存
- `/inventory/fabric`：面料库存
- `/finance/dashboard`：财务看板
- `/finance/income`：收入流水
- `/finance/expense`：支出流水
- `/settings/users`：用户管理
- `/settings/roles`：角色与权限
- `/settings/orders`：订单设置
- `/settings/suppliers`：供应商设置
- `/settings/inventory`：库存设置
- `/settings/finance`：财务设置

后端订单动作权限：

- `orders_edit`：订单编辑、更新成本、撤回审核等编辑类动作
- `orders_delete`：订单删除
- `orders_review`：订单审核通过/驳回
- `orders_cost_submit`：订单成本提交、成本模板保存入口之一

后端生产动作权限：

- `production_purchase_register`
- `production_pattern_assign`
- `production_pattern_complete`
- `production_pattern_materials`
- `production_process_complete`
- `production_cutting_complete`
- `production_sewing_assign`
- `production_sewing_complete`
- `production_finishing_receive`
- `production_finishing_packaging`
- `production_finishing_inbound`

前端按钮权限读取：

- 订单列表：`orders_edit`、`orders_delete`、`orders_review`
- 订单成本：`orders_cost_submit`
- 纸样物料维护：`production_pattern_materials`
- 采购动作：`production_purchase_register`
- 纸样动作：`production_pattern_assign`、`production_pattern_complete`
- 工艺动作：`production_process_complete`
- 裁床动作：`production_cutting_complete`
- 车缝动作：`production_sewing_assign`、`production_sewing_complete`
- 尾部动作：`production_finishing_receive`、`production_finishing_packaging`

仍保留的系统级保护：

- `admin` 角色会被自动补齐全部 `permissions`，用于避免超级管理员误删权限后锁死系统。
- `admin` 角色在订单编辑/删除/审核状态策略里仍有兜底放行；如果要做到完全配置化，可以下一步把超级管理员的所有 `role_order_policies` 自动补齐后删除这处兜底。
- 角色管理界面禁止删除/改坏 `admin` 角色编码，这是系统安全保护，不属于生产动作权限。
- 首页待办里用 `roleName === '超级管理员'` 控制“待我跟单”展示，这是首页展示逻辑，不参与后端权限判断。
