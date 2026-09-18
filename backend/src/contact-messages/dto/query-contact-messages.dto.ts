import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryContactMessagesDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['NOUVEAU', 'LU', 'TRAITE'])
  status?: 'NOUVEAU' | 'LU' | 'TRAITE';
}
