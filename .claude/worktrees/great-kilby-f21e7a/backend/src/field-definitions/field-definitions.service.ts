import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FieldDefinition } from '../entities/field-definition.entity';

@Injectable()
export class FieldDefinitionsService {
  constructor(
    @InjectRepository(FieldDefinition)
    private repo: Repository<FieldDefinition>,
  ) {}

  async findByModule(module: string) {
    return this.repo.find({
      where: { module },
      order: { order: 'ASC' },
    });
  }

  async updateOrder(id: number, order: number) {
    const fd = await this.repo.findOne({ where: { id } });
    if (!fd) throw new NotFoundException('字段配置不存在');
    fd.order = order;
    return this.repo.save(fd);
  }

  async updateVisible(id: number, visible: boolean) {
    const fd = await this.repo.findOne({ where: { id } });
    if (!fd) throw new NotFoundException('字段配置不存在');
    fd.visible = visible ? 1 : 0;
    return this.repo.save(fd);
  }

  async batchUpdateOrder(module: string, items: { id: number; order: number }[]) {
    for (const item of items) {
      const fd = await this.repo.findOne({ where: { id: item.id, module } });
      if (fd) {
        fd.order = item.order;
        await this.repo.save(fd);
      }
    }
    return this.findByModule(module);
  }
}
