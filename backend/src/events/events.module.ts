import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { AdminEventsController } from './admin-events.controller';
import { EventsService } from './events.service';
import { GeocodingService } from './geocoding.service';
import { CommunityMember } from '../communities/entities/community-member.entity';
import { Community } from '../communities/entities/community.entity';
import { SubgroupMember } from '../communities/entities/subgroup-member.entity';
import { Subgroup } from '../communities/entities/subgroup.entity';
import { EventComment } from './entities/event-comment.entity';
import { EventRecurrence } from './entities/event-recurrence.entity';
import { EventShare } from './entities/event-share.entity';
import { EventRsvp } from './entities/event-rsvp.entity';
import { Event } from './entities/event.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      EventRsvp,
      EventComment,
      EventShare,
      EventRecurrence,
      Community,
      CommunityMember,
      Subgroup,
      SubgroupMember,
      User,
    ]),
    NotificationsModule,
    UploadsModule,
  ],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService, GeocodingService],
  exports: [EventsService, GeocodingService],
})
export class EventsModule {}
