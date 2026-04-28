# 项目全局上下文（模板）

> 本文件用于给「AI + 人」提供一个可以长期维护的**全局记忆**。  
> 建议：只要做了**重要功能 / 结构性调整**，就来这里补一两句话即可。

---

## 一、项目整体信息

- **项目名称**：服装工贸一体 ERP（内部 B2B 后台）  
- **主要用途**：订单管理、客户与产品管理、生产流程协同、仓储等  
- **主要使用人员**：业务员、跟单员、生产主管、仓库、财务、管理员等  
- **当前部署环境**：
  - 宝塔项目根目录 / Git 仓库 / 部署脚本目录 / 前端发布目录：`/www/wwwroot/erp.hyfsmes.com`
  - 前端源码目录：`/www/wwwroot/erp.hyfsmes.com/frontend`
  - 后端源码目录：`/www/wwwroot/erp.hyfsmes.com/backend`
  - PM2 后端服务名：`erp-backend`
  - 给部署命令前必须先核对 `docs/DEPLOY_GUIDE.md`；执行 `sh scripts/deploy-*.sh` 前统一先 `cd /www/wwwroot/erp.hyfsmes.com`。

> 如有特别重要的业务背景（例如「成衣+来料+外发」三种模式），也可以在这里补充一两行。

---

## 二、业务模块总览（按实际补充）

> 用这一节快速告诉 AI：系统里有哪些大模块，各自负责什么，对应哪些前后端入口。

| 模块 | 主要职责 / 说明 | 前端主要页面（路径示例） | 后端主要模块（Nest 模块 / 控制器） | 相关设计文档 |
|------|-----------------|--------------------------|------------------------------------|--------------|
| 认证与权限 | 登录、角色、权限点控制 | `frontend/src/views/login.vue` 等 | `backend/src/auth/*`, `backend/src/roles/*`, `backend/src/permissions/*` | `TODO` |
| 字段配置 | 各业务模块的字段定义、显示名、顺序、显示/隐藏 | 各列表页面上的「列设置」弹窗 | `backend/src/field-definitions/*` | `docs/FIELD_CONFIG_DESIGN.md` |
| 字典 / 系统选项 | 下拉选项（如订单类型、合作方式等）、系统常规配置 | 相关设置页面 | `backend/src/dicts/*`, `backend/src/system-options/*` | `TODO` |
| 订单管理 | 从下单、审单到生产、完成的全流程；订单列表 / 编辑页面 | `frontend/src/views/orders/list.vue`, `frontend/src/views/orders/edit.vue` 等 | `backend/src/orders/*` | `docs/ORDER_STATUS_FLOW_DESIGN.md` |
| 客户管理 | 客户档案、联系人信息等 | `frontend/src/views/customers/*` | `backend/src/customers/*` | `TODO` |
| 产品 / 款式管理 | 产品档案、规格、工艺等 | `frontend/src/views/products/*` | `backend/src/products/*`, `backend/src/process-items/*` | `TODO` |
| 供应商管理 | 供应商信息 | `frontend/src/views/suppliers/*` | `backend/src/suppliers/*` | `TODO` |
| 仓储 / 出入库 | 入库、出库、库存查看（如已实现） | `TODO` | `TODO` | `TODO` |
| 财务管理 | 收入流水（按部门+银行账号录入）、支出流水（可关联订单/供应商或填明细）、财务设置（支出类型、银行账号） | `frontend/src/views/finance/income.vue`, `expense.vue`, `frontend/src/views/settings/finance-settings.vue` | `backend/src/finance-income/*`, `backend/src/finance-expense/*` | `TODO` |
| 其它模块 | 例如健康检查、文件上传、小满对接等 | `TODO` | `TODO` | `TODO` |

> 使用建议：  
> - 新增模块时，请在表格里补一行；  
> - 如果只是某个模块内部做了细节优化，不需要在这里写得很细，只要能让 AI 快速知道「大地图」即可。

---

## 三、关键全局约定

> 这一节写的是「跨多个模块都会用到的约定」，比如字段配置、订单状态、权限命名等，便于所有后续对话统一口径。

- **字段配置统一约定**  
  - 所有可配置字段使用唯一 `code`（如 `companyName`），含义在全系统保持一致。  
  - 各模块通过 `module` + `code` 关联字段定义，默认配置存放在 `field_definitions` 表。  
  - 页面优先从配置表读取字段定义；若无记录，则回退到代码中的默认配置。  
  - 更详细说明见：`docs/FIELD_CONFIG_DESIGN.md`。

- **订单状态与流转**  
  - 订单从「草稿」到「完成」的状态流转、角色权限、按钮对应关系，集中在 `docs/ORDER_STATUS_FLOW_DESIGN.md` 中维护。  
  - 所有涉及订单状态变更、新增按钮、新增状态的需求，应**优先在该文档中更新设计**，再改代码。

- **权限点与角色**  
  - 角色（如管理员、业务员、跟单员、生产主管、仓库、财务等）通过权限点控制页面与按钮可见性。  
  - 新增接口或按钮时，应同时考虑：需要哪些权限点？哪些角色默认拥有？并在权限相关 seed/文档中记录。

- **部署路径记忆**
  - 宝塔项目根目录是 `/www/wwwroot/erp.hyfsmes.com`，部署命令只保留这一个目录。
  - 以后生成上线命令时，先读取 `docs/DEPLOY_GUIDE.md`，不要凭记忆猜路径。

如有其它跨模块约定（例如「所有金额字段保留两位小数、使用同一货币字段」等），也建议在这里补充。

---

## 四、已完成的重要功能与决策记录

> 用极短的条目记录「这个项目已经做了哪些关键决定 / 大功能」，方便之后的对话快速对齐历史。

示例格式（按时间倒序追加即可）：

- `2026-04-25`：权限模块增加 admin 角色权限保全与 `/permissions/resync-admin` 重同步接口，角色权限页面保存 admin 权限后会触发重同步，避免订单设置等权限被误删。
- `2026-04-28`：纸样管理筛选区新增「纸样师/车版师」条件，选项自动复用人事岗位对应员工，前后端查询链路同步支持按两类岗位人员筛选列表与导出。
- `2026-04-24`：前端完成订单编辑主 composable 拆分：`useOrderEditPage.ts` 收敛为组装入口，数据加载初始化与草稿/提交流程分别下沉到 `useOrderEditLoad.ts`、`useOrderEditSubmit.ts`，降低编辑页耦合复杂度。
- `2026-04-26`：订单模块完成第二批性能修复：`orders` 表补充 `sku/customer/status/factory` 查询索引，批量复制订单改为扩展与成本快照批量预加载（消除复制流程 N+1 查询），并在列表与状态统计请求中补充加载中取消守卫以降低瞬时重复请求。
- `2026-04-25`：订单状态 `reconcileCompletedWorkflowOrders` 从订单列表查询链路移出，改为 `OrdersModule` 内每 2 分钟执行一次的后台定时任务，并补充单订单调和失败告警日志以提升可观测性与列表性能。
- `2026-04-24`：后端完成采购服务职责拆分：`production-purchase.service.ts` 收敛为操作写入入口，采购列表查询与待采购状态自愈下沉到 `production-purchase-query.service.ts`，并更新模块注入保持原有接口行为。
- `2026-04-24`：后端完成订单状态配置服务实迁移：`order-status-config.service.ts` 收敛为代理入口，状态定义/流转链路/SLA与利润报表逻辑分别下沉到 Definition/Transition/Report 服务，降低后续改动冲突面。
- `2026-04-24`：后端完成成品库存入库服务职责拆分：`finished-goods-stock-inbound.service.ts` 聚焦写入/操作流程，查询与尺码快照读取逻辑下沉到 `finished-goods-stock-inbound-query.service.ts`，并在模块中注册新服务以降低入库维护复杂度。
- `2026-04-24`：前端完成成品库存详情抽屉结构化拆分：`FinishedDetailDrawer` 收敛为组装层，基础信息/颜色尺码/操作记录区块下沉子组件，数据与尺寸映射逻辑下沉到 `useFinishedDetail*` composable，保持现有业务行为不变。
- `2026-04-24`：后端完成成品库存操作服务拆分：`finished-goods-stock-operation.service.ts` 收敛为代理入口，入库/库存调整逻辑下沉到 Inbound 服务，出库逻辑下沉到 Outbound 服务，保持接口签名兼容。
- `2026-04-24`：后端完成裁床服务实迁移：`production-cutting.service.ts` 收敛为代理入口，查询聚合与登记写入分别下沉到 Query/Mutation 服务，并保留原接口与导出类型兼容。
- `2026-04-24`：后端完成尾部服务实迁移：`production-finishing.service.ts` 收敛为代理入口，列表/导出/登记弹窗查询与收货/包装/发货/入库写入分别下沉到 Query/Mutation 服务，降低单点改动风险。
- `2026-04-24`：后端完成大体量服务职责拆分第一步：订单、成品库存、裁床、订单状态配置模块新增 Query/Mutation(or Operation)/Status(or Report) 职责服务，并由控制器按职责注入调用，降低单 Service 变更耦合面。
- `2025-03`：财务管理新增「收入流水」「支出流水」：收入按部门+银行账号手动录入（不关联订单），支出可关联订单/供应商或仅填明细；系统设置中新增「财务设置」维护支出类型、银行账号（system_options 只存 ID，改名历史同步）。
- `2025-xx-xx`：完成「订单列表卡片信息重构」，下单时间、合作方式、工艺标签等展示规则见 `docs/ORDER_STATUS_FLOW_DESIGN.md` 第 X 节。  
- `2025-xx-xx`：客户模块接入字段配置，与产品页共用字段配置中心，细节见 `docs/FIELD_CONFIG_DESIGN.md`。  
- `2026-04-23`：生产管理「裁床管理」页面完成结构化拆分，列表查询/选中权限/尺码追踪/登记流程下沉到 composable，并提炼 `CuttingTable` 子组件以降低单文件复杂度。  
- `TODO`：请在实际完成后，用一行中文简单描述改动与影响模块。

> 建议：每次做完**需求级别**的改动（而不是小 bug），就在这里加一条一句话记录即可。

---

## 五、当前重点/待办与风险（可选）

> 这一节可选，用于记项目当前阶段的重点与风险，帮助后续对话更聚焦。

- **当前迭代重点**：`TODO: 例如「打通订单状态流转 + 权限」`  
- **已识别风险**：  
  - `TODO: 例如「订单 edit 页逻辑复杂，多处改动容易互相影响，需要谨慎回归」`  
  - `TODO: 例如「字段配置尚未接入客户/供应商，需要后续统一」`

---

## 六、如何维护本文件（给未来的你和 AI 看）

- **何时更新？**  
  - 新增了模块 / 大页面；  
  - 改动了订单状态、字段配置等「跨模块的约定」；  
  - 完成了一个对业务有明显影响的需求。

- **谁来更新？**  
  - 人工或 AI 均可，只要在改动完成后**补一两句话**，不用追求特别详细。  

- **怎么用？**  
  - 每次在 Cursor 新开对话、要改代码之前，可以先让 AI 读取本文件和相关设计文档，再开始修改；  
  - 这样相当于给 AI 加了一层「本地长期记忆」，减少来回解释、避免改坏已设计好的部分。

