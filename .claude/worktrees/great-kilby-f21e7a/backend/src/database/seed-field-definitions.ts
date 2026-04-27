import { DataSource } from 'typeorm';
import { FieldDefinition } from '../entities/field-definition.entity';

const PRODUCT_FIELDS = [
  { code: 'createdAt', label: '创建时间', type: 'date', order: 1, visible: 1, filterable: 0, sortable: 1, optionsKey: null },
  { code: 'productName', label: '产品名称', type: 'text', order: 2, visible: 1, filterable: 1, sortable: 0, optionsKey: null },
  { code: 'skuCode', label: 'SKU编号', type: 'text', order: 3, visible: 1, filterable: 1, sortable: 0, optionsKey: null },
  { code: 'imageUrl', label: '图片', type: 'image', order: 4, visible: 1, filterable: 0, sortable: 0, optionsKey: null },
  { code: 'productGroup', label: '产品分组', type: 'select', order: 5, visible: 1, filterable: 1, sortable: 0, optionsKey: 'productGroups' },
  { code: 'applicablePeople', label: '适用人群', type: 'select', order: 6, visible: 1, filterable: 1, sortable: 0, optionsKey: 'applicablePeople' },
  { code: 'companyName', label: '客户(公司名称)', type: 'text', order: 7, visible: 1, filterable: 1, sortable: 0, optionsKey: null },
  { code: 'salesperson', label: '业务员', type: 'select', order: 8, visible: 1, filterable: 1, sortable: 0, optionsKey: 'salespeople' },
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
    const hasProductName = await repo.count({ where: { module: 'products', code: 'productName' } });
    if (hasProductName === 0) {
      await repo.save(
        repo.create({
          module: 'products',
          code: 'productName',
          label: '产品名称',
          type: 'text',
          order: 2,
          visible: 1,
          filterable: 1,
          sortable: 0,
          optionsKey: null,
          placeholder: '建议补充场景/版型/面料（如：紧身运动速干T恤）',
        }),
      );
    } else {
      await repo.update(
        { module: 'products', code: 'productName' },
        { label: '产品名称', filterable: 1, placeholder: '建议补充场景/版型/面料（如：紧身运动速干T恤）' },
      );
    }
    const hasApplicablePeople = await repo.count({ where: { module: 'products', code: 'applicablePeople' } });
    if (hasApplicablePeople === 0) {
      const maxOrderRow = await repo
        .createQueryBuilder('f')
        .select('MAX(f.order)', 'maxOrder')
        .where('f.module = :m', { m: 'products' })
        .getRawOne<{ maxOrder?: string | number }>();
      const baseOrder = Number((maxOrderRow as any)?.maxOrder ?? 7) || 7;
      await repo.save(
        repo.create({
          module: 'products',
          code: 'applicablePeople',
          label: '适用人群',
          type: 'select',
          order: baseOrder + 1,
          visible: 1,
          filterable: 1,
          sortable: 0,
          optionsKey: 'applicablePeople',
        }),
      );
    }
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
