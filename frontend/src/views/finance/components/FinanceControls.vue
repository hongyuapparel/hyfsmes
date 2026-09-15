<template>
  <AppDialog top="2vh" :model-value="visible" title="资金核对与内部转账" width="1050" @update:model-value="emit('close', $event)">
    <el-tabs v-model="tab">
      <el-tab-pane label="账户与对账" name="accounts">
        <el-alert title="只纳入公司的资金；个人账户只登记属于公司的部分。期初为所选日期开始前的余额，期初以前的流水不重复计入余额。金额统一人民币。" type="info" :closable="false" />
        <el-table :data="accounts" border stripe>
          <el-table-column prop="name" label="资金账户" min-width="140" show-overflow-tooltip />
          <el-table-column label="期初日期" width="115"><template #default="{row}">{{ row.opening_date || '待设置' }}</template></el-table-column>
          <el-table-column label="今日账面余额" width="150" align="right"><template #default="{row}">{{ financeAmount(row.bookBalance) }}</template></el-table-column>
          <el-table-column label="已核对至" width="115"><template #default="{row}">{{ row.reconciled_through || '未核对' }}</template></el-table-column>
          <el-table-column label="操作" width="220" fixed="right"><template #default="{row}">
            <el-button v-if="canManage" link type="primary" @click="editAccount(row,'opening')">期初</el-button>
            <el-button v-if="canManage" link type="primary" @click="editAccount(row,'reconcile')">核对</el-button>
            <el-button v-if="canManage && row.reconciled_through" link type="primary" @click="editAccount(row,'reopen')">撤销核对</el-button>
            <el-button link type="primary" @click="emit('history','account',row.id)">记录</el-button>
          </template></el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="内部转账" name="transfers">
        <el-alert title="公司账户之间划款只在这里登记一次，不再分别登记收入和支出。转账手续费另记一笔经营支出。不同币种不能直接在这里互转。" type="info" :closable="false" />
        <div class="filter-bar">
          <el-input v-model="keyword" placeholder="账户、流水号或备注" maxlength="100" clearable style="width:220px" @keyup.enter="search" />
          <el-select :model-value="transferQuery.status" style="width:120px" @change="emit('query',{status:$event,page:1})"><el-option label="有效转账" value="active" /><el-option label="已作废" value="void" /><el-option label="全部状态" value="all" /></el-select>
          <el-button @click="search">查询</el-button><el-button @click="resetSearch">清空</el-button>
          <el-button v-if="canTransfer" type="primary" @click="startTransfer">登记内部转账</el-button>
        </div>
        <el-table v-loading="transferLoading" :data="transfers" border stripe>
          <el-table-column prop="occur_date" label="日期" width="110" />
          <el-table-column prop="fromName" label="转出账户" min-width="140" show-overflow-tooltip />
          <el-table-column prop="toName" label="转入账户" min-width="140" show-overflow-tooltip />
          <el-table-column label="金额" width="140" align="right"><template #default="{row}">{{ financeAmount(row.amount) }}</template></el-table-column>
          <el-table-column prop="bank_reference" label="银行流水号" min-width="150" show-overflow-tooltip />
          <el-table-column label="状态" width="85"><template #default="{row}">{{ row.deleted_at ? '已作废' : '有效' }}</template></el-table-column>
          <el-table-column label="操作" width="110" fixed="right"><template #default="{row}"><el-button link type="primary" @click="emit('history','transfer',row.id)">记录</el-button><el-button v-if="canVoid && !row.deleted_at" link type="primary" @click="startVoid(row.id)">作废</el-button></template></el-table-column>
        </el-table>
        <AppPaginationBar :current-page="transferQuery.page" :page-size="transferQuery.pageSize" :total="transferTotal" :page-sizes="[20,50,100]" @current-change="emit('query',{page:$event})" @size-change="emit('query',{pageSize:$event,page:1})" />
      </el-tab-pane>
    </el-tabs>
    <template #footer><el-button @click="emit('close',false)">关闭</el-button></template>
  </AppDialog>
  <AppDialog top="2vh" v-model="editor.visible" :title="editor.title" width="620" :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy">
    <el-form ref="formRef" :model="draft" label-width="110px" :disabled="busy">
      <template v-if="editor.mode==='transfer'">
        <el-form-item label="转出账户" prop="fromId" :rules="required('请选择转出账户')"><el-select v-model="draft.fromId" filterable><el-option v-for="a in accounts.filter(a=>a.is_enabled)" :key="a.id" :value="a.id" :label="a.name" /></el-select></el-form-item>
        <el-form-item label="转入账户" prop="toId" :rules="required('请选择转入账户')"><el-select v-model="draft.toId" filterable><el-option v-for="a in accounts.filter(a=>a.is_enabled && a.id!==draft.fromId)" :key="a.id" :value="a.id" :label="a.name" /></el-select></el-form-item>
      </template>
      <template v-if="!['reopen','void'].includes(editor.mode)">
        <el-form-item :label="editor.mode==='opening' ? '期初日期' : '日期'" prop="date" :rules="required('请选择日期')"><el-date-picker v-model="draft.date" value-format="YYYY-MM-DD" type="date" /></el-form-item>
        <el-form-item :label="editor.mode==='reconcile' ? '银行期末余额' : '金额（元）'" prop="amount" :rules="required('请输入金额')"><el-input-number v-model="draft.amount" :precision="2" :controls="false" /></el-form-item>
      </template>
      <el-form-item v-if="editor.mode==='transfer'" label="银行流水号" prop="reference" :rules="required('请输入流水号')"><el-input v-model="draft.reference" maxlength="100" /></el-form-item>
      <el-form-item v-if="editor.mode!=='reconcile'" :label="editor.mode==='opening' ? '余额来源' : '说明／原因'" prop="reason" :rules="editor.mode==='transfer' ? [] : required('请填写来源或原因')"><el-input v-model="draft.reason" type="textarea" :rows="3" maxlength="500" /></el-form-item>
      <el-alert v-if="editor.mode==='reconcile'" title="确认已逐笔核对至所选日期、无遗漏或重复，且银行余额与账面相等后提交。提交后锁定该日期及以前的流水。" type="info" :closable="false" />
      <el-alert v-if="editor.mode==='reopen'" title="撤销后该账户不再显示为已核对，允许修改历史流水。修改完成后必须重新核对。" type="warning" :closable="false" />
    </el-form>
    <template #footer><el-button :disabled="busy" @click="editor.visible=false">取消</el-button><el-button type="primary" :loading="busy" @click="submit">确认提交</el-button></template>
  </AppDialog>
</template>
<script setup lang="ts">
import { reactive, ref, nextTick } from 'vue'
import type { FormInstance, FormItemRule } from 'element-plus'
import type { FinanceAccountStatus, FinanceTransfer, FinanceTransferQuery } from '@/api/finance-control'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import { financeAmount } from '@/composables/useFinanceDashboard'
defineProps<{ visible: boolean; busy: boolean; accounts: FinanceAccountStatus[]; transfers: FinanceTransfer[]; transferQuery:FinanceTransferQuery; transferTotal:number; transferLoading:boolean; canManage:boolean;canTransfer:boolean;canVoid:boolean }>()
const emit=defineEmits<{ close:[value:boolean]; query:[patch:Partial<FinanceTransferQuery>]; history:[kind:string,id:number]; save:[id:number,mode:string,body:typeof draft] }>()
const keyword=ref('')
function search(){emit('query',{keyword:keyword.value.trim(),page:1})}
function resetSearch(){keyword.value='';emit('query',{keyword:'',status:'active',page:1})}
const tab=ref('accounts');const formRef=ref<FormInstance>()
const editor=reactive({visible:false,title:'',mode:'opening',id:0})
const draft=reactive({date:'',amount:0,reason:'',fromId:null as number|null,toId:null as number|null,reference:''})
const required=(message:string):FormItemRule[]=>[{required:true,message,trigger:'change'}]
function reset(){Object.assign(draft,{date:new Date().toLocaleDateString('sv-SE'),amount:0,reason:'',fromId:null,toId:null,reference:''});nextTick(()=>formRef.value?.clearValidate())}
function editAccount(row:FinanceAccountStatus,mode:string){reset();Object.assign(editor,{visible:true,title:row.name+' · '+({opening:'设置期初',reconcile:'核对余额',reopen:'撤销对账'}[mode]||''),mode,id:row.id});if(mode==='opening'){draft.date=row.opening_date||draft.date;draft.amount=Number(row.opening_balance||0)}}
function startTransfer(){reset();Object.assign(editor,{visible:true,title:'登记内部转账',mode:'transfer',id:0})}
function startVoid(id:number){reset();Object.assign(editor,{visible:true,title:'作废内部转账',mode:'void',id})}
async function submit(){if(await formRef.value?.validate().catch(()=>false))emit('save',editor.id,editor.mode,{...draft})}
defineExpose({closeEditor(){editor.visible=false}})
</script>
<style scoped>
.note{font-size:var(--font-size-caption);color:var(--color-text-muted)}
</style>
