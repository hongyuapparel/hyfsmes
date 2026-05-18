import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class DeleteOrphansDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  filenames: string[];
}
