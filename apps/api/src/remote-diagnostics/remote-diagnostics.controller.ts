import {
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { RemoteDiagnosticsService } from './remote-diagnostics.service';

@Controller('api/remote-diagnostics')
export class RemoteDiagnosticsController {
  constructor(
    private readonly diagnostics:
      RemoteDiagnosticsService,
  ) {}

  @Get('telemetry')
  telemetry(): Promise<unknown> {
    return this.diagnostics.telemetry();
  }

  @Post('run')
  run(): Promise<unknown> {
    return this.diagnostics.runDiagnostics();
  }

  @Get('summary')
  summary(): Promise<unknown> {
    return this.diagnostics.collectSummary();
  }
}
