import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RenameSlugDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug: string;
}

export class SlugReplaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  find: string;

  @IsString()
  @MaxLength(100)
  replace: string;

  @IsIn(['communities', 'subgroups', 'both'])
  target: 'communities' | 'subgroups' | 'both';

  /** False (default) only previews the changes. */
  @IsOptional()
  @IsBoolean()
  apply?: boolean;

  /** With `apply`: only change these communities/subgroups (default: all matches). */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  ids?: string[];
}
