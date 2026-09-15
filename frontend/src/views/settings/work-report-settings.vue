<template>
 <div class="page-card report-settings" v-loading="busy">
  <header class="settings-toolbar"><div><h1>工作报告设置</h1><p class="settings-hint">选择需要报告的人员及岗位数据。所有岗位统一展示工作计划和工作数据。</p></div><div class="settings-actions">
   <el-button :disabled="saving" @click="router.push('/work-reports')">查看报告</el-button>
   <template v-if="editing"><el-button :disabled="saving" @click="cancel">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存设置</el-button></template>
   <el-button v-else type="primary" :disabled="!loaded || busy" @click="edit">编辑</el-button>
  </div></header>
  <el-alert v-if="error" :title="error" type="error" :closable="false" /><el-button v-if="error && !loaded" @click="load">重新加载</el-button>
  <el-alert v-if="message" :title="message" type="success" :closable="false" />
  <p v-if="loaded && !configured && !editing" class="settings-hint">尚未配置报告范围，报告页暂显示全员。点击“编辑”选择需要报告的人员。</p>
  <p v-if="editing" class="editing-hint">勾选人员并选择岗位数据；下一步动作、日期和其他事项均可补充。</p>
  <div class="settings-filters">
   <el-select v-model="roleFilter" placeholder="全部岗位" clearable filterable aria-label="筛选岗位"><el-option v-for="role in roles" :key="role" :label="role" :value="role" /></el-select>
   <el-select v-model="personFilter" placeholder="全部人员" clearable filterable aria-label="筛选姓名"><el-option v-for="person in rows" :key="person.id" :label="person.name" :value="person.id" /></el-select>
   <el-button link type="primary" @click="resetFilters">重置</el-button><span class="settings-hint count">显示 {{ visibleRows.length }} 人<span v-if="configured || editing"> · {{ editing?'当前':'已保存' }}纳入 {{ includedCount }} 人</span></span>
  </div>
  <el-table :data="visibleRows" :class="{'editable-grid':editing}" row-key="id" empty-text="没有符合筛选条件的人员" :max-height="600">
   <el-table-column prop="name" label="姓名" min-width="100" /><el-table-column prop="role" label="岗位" min-width="120" show-overflow-tooltip />
   <el-table-column label="是否需要报告" width="150"><template #default="{row}"><el-checkbox v-if="editing" v-model="row.enabled" :disabled="saving" :aria-label="row.name+'需要报告'">需要报告</el-checkbox><span v-else>{{ row.enabled?'需要报告':'不需要' }}</span></template></el-table-column>
   <el-table-column label="岗位数据" min-width="190"><template #default="{row}"><el-select v-if="editing" v-model="row.templateId" :disabled="saving" :aria-label="row.name+'岗位数据'"><el-option v-for="t in templates" :key="t.id" :value="t.id" :label="t.name.replace('模板','数据')" /></el-select><span v-else>{{ templates.find(t=>t.id===row.templateId)?.name.replace('模板','数据') }}</span></template></el-table-column>
  </el-table>
  <AppDialog v-model="leaveVisible" title="设置尚未保存" width="440"><p>保存后继续，或放弃本次修改。</p><template #footer><el-button @click="leaveVisible=false">继续编辑</el-button><el-button :disabled="saving" @click="leave(false)">放弃修改</el-button><el-button type="primary" :loading="saving" @click="leave(true)">保存并继续</el-button></template></AppDialog>
 </div>
</template>
<script setup lang="ts">
import { onMounted,onActivated,onBeforeUnmount,ref } from 'vue'
import { onBeforeRouteLeave,useRouter } from 'vue-router'
import AppDialog from '@/components/AppDialog.vue'
import { useWorkReportSettings } from '@/composables/useWorkReportSettings'

const {templates,rows,visibleRows,roles,roleFilter,personFilter,includedCount,configured,editing,busy,saving,error,message,loaded,dirty,resetFilters,edit,cancel,load,save}=useWorkReportSettings()
const router=useRouter(),leaveVisible=ref(false),nextRoute=ref(''),allowLeave=ref(false)
async function leave(persist:boolean){if(persist&&!await save())return;if(!persist)cancel();leaveVisible.value=false;allowLeave.value=true;await router.push(nextRoute.value)}
onBeforeRouteLeave(to=>{if(saving.value)return false;if(dirty.value&&!allowLeave.value){nextRoute.value=to.fullPath;leaveVisible.value=true;return false}return true})
function unload(e:BeforeUnloadEvent){if(dirty.value){e.preventDefault();e.returnValue=''}}
onActivated(()=>{allowLeave.value=false;if(!dirty.value)void load()})
onMounted(()=>{window.addEventListener('beforeunload',unload)})
onBeforeUnmount(()=>window.removeEventListener('beforeunload',unload))
</script>
<style scoped>
h1 {font-size:var(--font-size-title);margin:0}
.settings-toolbar {display:flex;align-items:center;justify-content:space-between;gap:var(--space-sm);margin-bottom:var(--space-md);flex-wrap:wrap}
.settings-actions {display:flex;align-items:center}
.settings-hint {color:var(--color-text-muted);font-size:var(--font-size-caption);line-height:1.6;margin:0}
header .settings-hint {margin-top:var(--space-xs)}
.settings-filters {display:flex;align-items:center;gap:var(--space-sm);margin:var(--space-md) 0;flex-wrap:wrap}
.settings-filters .el-select {width:180px}
.count {margin-left:auto}
.editing-hint {color:var(--color-primary);font-size:var(--font-size-caption);margin:var(--space-sm) 0}
.report-contents {display:flex;align-items:center;gap:var(--space-xs);flex-wrap:wrap}
.report-contents .el-checkbox {margin-right:0}
.footnote {margin-top:var(--space-sm)}
</style>
