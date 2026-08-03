import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { InventoryStockExportRequestDto } from '../common/inventory-stock-export.dto';

export class FabricStockExportDto extends InventoryStockExportRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inventoryTypeId?: number;

  @ValidateIf((dto: FabricStockExportDto) => dto.sortField !== undefined || dto.sortOrder !== undefined)
  @IsIn(['quantity'])
  sortField?: 'quantity';

  @ValidateIf((dto: FabricStockExportDto) => dto.sortField !== undefined || dto.sortOrder !== undefined)
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
