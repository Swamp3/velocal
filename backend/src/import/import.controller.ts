import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ImportService } from './import.service';
import { ImportRun } from './entities/import-run.entity';
import { TriggerImportDto } from './dto/trigger-import.dto';

interface ImportJobResponse {
  id: string;
  source: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  result: { created: number; updated: number; skipped: number } | null;
  error: string | null;
}

function toJobResponse(run: ImportRun): ImportJobResponse {
  const hasResult = run.status !== 'running';
  return {
    id: run.id,
    source: run.source,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    result: hasResult
      ? {
          created: run.eventsCreated,
          updated: run.eventsUpdated,
          skipped: run.eventsSkipped,
        }
      : null,
    error: run.errorLog,
  };
}

@Controller('import')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async trigger(@Body() dto: TriggerImportDto): Promise<ImportJobResponse> {
    const run = await this.importService.startImport(dto.source);
    return toJobResponse(run);
  }

  @Get('jobs')
  async getJobs(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<ImportJobResponse[]> {
    const runs = await this.importService.getJobs(limit, offset);
    return runs.map(toJobResponse);
  }

  @Get('jobs/:id')
  async getJob(@Param('id') id: string): Promise<ImportJobResponse> {
    const run = await this.importService.getJob(id);
    if (!run) {
      throw new NotFoundException(`Import job ${id} not found`);
    }
    return toJobResponse(run);
  }

  @Get('sources')
  getSources(): string[] {
    return this.importService.getSourceNames();
  }
}
