import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommunityCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}
