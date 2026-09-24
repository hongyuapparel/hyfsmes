import { ProductionCuttingListService } from '../production-cutting/production-cutting-list.service';
import { ProductionSewingService } from '../production-sewing/production-sewing.service';
import { ProductionFinishingQueryService } from '../production-finishing/production-finishing-query.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkReportSettingsService } from './work-report-settings.service';
import { ProductionPurchaseQueryService } from '../production-purchase/production-purchase-query.service';
import { defaultReportTemplateId } from './work-report-templates';
import { patternHandoff } from './pattern-milestones';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { applyReportBatch, applyAutomaticPlans, type AutomaticPlanInput, validReportDate, type WorkTask, type DraftRow } from './work-report-plan';

export interface Person { id: number; name: string; username: string; codes: string; role: string }
export interface CatalogOrder { id: number; no: string; sku: string; customer: string; salesperson: string; merchandiser: string; status: string; orderType: string; imageUrl: string; active: number; finished: number }
interface PlanState { version: number; tasks: WorkTask[] | string }
export interface AutoRow { planKey?:string; entryId?:number; orderId: number; orderNo: string; sku: string; title: string; time: string; quantity: number | null; factory: string; imageUrl: string; remark?:string; status?:string; customer?:string; materialIndex?:number }
export const reportToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
const parseTasks = (value: WorkTask[] | string): WorkTask[] => typeof value === 'string' ? JSON.parse(value) : value;

@Injectable()
export class WorkReportsService {
 constructor(private readonly db: DataSource, private readonly settings:WorkReportSettingsService, private readonly purchase:ProductionPurchaseQueryService, private readonly cutting:ProductionCuttingListService, private readonly sewing:ProductionSewingService, private readonly finishing:ProductionFinishingQueryService) {}
 async canReadAll(id: number) {
   const rows: { id: number }[] = await this.db.query(`SELECT p.id FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id
     WHERE p.code='work_reports_all' AND rp.role_id IN (SELECT role_id FROM users WHERE id=? UNION SELECT role_id FROM user_roles WHERE user_id=?) LIMIT 1`, [id,id]);
   return rows.length > 0;
 }
 async people(_actor: number): Promise<Person[]> {
   return this.db.query(`SELECT u.id, COALESCE(NULLIF(u.display_name,''),u.username) name,u.username,
     GROUP_CONCAT(DISTINCT r.code) codes,GROUP_CONCAT(DISTINCT r.name SEPARATOR ' / ') role
     FROM users u JOIN roles r ON r.id=u.role_id OR r.id IN (SELECT role_id FROM user_roles WHERE user_id=u.id)
     WHERE u.status='active' GROUP BY u.id ORDER BY u.id`);
 }
 async orders(actor: number, forEditing=false): Promise<CatalogOrder[]> {
   const all = !forEditing || await this.canReadAll(actor);
   const [self]: Person[] = await this.db.query("SELECT id,username,COALESCE(NULLIF(display_name,''),username) name FROM users WHERE id=?", [actor]);
   const rows:CatalogOrder[]=await this.db.query(`SELECT o.id,o.order_no no,o.sku_code sku,o.customer_name customer,o.salesperson,o.merchandiser,
     COALESCE(s.label,o.status) status,o.image_url imageUrl, COALESCE(s.is_final,0) finished, IF(COALESCE(s.is_final,0)=0 AND o.status NOT IN ('draft','pending_review'),1,0) active,
     CASE WHEN opt.value='大货' OR parent.value='大货' THEN 'bulk' WHEN opt.value IN ('样品','头版','修改版','产前版','拍照版','销售版') OR parent.value='样品' THEN 'sample' ELSE 'unknown' END orderType
     FROM orders o LEFT JOIN order_statuses s ON s.code=o.status LEFT JOIN system_options opt ON opt.id=o.order_type_id
     LEFT JOIN system_options parent ON parent.id=opt.parent_id
     WHERE o.deleted_at IS NULL AND (?=1 OR o.merchandiser IN (?,?)) ORDER BY o.order_date,o.id`, [all?1:0,self.name,self.username]);
   return rows.map(o=>({...o,active:Number(o.active),finished:Number(o.finished)}));
 }
 private checkDate(date: string) { if (!date || !validReportDate(date)) throw new BadRequestException('报告日期无效'); }
 async report(actor: number, owner: number, date: string) {
   this.checkDate(date);
   const person = (await this.people(actor)).find(p=>p.id===owner);
   if (!person) throw new ForbiddenException('无权查看此人的报告');
   const today=reportToday();
   const [state]: PlanState[] = await this.db.query('SELECT version,tasks FROM work_report_plans WHERE owner_id=?',[owner]);
   const [snapshot]: { tasks: WorkTask[] | string }[] = date < today ? await this.db.query('SELECT tasks FROM work_report_snapshots WHERE owner_id=? AND report_date<=? ORDER BY report_date DESC LIMIT 1',[owner,date]) : [];
   const tasks=date<today ? (snapshot?parseTasks(snapshot.tasks):[]) : state?parseTasks(state.tasks):[];
   const settings=await this.settings.read(),rule=settings.rules.find(r=>r.ownerId===owner);
   const template=settings.templates.find(t=>t.id===(rule?.templateId||defaultReportTemplateId(person.codes)))!;
   const codes=template.automaticSources;
   const automatic: { title: string; note: string; rows: AutoRow[] }[]=[];
   if(codes.includes('pattern')) {
     const [duplicates]: { n: number }[] = await this.db.query("SELECT COUNT(*) n FROM users WHERE display_name=? AND status='active'",[person.name]);
     const rows: AutoRow[] = duplicates.n>1 ? [] : await this.db.query(`SELECT o.id orderId,o.order_no orderNo,o.sku_code sku,o.image_url imageUrl,
       '样品完成' title,DATE_FORMAT(p.completed_at,'%Y-%m-%d %H:%i') time,NULL quantity,p.sample_maker factory
       FROM order_pattern p JOIN orders o ON o.id=p.order_id WHERE o.deleted_at IS NULL AND p.status='completed'
       AND p.completed_at>=? AND p.completed_at<DATE_ADD(?,INTERVAL 1 DAY) AND p.pattern_master IN (?,?)`,[date,date,person.name,person.username]);
     const logs:(AutoRow&{detail:string})[]=await this.db.query(`SELECT o.id orderId,o.order_no orderNo,o.sku_code sku,o.image_url imageUrl,
       l.detail,DATE_FORMAT(l.created_at,'%Y-%m-%d %H:%i') time,NULL quantity,'' factory,'' title
       FROM order_operation_logs l JOIN orders o ON o.id=l.order_id
       WHERE l.action='production_pattern_assign' AND o.deleted_at IS NULL AND l.created_at<DATE_ADD(?,INTERVAL 1 DAY)
       ORDER BY l.created_at,l.id`,[date]);
     const seen=new Set<number>(),handoffs:AutoRow[]=[];
     for(const log of logs){const event=patternHandoff(log.detail);if(!event||seen.has(log.orderId))continue;seen.add(log.orderId);
       if(duplicates.n<=1&&log.time.startsWith(date)&&[person.name,person.username].includes(event.master)){
         const {detail,...row}=log;handoffs.push({...row,title:'纸样完成 · 已分配车板师',factory:event.maker});
       }
     }
     automatic.push({title:'今日纸样完成',note:'按首次分配车板师的日志时间、当时的纸样负责人统计；换人不重复计数。缺失分配日志的旧订单不推算日期。',rows:handoffs});
     automatic.push({title:'今日样品完成（负责订单）',note:duplicates.n>1?'存在同名人员，无法准确归属，暂不统计。':'按负责订单在纸样工作页点击完成的时间统计；表示样品完成，不作为纸样师个人车板产量。',rows});
     const queue: AutoRow[]=await this.db.query(`SELECT o.id orderId,o.order_no orderNo,o.sku_code sku,o.image_url imageUrl,
       CASE WHEN COALESCE(p.pattern_master,'')='' THEN '部门待分单' WHEN COALESCE(p.sample_maker,'')='' THEN '本人纸样制作中' ELSE '样品制作中（负责订单）' END title,DATE_FORMAT(o.order_date,'%Y-%m-%d %H:%i') time,NULL quantity,COALESCE(p.sample_maker,'') factory
       FROM orders o LEFT JOIN order_pattern p ON p.order_id=o.id WHERE o.deleted_at IS NULL AND o.status='pending_pattern'
       AND (p.id IS NULL OR p.status<>'completed') AND (COALESCE(p.pattern_master,'')='' OR p.pattern_master IN (?,?)) ORDER BY o.order_date,o.id`,[person.name,person.username]);
     automatic.push({title:'当前纸样队列',note:'实时队列，不是历史快照；待分单属于部门。分配日志缺少结构化负责人和首次分配时间，今日接单暂不统计。',rows:date===today?queue:[]});
   }
   const queueNote=date===today?'与岗位工作页一致，部门待办按下单顺序展示。':'历史日期不展示当前待办，尚无该日队列快照。';
   if(codes.includes('cutting')) {
     const pending=date===today?await this.cutting.getCuttingExportRows({tab:'pending'}):[];
     const completed=await this.cutting.getCuttingExportRows({tab:'completed',completedStart:date,completedEnd:date});
     const map=(r:typeof pending[number]):AutoRow=>({orderId:r.orderId,orderNo:r.orderNo,sku:r.skuCode,imageUrl:r.imageUrl,customer:r.customerName,title:r.cuttingStatus==='completed'?'裁剪完成':'待裁剪',time:r.cuttingStatus==='completed'?r.completedAt||'':r.arrivedAt||'',quantity:r.cuttingStatus==='completed'?r.actualCutTotal:r.quantity,factory:''});
     automatic.push({title:'当前裁床待办（部门）',note:queueNote,rows:pending.reverse().map(map)},{title:'当天裁剪完成（部门）',note:'按裁床完成时间和实际裁剪数量统计。',rows:completed.map(map)});
   }
   if(codes.includes('sewing')) {
     const pending=date===today?await this.sewing.getSewingExportRows({tab:'pending'}):[];
     const completed=await this.sewing.getSewingExportRows({tab:'completed',completedStart:date,completedEnd:date});
     const map=(r:typeof pending[number]):AutoRow=>({orderId:r.orderId,orderNo:r.orderNo,sku:r.skuCode,imageUrl:r.imageUrl,customer:r.customerName,title:r.sewingStatus==='completed'?'车缝完成':r.distributedAt?'车缝中':'待分单',time:r.sewingStatus==='completed'?r.completedAt||'':r.arrivedAt||'',quantity:r.sewingStatus==='completed'?r.sewingQuantity:r.quantity,factory:r.factoryName});
     automatic.push({title:'当前车缝待办（部门）',note:queueNote,rows:pending.reverse().map(map)},{title:'当天车缝完成（部门）',note:'部门记录，包含工作页中的加工厂，不作为个人产量。',rows:completed.map(map)});
   }
   if(codes.includes('finishing')) {
     const pending=date===today?(await this.finishing.getFinishingExportRows({tab:'all'})).filter(r=>r.finishingStatus!=='inbound'):[];
     const completed=await this.finishing.getFinishingExportRows({tab:'inbound',completedStart:date,completedEnd:date});
     const map=(r:typeof pending[number]):AutoRow=>({orderId:r.orderId,orderNo:r.orderNo,sku:r.skuCode,imageUrl:r.imageUrl,customer:r.customerName,title:r.finishingStatus==='inbound'?'包装完成':r.finishingStatus==='pending_receive'?'待收货':'待包装 / 分配',time:r.finishingStatus==='inbound'?r.completedAt||'':r.arrivedAt||'',quantity:r.finishingStatus==='inbound'?r.tailReceivedQty:r.quantity,factory:r.factoryName||'',remark:r.remark||''});
     automatic.push({title:'当前尾部待办（部门）',note:queueNote,rows:pending.reverse().map(map)},{title:'当天尾部完成（部门）',note:'按包装完成时间统计；交仓不等于已出货。',rows:completed.map(map)});
   }
   if(codes.includes('warehouse')) {
     const pending:AutoRow[]=date===today?await this.db.query(`SELECT p.id entryId,o.id orderId,o.order_no orderNo,p.sku_code sku,o.image_url imageUrl,o.customer_name customer,'待仓处理' title,DATE_FORMAT(p.created_at,'%Y-%m-%d %H:%i') time,p.quantity,'' factory FROM inbound_pending p JOIN orders o ON o.id=p.order_id WHERE p.status='pending' AND o.deleted_at IS NULL ORDER BY p.created_at,p.id`):[];
     const completed:AutoRow[]=await this.db.query(`SELECT COALESCE(o.id,0) orderId,COALESCE(o.order_no,'') orderNo,p.sku_code sku,COALESCE(o.image_url,'') imageUrl,'出库完成' title,DATE_FORMAT(p.created_at,'%Y-%m-%d %H:%i') time,p.quantity,'' factory,p.remark FROM finished_goods_outbound p LEFT JOIN orders o ON o.id=p.order_id WHERE p.created_at>=? AND p.created_at<DATE_ADD(?,INTERVAL 1 DAY)`,[date,date]);
     automatic.push({title:'当前仓库待处理（部门）',note:queueNote,rows:pending},{title:'当天仓库出库完成（部门）',note:'按实际出库记录统计。待入库表没有完成时间，暂不把创建时间当作入库完成时间。',rows:completed});
   }
   if(codes.includes('purchase')) {
     // No actor is passed: the shared query cannot trigger purchase workflow reconciliation.
     const pending=date===today?(await this.purchase.getPurchaseExportRows({tab:'all',sortField:'orderDate',sortOrder:'asc'})).filter(r=>r.processRoute==='purchase'&&r.purchaseStatus!=='completed'):[];
     const completed=(await this.purchase.getPurchaseExportRows({tab:'completed',completedStart:date,completedEnd:date,sortField:'completedAt',sortOrder:'desc'})).filter(r=>r.processRoute==='purchase');
     const map=(r:typeof pending[number]):AutoRow=>({orderId:r.orderId,orderNo:r.orderNo,sku:r.skuCode,imageUrl:r.imageUrl,title:[r.materialName,r.color].filter(Boolean).join(' · '),time:r.purchaseStatus==='completed'?r.purchaseCompletedAt||'':r.pendingPurchaseAt||'',quantity:r.purchaseStatus==='completed'?r.actualPurchaseQuantity:r.planQuantity,factory:r.supplierName,remark:r.purchaseRemark||'',status:r.purchaseStatus==='completed'?'采购完成':r.purchaseStatus==='purchasing'?'采购中':'等待采购',customer:r.customerName,materialIndex:r.materialIndex});
     automatic.push({title:'当前待采购（部门）',note:date===today?'与采购页等待采购、采购中清单一致，按物料项展示；不包含领料。':'历史日期不展示当前待采购清单，系统尚无待采购历史快照。',rows:pending.map(map)});
     automatic.push({title:'当天采购完成（部门）',note:'与采购页完成记录一致，按所选日期和物料项统计；登记完成不等于仓库到货，不同物料数量不合计。',rows:completed.map(map)});
   }
   if(codes.includes('finishing')||codes.includes('warehouse')||template.id==='merchandiser') {
     const shipped:AutoRow[]=await this.db.query(`SELECT COALESCE(o.id,0) orderId,COALESCE(o.order_no,'') orderNo,
       i.style_no sku,i.image_url imageUrl,p.customer_name customer,CONCAT('装箱单 ',p.code) title,
       DATE_FORMAT(p.shipped_at,'%Y-%m-%d %H:%i') time,i.total_qty quantity,'' factory
       FROM packing_list_items i JOIN packing_lists p ON p.id=i.packing_list_id
       LEFT JOIN inbound_pending ip ON i.source_type='pending' AND ip.id=i.source_id
       LEFT JOIN finished_goods_stock fs ON i.source_type='finished' AND fs.id=i.source_id
       LEFT JOIN orders o ON o.id=COALESCE(ip.order_id,fs.order_id)
       WHERE p.status='shipped' AND p.shipped_at>=? AND p.shipped_at<DATE_ADD(?,INTERVAL 1 DAY)
       AND (?=1 OR o.merchandiser IN (?,?)) ORDER BY p.shipped_at,p.id,i.id`,
       [date,date,template.id==='merchandiser'?0:1,person.name,person.username]);
     automatic.push({title:template.id==='merchandiser'?'今日出货（跟进订单）':'今日出货（部门）',note:'按装箱单确认发货时间和明细件数统计；领用出库不计入。无订单关联的手填装箱明细单独标出。',rows:shipped});
   }
   for(const group of automatic) if(group.title.startsWith('当前')) for(const row of group.rows) row.planKey=group.title+':'+row.orderId+':'+(row.materialIndex??row.entryId??'');
   const pendingOrders=date===today&&(template.manualSections.includes('sample')||template.manualSections.includes('bulk'))?(await this.orders(actor)).filter(o=>!!o.active&&[person.name,person.username].includes(o.merchandiser)):[];
   return { today,person,template,pendingOrders,version:state?.version||0,tasks,automatic,historicalMissing:date<today&&!snapshot };
 }
 async save(actor: number, body: unknown, owner=actor) {
   if(owner!==actor){await this.settings.assertAdmin(actor);if(!(await this.people(actor)).some(p=>p.id===owner))throw new NotFoundException('报告人员不存在');}
   if(!body || typeof body!=='object') throw new BadRequestException('无效请求');
   const b=body as {version?:unknown; drafts?:unknown; automaticPlans?:unknown};
   if(!Number.isInteger(b.version) || !Array.isArray(b.drafts) || b.drafts.length>1000) throw new BadRequestException('安排格式无效');
   for(const row of b.drafts) {
     if(!row || typeof row!=='object') throw new BadRequestException('行格式无效');
     const r=row as Record<string,unknown>;
     if(!['id','order','title','date'].every(k=>typeof r[k]==='string') || typeof r.done!=='boolean'
       || !['sample','bulk','other'].includes(String(r.section))
       || !['orders','sourceIds'].every(k=>Array.isArray(r[k]) && (r[k] as unknown[]).length<=1000 && (r[k] as unknown[]).every(v=>typeof v==='string'))
       || ['urgent','needsHelp','end'].some(k=>r[k]!==undefined && typeof r[k]!=='boolean')) throw new BadRequestException('行字段无效');
   }
   const orders=await this.orders(actor,true),today=reportToday();
   const plans=b.automaticPlans as AutomaticPlanInput[]|undefined;
   let automaticRows:AutoRow[]=[];
   if(plans!==undefined){
    if(!Array.isArray(plans)||plans.length>5000)throw new BadRequestException('自动待办安排格式无效');
    const own=await this.report(actor,owner,today),allowed=new Set(own.automatic.flatMap(g=>g.rows.map(r=>r.planKey).filter(Boolean))),seen=new Set<string>();
    automaticRows=own.automatic.flatMap(g=>g.rows);
    for(const p of plans){if(!p||typeof p.key!=='string'||!allowed.has(p.key)||seen.has(p.key)||typeof p.title!=='string'||p.title.length>200||typeof p.date!=='string'||p.date!==''&&!validReportDate(p.date)||(['done','needsHelp'] as const).some(k=>p[k]!==undefined&&typeof p[k]!=='boolean'))throw new BadRequestException('待办已更新或安排格式无效，请刷新后再试');seen.add(p.key);}
   }
   for(const row of b.drafts as DraftRow[]) if(row.section!=='other' && row.orders?.some(no=>orders.find(o=>o.no===no)?.orderType!==row.section)) throw new BadRequestException('订单类型与板块不一致，或订单不可访问');
   return this.db.transaction(async em=>{
     await em.query("INSERT IGNORE INTO work_report_plans(owner_id,version,tasks) VALUES (?,0,'[]')",[owner]);
     const [state]:PlanState[]=await em.query('SELECT version,tasks FROM work_report_plans WHERE owner_id=? FOR UPDATE',[owner]);
     if(state.version!==b.version) throw new ConflictException('安排已在其他窗口更新，请先刷新再编辑');
     let next:WorkTask[];
     try { next=applyReportBatch(parseTasks(state.tasks).filter(t=>!t.automaticKey),b.drafts as DraftRow[],randomUUID,{owner:String(owner),today,orders}); }
     catch(e) { throw new BadRequestException(e instanceof Error?e.message:'保存失败'); }
     const previous=parseTasks(state.tasks).filter(t=>t.automaticKey);
     next.push(...applyAutomaticPlans(previous,plans||[],randomUUID,String(owner),today,automaticRows));
     const json=JSON.stringify(next);
     await em.query('UPDATE work_report_plans SET tasks=?,version=version+1 WHERE owner_id=?',[json,owner]);
     await em.query('INSERT INTO work_report_snapshots(owner_id,report_date,tasks) VALUES (?,?,?) ON DUPLICATE KEY UPDATE tasks=VALUES(tasks)',[owner,today,json]);
     return {version:state.version+1,tasks:next};
   });
 }
}
