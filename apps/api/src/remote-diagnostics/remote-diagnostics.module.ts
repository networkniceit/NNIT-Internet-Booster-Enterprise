import { Module } from '@nestjs/common';
import { RemoteDiagnosticsController } from './remote-diagnostics.controller';
import { RemoteDiagnosticsService } from './remote-diagnostics.service';

@Module({
  controllers: [
    RemoteDiagnosticsController,
  ],
  providers: [
    RemoteDiagnosticsService,
  ],
  exports: [
    RemoteDiagnosticsService,
  ],
})
export class RemoteDiagnosticsModule {}
