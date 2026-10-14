import { Module } from '@nestjs/common';
import { ImageAccessService } from './image-access.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, ImageAccessService],
  exports: [UploadsService, ImageAccessService],
})
export class UploadsModule {}
