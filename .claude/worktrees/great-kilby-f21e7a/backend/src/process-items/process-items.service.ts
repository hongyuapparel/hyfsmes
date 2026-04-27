import { Injectable } from '@nestjs/common';
import { SystemOptionsService } from '../system-options/system-options.service';

@Injectable()
export class ProcessItemsService {
  constructor(private readonly systemOptionsService: SystemOptionsService) {}

  /**
   * 目前直接复用 system-options 表，type = 'processItem'
   * 后续若有独立「工艺管理」模块，可在此替换实现
   */
  async search(keyword?: string) {
    const list = await this.systemOptionsService.findByType('processItem');
    const trimmed = keyword?.trim();
    if (!trimmed) return list;
    return list.filter((item) => item.includes(trimmed));
  }
}

