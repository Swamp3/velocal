import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MaxLength(200)
  token: string;

  @MinLength(8)
  @MaxLength(72)
  password: string;
}
