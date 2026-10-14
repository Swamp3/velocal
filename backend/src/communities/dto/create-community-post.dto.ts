import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommunityPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  body: string;
}
