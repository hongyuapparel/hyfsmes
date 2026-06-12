# 装箱单（Packing List）功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 库存管理下新增「装箱单」：从待仓处理/成品库存选货（含手工行）做 Excel 式分箱录入，确认发货时自动走两边既有发货逻辑，支持一键生成可改字箱贴（A4 打印）与中英双语 Excel 导出。

**Architecture:** 后端新增 `packing-lists` NestJS 模块（3 张新表，启动自动建表），发货复用 `InventoryPendingService.doOutbound` 与 `FinishedGoodsStockOutboundService.outbound`（不复制库存逻辑）。前端在库存管理下新增列表页 + 编辑页（editable-grid 表格、rowspan 合并箱级单元格），箱贴用 contenteditable + `@media print`，Excel 用前端 `xlsx`（HR 导出同款）。

**Tech Stack:** NestJS + TypeORM(MySQL, synchronize:false + 启动 ensure)、Vue3 + Element Plus + `xlsx@0.18.5`。

**已确认的代码事实（实现时直接引用，勿再猜）：**
- 待仓发货：`backend/src/inventory-pending/inventory-pending.service.ts:455` `doOutbound(items: {id,quantity,sizeBreakdown}[], operatorUsername, pickupUserId?)`，校验 quantity ≤ pending.quantity、拒绝 defect、同客户；`sizeBreakdown` 仅存档不校验。
- 成品出库：`backend/src/finished-goods-stock/finished-goods-stock-outbound.service.ts:351` `outbound(items: {id,quantity,sizeBreakdown}[], operatorUsername, remark, pickupUserId?)`，**当库存有 colorSizeSnapshot 时必须传同构 sizeBreakdown（{headers,rows:[{colorName,quantities}]}）且逐格扣减校验**。
- `FinishedGoodsStockModule` 已 export `FinishedGoodsStockOutboundService`；`InventoryPendingModule` 未 export service，需补。
- 权限：`backend/src/database/seed-permissions.ts` PERMISSIONS 数组加一条即可，启动时 `main.ts:319` 自动 seed；controller 用 `@RequirePermission('/inventory/packing')`。
- 建表模式：`backend/src/main.ts:27-328` `ensure*()` 函数（`CREATE TABLE IF NOT EXISTS` / information_schema 查列），同时给 `backend/scripts/*.sql`。
- 订单颜色图：`order_ext.color_size_rows`（JSON `ColorSizeRow{colorName,quantities,remark,imageUrl}`，`backend/src/entities/order-ext.entity.ts:69`）。
- 成品颜色图：`finished_goods_stock_color_images(finished_stock_id,color_name,image_url)`。
- 客户实体 `customer.entity.ts`：`companyName`、`salesperson`（纯文本）。无英文名字段。
- 前端：request 从 `./request` import；菜单 `src/router/menu.ts:37` 库存管理块；路由 `src/router/index.ts:130` inventory children，编辑页复用列表权限的先例见 `index.ts:68-72`（orders edit 用 `permissionPath: '/orders/list'`）。
- editable-grid 样例：`frontend/src/components/orders/edit/OrderEditColorSizeCard.vue:12`、`production/SewingRegisterDialog.vue:34`；行高变量 `styles/design-system.css:77-78`。
- 图片上传组件：`frontend/src/components/ImageUploadArea.vue`（v-model=url，`dense` 模式，点击/拖拽/Ctrl+V 都已支持）。
- 打印先例：`frontend/src/views/orders/detail.vue` + `detail.css`（`window.print`、`@media print`、`.a4-sheet` 210mm）。
- Excel 导出先例：`frontend/src/composables/useHrEmployeeList.ts:203-234`（`XLSX.utils.aoa_to_sheet/json_to_sheet` + `writeFile`）。
- 客户下拉：`frontend/src/api/customers.ts` `getAllCustomerCompanyOptions()`；用户：`frontend/src/api/users.ts` `getUsers()`。
- 待仓列表 API：`GET /inventory/pending/items`（无客户筛选；pickable 接口自建查询，不改它）。

---

## 数据模型（全局约定）

`sizeQuantities` 行内尺码数据统一为 `Record<string, number>`（码名→件数）；列顺序由 `packing_lists.size_headers`（`string[]` JSON）决定。发货时按 sourceId 聚合转回 `{headers, rows:[{colorName, quantities}]}` snapshot。

```sql
-- backend/scripts/create-packing-list-tables.sql（同逻辑写进 main.ts ensurePackingListTables）
CREATE TABLE IF NOT EXISTS packing_lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL DEFAULT '',
  customer_id INT NULL,
  customer_name VARCHAR(255) NOT NULL DEFAULT '',
  service_manager VARCHAR(128) NOT NULL DEFAULT '',
  po_no VARCHAR(255) NOT NULL DEFAULT '',
  pack_date DATE NULL,
  remark VARCHAR(1000) NOT NULL DEFAULT '',
  show_company TINYINT NOT NULL DEFAULT 1,
  size_headers JSON NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  shipped_at DATETIME NULL,
  operator_username VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_packing_lists_status (status),
  KEY idx_packing_lists_customer_name (customer_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS packing_list_boxes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packing_list_id INT NOT NULL,
  box_seq INT NOT NULL,
  weight_kg DECIMAL(10,2) NULL,
  carton_size VARCHAR(64) NOT NULL DEFAULT '',
  remark VARCHAR(255) NOT NULL DEFAULT '',
  KEY idx_plb_list (packing_list_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS packing_list_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packing_list_id INT NOT NULL,
  box_id INT NOT NULL,
  style_no VARCHAR(128) NOT NULL DEFAULT '',
  style_name VARCHAR(255) NOT NULL DEFAULT '',
  color_name VARCHAR(128) NOT NULL DEFAULT '',
  image_url VARCHAR(512) NOT NULL DEFAULT '',
  size_quantities JSON NULL,
  total_qty INT NOT NULL DEFAULT 0,
  source_type VARCHAR(16) NOT NULL DEFAULT 'manual',
  source_id INT NULL,
  KEY idx_pli_list (packing_list_id),
  KEY idx_pli_box (box_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

说明：`customer_name` 冗余是既有模式（`finished_goods_stock` 同款），且支持档案外手填客户；`service_manager` 存文本对齐 `customer.salesperson` 既有模式。`source_type ∈ 'pending'|'finished'|'manual'`，`source_id` 对应 `inbound_pending.id` / `finished_goods_stock.id`。

## API 设计

| 方法 | 路由 | 说明 |
|---|---|---|
| GET | `/packing-lists` | 列表，query: `status?`,`customerName?`,`dateFrom?`,`dateTo?`,`page`,`pageSize`；行带聚合 boxCount/totalQty/totalWeight |
| GET | `/packing-lists/:id` | 详情（含 boxes+items） |
| POST | `/packing-lists` | 新建草稿（整单 payload，服务端生成 code `PL-YYYYMMDD-NN`） |
| PUT | `/packing-lists/:id` | 更新草稿（事务内整单替换 boxes/items；status≠draft 拒绝） |
| DELETE | `/packing-lists/:id` | 仅草稿可删 |
| POST | `/packing-lists/:id/ship` | 确认发货（见 Task 4） |
| GET | `/packing-lists/pickable/pending` | query `customerName?`,`keyword?`,`page`,`pageSize`；返回**按颜色拆行**的可选货 |
| GET | `/packing-lists/pickable/finished` | 同上，来源成品库存 |

pickable 行结构（两端同构）：
```ts
interface PickableLine {
  sourceType: 'pending' | 'finished'
  sourceId: number
  orderNo: string
  styleNo: string        // skuCode
  customerName: string
  colorName: string
  imageUrl: string       // pending→order_ext.colorSizeRows 匹配色；finished→color_images 匹配色
  sizeQuantities: Record<string, number>  // 该色当前可发分码数
  totalQty: number
  hasSnapshot: boolean   // finished 无 colorSizeSnapshot 时 false（整数发不分码，UI 提示）
}
```

## 文件清单

**后端（新建）**
- `backend/src/entities/packing-list.entity.ts` / `packing-list-box.entity.ts` / `packing-list-item.entity.ts`
- `backend/src/packing-lists/packing-lists.module.ts`
- `backend/src/packing-lists/packing-lists.controller.ts`
- `backend/src/packing-lists/packing-lists.service.ts`（CRUD+列表聚合，≤500 行警戒）
- `backend/src/packing-lists/packing-lists-pickable.service.ts`（选货查询）
- `backend/src/packing-lists/packing-lists-ship.service.ts`（发货聚合+调用两服务）
- `backend/scripts/create-packing-list-tables.sql`

**后端（修改，均为加法）**
- `backend/src/main.ts`：`ensurePackingListTables()` + 调用
- `backend/src/database/seed-permissions.ts`：`{ code: 'menu_inventory_packing', name: '装箱单', routePath: '/inventory/packing', type: 'menu' }`
- `backend/src/inventory-pending/inventory-pending.module.ts`：`exports: [InventoryPendingService]`
- `backend/src/app.module.ts`：注册 `PackingListsModule`

**前端（新建）**
- `frontend/src/api/packing-lists.ts`
- `frontend/src/views/inventory/packing.vue`（列表，≤300）
- `frontend/src/views/inventory/packing-edit.vue`（编排，≤300）
- `frontend/src/composables/usePackingListEdit.ts`（加载/保存/发货，≤250）
- `frontend/src/composables/usePackingGridRows.ts`（箱/行/尺码列操作+合计+分配校验，≤250）
- `frontend/src/composables/usePackingGridRows.spec.ts`（纯逻辑 Vitest）
- `frontend/src/components/packing/PackingGrid.vue`（editable-grid 主表，≤350）
- `frontend/src/components/packing/PackingGoodsPickerDialog.vue`（选货弹窗，≤350）
- `frontend/src/components/packing/PackingLabelPrint.vue`（箱贴预览+打印，≤350）
- `frontend/src/utils/packing-export.ts`（xlsx 导出）

**前端（修改）**
- `frontend/src/router/index.ts`：inventory children 加 `packing`（菜单权限 `/inventory/packing`）与 `packing/edit/:id?`（`meta.permissionPath: '/inventory/packing'`，照 orders edit 先例）
- `frontend/src/router/menu.ts`：库存管理块加 `{ path: '/inventory/packing', title: '装箱单' }`

---

### Task 1：后端表/实体/权限种子

**Files:** 新建 3 个 entity + SQL 脚本；修改 `main.ts`、`seed-permissions.ts`。

- [x] Step 1 写 3 个 entity（字段与上方 SQL 一一对应；JSON 列用 `@Column({ type: 'json', nullable: true })`，类型 `string[] | null` / `Record<string, number> | null`，照 `order-ext.entity.ts` 写法）
- [x] Step 2 写 `backend/scripts/create-packing-list-tables.sql`（内容即上方 SQL，文件头注释一行用途）
- [x] Step 3 `main.ts` 加 `ensurePackingListTables(dataSource)`：三段 `CREATE TABLE IF NOT EXISTS`（照 `ensureInventoryOperationLogTables` 行 156-188 模式），在启动序列（行 302-328 区域）加调用
- [x] Step 4 `seed-permissions.ts` PERMISSIONS 数组「库存管理」分组内（行 33 后）插入 menu_inventory_packing 条目
- [x] Step 5 `cd backend && npm run build` 通过
- [x] Step 6 commit `feat(packing): 装箱单数据表与权限种子`

### Task 2：后端模块 CRUD

**Files:** 新建 module/controller/service；修改 `app.module.ts`。

- [x] Step 1 `packing-lists.service.ts`：
  - `getList(query)`：QueryBuilder 左联 boxes/items 聚合 `COUNT(DISTINCT box.id)`、`SUM(item.total_qty)`、`SUM(box.weight_kg)`，筛 status/customerName like/pack_date 区间，分页返回 `{list,total}`
  - `getDetail(id)`：list + boxes(按 box_seq) + items(按 box 分组)
  - `create(payload, username)`：事务内生成 code（当日 `COUNT(*) WHERE code LIKE 'PL-YYYYMMDD-%'` + 1，两位补零）→ 存主表 → 存 boxes → 存 items（box_id 回填）
  - `update(id, payload)`：status==='draft' 校验 → 事务内更新主表 + `DELETE` 旧 boxes/items + 重插
  - `remove(id)`：仅 draft
  - payload DTO 用 class-validator（`@IsString/@IsOptional/@IsArray/@ValidateNested`），boxes 内嵌 items
- [x] Step 2 controller：`@Controller('packing-lists')` + `@UseGuards(JwtAuthGuard, PermissionGuard)` + `@RequirePermission('/inventory/packing')`，`@CurrentUser()` 取 username（照 inventory-pending.controller 模式）
- [x] Step 3 module：forFeature 三个新实体 + `Order`、`OrderExt`、`InboundPending`、`FinishedGoodsStock`、`FinishedGoodsStockColorImage`、`Product`；imports `AuthModule`；app.module 注册
- [x] Step 4 `npm run build` 通过
- [x] Step 5 commit `feat(packing): 装箱单后端 CRUD`

### Task 3：后端选货接口

**Files:** 新建 `packing-lists-pickable.service.ts`；controller 加两个 GET。

- [x] Step 1 `getPendingPickable({customerName, keyword, page, pageSize})`：
  - `inbound_pending WHERE status='pending' AND (source_type IS NULL OR source_type='normal')` join `orders ON order_id`（customerName like 筛 orders.customer_name；keyword 同时模糊 sku_code/order_no）
  - 取 `order_ext.color_size_rows` 建 `colorName→imageUrl` 映射
  - 每条 pending 的 `colorSizeSnapshot.rows` 逐色拆为 PickableLine；snapshot 缺失（老数据）时输出单行 `colorName:''、sizeQuantities:{}, totalQty:quantity, hasSnapshot:false`
- [x] Step 2 `getFinishedPickable(...)`：`finished_goods_stock` 按 customer_name 筛；逐色拆 `colorSizeSnapshot`；颜色图查 `finished_goods_stock_color_images`；无 snapshot 同上降级
- [x] Step 3 controller 加 `GET pickable/pending`、`GET pickable/finished`
- [x] Step 4 build + commit `feat(packing): 装箱单选货查询接口`

### Task 4：后端发货

**Files:** 新建 `packing-lists-ship.service.ts`；修改 `inventory-pending.module.ts`（exports）、`packing-lists.module.ts`（imports 两模块）。

- [x] Step 1 `inventory-pending.module.ts` 加 `exports: [InventoryPendingService]`；packing module imports `InventoryPendingModule`、`FinishedGoodsStockModule`
- [x] Step 2 `ship(id, username)` 逻辑：
  ```
  1. getDetail(id)，status!=='draft' → BadRequest('该装箱单已发货')
  2. 按 sourceType 分组 items（manual 跳过）：
     groupBySource: Map<sourceId, { totalQty, colorRows: Map<colorName, Record<size,qty>> }>
     （同 source 同色多箱行合并相加）
  3. 组装 snapshot：headers = 该 source 出现过的所有码（按 list.size_headers 顺序），
     rows = [{colorName, quantities: headers.map(h => qty)}]
     hasSnapshot=false 的行（colorName='' 且无码）→ sizeBreakdown=null
  4. 预校验（只读，发货前两边都查一遍，把跨服务非原子风险压到最低）：
     pending: 记录存在/status='pending'/非 defect/total ≤ quantity
     finished: 记录存在/total ≤ quantity；有 colorSizeSnapshot 的逐色逐码 ≤ 当前值
     任一不过 → BadRequest 列出明细，什么都不执行
  5. await inventoryPendingService.doOutbound(pendingItems, username, null)
  6. await finishedOutboundService.outbound(finishedItems, username, `装箱单发货 ${code}`, null)
  7. UPDATE packing_lists SET status='shipped', shipped_at=NOW()
  步骤 5/6 之间若 6 失败：状态保持 draft，错误信息注明「待仓部分已发出，请勿重复发货，需人工核对」——预校验已把该概率压到数据竞争窗口内
  ```
- [x] Step 3 controller `POST :id/ship`
- [x] Step 4 build + commit `feat(packing): 装箱单确认发货联动待仓/成品出库`

### Task 5：前端 API + 路由 + 菜单

- [x] Step 1 `api/packing-lists.ts`：类型（`PackingListRow/PackingListDetail/PackingBoxPayload/PackingItemPayload/PickableLine`，与后端 DTO 字段一致）+ 8 个函数（`getPackingLists/getPackingListDetail/createPackingList/updatePackingList/deletePackingList/shipPackingList/getPickablePending/getPickableFinished`），`import request from './request'`
- [x] Step 2 router：inventory children 加
  ```ts
  { path: 'packing', name: 'InventoryPacking', component: () => import('@/views/inventory/packing.vue'), meta: { title: '装箱单', permissionPath: '/inventory/packing' } },
  { path: 'packing/edit/:id?', name: 'InventoryPackingEdit', component: () => import('@/views/inventory/packing-edit.vue'), meta: { title: '装箱单编辑', permissionPath: '/inventory/packing' } },
  ```
  menu.ts 库存管理块加 `{ path: '/inventory/packing', title: '装箱单' }`
- [x] Step 3 先建两个最小占位 .vue（仅标题）保证路由编译；`cd frontend && npm run build` 通过
- [x] Step 4 commit `feat(packing): 装箱单前端路由与 API 封装`

### Task 6：列表页 packing.vue

- [x] Step 1 筛选栏（客户关键字/状态/日期范围，照 pending.vue 工具栏密度）+ `新建装箱单` 按钮 → push edit 路由
- [x] Step 2 表格列：单号/客户/业务员/款号摘要（items 去重 styleNo 首个+N款）/箱数/件数/总重/状态 tag/装箱日期/操作（编辑或查看、箱贴、导出、删除-仅草稿，删除走 ElMessageBox.confirm）
- [x] Step 3 操作「箱贴/导出」直接 getDetail 后复用 Task 9/10 的组件与 util
- [x] Step 4 build + commit `feat(packing): 装箱单列表页`

### Task 7：编辑页（核心）

**结构：** `packing-edit.vue`（编排）→ `usePackingListEdit`（load/save/导航）+ `usePackingGridRows`（数据操作）→ `PackingGrid.vue`（渲染）+ `PackingGoodsPickerDialog.vue`。

- [x] Step 1 `usePackingGridRows.ts` 纯逻辑（先写 spec 后写实现，照 `useOrderSizeInfo.spec.ts` 模式）：
  - state：`sizeHeaders: string[]`、`boxes: PackingBoxDraft[]`（box 含 `items: PackingItemDraft[]`）
  - 操作：`addBox/removeBox/copyBox(seq 重排)/addItemToBox/removeItem/insertSizeHeader(name,idx)/removeSizeHeader(name)`
  - 派生：`flatRows`（供 el-table，行带 boxRef/首行标记/rowspan 数）、`totals`（总箱/件/重 + 每码合计）、`allocationBySource`（Map<`${sourceType}:${sourceId}:${colorName}`, 已分配 Record<size,qty>>）
  - 校验：`validateAgainstPicked(pickedLines)` → 超发明细数组（finished 逐码、pending 总量）
  - spec 覆盖：copyBox 序号重排、insertSizeHeader 不丢已有数量、allocation 跨箱累加、超发检出
- [x] Step 2 `npx vitest run src/composables/usePackingGridRows.spec.ts` 通过
- [x] Step 3 `PackingGrid.vue`：`<el-table :data="flatRows" class="editable-grid" :span-method="spanMethod">`
  - spanMethod：箱号/重量/箱规/箱备注列在 box 首行 rowspan=items.length，其余行 [0,0]
  - 列：箱号 | 款号(el-input) | 颜色/图片(ImageUploadArea dense + el-input 色名) | 动态码列(el-input-number, v-for sizeHeaders) | 合计(只读) | 重量(el-input-number, box) | 箱规(el-input, box) | 备注(el-input, box) | 行操作(本箱加款/删行)
  - 含图片列 → 该表局部行高自适应（CLAUDE.md 既定做法）
  - 表头动态码列后插「+」列头按钮 → emit `insert-size`
  - 底部合计行用 `show-summary` 自定义 `summary-method`
- [x] Step 4 `PackingGoodsPickerDialog.vue`：AppDialog(width 900) + el-tabs（待仓处理/成品库存）+ 关键字搜索 + 分页表（款号/订单号/颜色图/颜色/各码可发/合计/已分配提示），多选 → emit `picked(lines)`；已选过的行打标
- [x] Step 5 `usePackingListEdit.ts`：路由参数加载详情/新建空单（默认 1 空箱、pack_date 今天、size_headers []）；表头表单（客户=getAllCustomerCompanyOptions 的 el-select filterable allow-create、业务员=getUsers el-select filterable allow-create、PO、整单备注、公司名 el-switch）；`save()`（create/update 后回列表或留页提示）；客户切换且已有来源行时 ElMessageBox 提醒清空来源行
- [x] Step 6 `packing-edit.vue` 组装；选货行进箱默认 sizeQuantities=剩余可发（pickable 值减 allocationBySource）
- [x] Step 7 手工加行：box 行操作「+手工行」直接插空行（source_type manual，全字段可编）
- [x] Step 8 `npm run build`（vue-tsc）通过 + commit `feat(packing): 装箱单编辑页与选货`

### Task 8：发货动作

- [x] Step 1 编辑页「确认发货」：先 `validateAgainstPicked` 前端拦截超发 → ElMessageBox.confirm（列箱数/件数）→ `save()` → `shipPackingList(id)` → 成功后状态变只读（所有输入 disabled、按钮区换成 箱贴/导出/返回）
- [x] Step 2 已发货单进编辑页全只读（detail.status 驱动）
- [x] Step 3 build + commit `feat(packing): 装箱单确认发货`

### Task 9：箱贴 PackingLabelPrint.vue

- [x] Step 1 props：`detail: PackingListDetail`、`v-model`(visible)。AppDialog 全宽预览，每箱一张 label（方案 D 版式）：
  - 顶条（show_company 时）：HONGYU APPAREL ｜ Service manager: xxx
  - 抬头：po_no 优先否则 customer_name + `CARTON NO# {seq} OF {total}`
  - 每款块：左图（item.image_url，无图不留位）+ STYLE NO#/COLOR + SIZE/QTY 表格行（只列该行有量的码）
  - 底部：TOTAL PCS / WEIGHT / CARTON SIZE / SHIPPING(box.remark，空则整行省) / MADE IN CHINA
- [x] Step 2 可改字：所有文本节点 `contenteditable="true"`（只改 DOM 不回写数据）；箱多选 checkbox 决定打印哪些
- [x] Step 3 打印：组件内 `@media print` —— `body * visibility:hidden; .packing-label-print-area, .packing-label-print-area * visibility:visible; position:absolute; inset:0`，每张 label `page-break-after: always`、宽 210mm 内边距留白（照 orders/detail.css 的 a4 尺寸基准）；按钮 `window.print()`
- [x] Step 4 列表页/编辑页接入；build + commit `feat(packing): 箱贴一键生成与打印`

### Task 10：Excel 导出 packing-export.ts

- [x] Step 1 `exportPackingListExcel(detail)`：`XLSX.utils.aoa_to_sheet` 组装（贴近公盘模板）：
  - 行1：`装箱日期 Pack Date: x` / `Total: N箱`；行2：客户 Client、业务员 Service manager、PO#、备注 Remark
  - 表头行：`箱号 Carton No. | 款号 Style No. | 颜色 Color | <各码> | 合计 Qty | 重量 Weight(kg) | 箱规 Carton Size(cm) | 备注 Remark`
  - 数据行按箱展开；`!merges` 合并多款箱的箱号/重量/箱规/备注单元格；末行合计
  - 文件名 `装箱单_{code}_{customerName}.xlsx`；列宽 `!cols` 适配
  - 已知限制：SheetJS CE 不支持嵌图，颜色列导出文字（向用户说明）
- [x] Step 2 列表页+编辑页接「导出 Excel」；build + commit `feat(packing): 装箱单导出双语 Excel`

### Task 11：收尾验证

- [x] Step 1 根目录前后端完整 build 各跑一次；`npm run check:el-radio-value`
- [x] Step 2 `npx vitest run`（前端既有 + 新 spec）
- [x] Step 3 `scripts/start.ps1` 起本地，过冒烟：菜单出现 → 新建（手填客户+手工行+插码列）→ 保存草稿 → 重开 → 选货（两来源）→ 确认发货 → 待仓/成品两页核对扣减与出库记录 → 箱贴打印预览 → Excel 导出打开核对
- [x] Step 4 `git status` 核对改动面；docs/PROJECT_CONTEXT.md 更新记录一行
- [x] Step 5 commit `docs: 装箱单功能说明`

## Self-Review 结论

- 覆盖检查：客户手填（allow-create）✓ 业务员 ✓ PO 选填回退客户名 ✓ 公司名开关 ✓ 整单+箱级备注 ✓ 插尺码列 ✓ 双语 ✓ 手工行传图 ✓ 一键箱贴可改字 ✓ 部分发货（分码差额校验）✓ 草稿/已发货状态 ✓ 两来源混选+联动扣减 ✓
- 风险点已显式处理：finished 出库强制 snapshot 同构（Task 4 Step 2.3）；跨服务非原子用预校验压缩窗口（Step 2.4）；老数据无 snapshot 降级（hasSnapshot:false 链路）
- 不做（本期范围外）：历史 Excel 导入、运费预估、pickupUser（装箱单发货不选领货人，传 null，出库记录 remark 带装箱单号可溯）
