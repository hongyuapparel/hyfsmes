import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';

/** Keys identify visible rows, not stock IDs; finished records may split into multiple colors. */
export class OutboundExportDto {
  @IsIn(['selected', 'filtered'])
  mode: 'selected' | 'filtered';

  @ValidateIf((dto: OutboundExportDto) => dto.mode === 'selected' || dto.selectedKeys !== undefined)
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ArrayUnique()
  @Matches(/^[1-9]\d*(?::\d+)?$/, { each: true })
  selectedKeys?: string[];

  @IsOptional() @IsString() @MaxLength(200)
  orderNo?: string;
  @IsOptional() @IsString() @MaxLength(200)
  skuCode?: string;
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;
  @IsOptional() @IsString() @MaxLength(200)
  customerName?: string;
  @IsOptional() @IsIn(['manual', 'order_auto'])
  outboundType?: string;
  @IsOptional() @IsInt() @Min(1)
  inventoryTypeId?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}
