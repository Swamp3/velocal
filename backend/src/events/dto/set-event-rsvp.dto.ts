import { IsEnum } from 'class-validator';
import { EventRsvpStatus } from '../entities/event-rsvp.entity';

export class SetEventRsvpDto {
  @IsEnum(EventRsvpStatus)
  status: EventRsvpStatus;
}
