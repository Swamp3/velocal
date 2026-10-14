import { IsEmail } from 'class-validator';

export class InviteEventDto {
  @IsEmail()
  email: string;
}
