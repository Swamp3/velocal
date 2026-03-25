import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserFavorite } from './entities/user-favorite.entity';
import { UserDisciplinePref } from './entities/user-discipline-pref.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserFavorite, UserDisciplinePref])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
