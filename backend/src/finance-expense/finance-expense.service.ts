import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { ExpenseRecord } from '../entities/expense-record.entity';
import { Order } from '../entities/order.entity';
import { Supplier } from '../entities/supplier.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

@Injectable()
export class FinanceExpenseService {
  constructor(
    @InjectRepository(ExpenseRecord)
    private readonly repo: Repository<ExpenseRecord>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  async getList(params: {
    dateFrom?: string;
    dateTo?: string;
    expenseTypeId?: number | null;
    departmentId?: number | null;
    orderId?: number | null;
    supplierId?: number | null;
    page?: number;
    pageSize?: number;
  }) {
    const {
      dateFrom,
      dateTo,
      expenseTypeId,
      departmentId,
      orderId,
      supplierId,
      page = 1,
      pageSize = 20,
    } = params;
    const qb = this.repo.createQueryBuilder('r');
    if (dateFrom) {
      qb.andWhere('r.occur_date >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('r.occur_date <= :dateTo', { dateTo });
    }
    if (expenseTypeId != null) {
      qb.andWhere('r.expense_type_id = :expenseTypeId', { expenseTypeId });
    }
    if (departmentId != null) {
      qb.andWhere('r.department_id = :departmentId', { departmentId });
    }
    if (orderId != null) {
      qb.andWhere('r.order_id = :orderId', { orderId });
    }
    if (supplierId != null) {
      qb.andWhere('r.supplier_id = :supplierId', { supplierId });
    }
    qb.orderBy('r.occur_date', 'DESC').addOrderBy('r.id', 'DESC');
    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const departmentIds = [
      ...new Set(list.map((r) => r.departmentId).filter((id) => id != null) as number[]),
    ];
    const expenseTypeIds = [
      ...new Set(list.map((r) => r.expenseTypeId).filter((id) => id != null) as number[]),
    ];
    const bankAccountIds = [
      ...new Set(list.map((r) => r.bankAccountId).filter((id) => id != null) as number[]),
    ];
    const orderIds = [
      ...new Set(list.map((r) => r.orderId).filter((id) => id != null) as number[]),
    ];
    const supplierIds = [
      ...new Set(list.map((r) => r.supplierId).filter((id) => id != null) as number[]),
    ];

    const [departmentLabels, expenseTypeLabels, bankAccountLabels, orders, suppliers] = await Promise.all([
      this.systemOptionsService.getOptionLabelsByIds('org_departments', departmentIds),
      this.systemOptionsService.getOptionLabelsByIds('expense_types', expenseTypeIds),
      this.systemOptionsService.getOptionLabelsByIds('bank_accounts', bankAccountIds),
      orderIds.length > 0
        ? this.orderRepo.find({ where: { id: In(orderIds) }, select: ['id', 'orderNo'] })
        : Promise.resolve([]),
      supplierIds.length > 0
        ? this.supplierRepo.find({ where: { id: In(supplierIds) }, select: ['id', 'name'] })
        : Promise.resolve([]),
    ]);
    const orderNoById = Object.fromEntries(orders.map((o) => [o.id, o.orderNo]));
    const supplierNameById = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));

    const items = list.map((r) => ({
      ...r,
      departmentName: r.departmentId != null ? departmentLabels[r.departmentId] : '',
      expenseTypeName: r.expenseTypeId != null ? expenseTypeLabels[r.expenseTypeId] : '',
      bankAccountName: r.bankAccountId != null ? bankAccountLabels[r.bankAccountId] : '',
      orderNo: r.orderId != null ? orderNoById[r.orderId] : '',
      supplierName: r.supplierId != null ? supplierNameById[r.supplierId] : '',
    }));
    return { list: items, total, page, pageSize };
  }

  async getOne(id: number) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('支出记录不存在');
    const [departmentLabels, expenseTypeLabels, bankAccountLabels] = await Promise.all([
      r.departmentId != null
        ? this.systemOptionsService.getOptionLabelsByIds('org_departments', [r.departmentId])
        : Promise.resolve({} as Record<number, string>),
      r.expenseTypeId != null
        ? this.systemOptionsService.getOptionLabelsByIds('expense_types', [r.expenseTypeId])
        : Promise.resolve({} as Record<number, string>),
      r.bankAccountId != null
        ? this.systemOptionsService.getOptionLabelsByIds('bank_accounts', [r.bankAccountId])
        : Promise.resolve({} as Record<number, string>),
    ]);
    let orderNo = '';
    let supplierName = '';
    if (r.orderId != null) {
      const order = await this.orderRepo.findOne({ where: { id: r.orderId }, select: ['orderNo'] });
      orderNo = order?.orderNo ?? '';
    }
    if (r.supplierId != null) {
      const sup = await this.supplierRepo.findOne({ where: { id: r.supplierId }, select: ['name'] });
      supplierName = sup?.name ?? '';
    }
    return {
      ...r,
      departmentName: r.departmentId != null ? departmentLabels[r.departmentId] : '',
      expenseTypeName: r.expenseTypeId != null ? expenseTypeLabels[r.expenseTypeId] : '',
      bankAccountName: r.bankAccountId != null ? bankAccountLabels[r.bankAccountId] : '',
      orderNo,
      supplierName,
    };
  }

  async create(dto: {
    occurDate: string;
    amount: number | string;
    expenseTypeId?: number | null;
    departmentId?: number | null;
    bankAccountId?: number | null;
    payee?: string;
    styleNo?: string;
    orderId?: number | null;
    supplierId?: number | null;
    detail?: string;
    attachments?: string[] | null;
  }) {
    const entity = this.repo.create({
      occurDate: new Date(dto.occurDate),
      amount: String(dto.amount),
      expenseTypeId: dto.expenseTypeId != null ? Number(dto.expenseTypeId) : null,
      departmentId: dto.departmentId != null ? Number(dto.departmentId) : null,
      bankAccountId: dto.bankAccountId != null ? Number(dto.bankAccountId) : null,
      payee: dto.payee?.trim() ?? '',
      styleNo: dto.styleNo?.trim() ?? '',
      orderId: dto.orderId != null ? Number(dto.orderId) : null,
      supplierId: dto.supplierId != null ? Number(dto.supplierId) : null,
      detail: dto.detail?.trim() ?? '',
      attachments: Array.isArray(dto.attachments)
        ? dto.attachments.map((u) => String(u).trim()).filter(Boolean)
        : null,
    });
    await this.assertNotDuplicate(entity);
    return this.repo.save(entity);
  }

  async update(
    id: number,
    dto: {
      occurDate?: string;
      amount?: number | string;
      expenseTypeId?: number | null;
      departmentId?: number | null;
      bankAccountId?: number | null;
      payee?: string;
      styleNo?: string;
      orderId?: number | null;
      supplierId?: number | null;
      detail?: string;
      attachments?: string[] | null;
    },
  ) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('支出记录不存在');
    if (dto.occurDate != null) r.occurDate = new Date(dto.occurDate);
    if (dto.amount != null) r.amount = String(dto.amount);
    if (dto.expenseTypeId !== undefined) r.expenseTypeId = dto.expenseTypeId != null ? Number(dto.expenseTypeId) : null;
    if (dto.departmentId !== undefined) r.departmentId = dto.departmentId != null ? Number(dto.departmentId) : null;
    if (dto.bankAccountId !== undefined) r.bankAccountId = dto.bankAccountId != null ? Number(dto.bankAccountId) : null;
    if (dto.payee !== undefined) r.payee = dto.payee?.trim() ?? '';
    if (dto.styleNo !== undefined) r.styleNo = dto.styleNo?.trim() ?? '';
    if (dto.orderId !== undefined) r.orderId = dto.orderId != null ? Number(dto.orderId) : null;
    if (dto.supplierId !== undefined) r.supplierId = dto.supplierId != null ? Number(dto.supplierId) : null;
    if (dto.detail !== undefined) r.detail = dto.detail?.trim() ?? '';
    if (dto.attachments !== undefined) {
      r.attachments = Array.isArray(dto.attachments)
        ? dto.attachments.map((u) => String(u).trim()).filter(Boolean)
        : null;
    }
    await this.assertNotDuplicate(r, id);
    return this.repo.save(r);
  }

  async remove(id: number) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('支出记录不存在');
    await this.repo.remove(r);
  }

  /** 下拉选项：支出类型、部门（供支出流水页使用） */
  async getOptions() {
    const [expenseTypes, departments, bankAccounts] = await Promise.all([
      this.systemOptionsService.findAllByType('expense_types'),
      this.systemOptionsService.findAllByType('org_departments'),
      this.systemOptionsService.findAllByType('bank_accounts'),
    ]);
    return {
      expenseTypes: expenseTypes.map((o) => ({ id: o.id, value: o.value })),
      departments: departments.map((o) => ({ id: o.id, value: o.value })),
      bankAccounts: bankAccounts.map((o) => ({ id: o.id, value: o.value })),
    };
  }

  /**
   * 疑似重复付款拦截：
   * - 同金额
   * - 同订单 / 同供应商 / 同款号 三者至少满足其一
   * - 发生日期在 ±30 天内
   */
  private async assertNotDuplicate(entity: ExpenseRecord, ignoreId?: number) {
    const amount = String(entity.amount ?? '').trim();
    const orderId = entity.orderId ?? null;
    const supplierId = entity.supplierId ?? null;
    const styleNo = (entity.styleNo ?? '').trim();
    if (!amount || (!orderId && !supplierId && !styleNo)) return;

    const occur = entity.occurDate instanceof Date ? entity.occurDate : new Date(entity.occurDate as any);
    const from = new Date(occur);
    const to = new Date(occur);
    from.setDate(from.getDate() - 30);
    to.setDate(to.getDate() + 30);

    const qb = this.repo.createQueryBuilder('r');
    qb.where('r.amount = :amount', { amount })
      .andWhere('r.occur_date >= :from AND r.occur_date <= :to', {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      })
      .andWhere(
        new Brackets((b) => {
          if (orderId) b.orWhere('r.order_id = :orderId', { orderId });
          if (supplierId) b.orWhere('r.supplier_id = :supplierId', { supplierId });
          if (styleNo) b.orWhere('r.style_no = :styleNo', { styleNo });
        }),
      );
    if (ignoreId) qb.andWhere('r.id <> :ignoreId', { ignoreId });
    qb.orderBy('r.occur_date', 'DESC').addOrderBy('r.id', 'DESC').limit(1);
    const dup = await qb.getOne();
    if (!dup) return;

    const tips = [
      orderId ? `订单ID=${orderId}` : null,
      supplierId ? `供应商ID=${supplierId}` : null,
      styleNo ? `款号=${styleNo}` : null,
    ]
      .filter(Boolean)
      .join('、');
    throw new ConflictException(
      `疑似重复付款：同金额且（${tips}）在近 30 天内已存在记录（ID=${dup.id}，日期=${dup.occurDate
        .toISOString()
        .slice(0, 10)}）。如确需重复付款，请先修改款号/明细以区分，或调整日期后再登记。`,
    );
  }
}
