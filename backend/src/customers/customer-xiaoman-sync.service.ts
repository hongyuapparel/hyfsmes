import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, Timeout } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { XiaomanSyncState, type XiaomanSearchCustomer } from '../entities/xiaoman-sync-state.entity';
import { XiaomanService, type XiaomanCompanyItem } from '../xiaoman/xiaoman.service';
import { customerProfile } from '../xiaoman/xiaoman-customer-profile';
import { CustomersService } from './customers.service';

const SIX_HOURS = 6 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class CustomerXiaomanSyncService {
  private readonly logger = new Logger(CustomerXiaomanSyncService.name);
  private running = false;

  constructor(
    @InjectRepository(XiaomanSyncState) private readonly stateRepo: Repository<XiaomanSyncState>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    private readonly xiaoman: XiaomanService,
    private readonly customers: CustomersService,
  ) {}

  /** 生产默认启用；开发环境必须显式开启，避免启动预览触发真实同步。 */
  private enabled() {
    return process.env.XIAOMAN_SYNC_ENABLED === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.XIAOMAN_SYNC_ENABLED !== 'false');
  }

  @Timeout(15000)
  async initialize() { await this.scheduledSync(); }

  /** 正常 6 小时一次；失败后最多 15 分钟重试，不受前台请求触发。 */
  @Cron('0 */15 * * * *')
  async scheduledSync() {
    if (!this.enabled()) return;
    await this.sync();
  }

  async getList(page = 1, pageSize = 20, keyword?: string) {
    const state = await this.stateRepo.findOneBy({ id: 1 });
    if (!state?.snapshot) {
      throw new ServiceUnavailableException('小满联系人搜索资料首次准备中，请稍后再试；若持续未就绪，请检查小满同步状态。');
    }
    const kw = keyword?.trim().toLocaleLowerCase() ?? '';
    const preparing = state.snapshot.some((row) => !row.fetchedAt);
    const matches = state.snapshot.filter((row) => !kw ||
      [row.name, row.short_name, row.serial_id, ...(preparing ? [] : row.contactNames)]
        .some((value) => value.toLocaleLowerCase().includes(kw)));
    if (preparing && kw && !matches.length) {
      throw new ServiceUnavailableException('联系人搜索资料首次准备中，公司名称和客户编号搜索仍可使用，请稍后再按联系人搜索。');
    }
    const size = Math.max(1, Math.min(100, Number.isFinite(pageSize) ? pageSize : 20));
    const start = (Math.max(1, Number.isFinite(page) ? page : 1) - 1) * size;
    // 保持原列表契约，不把电话号码、内部同步字段发送给选择弹窗。
    const list = matches.slice(start, start + size).map((row) => ({
      company_id: row.company_id, serial_id: row.serial_id, name: row.name,
      short_name: row.short_name, order_time: row.order_time, create_time: row.create_time,
      contactPerson: row.contactPerson,
    }));
    return { list, total: matches.length };
  }

  async getStatus() {
    const state = await this.stateRepo.findOneBy({ id: 1 });
    const totalCustomers = state?.snapshot?.length ?? 0;
    const indexedCustomers = state?.snapshot?.filter((row) => row.fetchedAt > 0).length ?? 0;
    return {
      enabled: this.enabled(), intervalHours: 6, running: this.running,
      totalCustomers, indexedCustomers, ready: !!state?.snapshot && totalCustomers === indexedCustomers,
      lastSuccessAt: state?.lastSuccessAt ?? null, lastAttemptAt: state?.lastAttemptAt ?? null,
      lastError: state?.lastError ?? null,
    };
  }

  private async fetchList(): Promise<XiaomanCompanyItem[]> {
    const all = new Map<number, XiaomanCompanyItem>();
    for (let page = 1; ; page++) {
      const result = await this.xiaoman.getCompanyList(page, 500);
      const before = all.size;
      for (const item of result.list) all.set(item.company_id, item);
      if (all.size >= result.total) return [...all.values()];
      if (!result.list.length || all.size === before) throw new Error('小满客户列表分页不完整，保留上次搜索资料');
    }
  }

  async sync(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const runner = this.stateRepo.manager.connection.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      const rows: Array<{ acquired: number }> = await runner.query("SELECT GET_LOCK('erp_xiaoman_customer_sync', 0) AS acquired");
      locked = Number(rows[0]?.acquired) === 1;
      if (!locked) return;
      const previous = await this.stateRepo.findOneBy({ id: 1 });
      if (previous?.lastSuccessAt && !previous.lastError && Date.now() - +previous.lastSuccessAt < SIX_HOURS) return;
      await this.stateRepo.upsert({ id: 1, lastAttemptAt: new Date() }, ['id']);
      const old = new Map((previous?.snapshot ?? []).map((row) => [row.company_id, row]));
      const list = await this.fetchList();
      if (old.size && !list.length) throw new Error('小满列表异常为空，保留上次搜索资料');
      const initializing = !previous?.snapshot?.length || previous.snapshot.some((row) => !row.fetchedAt);
      const snapshot: XiaomanSearchCustomer[] = list.map((item) => old.get(item.company_id) ?? {
        ...item, name: item.name ?? '', serial_id: String(item.serial_id || item.company_id).trim(),
        short_name: item.short_name ?? '', order_time: item.order_time ?? '', create_time: item.create_time ?? '',
        contactPerson: '', contactNames: [], country: '', contactInfo: '', version: '', fetchedAt: 0,
      });
      // 首次先发布公司列表，保留原来的公司/编号搜索；详情分批保存，可在失败后续接。
      if (initializing) await this.stateRepo.upsert({ id: 1, snapshot }, ['id']);
      let requested = 0;
      for (const [index, item] of list.entries()) {
        const cached = old.get(item.company_id);
        const version = `${item.update_time ?? ''}|${item.edit_time ?? ''}`;
        if (cached && version !== '|' && cached.version === version && Date.now() - cached.fetchedAt < ONE_DAY) {
          snapshot[index] = cached;
          continue;
        }
        const detail = await this.xiaoman.getCompanyDetail(item.company_id);
        if (!detail || detail.company_id !== item.company_id || !detail.name?.trim() ||
          !Array.isArray(detail.customers) || !(Array.isArray(detail.tel) || typeof detail.tel === 'string') ||
          typeof detail.country !== 'string') {
          throw new Error(`小满客户 ${item.company_id} 详情缺失或不完整，保留上次搜索资料`);
        }
        snapshot[index] = customerProfile(detail, item);
        requested++;
        if (initializing && requested % 20 === 0) await this.stateRepo.upsert({ id: 1, snapshot }, ['id']);
        // 一次一个详情请求，主动留出间隔；不抢占搜索请求或短时间突发调用。
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      const errors = await this.applyCustomers(snapshot);
      // 完整搜索资料可用时一次替换，搜索不等待此次后台同步。
      await this.stateRepo.upsert({
        id: 1, snapshot, lastSuccessAt: errors.length ? previous?.lastSuccessAt ?? null : new Date(),
        lastError: errors.length ? errors.slice(0, 20).join('; ') : null,
      }, ['id']);
      this.logger.log(`小满同步：索引 ${snapshot.length}，详情请求 ${requested}，失败 ${errors.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '小满同步失败';
      this.logger.error(message);
      if (locked) await this.stateRepo.upsert({ id: 1, lastError: message.slice(0, 2000) }, ['id']).catch(() => undefined);
    } finally {
      if (locked) await runner.query("SELECT RELEASE_LOCK('erp_xiaoman_customer_sync')").catch(() => undefined);
      await runner.release();
      this.running = false;
    }
  }

  private async applyCustomers(snapshot: XiaomanSearchCustomer[]): Promise<string[]> {
    const locals = await this.customerRepo.find();
    const byId = new Map(snapshot.map((row) => [String(row.company_id), row]));
    const bySerial = new Map<string, XiaomanSearchCustomer[]>();
    for (const row of snapshot) {
      const group = bySerial.get(row.serial_id) ?? [];
      group.push(row);
      bySerial.set(row.serial_id, group);
    }
    const errors: string[] = [];
    for (const local of locals) {
      const candidates = bySerial.get(local.customerId) ?? [];
      const remote = local.xiaomanCompanyId ? byId.get(local.xiaomanCompanyId) : candidates.length === 1 ? candidates[0] : undefined;
      if (!remote) {
        if (local.xiaomanCompanyId || candidates.length > 1) errors.push(`客户 ${local.id} 小满关联缺失或编号重复`);
        continue;
      }
      try {
        if (!local.xiaomanCompanyId) {
          await this.customerRepo.update(local.id, { xiaomanCompanyId: String(remote.company_id) });
        }
        if (local.companyName !== remote.name || local.contactPerson !== remote.contactPerson ||
          local.contactInfo !== remote.contactInfo || local.country !== remote.country) {
          await this.customers.update(local.id, {
            company_name: remote.name, contact_person: remote.contactPerson,
            contact_info: remote.contactInfo, country: remote.country,
          });
        }
      } catch (error) {
        errors.push(`客户 ${local.id}: ${error instanceof Error ? error.message : '更新失败'}`);
      }
    }
    return errors;
  }
}
