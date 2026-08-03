import { IsOptional, IsString, MaxLength } from 'class-validator';
import { InventoryStockExportRequestDto } from '../common/inventory-stock-export.dto';

export class InventoryAccessoriesExportDto extends InventoryStockExportRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  salesperson?: string;
}
