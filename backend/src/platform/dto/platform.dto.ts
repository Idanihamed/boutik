import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const BUSINESS_STATUSES = ['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'BANNED'] as const;
const REPORT_STATUSES = ['OPEN', 'DISMISSED', 'ACTIONED'] as const;

export class QueryPlatformBusinessesDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(BUSINESS_STATUSES)
  status?: (typeof BUSINESS_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

/** Motif communiqué au responsable ; obligatoire pour refuser, suspendre ou bannir (voir le service). */
export class ModerateBusinessDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class QueryPlatformReportsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(REPORT_STATUSES)
  status?: (typeof REPORT_STATUSES)[number];

  @IsOptional()
  @IsString()
  businessId?: string;
}

export class UpdateReportDto {
  @IsIn(['DISMISSED', 'ACTIONED'])
  status: 'DISMISSED' | 'ACTIONED';
}
