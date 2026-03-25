import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImportService } from './import.service';
import { TriggerImportDto } from './dto/trigger-import.dto';
import type { ImportResult } from './interfaces/import-source.interface';

@Controller('import')
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('trigger')
  trigger(@Body() dto: TriggerImportDto): Promise<ImportResult> {
    return this.importService.runImport(dto.source);
  }

  @Get('sources')
  getSources(): string[] {
    return this.importService.getSourceNames();
  }
}
