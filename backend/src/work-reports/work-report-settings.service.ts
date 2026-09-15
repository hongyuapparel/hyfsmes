import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { defaultReportTemplates,defaultReportTemplateId,type ReportRule,type ReportTemplate,type ManualSection,type AutomaticSource } from './work-report-templates';
interface SettingsRow { version:number; rules:string|ReportRule[]|{rules:ReportRule[];templates:ReportTemplate[];schemaVersion?:number}|null }
@Injectable()
export class WorkReportSettingsService {
 constructor(private readonly db:DataSource) {}
 async assertAdmin(actor:number) {
  const rows:{id:number}[]=await this.db.query("SELECT r.id FROM roles r WHERE r.code='admin' AND r.id IN (SELECT role_id FROM users WHERE id=? UNION SELECT role_id FROM user_roles WHERE user_id=?)",[actor,actor]);
  if(!rows.length)throw new ForbiddenException('仅管理员可设置报告安排');
 }
 async read() {
  const [row]:SettingsRow[]=await this.db.query('SELECT version,rules FROM work_report_settings WHERE id=1');
  const stored=row?.rules?(typeof row.rules==='string'?JSON.parse(row.rules):row.rules):null;
  const templates=defaultReportTemplates();
  const raw:(Partial<ReportRule>&{mode?:string})[]=Array.isArray(stored)?stored:stored?.rules||[];
  const users:{id:number;codes:string}[]=await this.db.query('SELECT u.id,GROUP_CONCAT(DISTINCT r.code) codes FROM users u JOIN roles r ON r.id=u.role_id OR r.id IN (SELECT role_id FROM user_roles WHERE user_id=u.id) GROUP BY u.id');
  const rules:ReportRule[]=raw.map(r=>({ownerId:r.ownerId!,enabled:typeof r.enabled==='boolean'?r.enabled:r.mode!=='hidden',templateId:(r.templateId==='general'&&users.find(u=>u.id===r.ownerId)?.codes?.split(',').includes('inventory')?'warehouse':r.templateId)||defaultReportTemplateId(users.find(u=>u.id===r.ownerId)?.codes||'')}));
  return {version:row?.version||0,configured:row?.rules!=null,rules,templates};
 }
 async save(actor:number,body:unknown) {
  await this.assertAdmin(actor);
  if(!body||typeof body!=='object')throw new BadRequestException('设置格式无效');
  const b=body as {version?:unknown;rules?:unknown;templates?:unknown};
  if(!Number.isInteger(b.version)||!Array.isArray(b.rules)||b.rules.length>5000||!Array.isArray(b.templates))throw new BadRequestException('请重新打开设置页面后保存');
  const defaults=defaultReportTemplates(),templates:ReportTemplate[]=[],templateIds=new Set<string>();
  for(const item of b.templates){
   if(!item||typeof item!=='object')throw new BadRequestException('模板无效');
   const t=item as Record<string,unknown>,base=defaults.find(d=>d.id===t.id);
   if(!base||templateIds.has(base.id)||!Array.isArray(t.manualSections)||!Array.isArray(t.automaticSources))throw new BadRequestException('模板无效或重复');
   if(t.manualSections.some(v=>!['sample','bulk','other'].includes(v))||t.automaticSources.some(v=>!['purchase','pattern','cutting','sewing','finishing','warehouse'].includes(v))||new Set(t.manualSections).size!==t.manualSections.length||new Set(t.automaticSources).size!==t.automaticSources.length||!t.manualSections.length&&!t.automaticSources.length)throw new BadRequestException(base.name+'至少需要一个有效板块');
   templateIds.add(base.id);templates.push({...base,manualSections:t.manualSections as ManualSection[],automaticSources:t.automaticSources as AutomaticSource[]});
  }
  if(templates.length!==defaults.length)throw new BadRequestException('模板列表不完整');
  const users:{id:number}[]=await this.db.query("SELECT id FROM users WHERE status='active'");
  const seen=new Set<number>(),rules:ReportRule[]=[];
  for(const item of b.rules){
   if(!item||typeof item!=='object')throw new BadRequestException('人员设置无效');
   const r=item as Record<string,unknown>,u=users.find(p=>p.id===r.ownerId);
   if(!u||seen.has(u.id)||typeof r.enabled!=='boolean'||typeof r.templateId!=='string'||!templateIds.has(r.templateId))throw new BadRequestException('人员不存在、重复或模板无效');
   seen.add(u.id);rules.push({ownerId:u.id,enabled:r.enabled,templateId:r.templateId});
  }
  return this.db.transaction(async em=>{
   await em.query('INSERT IGNORE INTO work_report_settings(id,version,rules) VALUES(1,0,NULL)');
   const [row]:SettingsRow[]=await em.query('SELECT version,rules FROM work_report_settings WHERE id=1 FOR UPDATE');
   if(row.version!==b.version)throw new ConflictException('设置已被其他管理员修改，请重新读取后再保存');
   await em.query('UPDATE work_report_settings SET rules=?,version=version+1 WHERE id=1',[JSON.stringify({rules,templates,schemaVersion:2})]);
   return {version:row.version+1,configured:true,rules,templates};
  });
 }
}
