<template>
  <div class="order-detail-page" v-loading="loading">
    <div class="toolbar no-print">
      <el-button @click="goBack">返回列表</el-button>
      <el-button type="primary" @click="handlePrint" :disabled="!detail">打印</el-button>
    </div>

    <div class="a4-sheet" v-if="detail">
      <header class="sheet-header">
        <span class="brand">鸿宇服饰 · 订单</span>
        <span class="header-sep" v-if="detail.orderNo">订单号：</span>
        <span class="header-order-no" v-if="detail.orderNo">{{ detail.orderNo }}</span>
        <span class="header-sep" v-if="detail.orderDate">下单日期：</span>
        <span v-if="detail.orderDate">{{ formatDate(detail.orderDate) }}</span>
        <span class="header-meta-right" v-if="headerMetaValues.length">
          {{ headerMetaValues.join('  ') }}
        </span>
      </header>

      <div class="block block-ab-layout">
        <div class="ab-left">
          <div v-if="detail.imageUrl" class="main-image">
            <el-image :src="detail.imageUrl" fit="contain" />
          </div>
          <div v-else class="main-image placeholder">
            无主图
          </div>
        </div>

        <div class="ab-right">
          <OrderDetailBasicInfoSection
            :detail="detail"
            :collaboration-display="collaborationDisplay"
            :order-type-display="orderTypeDisplay"
          />

          <section v-if="hasColorSize" class="block block-color-qty">
            <div class="block-title">B 颜色 / 数量</div>
            <div class="block-body">
              <el-table
                :data="colorSizeRowsForView"
                border
                size="small"
                class="compact-table table-full"
              >
                <el-table-column prop="colorName" label="颜色" min-width="80" />
                <el-table-column
                  v-for="(header, index) in colorSizeHeadersForView"
                  :key="header + index"
                  :label="header"
                  min-width="60"
                >
                  <template #default="{ row }">
                    <span>{{ formatDisplayNumber(row.quantities[index]) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="合计" min-width="60">
                  <template #default="{ row }">
                    <span>{{ formatDisplayNumber(row.total) }}</span>
                  </template>
                </el-table-column>
                <el-table-column v-if="hasColorRemark" label="备注" min-width="100">
                  <template #default="{ row }">
                    <span>{{ row.remark }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </section>
        </div>
      </div>

      <OrderDetailMaterialsSection
        :has-materials="hasMaterials"
        :materials-for-view="materialsForView"
        :material-columns="materialColumns"
        :format-detail-material-cell="formatDetailMaterialCell"
      />

      <OrderDetailSizeInfoSection
        :has-size-info="hasSizeInfo"
        :size-info-rows-for-view="sizeInfoRowsForView"
        :size-meta-headers-for-view="sizeMetaHeadersForView"
        :size-headers-for-view="sizeHeadersForView"
        :size-meta-col-width="sizeMetaColWidth"
        :size-value-col-width="sizeValueColWidth"
      />

      <section v-if="hasProcessItems" class="block">
        <div class="block-title">E 工艺项目</div>
        <div class="block-body">
          <el-table
            :data="processItemsForView"
            border
            size="small"
            class="compact-table table-full process-table-view"
          >
            <el-table-column
              v-for="col in processColumns"
              :key="`process-col-${col.key}`"
              :prop="col.key"
              :label="col.label"
              :min-width="col.minWidth"
              :show-overflow-tooltip="col.showOverflowTooltip"
            >
              <template #default="{ row }">
                {{ formatDetailProcessCell(row, col.key) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>

      <section v-if="detail.productionRequirement" class="block">
        <div class="block-title">F 生产要求</div>
        <div class="block-text production-text">
          {{ detail.productionRequirement }}
        </div>
      </section>

      <section v-if="hasPackaging" class="block">
        <div class="block-title">G 包装要求</div>
        <div class="packaging-list">
          <div
            v-for="(cell, index) in packagingCellsForView"
            :key="cell.header + index"
            class="packaging-item"
          >
            <div class="packaging-header-text">
              {{ cell.header }}
            </div>
            <div v-if="cell.description" class="packaging-desc">
              {{ cell.description }}
            </div>
            <div v-if="cell.imageUrl" class="packaging-image-wrap">
              <el-image :src="cell.imageUrl" fit="contain" />
            </div>
          </div>
        </div>
        <div v-if="detail.packagingMethod" class="block-text packaging-method">
          包装方式：{{ detail.packagingMethod }}
        </div>
      </section>

      <OrderDetailAttachmentsSection
        :has-attachments="hasAttachments"
        :attachments-for-view="attachmentsForView"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import OrderDetailBasicInfoSection from '@/components/orders/detail/OrderDetailBasicInfoSection.vue'
import OrderDetailMaterialsSection from '@/components/orders/detail/OrderDetailMaterialsSection.vue'
import OrderDetailSizeInfoSection from '@/components/orders/detail/OrderDetailSizeInfoSection.vue'
import OrderDetailAttachmentsSection from '@/components/orders/detail/OrderDetailAttachmentsSection.vue'
import { useOrderDetailLoader } from '@/composables/useOrderDetailLoader'
import { useOrderDetailDictionaries } from '@/composables/useOrderDetailDictionaries'
import { useOrderDetailView } from '@/composables/useOrderDetailView'

const route = useRoute()
const router = useRouter()

const { loading, detail, loadDetail } = useOrderDetailLoader({ route, router })
const {
  loadDicts,
  findOrderTypeLabelById,
  findCollaborationLabelById,
  findMaterialTypeLabelById,
} = useOrderDetailDictionaries()

const {
  orderTypeDisplay,
  collaborationDisplay,
  headerMetaValues,
  colorSizeHeadersForView,
  colorSizeRowsForView,
  hasColorSize,
  hasColorRemark,
  materialsForView,
  hasMaterials,
  materialColumns,
  sizeMetaHeadersForView,
  sizeHeadersForView,
  sizeMetaColWidth,
  sizeValueColWidth,
  sizeInfoRowsForView,
  hasSizeInfo,
  processItemsForView,
  hasProcessItems,
  processColumns,
  packagingCellsForView,
  hasPackaging,
  attachmentsForView,
  hasAttachments,
  formatDetailMaterialCell,
  formatDetailProcessCell,
} = useOrderDetailView({
  detail,
  findOrderTypeLabelById,
  findCollaborationLabelById,
  findMaterialTypeLabelById,
})

function goBack() {
  void router.push({ name: 'OrdersList' })
}

function handlePrint() {
  window.print()
}

onMounted(async () => {
  await Promise.all([loadDicts(), loadDetail()])
  if (route.query.print === '1' && detail.value) {
    await nextTick()
    window.print()
    await router.replace({ name: 'OrdersDetail', params: route.params })
  }
})
</script>

<style src="./detail.css"></style>
