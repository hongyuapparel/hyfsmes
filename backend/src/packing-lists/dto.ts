import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PackingItemPayloadDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  styleNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  styleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  colorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string;

  /** 码名→件数 */
  @IsOptional()
  sizeQuantities?: Record<string, number> | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalQty?: number;

  /** pending | finished | manual */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  sourceType?: string;

  @IsOptional()
  @IsInt()
  sourceId?: number | null;
}

export class PackingBoxPayloadDto {
  @IsOptional()
  @IsNumber()
  weightKg?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cartonSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackingItemPayloadDto)
  items: PackingItemPayloadDto[];
}

export class SavePackingListDto {
  @IsOptional()
  @IsInt()
  customerId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  serviceManager?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  poNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  xiaomanOrderNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  xiaomanOrderId?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  packDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remark?: string;

  @IsOptional()
  @IsBoolean()
  showCompany?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sizeHeaders?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackingBoxPayloadDto)
  boxes: PackingBoxPayloadDto[];
}
