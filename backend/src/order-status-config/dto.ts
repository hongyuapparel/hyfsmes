import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  label: string;

  @IsInt()
  @Min(0)
  sortOrder = 0;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  groupKey?: string;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateOrderStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  groupKey?: string | null;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateOrderStatusTransitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  fromStatus: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  toStatus: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  triggerType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  triggerCode: string;

  @IsOptional()
  conditionsJson?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nextDepartment?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/** 批量创建流转规则（一条链路多步） */
export class BatchCreateTransitionsDto {
  /** 链路名称 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  /** 整条链路共用的条件（可选），如 { orderType: 'sample', productForm: 'all' } */
  @IsOptional()
  conditionsJson?: unknown;

  /** 步骤列表，按顺序执行会依次创建多条规则 */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderStatusTransitionDto)
  steps: CreateOrderStatusTransitionDto[];
}

/** 订单状态时效配置：创建 */
export class CreateOrderStatusSlaDto {
  @IsInt()
  orderStatusId: number;

  @IsNumber()
  @Min(0)
  limitHours: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/** 订单状态时效配置：更新 */
export class UpdateOrderStatusSlaDto {
  @IsOptional()
  @IsInt()
  orderStatusId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limitHours?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateOrderStatusTransitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  fromStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  toStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  triggerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  triggerCode?: string;

  @IsOptional()
  conditionsJson?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nextDepartment?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

