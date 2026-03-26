import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdminSeeder } from './admin.seeder';
import { User } from './entities/user.entity';
import { UserFavorite } from './entities/user-favorite.entity';
import { UserDisciplinePref } from './entities/user-discipline-pref.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserFavorite, UserDisciplinePref]),
    EventsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, AdminSeeder],
  exports: [UsersService],
})
export class UsersModule {}
