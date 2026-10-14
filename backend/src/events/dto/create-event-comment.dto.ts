import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateEventCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  body: string;
}
