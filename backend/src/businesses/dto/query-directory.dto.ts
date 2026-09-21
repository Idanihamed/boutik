import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryDirectoryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  /** Code pays ISO à deux lettres (ex. « CI »). */
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
