import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ImportService } from './import.service';
import type { ImportJob } from './import.service';
import { TriggerImportDto } from './dto/trigger-import.dto';

@Controller('import')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  trigger(@Body() dto: TriggerImportDto): ImportJob {
    return this.importService.startImport(dto.source);
  }

  @Get('jobs')
  getJobs(): ImportJob[] {
    return this.importService.getJobs();
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string): ImportJob {
    const job = this.importService.getJob(id);
    if (!job) {
      throw new NotFoundException(`Import job ${id} not found`);
    }
    return job;
  }

  @Get('sources')
  getSources(): string[] {
    return this.importService.getSourceNames();
  }
}
