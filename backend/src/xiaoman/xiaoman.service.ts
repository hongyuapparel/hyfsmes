import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_BASE_URL = 'https://api.xiaoman.cn';

export interface XiaomanCompanyItem {
  company_id: number;
  serial_id: string;
  name: string;
  short_name: string;
  order_time: string;
  create_time: string;
  update_time?: string;
  edit_time?: string;
}

export interface XiaomanCompanyDetail {
  company_id: number;
  serial_id: string;
  name: string;
  short_name?: string;
  country?: string;
  country_name?: string;
  country_region?: { country?: string; province?: string; city?: string };
  order_time?: string;
  cooperation_date?: string;
  cooperationDate?: string;
  tel?: string[] | string;
  product_group_ids?: number[];
  product_group_names?: string;
  /** 主联系人姓名（字段名按小满返回结构做 best effort 兼容） */
  main_contact_name?: string;
  main_contact?: { name?: string } | null;
  contact_person?: string;
  contact_name?: string;
  contact_nickname?: string;
  linkman?: string;
  contacts?: { name?: string; nickname?: string; nick_name?: string; contact_name?: string }[] | null;
  customers?: {
    customer_id?: number;
    name?: string;
    nickname?: string;
    nick_name?: string;
    main_customer_flag?: number;
  }[];
}

export interface XiaomanOrderItem {
  order_id: number;
  order_no: string;
  name: string;
  company_id: number;
  company_name: string;
  account_date: string;
}

@Injectable()
export class XiaomanService {
  /** 按 scope 分别缓存 token：客户用 company、订单用 invoices，互不影响 */
  private tokenByScope = new Map<string, { token: string; expiry: number }>();
  private orderListCache: { list: XiaomanOrderItem[]; fetchedAt: number } | null = null;
  private readonly orderListCacheTtlMs = 5 * 60 * 1000;
  /** 并发去重：缓存冷时多个请求(预热+正式搜索)共用同一次拉取，避免重复全量拉小满 */
  private orderListInflight: Promise<XiaomanOrderItem[]> | null = null;

  constructor(private config: ConfigService) {}

  private getBaseUrl(): string {
    return this.config.get<string>('XIAOMAN_API_BASE_URL') ?? process.env.XIAOMAN_API_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private async getToken(scope = 'company'): Promise<string> {
    const now = Date.now();
    const cached = this.tokenByScope.get(scope);
    if (cached && cached.expiry > now + 60000) return cached.token;

    const clientId = this.config.get<string>('XIAOMAN_CLIENT_ID') ?? process.env.XIAOMAN_CLIENT_ID;
    const clientSecret = this.config.get<string>('XIAOMAN_CLIENT_SECRET') ?? process.env.XIAOMAN_CLIENT_SECRET;
    if (!clientId?.trim() || !clientSecret?.trim()) {
      throw new Error('请配置 .env 中的 XIAOMAN_CLIENT_ID 和 XIAOMAN_CLIENT_SECRET（需重启后端生效）');
    }

    const baseUrl = this.getBaseUrl();
    const res = await fetch(`${baseUrl}/v1/oauth2/access_token`, {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope,
      }),
    });
    const text = await res.text();
    let data: { access_token?: string; expires_in?: number; message?: string };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error(`小满鉴权失败：响应格式异常 HTTP ${res.status}，请确认 XIAOMAN_API_BASE_URL 与密钥正确`);
    }
    if (!data.access_token) {
      const msg = data.message || '小满鉴权失败，请检查 client_id 和 client_secret 是否从小满 CRM 正确复制';
      throw new Error(msg);
    }
    this.tokenByScope.set(scope, { token: data.access_token, expiry: now + (data.expires_in ?? 28800) * 1000 });
    return data.access_token;
  }

  async getCompanyList(
    page = 1,
    pageSize = 20,
  ): Promise<{ list: XiaomanCompanyItem[]; total: number }> {
    const token = await this.getToken();
    const baseUrl = this.getBaseUrl();
    const baseParams = '&removed=0&all=0';

    // 无搜索关键词：start_index 为小满页码（与 count 配套），非偏移量
    const startIndex = page;
    const url = `${baseUrl}/v1/company/list?count=${pageSize}&start_index=${startIndex}${baseParams}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let json: {
      code?: number;
      message?: string;
      data?: { list?: XiaomanCompanyItem[]; totalItem?: number };
    };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw new Error(`小满 API 响应格式异常 (${res.status})`);
    }
    if (json.code !== 200) {
      const msg = json.message || `小满客户列表获取失败 (code: ${json.code})`;
      throw new Error(msg);
    }
    if (!json.data) {
      throw new Error('小满 API 返回数据为空，请确认账号权限与 API 范围');
    }
    const list = json.data.list ?? [];
    const total = Number(json.data.totalItem);
    if (!Number.isFinite(total) || total < list.length) {
      throw new Error('小满客户列表总数无效，无法确认分页完整性');
    }
    return { list, total };
  }

  async getCompanyDetail(companyId: number): Promise<XiaomanCompanyDetail | null> {
    const token = await this.getToken();
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/v1/company/info?company_id=${companyId}&format=1`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let json: { code?: number; data?: XiaomanCompanyDetail };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      return null;
    }
    if (json.code !== 200 || !json.data) return null;
    return json.data;
  }

  /** 批量获取详情，每批 5 个并行，控制速度 */
  async getCompanyDetailsBatch(companyIds: number[]): Promise<(XiaomanCompanyDetail | null)[]> {
    const BATCH = 5;
    const results: (XiaomanCompanyDetail | null)[] = [];
    for (let i = 0; i < companyIds.length; i += BATCH) {
      const batch = companyIds.slice(i, i + BATCH);
      const batchResults = await Promise.all(batch.map((id) => this.getCompanyDetail(id)));
      results.push(...batchResults);
    }
    return results;
  }

  private normalizeOrder(raw: Record<string, unknown>): XiaomanOrderItem {
    const company = (raw.company ?? null) as { name?: string; company_id?: number } | null;
    return {
      order_id: Number(raw.order_id) || 0,
      order_no: String(raw.order_no ?? '').trim(),
      name: String(raw.name ?? '').trim(),
      company_id: Number(raw.company_id ?? company?.company_id) || 0,
      company_name: String(raw.company_name ?? company?.name ?? '').trim(),
      account_date: String(raw.account_date ?? '').trim(),
    };
  }

  /** 取某客户在小满里的国家（选订单后按 company_id 拉一次详情），用于带出装箱单收货国家。取不到返回 ''。 */
  async getCompanyCountry(companyId: number): Promise<string> {
    if (!companyId) return '';
    const detail = await this.getCompanyDetail(companyId);
    if (!detail) return '';
    return String(detail.country ?? detail.country_region?.country ?? '').trim();
  }

  /** 拉取近期销售订单（按更新时间倒序），最多 MAX 条，供后端本地按关键词过滤 */
  private async fetchRecentOrders(): Promise<XiaomanOrderItem[]> {
    const token = await this.getToken('invoices');
    const baseUrl = this.getBaseUrl();
    const MAX = 2000;
    // 每页 500（与客户列表同口径，已验证小满允许），减少翻页次数：1449 单从 ~8 次顺序请求降到 ~3 次，冷拉取明显变快
    const COUNT = 500;
    const out: XiaomanOrderItem[] = [];
    for (let startIndex = 1; out.length < MAX; startIndex++) {
      const url = `${baseUrl}/v1/invoices/order/list?count=${COUNT}&start_index=${startIndex}&time_type=1`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const text = await res.text();
      let json: { code?: number; message?: string; data?: { list?: Record<string, unknown>[] } };
      try {
        json = JSON.parse(text) as typeof json;
      } catch {
        throw new Error(`小满订单接口响应格式异常 (${res.status})`);
      }
      if (json.code !== 200) {
        throw new Error(json.message || `小满订单列表获取失败 (code: ${json.code})，请确认已开通 invoices 接口权限`);
      }
      const list = json.data?.list ?? [];
      out.push(...list.map((o) => this.normalizeOrder(o)));
      if (list.length < COUNT) break;
    }
    return out;
  }

  /**
   * 销售订单搜索：小满列表接口无关键词参数，故拉取近期订单后本地按订单号/订单名/客户名过滤（5 分钟缓存）。
   */
  async getOrderList(page = 1, pageSize = 20, keyword?: string): Promise<{ list: XiaomanOrderItem[]; total: number }> {
    const now = Date.now();
    let all: XiaomanOrderItem[];
    if (this.orderListCache && now - this.orderListCache.fetchedAt < this.orderListCacheTtlMs) {
      all = this.orderListCache.list;
    } else {
      if (!this.orderListInflight) {
        this.orderListInflight = this.fetchRecentOrders()
          .then((list) => {
            if (list.length) this.orderListCache = { list, fetchedAt: Date.now() };
            return list;
          })
          .finally(() => {
            this.orderListInflight = null;
          });
      }
      all = await this.orderListInflight;
    }
    const kw = keyword?.trim().toLowerCase();
    const filtered = kw
      ? all.filter((o) => `${o.order_no} ${o.name} ${o.company_name}`.toLowerCase().includes(kw))
      : all;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    return { list: filtered.slice(start, start + pageSize), total };
  }
}
