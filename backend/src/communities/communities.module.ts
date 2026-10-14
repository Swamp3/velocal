import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UploadsModule } from '../uploads/uploads.module';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityJoinRequest } from './entities/community-join-request.entity';
import { CommunityMember } from './entities/community-member.entity';
import { Community } from './entities/community.entity';
import { SubgroupJoinRequest } from './entities/subgroup-join-request.entity';
import { SubgroupMember } from './entities/subgroup-member.entity';
import { Subgroup } from './entities/subgroup.entity';
import { SubgroupsController } from './subgroups.controller';
import { SubgroupsService } from './subgroups.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Community,
      CommunityMember,
      CommunityJoinRequest,
      Subgroup,
      SubgroupMember,
      SubgroupJoinRequest,
      User,
    ]),
    UploadsModule,
  ],
  controllers: [CommunitiesController, SubgroupsController],
  providers: [CommunitiesService, SubgroupsService],
  exports: [CommunitiesService, SubgroupsService],
})
export class CommunitiesModule {}
