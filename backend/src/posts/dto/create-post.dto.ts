import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PostStatus } from '../entities/post.entity';

export class CreatePostDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
