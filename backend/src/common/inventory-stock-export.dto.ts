import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export enum InventoryStockExportMode {
  Selected = 'selected',
  Filtered = 'filtered',
}

export abstract class InventoryStockExportRequestDto {
  @IsEnum(InventoryStockExportMode)
  mode: InventoryStockExportMode;

  @ValidateIf((dto: InventoryStockExportRequestDto) => (
    dto.mode === InventoryStockExportMode.Selected || dto.selectedIds !== undefined
  ))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  selectedIds?: number[];

  @ValidateIf((_, value) => value !== undefined)
  @MaxLength(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @MaxLength(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}
