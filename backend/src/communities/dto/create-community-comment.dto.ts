import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommunityCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  body: string;
}
