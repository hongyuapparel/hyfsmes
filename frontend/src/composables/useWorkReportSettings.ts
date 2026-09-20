import { computed, ref } from 'vue'
import { getReportSettings, saveReportSettings, type ReportRule, type ReportPerson, type ReportTemplate } from '@/api/work-reports'
import { getErrorMessage } from '@/api/request'
type SettingsPerson=ReportPerson & ReportRule
export function useWorkReportSettings() {
 const rows=ref<SettingsPerson[]>([]),version=ref(0),busy=ref(false),saving=ref(false),error=ref(''),message=ref(''),baseline=ref(''),loaded=ref(false),configured=ref(false),editing=ref(false)
 const templates=ref<ReportTemplate[]>([]),savedTemplates=ref<ReportTemplate[]>([])
 const roleFilter=ref(''),personFilter=ref<number>(),savedRows=ref<SettingsPerson[]>([])
 const clone=(value:SettingsPerson[])=>JSON.parse(JSON.stringify(value)) as SettingsPerson[]
 const rules=()=>rows.value.map(({ownerId,enabled,templateId})=>({ownerId,enabled,templateId}))
 const serialized=()=>JSON.stringify({rules:rules(),templates:templates.value})
 const dirty=computed(()=>editing.value&&serialized()!==baseline.value)
 const roles=computed(()=>[...new Set(rows.value.flatMap(p=>p.role.split(' / ')))].sort((a,b)=>a.localeCompare(b,'zh-CN')))
 const visibleRows=computed(()=>rows.value.filter(p=>(!roleFilter.value||p.role.split(' / ').includes(roleFilter.value))&&(!personFilter.value||p.id===personFilter.value)))
 const includedCount=computed(()=>rows.value.filter(p=>p.enabled).length)
 function edit(){if(!loaded.value||busy.value||saving.value)return;editing.value=true;message.value='';error.value=''}
 function cancel(){if(saving.value)return;rows.value=clone(savedRows.value);templates.value=structuredClone(savedTemplates.value.map(t=>({...t,manualSections:[...t.manualSections],automaticSources:[...t.automaticSources]})));editing.value=false;error.value='';message.value=''}
 function resetFilters(){roleFilter.value='';personFilter.value=undefined}
 async function load() {
  busy.value=true;error.value='';message.value=''
  try {const {data}=await getReportSettings();version.value=data.version;configured.value=data.configured;templates.value=data.templates;rows.value=data.people.map(p=>({...p,...(data.rules.find(r=>r.ownerId===p.id)||{ownerId:p.id,enabled:false,templateId:p.defaultTemplateId||'general'})}));baseline.value=serialized();savedRows.value=clone(rows.value);savedTemplates.value=JSON.parse(JSON.stringify(templates.value));loaded.value=true;editing.value=false}
  catch(e){error.value=getErrorMessage(e,'读取设置失败')}finally{busy.value=false}
 }
 async function save() {
  if(saving.value||!loaded.value||!editing.value)return false
  saving.value=true;error.value='';message.value=''
  try {const {data}=await saveReportSettings(version.value,rules(),templates.value);version.value=data.version;configured.value=true;templates.value=data.templates;for(const row of rows.value){const rule=data.rules.find(r=>r.ownerId===row.id);if(rule)Object.assign(row,rule)}baseline.value=serialized();savedRows.value=clone(rows.value);savedTemplates.value=JSON.parse(JSON.stringify(templates.value));editing.value=false;message.value='设置已保存';return true}
  catch(e){error.value=getErrorMessage(e,'保存失败，修改已保留');return false}finally{saving.value=false}
 }
 return {templates,rows,visibleRows,roles,roleFilter,personFilter,includedCount,configured,editing,busy,saving,error,message,loaded,dirty,resetFilters,edit,cancel,load,save}
}
