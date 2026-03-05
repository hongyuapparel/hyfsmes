import { DataSource } from 'typeorm';
import { FieldDefinition } from '../entities/field-definition.entity';

const PRODUCT_FIELDS = [
  { code: 'createdAt', label: '创建时间', type: 'date', order: 1, visible: 1, filterable: 0, sortable: 1, optionsKey: null },
  { code: 'skuCode', label: 'SKU编号', type: 'text', order: 2, visible: 1, filterable: 1, sortable: 0, optionsKey: null },
  { code: 'imageUrl', label: '图片', type: 'image', order: 3, visible: 1, filterable: 0, sortable: 0, optionsKey: null },
  { code: 'productGroup', label: '产品分组', type: 'select', order: 4, visible: 1, filterable: 1, sortable: 0, optionsKey: 'productGroups' },
  { code: 'companyName', label: '客户(公司名称)', type: 'text', order: 5, visible: 1, filterable: 1, sortable: 0, optionsKey: null },
  { code: 'salesperson', label: '业务员', type: 'select', order: 6, visible: 1, filterable: 1, sortable: 0, optionsKey: 'salespeople' },
];

export async function seedFieldDefinitions(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(FieldDefinition);
  const count = await repo.count({ where: { module: 'products' } });
  if (count > 0) {
    await repo.update(
      { module: 'products', code: 'clothingType' },
      { code: 'productGroup', label: '产品分组', optionsKey: 'productGroups' },
    );
    await repo.delete({ module: 'products', code: 'customerId' });
    await repo.update(
      { module: 'products', code: 'companyName' },
      { label: '客户' },
    );
    return;
  }

  for (const f of PRODUCT_FIELDS) {
    await repo.save(
      repo.create({
        module: 'products',
        code: f.code,
        label: f.label,
        type: f.type,
        order: f.order,
        visible: f.visible,
        filterable: f.filterable,
        sortable: f.sortable,
        optionsKey: f.optionsKey,
      }),
    );
  }
  console.log('[Seed] Field definitions for products seeded.');
}
