import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../entities/employee.entity';
import { UsersService } from '../users/users.service';
import { SystemOptionsService } from '../system-options/system-options.service';

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
    private readonly usersService: UsersService,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  async getList(params: {
    name?: string;
    departmentId?: number;
    jobTitleId?: number;
    status?: string;
    entryDateStart?: string;
    entryDateEnd?: string;
    leaveDateStart?: string;
    leaveDateEnd?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }) {
    const {
      name,
      departmentId,
      jobTitleId,
      status,
      entryDateStart,
      entryDateEnd,
      leaveDateStart,
      leaveDateEnd,
      sortBy,
      sortOrder,
      page = 1,
      pageSize = 20,
    } = params;
    const qb = this.repo.createQueryBuilder('e').leftJoinAndSelect('e.user', 'u');
    if (name?.trim()) {
      qb.andWhere('e.name LIKE :name', { name: `%${name.trim()}%` });
    }
    if (typeof departmentId === 'number' && !Number.isNaN(departmentId)) {
      qb.andWhere('e.department_id = :departmentId', { departmentId });
    }
    if (typeof jobTitleId === 'number' && !Number.isNaN(jobTitleId)) {
      qb.andWhere('e.job_title_id = :jobTitleId', { jobTitleId });
    }
    if (status?.trim()) {
      qb.andWhere('e.status = :status', { status: status.trim() });
    }
    if (entryDateStart) {
      qb.andWhere('e.entry_date >= :entryDateStart', { entryDateStart });
    }
    if (entryDateEnd) {
      qb.andWhere('e.entry_date <= :entryDateEnd', { entryDateEnd });
    }
    if (leaveDateStart) {
      qb.andWhere('e.leave_date >= :leaveDateStart', { leaveDateStart });
    }
    if (leaveDateEnd) {
      qb.andWhere('e.leave_date <= :leaveDateEnd', { leaveDateEnd });
    }
    const sortColumnMap: Record<string, string> = {
      sortOrder: 'e.sortOrder',
      name: 'e.name',
      entryDate: 'e.entryDate',
      status: 'e.status',
    };
    const sortColumn = sortBy ? sortColumnMap[sortBy] : '';
    const direction = sortOrder === 'desc' ? 'DESC' : 'ASC';
    if (sortColumn) {
      qb.orderBy(sortColumn, direction as 'ASC' | 'DESC').addOrderBy('e.id', 'ASC');
    } else {
      qb.orderBy('e.sortOrder', 'ASC').addOrderBy('e.id', 'ASC');
    }
    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const departmentIds = Array.from(
      new Set(list.map((e) => e.departmentId).filter((v) => v != null) as number[]),
    );
    const jobTitleIds = Array.from(
      new Set(list.map((e) => e.jobTitleId).filter((v) => v != null) as number[]),
    );

    const [departmentLabels, jobTitleLabels] = await Promise.all([
      this.systemOptionsService.getOptionLabelsByIds('org_departments', departmentIds),
      this.systemOptionsService.getOptionLabelsByIds('org_jobs', jobTitleIds),
    ]);

    const withLabels = list.map((e) => ({
      ...e,
      departmentName:
        (e.departmentId != null ? departmentLabels[e.departmentId] : '') || e.department || '',
      jobTitleName:
        (e.jobTitleId != null ? jobTitleLabels[e.jobTitleId] : '') || e.jobTitle || '',
    }));

    return { list: withLabels, total, page, pageSize };
  }

  async getStaffOptions(): Promise<{ id: number; name: string; departmentName: string; jobTitleName: string; status: string }[]> {
    const list = await this.repo.find({ select: ['id', 'name', 'departmentId', 'jobTitleId', 'department', 'jobTitle', 'status'] });
    const departmentIds = Array.from(new Set(list.map((e) => e.departmentId).filter((v) => v != null) as number[]));
    const jobTitleIds = Array.from(new Set(list.map((e) => e.jobTitleId).filter((v) => v != null) as number[]));
    const [departmentLabels, jobTitleLabels] = await Promise.all([
      this.systemOptionsService.getOptionLabelsByIds('org_departments', departmentIds),
      this.systemOptionsService.getOptionLabelsByIds('org_jobs', jobTitleIds),
    ]);
    return list.map((e) => ({
      id: e.id,
      name: e.name ?? '',
      departmentName: (e.departmentId != null ? departmentLabels[e.departmentId] : '') || e.department || '',
      jobTitleName: (e.jobTitleId != null ? jobTitleLabels[e.jobTitleId] : '') || e.jobTitle || '',
      status: e.status ?? '',
    }));
  }

  async getOne(id: number): Promise<Employee> {
    const item = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!item) throw new NotFoundException('人员不存在');
    return item;
  }

  async create(dto: {
    employeeNo?: string;
    name: string;
    gender?: string;
    departmentId?: number | null;
    jobTitleId?: number | null;
    entryDate?: string;
    contactPhone?: string;
    education?: string;
    dormitory?: string;
    idCardNo?: string;
    nativePlace?: string;
    homeAddress?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
    leaveDate?: string;
    leaveReason?: string;
    status?: string;
    userId?: number | null;
    remark?: string;
    photoUrl?: string;
  }): Promise<Employee> {
    const normalizedName = dto.name?.trim() ?? '';
    if (!normalizedName) throw new BadRequestException('姓名不能为空');
    const exists = await this.repo.findOne({ where: { name: normalizedName } });
    if (exists) throw new BadRequestException('该姓名已存在');

    const [{ maxSort }] = await this.repo
      .createQueryBuilder('e')
      .select('COALESCE(MAX(e.sortOrder), 0)', 'maxSort')
      .getRawMany<{ maxSort: number }>();
    const entity = this.repo.create({
      employeeNo: dto.employeeNo?.trim() ?? '',
      name: normalizedName,
      gender: dto.gender?.trim() || 'unknown',
      department: '',
      jobTitle: '',
      departmentId:
        typeof dto.departmentId === 'number' && !Number.isNaN(dto.departmentId)
          ? dto.departmentId
          : null,
      jobTitleId:
        typeof dto.jobTitleId === 'number' && !Number.isNaN(dto.jobTitleId)
          ? dto.jobTitleId
          : null,
      entryDate: dto.entryDate ? new Date(dto.entryDate) : null,
      contactPhone: dto.contactPhone?.trim() ?? '',
      education: dto.education?.trim() ?? '',
      dormitory: dto.dormitory?.trim() ?? '',
      idCardNo: dto.idCardNo?.trim() ?? '',
      nativePlace: dto.nativePlace?.trim() ?? '',
      homeAddress: dto.homeAddress?.trim() ?? '',
      emergencyContact: dto.emergencyContact?.trim() ?? '',
      emergencyPhone: dto.emergencyPhone?.trim() ?? '',
      leaveDate: dto.leaveDate ? new Date(dto.leaveDate) : null,
      leaveReason: dto.leaveReason?.trim() ?? '',
      status: dto.status?.trim() === 'left' ? 'left' : 'active',
      userId: dto.userId ?? null,
      remark: dto.remark?.trim() ?? '',
      photoUrl: dto.photoUrl?.trim() ?? '',
      sortOrder: Number(maxSort || 0) + 1,
    });
    return this.repo.save(entity);
  }

  async update(
    id: number,
    dto: {
      employeeNo?: string;
      name?: string;
      gender?: string;
      departmentId?: number | null;
      jobTitleId?: number | null;
      entryDate?: string;
      contactPhone?: string;
      education?: string;
      dormitory?: string;
      idCardNo?: string;
      nativePlace?: string;
      homeAddress?: string;
      emergencyContact?: string;
      emergencyPhone?: string;
      leaveDate?: string;
      leaveReason?: string;
      status?: string;
      userId?: number | null;
      remark?: string;
      photoUrl?: string;
    },
  ): Promise<Employee> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('人员不存在');
    if (dto.employeeNo !== undefined) item.employeeNo = dto.employeeNo?.trim() ?? '';
    if (dto.name !== undefined) {
      const normalizedName = dto.name?.trim() ?? '';
      if (!normalizedName) throw new BadRequestException('姓名不能为空');
      const exists = await this.repo.findOne({ where: { name: normalizedName } });
      if (exists && exists.id !== id) throw new BadRequestException('该姓名已存在');
      item.name = normalizedName;
    }
    if (dto.gender !== undefined) item.gender = dto.gender?.trim() || 'unknown';
    if (dto.departmentId !== undefined) {
      item.departmentId =
        typeof dto.departmentId === 'number' && !Number.isNaN(dto.departmentId)
          ? dto.departmentId
          : null;
    }
    if (dto.jobTitleId !== undefined) {
      item.jobTitleId =
        typeof dto.jobTitleId === 'number' && !Number.isNaN(dto.jobTitleId)
          ? dto.jobTitleId
          : null;
    }
    if (dto.entryDate !== undefined) {
      item.entryDate = dto.entryDate ? new Date(dto.entryDate) : null;
    }
    if (dto.contactPhone !== undefined) item.contactPhone = dto.contactPhone?.trim() ?? '';
    if (dto.education !== undefined) item.education = dto.education?.trim() ?? '';
    if (dto.dormitory !== undefined) item.dormitory = dto.dormitory?.trim() ?? '';
    if (dto.idCardNo !== undefined) item.idCardNo = dto.idCardNo?.trim() ?? '';
    if (dto.nativePlace !== undefined) item.nativePlace = dto.nativePlace?.trim() ?? '';
    if (dto.homeAddress !== undefined) item.homeAddress = dto.homeAddress?.trim() ?? '';
    if (dto.emergencyContact !== undefined) item.emergencyContact = dto.emergencyContact?.trim() ?? '';
    if (dto.emergencyPhone !== undefined) item.emergencyPhone = dto.emergencyPhone?.trim() ?? '';
    if (dto.leaveDate !== undefined) {
      item.leaveDate = dto.leaveDate ? new Date(dto.leaveDate) : null;
    }
    if (dto.leaveReason !== undefined) item.leaveReason = dto.leaveReason?.trim() ?? '';
    if (dto.status !== undefined) item.status = dto.status?.trim() === 'left' ? 'left' : 'active';
    if (dto.userId !== undefined) item.userId = dto.userId ?? null;
    if (dto.remark !== undefined) item.remark = dto.remark?.trim() ?? '';
    if (dto.photoUrl !== undefined) item.photoUrl = dto.photoUrl?.trim() ?? '';
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('人员不存在');
    await this.repo.remove(item);
  }

  async batchUpdateOrder(items: { id: number; sortOrder: number }[]): Promise<void> {
    for (const { id, sortOrder } of items) {
      await this.repo.update({ id }, { sortOrder });
    }
  }

  async moveSortOrder(id: number, targetOrder: number): Promise<void> {
    const all = await this.repo.find({
      select: ['id', 'sortOrder'],
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    if (!all.length) return;
    const fromIndex = all.findIndex((x) => x.id === id);
    if (fromIndex < 0) throw new NotFoundException('人员不存在');
    const toIndex = Math.max(0, Math.min(all.length - 1, Math.floor(targetOrder) - 1));
    if (fromIndex === toIndex) return;

    const rows = all.slice();
    const [moved] = rows.splice(fromIndex, 1);
    if (!moved) return;
    rows.splice(toIndex, 0, moved);

    await this.repo.manager.transaction(async (manager) => {
      for (let i = 0; i < rows.length; i += 1) {
        const nextSort = i + 1;
        if (rows[i].sortOrder !== nextSort) {
          await manager.update(Employee, { id: rows[i].id }, { sortOrder: nextSort });
        }
      }
    });
  }

  async checkNameExists(name: string, excludeId?: number): Promise<boolean> {
    const normalizedName = name?.trim() ?? '';
    if (!normalizedName) return false;
    const item = await this.repo.findOne({ where: { name: normalizedName } });
    if (!item) return false;
    if (typeof excludeId === 'number' && item.id === excludeId) return false;
    return true;
  }

  /** 人事页「关联用户」下拉：仅返回 id、username、displayName，需 /hr 权限即可调用 */
  async getUserOptions(): Promise<{ id: number; username: string; displayName: string }[]> {
    const list = await this.usersService.findAll();
    return (list as { id: number; username: string; displayName?: string }[]).map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName ?? '',
    }));
  }
}
