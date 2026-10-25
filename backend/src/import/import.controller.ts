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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ImportCheck, ImportService } from './import.service';
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
  triggeredBy: string | null;
  fileName: string | null;
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
    triggeredBy: run.triggeredBy,
    fileName: run.fileName ?? null,
  };
}

@Controller('import')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async trigger(
    @Body() dto: TriggerImportDto,
    @CurrentUser() user: User,
  ): Promise<ImportJobResponse> {
    const run = await this.importService.startImport(dto.source, user.email);
    return toJobResponse(run);
  }

  /**
   * Checks an import file (the JSON as body) without writing anything and returns what the
   * import would do, with errors and warnings per event.
   */
  @Post('events/check')
  @HttpCode(HttpStatus.OK)
  checkEvents(
    @Body() body: unknown,
    @Query('fileName') fileName?: string,
  ): Promise<ImportCheck> {
    return this.importService.checkFile(body, fileName);
  }

  /**
   * Imports a file of events (the JSON as body). Runs as a job; poll `jobs/:id`. Refused with
   * the check report when the file has errors, or warnings without `acceptWarnings=true`.
   */
  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async importEvents(
    @Body() body: unknown,
    @CurrentUser() user: User,
    @Query('fileName') fileName?: string,
    @Query('acceptWarnings') acceptWarnings?: string,
  ): Promise<ImportJobResponse> {
    const run = await this.importService.startFileImport(
      body,
      { fileName, acceptWarnings: acceptWarnings === 'true' },
      user.email,
    );
    return toJobResponse(run);
  }

  /** One run with its full report (per event: action, changes, problems). */
  @Get('jobs/:id/report')
  async getReport(@Param('id') id: string): Promise<{ report: unknown }> {
    const run = await this.importService.getJob(id);
    if (!run) throw new NotFoundException(`Import job ${id} not found`);
    return { report: run.report ?? null };
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
