import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadsModule } from '../uploads/uploads.module';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityJoinRequest } from './entities/community-join-request.entity';
import { CommunityMember } from './entities/community-member.entity';
import { Community } from './entities/community.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Community,
      CommunityMember,
      CommunityJoinRequest,
    ]),
    UploadsModule,
  ],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
