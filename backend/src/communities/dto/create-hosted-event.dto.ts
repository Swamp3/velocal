import { IsEnum, IsOptional } from 'class-validator';
import { EventListing } from '../../events/entities/event.entity';
import { CreateEventDto } from '../../events/dto/create-event.dto';

export class CreateHostedEventDto extends CreateEventDto {
  @IsOptional()
  @IsEnum(EventListing)
  listing?: EventListing;
}
