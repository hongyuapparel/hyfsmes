# 工作台模块设计文档

**日期**：2026-05-15  
**状态**：已确认，待实施

---

## 目标

在 ERP 系统侧边栏新增独立「工作台」页面（`/workspace`），让每位员工：

1. 一眼看到**今日系统操作汇总**（自动生成，不可编辑）
2. 管理**待跟进订单**的下次跟进时间和备注（表格内联编辑）
3. 补充**手动任务**（线下工作记录）

主账号（超级管理员）可在顶部切换查看任意成员当日报告。

---

## 页面结构

### 普通用户视图

```
岗位 · 姓名       ← 日期 →   📅 日期选择
[今日已操作][紧急待办][7天内到期][我跟的单]   ← 4个统计卡片

今日系统操作记录（自动，只读）[展开/收起]
  ● 审核通过  3单  XH1033 XH2803 XH1897
  ● 报价提交  1单  XH3046
  ...

待跟进订单                        [+ 手动任务]
┌订单号──┬SKU──┬类型┬业务员┬下次跟进时间┬跟进内容──┐
│ 🔍搜  │🔍搜 │▼筛 │▼筛  │  ↕排序   │          │
│XH2612 │TA134│大货│邓小花│05/15 🔴  │催出货     │
│XH1003 │XH2B │大货│王某  │05/15 🔴  │安排采购   │
│XH3168 │蓝款  │大货│邓小花│点击填写   │点击填写   │
│[手动] │样品看样│— │—   │05/15     │确认颜色   │
└────────┴─────┴────┴─────┴──────────┴──────────┘
```

**内联编辑**：
- `下次跟进时间` 列：点击 → 日期选择器，选完自动保存
- `跟进内容` 列：点击 → 文本输入，回车/失焦自动保存
- 颜色：🔴 今天或已过 / 🟡 3天内 / 🟢 更晚 / 无色=未设置

### 主账号附加视图（顶部多一行）

```
查看报告人：[全部成员 ▼]   日期：[2026-05-15]   [导出报告]
```

选人后下方内容切换为对应成员的当日视图（只读）。

---

## 数据模型

### 新建表 1：`order_follow_plans`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 自增 |
| order_id | INT | 订单 ID |
| user_id | INT | 用户 ID |
| next_follow_date | DATE NULL | 下次跟进日期 |
| next_action | VARCHAR(200) NULL | 跟进内容备注 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

UNIQUE KEY (order_id, user_id)

### 新建表 2：`workspace_manual_tasks`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 自增 |
| user_id | INT | 用户 ID |
| work_date | DATE | 所属日期 |
| title | VARCHAR(100) | 任务标题/SKU 描述 |
| next_follow_date | DATE NULL | 下次跟进日期 |
| note | VARCHAR(200) NULL | 备注 |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### 复用现有表：`order_operation_logs`

已有字段：`operator_username`, `action`, `detail`, `order_no`, `created_at`

已记录的 action 类型：
- `create` 创建草稿
- `update` 更新字段
- `submit` 状态推进
- `review` 审核
- `cost_confirm` 确认报价
- `delete` / `restore` 删除/恢复
- `copy_to_draft` 复制

---

## 接口设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/workspace/summary` | 4个统计数字 + 今日操作记录分组 |
| GET | `/workspace/follow-orders` | 我的待跟进订单（含跟进计划） |
| PUT | `/workspace/follow-plan/:orderId` | 设置/更新订单跟进计划（upsert） |
| POST | `/workspace/manual-task` | 新增手动任务 |
| PUT | `/workspace/manual-task/:id` | 更新手动任务 |
| DELETE | `/workspace/manual-task/:id` | 删除手动任务 |
| GET | `/workspace/users` | 可查看的用户列表（仅管理员） |

**公共查询参数**：
- `date`: YYYY-MM-DD（默认今天）
- `userId`: 数字（仅管理员可传，查看他人报告）

---

## 权限

- 新增权限点：`menu_workspace`，routePath: `/workspace`，type: `menu`
- 所有已有角色默认获得该权限
- 管理员额外可传 `userId` 参数查看他人

---

## 前端文件清单

| 文件 | 行数上限 |
|------|---------|
| `views/workspace/index.vue` | 80 |
| `components/workspace/WorkspaceAdminBar.vue` | 80 |
| `components/workspace/WorkspaceHeader.vue` | 60 |
| `components/workspace/WorkspaceTodaySummary.vue` | 130 |
| `components/workspace/WorkspaceOrderTable.vue` | 280 |
| `composables/useWorkspace.ts` | 180 |
| `composables/useWorkspaceFollowPlan.ts` | 100 |
| `api/workspace.ts` | 80 |
