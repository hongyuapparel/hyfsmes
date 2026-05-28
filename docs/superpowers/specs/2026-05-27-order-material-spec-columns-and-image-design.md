# 设计文档：订单物料表新增 成分/克重 列 + 参考图上传并同步采购

- 日期：2026-05-27
- 范围：前后端
- 触发来源：用户提出两点 ——（1）订单编辑「C 物料信息」想在颜色后加「成分」「克重」列，并把偏宽的 来源/类型/操作 列收窄；（2）想加物料参考图（色卡 / 辅料图）上传，并同步到采购页，让采购直接参考网站信息，不再靠跟单截图。

---

## 一、目标

在不改动数据库结构、不改动接口契约的前提下，对订单编辑「C 物料信息」表做两件事：

1. **规格列拆分**：把现在塞在「备注」提示语里的「成分 / 克重」拆成两个独立列（放在「颜色」之后），并收窄 来源/类型/操作 列宽，缓解一行内容拥挤。「备注」列保留，占位提示改为通用说明。
2. **物料参考图**：每条物料新增一张参考图（上传 / 拖拽 / 粘贴），图片列放在表格最前作为视觉锚点；该图与新增的 成分、克重 一并同步显示到**采购详情**（采购列表不动），供采购参考。

约束：复用现有组件与既有透传链路，新增字段不引入技术债、不写 `any`、不破坏键盘导航。

---

## 二、当前现状

### 物料数据模型与存取链路

- 物料以 JSON 形式存在 `order_ext.materials`，类型 `OrderMaterialRow`（[backend/src/entities/order-ext.entity.ts:76](backend/src/entities/order-ext.entity.ts)）。现有字段含 materialSourceId、materialTypeId、supplierName、materialName、color、fabricWidth、usagePerPiece、lossPercent、orderPieces、purchaseQuantity、remark，以及采购/领料登记后写入的 purchaseImageUrl 等。**无 成分、克重、参考图 字段。**
- 前端编辑态行类型 `MaterialRow`（[frontend/src/composables/useOrderMaterials.ts:8](frontend/src/composables/useOrderMaterials.ts)），字段与后端对应。
- 透传链路核对结论：

| 环节 | 文件 / 位置 | 是否自动透传新字段 | 需否改动 |
|---|---|---|---|
| 保存 payload（前端） | [useOrderEditPayload.ts:103](frontend/src/composables/useOrderEditPayload.ts) `materials.map(({materialType,materialSource,...m})=>({...m}))` | ✅ 整行展开 | 否 |
| 落库 normalize（后端） | [order-mutation.service.ts:37](backend/src/orders/order-mutation.service.ts) `normalizeMaterialRows` 仅剥离 materialType/materialSource | ✅ 整行展开 | 否 |
| 详情输出（后端 query） | [order-query.service.ts:57](backend/src/orders/order-query.service.ts) `enrichMaterialsWithOptionLabels` `{...row,...}` | ✅ 整行展开 | 否 |
| **回填编辑表（前端 hydration）** | [useOrderDetailHydration.ts:89](frontend/src/composables/useOrderDetailHydration.ts) 逐字段枚举 | ❌ | **必须补字段** |
| **采购查询映射** | [production-purchase-query.service.ts:185](backend/src/production-purchase/production-purchase-query.service.ts) 逐字段构造 `PurchaseItemRow` | ❌ | **必须补字段** |
| **类型定义** | 前端 `MaterialRow`、后端 `OrderMaterialRow`、前后端 `PurchaseItemRow` | ❌ | **必须补字段** |

> 说明：成本快照映射 [order-mutation.service.ts:579](backend/src/orders/order-mutation.service.ts) 也是逐字段枚举，但成分/克重/参考图与成本无关，**不纳入本次改动**。

### 物料表 UI 与键盘导航

- 物料表 [OrderEditMaterialsCard.vue](frontend/src/components/orders/edit/OrderEditMaterialsCard.vue)：当前 10 个录入列（来源/类型/供应商/名称/颜色/单件用量/损耗/件数/采购总量/备注）+ 操作列。来源、类型 `min-width=120`，操作 `width=80`，备注占位文案为「面料成分 / 克重等」。
- **键盘导航**：[useOrderMaterials.ts:58](frontend/src/composables/useOrderMaterials.ts) `onMaterialCellKeydown` 内 `colsCount = 10` 为**硬编码**；模板中 `setMaterialCellRef(el,$index,colIndex)` 与 `onMaterialCellKeydown($event,$index,colIndex)` 的 `colIndex` 为 0~9 写死。新增列会改变索引，必须同步重排。

### 现成可复用组件

- 上传：[ImageUploadArea.vue](frontend/src/components/ImageUploadArea.vue)（compact 模式，支持点击/拖拽/粘贴，`v-model` 绑定 URL 字符串，已在多处使用）。
- 展示：[AppImageThumb.vue](frontend/src/components/AppImageThumb.vue)（采购详情已用其展示 purchaseImageUrl，[purchase.vue:248](frontend/src/views/production/purchase.vue)）。

---

## 三、设计方案

### 1. 新增字段（无数据库迁移）

`OrderMaterialRow`（后端）与 `MaterialRow`（前端）各新增三个可选字段：

```ts
/** 成分（如 100%棉），面料类常用，辅料可空 */
composition?: string
/** 克重 / 规格（如 180g/m²），面料类常用，辅料可空 */
weight?: string
/** 物料参考图 URL（色卡 / 辅料图），由跟单在订单编辑上传 */
referenceImageUrl?: string
```

`order_ext.materials` 为 JSON 列，新增字段直接随对象存取，**无需建表 / 迁移**。

### 2. 物料表最终列布局

顺序与宽度（编辑态）：

| 顺序 | 列 | 宽度 | 变化 |
|---|---|---|---|
| 1 | 图片 | width≈50 | 新增（`ImageUploadArea` compact，`v-model=row.referenceImageUrl`） |
| 2 | 物料来源 | min-width 120 → **90** | 收窄 |
| 3 | 物料类型 | min-width 120 → **90** | 收窄 |
| 4 | 供应商 | 140 | 不变 |
| 5 | 物料名称 | 160 | 不变 |
| 6 | 颜色 | 120 | 不变 |
| 7 | 成分 | min-width≈120 | 新增（`el-input`） |
| 8 | 克重 | min-width≈90 | 新增（`el-input`） |
| 9 | 单件用量 | 100 | 不变 |
| 10 | 损耗% | 90 | 不变 |
| 11 | 订单件数 | 100 | 不变 |
| 12 | 采购总量 | 100 | 不变 |
| 13 | 备注 | min-width 120 | 占位文案改为「其他说明」 |
| 14 | 操作 | width 80 → **56** | 收窄 |

> 宽度数字为目标值，实现时以视觉不挤、表头不换行为准，可微调 ±10px。

### 3. 键盘导航重排（关键，易漏）

图片列是上传控件，**不参与**文本单元格的 Tab/方向键导航。其余录入列重新编号为 12 个：

| colIndex | 列 |
|---|---|
| 0 | 物料来源 |
| 1 | 物料类型 |
| 2 | 供应商 |
| 3 | 物料名称 |
| 4 | 颜色 |
| 5 | 成分（新） |
| 6 | 克重（新） |
| 7 | 单件用量 |
| 8 | 损耗% |
| 9 | 订单件数 |
| 10 | 采购总量 |
| 11 | 备注 |

改动：
- [useOrderMaterials.ts:60](frontend/src/composables/useOrderMaterials.ts) `colsCount = 10` → `12`。
- [OrderEditMaterialsCard.vue](frontend/src/components/orders/edit/OrderEditMaterialsCard.vue) 模板内 颜色 之后所有列的 `colIndex`（原 5~9）整体 +2，并为 成分、克重 补上 5、6。

### 4. 回填补字段

[useOrderDetailHydration.ts:89](frontend/src/composables/useOrderDetailHydration.ts) 的 `materials.value = (d.materials ?? []).map(...)` 中，补：

```ts
composition: m.composition ?? '',
weight: m.weight ?? '',
referenceImageUrl: m.referenceImageUrl ?? '',
```

类型来源：hydration 用的 `MaterialPayload` 是 `NonNullable<OrderDetail['materials']>[number]` 推导别名（[useOrderDetailHydration.ts:53](frontend/src/composables/useOrderDetailHydration.ts)），其字段实际定义在 `OrderFormPayload.materials` 内联数组（[frontend/src/api/orders.ts:157](frontend/src/api/orders.ts)）。**三个新字段补到这里即可**，同时覆盖「保存 payload 出参类型」与「详情回填入参类型」两用途。

### 5. 采购同步（参考图 + 成分 + 克重）

仅同步到**采购详情抽屉**「本行物料」区，采购列表不动。

后端：
- `PurchaseItemRow`（[production-purchase.types.ts:11](backend/src/production-purchase/production-purchase.types.ts)）新增 `referenceImageUrl: string | null`、`composition: string`、`weight: string`。
- [production-purchase-query.service.ts:185](backend/src/production-purchase/production-purchase-query.service.ts) 构造行处补：`referenceImageUrl: m.referenceImageUrl ?? null`、`composition: (m.composition ?? '').trim()`、`weight: (m.weight ?? '').trim()`。

前端：
- 前端 `PurchaseItemRow` 类型（`frontend/src/api/production-purchase.ts`）同步加三个字段。
- 采购详情「本行物料」区（[purchase.vue:187](frontend/src/views/production/purchase.vue)）新增三条 `el-descriptions-item`：成分、克重，以及「参考图」（用 `AppImageThumb` 展示 `referenceImageUrl`，无图显示「—」，与采购凭证写法一致）。

### 6. 边界与不动项

- **方向单一**：参考图、成分、克重由跟单在订单编辑录入，采购侧只读；采购仍只改自己的 `purchaseImageUrl`（采购凭证），职责不冲突。
- **采购操作字段保留逻辑不变**：`materialOperationMatchKey`（[order-mutation.service.ts:54](backend/src/orders/order-mutation.service.ts)）**不纳入**新字段——成分/克重/参考图变化不应影响采购登记数据的行匹配与保留。
- **复制订单**：参考图等随 `materials` JSON 一并继承（[order-mutation.service.ts:458](backend/src/orders/order-mutation.service.ts) `materials: srcExt.materials`），符合预期。
- 成本快照、订单详情只读页（detail.vue）本次**不展示**新字段（如后续需要再单列需求）。

---

## 四、分阶段实施

### Phase 1 —— 规格列 + 列宽（纯前端 + 2 个模型字段）

1. `OrderMaterialRow`（后端）新增 composition、weight。
2. `MaterialRow`（前端）新增 composition、weight。
3. `OrderEditMaterialsCard.vue`：颜色后加 成分、克重 列；收窄 来源/类型/操作；备注占位改文案；重排 colIndex。
4. `useOrderMaterials.ts`：`colsCount` 10 → 12。
5. `useOrderDetailHydration.ts`：补 composition、weight 及其 payload 类型。

验证点：新增→保存→重新打开能正确回填；键盘 Tab/方向键能走通所有列。

### Phase 2 —— 参考图 + 采购同步

1. `OrderMaterialRow`、`MaterialRow` 新增 referenceImageUrl。
2. `OrderEditMaterialsCard.vue`：最前加图片列（`ImageUploadArea`）。
3. `useOrderDetailHydration.ts`：补 referenceImageUrl。
4. 后端 `PurchaseItemRow` + 采购查询映射补三字段。
5. 前端 `PurchaseItemRow` 类型补三字段。
6. 采购详情「本行物料」区加 成分/克重/参考图 展示。

验证点：编辑上传参考图→保存→进入采购详情能看到图与成分/克重。

---

## 五、验证方式

- 类型与编译：改动完成后本地 `npm run build`（前端）、`npm run build`（后端），与宝塔一致，确保无类型错误（dev 不查类型会漏错）。
- `el-radio` 检查：本次无 radio 改动，可跳过 `npm run check:el-radio-value`。
- 手动：按上面两个 Phase 的验证点逐项回归。

---

## 六、改动文件清单（汇总）

前端：
- `frontend/src/composables/useOrderMaterials.ts`
- `frontend/src/components/orders/edit/OrderEditMaterialsCard.vue`
- `frontend/src/composables/useOrderDetailHydration.ts`
- `frontend/src/api/orders.ts`（`OrderFormPayload.materials` 加 composition/weight/referenceImageUrl）
- `frontend/src/api/production-purchase.ts`
- `frontend/src/views/production/purchase.vue`

后端：
- `backend/src/entities/order-ext.entity.ts`
- `backend/src/production-purchase/production-purchase.types.ts`
- `backend/src/production-purchase/production-purchase-query.service.ts`

无数据库迁移、无新接口。
