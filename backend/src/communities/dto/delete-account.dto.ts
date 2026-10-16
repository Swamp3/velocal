import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  /** Required when the account has a password. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  /** The user must type their own email address. */
  @IsString()
  @MaxLength(320)
  confirmEmail: string;

  /** Also remove posts, comments and polls written by the user. */
  @IsBoolean()
  deleteContent: boolean;
}
