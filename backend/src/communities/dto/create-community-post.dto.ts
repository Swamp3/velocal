import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommunityPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
