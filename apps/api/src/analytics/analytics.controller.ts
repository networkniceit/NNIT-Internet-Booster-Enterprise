import {
  Controller,
  Delete,
  Get,
  Header,
  Query,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics:
      AnalyticsService,
  ) {}

  @Get('history')
  getHistory(
    @Query('limit') limit?: string,
  ) {
    return this.analytics.getHistory(
      Number(limit ?? 180),
    );
  }

  @Get('summary')
  getSummary() {
    return this.analytics.getSummary();
  }

  @Get('audit')
  getAudit() {
    return this.analytics.getAudit();
  }

  @Get('export')
  @Header(
    'Content-Type',
    'application/json; charset=utf-8',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="nnit-diagnostics.json"',
  )
  exportDiagnostics() {
    return this.analytics.exportDiagnostics();
  }

  @Delete('history')
  clearHistory() {
    return this.analytics.clearHistory();
  }
}
