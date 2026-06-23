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
}

export interface XiaomanCompanyDetail {
  company_id: number;
  serial_id: string;
  name: string;
  short_name?: string;
  country?: string;
  country_region?: { country?: string; province?: string; city?: string };
  order_time?: string;
  tel?: string[];
  product_group_ids?: number[];
  product_group_names?: string;
  /** 主联系人姓名（字段名按小满返回结构做 best effort 兼容） */
  main_contact_name?: string;
  main_contact?: { name?: string } | null;
  contacts?: { name?: string; nickname?: string; nick_name?: string }[] | null;
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
  private companyListCache: { list: XiaomanCompanyItem[]; fetchedAt: number } | null = null;
  private orderListCache: { list: XiaomanOrderItem[]; fetchedAt: number } | null = null;
  private companyListCacheTtlMs = 5 * 60 * 1000; // 5 分钟
  private listLoggedOnce = false;

  constructor(private config: ConfigService) {}

  /**
   * 搜索匹配：公司名 + 客户编号 + 联系人（按小满列表真实字段做兼容）。
   */
  private matchesKeyword(item: XiaomanCompanyItem, lowerKeyword: string): boolean {
    const anyItem = item as unknown as Record<string, unknown>;
    const companyName = String(anyItem.name ?? '').toLowerCase();
    const serialId = String(anyItem.serial_id ?? anyItem.serialId ?? '').toLowerCase();
    const contactPerson = String(
      anyItem.contactPerson ??
        anyItem.contact_person ??
        anyItem.main_contact_name ??
        anyItem.main_contact ??
        anyItem.contact_name ??
        anyItem.linkman ??
        '',
    ).toLowerCase();
    return (
      companyName.includes(lowerKeyword) ||
      serialId.includes(lowerKeyword) ||
      contactPerson.includes(lowerKeyword)
    );
  }

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
    keyword?: string,
  ): Promise<{ list: XiaomanCompanyItem[]; total: number }> {
    const token = await this.getToken();
    const baseUrl = this.getBaseUrl();
    const kw = keyword?.trim();
    const hasKeyword = !!kw;

    // 只取「客户列表」中的客户（all=0 排除公海）
    // const baseParams = '&removed=0&all=0';
    const baseParams = '&all=0';

    // 有搜索关键词：先拉列表，再在后端本地按 name/contactPerson 做模糊匹配。
    if (hasKeyword) {
      const now = Date.now();
      if (this.companyListCache && now - this.companyListCache.fetchedAt < this.companyListCacheTtlMs) {
        // eslint-disable-next-line no-console
        console.log('[xiaoman] using search cache');
        const all = this.companyListCache.list;
        const lower = kw.toLowerCase();
        const filtered = all.filter((c) => this.matchesKeyword(c, lower));
        const total = filtered.length;
        const sliceStart = (page - 1) * pageSize;
        const sliceEnd = sliceStart + pageSize;
        return { list: filtered.slice(sliceStart, sliceEnd), total };
      }
      // eslint-disable-next-line no-console
      console.log('[xiaoman] refreshing search cache');

      const MAX_FETCH = 5000;
      const PAGE_SIZE_FOR_FETCH = 500;
      let fetched: XiaomanCompanyItem[] = [];
      // 小满 start_index 按页码语义：1, 2, 3...（每页 count 条）
      let startIndex = 1;
      let totalItem: number | null = null;
      let endedByMaxFetch = false;
      let lastPageListLen = 0;

      const fetchPageWithRetry = async (): Promise<{ list: XiaomanCompanyItem[]; totalItem?: number } | null> => {
        const url = `${baseUrl}/v1/company/list?count=${PAGE_SIZE_FOR_FETCH}&start_index=${startIndex}${baseParams}`;
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const res = await fetch(url, {
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
            if (!this.listLoggedOnce) {
              this.listLoggedOnce = true;
              // eslint-disable-next-line no-console
              console.log(
                '[Xiaoman DEBUG] company/list first rows:',
                JSON.stringify((json.data.list ?? []).slice(0, 3), null, 2),
              );
            }
            return { list: json.data.list ?? [], totalItem: json.data.totalItem };
          } catch (e) {
            const delayMs = 400 * attempt;
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
        // 降级：这一页拿不到，就直接返回 null
        return null;
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const r = await fetchPageWithRetry();
        if (!r) break;

        if (totalItem == null && r.totalItem != null) {
          const parsed = Number(r.totalItem);
          if (Number.isFinite(parsed) && parsed > 0) totalItem = parsed;
        }

        lastPageListLen = r.list.length;
        fetched = fetched.concat(r.list);
        if (fetched.length >= MAX_FETCH) endedByMaxFetch = true;

        const reachedTotal = totalItem != null ? fetched.length >= totalItem : false;
        if (reachedTotal || fetched.length >= MAX_FETCH || r.list.length < PAGE_SIZE_FOR_FETCH) {
          break;
        }
        startIndex += 1;
      }

      // 只有在“看起来已拉完/自然结束”时才缓存，避免缓存不完整后导致后续永远搜不到
      const shouldCache = fetched.length > 0 && !endedByMaxFetch && (lastPageListLen < PAGE_SIZE_FOR_FETCH || (totalItem != null && fetched.length >= totalItem));
      if (shouldCache) {
        this.companyListCache = { list: fetched, fetchedAt: Date.now() };
      }

      if (!fetched.length) {
        return { list: [], total: 0 };
      }

      const lower = kw.toLowerCase();
      const filtered = fetched.filter((c) => this.matchesKeyword(c, lower));

      const total = filtered.length;
      const sliceStart = (page - 1) * pageSize;
      const sliceEnd = sliceStart + pageSize;
      return { list: filtered.slice(sliceStart, sliceEnd), total };
    }

    // 无搜索关键词：start_index 为小满页码（与 count 配套），非偏移量
    const startIndex = page;
    const url = `${baseUrl}/v1/company/list?count=${pageSize}&start_index=${startIndex}${baseParams}`;
    const res = await fetch(url, {
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
    const total = json.data.totalItem ?? list.length;
    return { list, total };
  }

  private detailLoggedOnce = false;

  async getCompanyDetail(companyId: number): Promise<XiaomanCompanyDetail | null> {
    const token = await this.getToken();
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/v1/company/info?company_id=${companyId}&format=1`;
    const res = await fetch(url, {
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
    // 只打印一次，用于确认联系人与合作日期的真实字段名
    if (!this.detailLoggedOnce) {
      this.detailLoggedOnce = true;
      // eslint-disable-next-line no-console
      console.log('[Xiaoman DEBUG] company detail raw:', JSON.stringify(json.data, null, 2));
    }
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
    const COUNT = 200;
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
    if (this.orderListCache && now - this.orderListCache.fetchedAt < this.companyListCacheTtlMs) {
      all = this.orderListCache.list;
    } else {
      all = await this.fetchRecentOrders();
      if (all.length) this.orderListCache = { list: all, fetchedAt: now };
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
