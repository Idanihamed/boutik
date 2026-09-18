import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const REPORT_REASONS = ['SCAM', 'INAPPROPRIATE_CONTENT', 'FAKE_PRODUCTS', 'IMPERSONATION', 'OTHER'] as const;

export class ReportBusinessDto {
  @IsIn(REPORT_REASONS)
  reason: (typeof REPORT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
