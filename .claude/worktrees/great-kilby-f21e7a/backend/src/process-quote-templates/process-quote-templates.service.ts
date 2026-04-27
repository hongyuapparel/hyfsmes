import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProcessQuoteTemplate } from '../entities/process-quote-template.entity';
import { ProcessQuoteTemplateItem } from '../entities/process-quote-template-item.entity';
import { ProductionProcess } from '../entities/production-process.entity';

export interface TemplateItemWithProcess {
  id: number;
  templateId: number;
  processId: number;
  sortOrder: number;
  department: string;
  jobType: string;
  processName: string;
  unitPrice: string;
}

@Injectable()
export class ProcessQuoteTemplatesService {
  constructor(
    @InjectRepository(ProcessQuoteTemplate)
    private readonly templateRepo: Repository<ProcessQuoteTemplate>,
    @InjectRepository(ProcessQuoteTemplateItem)
    private readonly itemRepo: Repository<ProcessQuoteTemplateItem>,
    @InjectRepository(ProductionProcess)
    private readonly processRepo: Repository<ProductionProcess>,
  ) {}

  async findAll(): Promise<ProcessQuoteTemplate[]> {
    return this.templateRepo.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<ProcessQuoteTemplate> {
    const row = await this.templateRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('报价模板不存在');
    return row;
  }

  async create(dto: { name: string; sortOrder?: number }): Promise<ProcessQuoteTemplate> {
    const entity = this.templateRepo.create({
      name: (dto.name ?? '').trim(),
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.templateRepo.save(entity);
  }

  async update(id: number, dto: { name?: string; sortOrder?: number }): Promise<ProcessQuoteTemplate> {
    const row = await this.findOne(id);
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    return this.templateRepo.save(row);
  }

  async remove(id: number): Promise<void> {
    const row = await this.findOne(id);
    await this.templateRepo.remove(row);
  }

  /** 获取模板下的工序项（含工序详情），用于配置页展示与订单成本页导入 */
  async findItemsWithProcess(templateId: number): Promise<TemplateItemWithProcess[]> {
    await this.findOne(templateId);
    const items = await this.itemRepo.find({
      where: { templateId },
      order: { sortOrder: 'ASC', id: 'ASC' },
      relations: ['process'],
    });
    return items.map((item) => ({
      id: item.id,
      templateId: item.templateId,
      processId: item.processId,
      sortOrder: item.sortOrder,
      department: (item.process?.department ?? '').trim(),
      jobType: (item.process?.jobType ?? '').trim(),
      processName: (item.process?.name ?? '').trim(),
      unitPrice: item.process?.unitPrice ?? '0.00',
    }));
  }

  /** 设置模板工序列表（覆盖） */
  async setItems(templateId: number, processIds: number[]): Promise<void> {
    await this.findOne(templateId);
    await this.itemRepo.delete({ templateId });
    if (!processIds?.length) return;
    const processes = await this.processRepo.find({ where: { id: In(processIds) } });
    const idSet = new Set(processes.map((p) => p.id));
    const order = processIds.filter((id) => idSet.has(id));
    const entities = order.map((processId, index) =>
      this.itemRepo.create({ templateId, processId, sortOrder: index }),
    );
    await this.itemRepo.save(entities);
  }
}
