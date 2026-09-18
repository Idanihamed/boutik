import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryPromotionsAdminDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'DISABLED'])
  adminStatus?: 'DRAFT' | 'ACTIVE' | 'DISABLED';
}
