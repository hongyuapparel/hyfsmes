import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../entities/employee.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
    private readonly usersService: UsersService,
  ) {}

  async getList(params: {
    name?: string;
    department?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { name, department, status, page = 1, pageSize = 20 } = params;
    const qb = this.repo.createQueryBuilder('e').leftJoinAndSelect('e.user', 'u');
    if (name?.trim()) {
      qb.andWhere('e.name LIKE :name', { name: `%${name.trim()}%` });
    }
    if (department?.trim()) {
      qb.andWhere('e.department = :department', { department: department.trim() });
    }
    if (status?.trim()) {
      qb.andWhere('e.status = :status', { status: status.trim() });
    }
    qb.orderBy('e.id', 'DESC');
    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { list, total, page, pageSize };
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
    department?: string;
    jobTitle?: string;
    entryDate?: string;
    contactPhone?: string;
    status?: string;
    userId?: number | null;
    remark?: string;
  }): Promise<Employee> {
    const entity = this.repo.create({
      employeeNo: dto.employeeNo?.trim() ?? '',
      name: dto.name?.trim() ?? '',
      department: dto.department?.trim() ?? '',
      jobTitle: dto.jobTitle?.trim() ?? '',
      entryDate: dto.entryDate ? new Date(dto.entryDate) : null,
      contactPhone: dto.contactPhone?.trim() ?? '',
      status: dto.status?.trim() === 'left' ? 'left' : 'active',
      userId: dto.userId ?? null,
      remark: dto.remark?.trim() ?? '',
    });
    return this.repo.save(entity);
  }

  async update(
    id: number,
    dto: {
      employeeNo?: string;
      name?: string;
      department?: string;
      jobTitle?: string;
      entryDate?: string;
      contactPhone?: string;
      status?: string;
      userId?: number | null;
      remark?: string;
    },
  ): Promise<Employee> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('人员不存在');
    if (dto.employeeNo !== undefined) item.employeeNo = dto.employeeNo?.trim() ?? '';
    if (dto.name !== undefined) item.name = dto.name?.trim() ?? '';
    if (dto.department !== undefined) item.department = dto.department?.trim() ?? '';
    if (dto.jobTitle !== undefined) item.jobTitle = dto.jobTitle?.trim() ?? '';
    if (dto.entryDate !== undefined) {
      item.entryDate = dto.entryDate ? new Date(dto.entryDate) : null;
    }
    if (dto.contactPhone !== undefined) item.contactPhone = dto.contactPhone?.trim() ?? '';
    if (dto.status !== undefined) item.status = dto.status?.trim() === 'left' ? 'left' : 'active';
    if (dto.userId !== undefined) item.userId = dto.userId ?? null;
    if (dto.remark !== undefined) item.remark = dto.remark?.trim() ?? '';
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('人员不存在');
    await this.repo.remove(item);
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
