import { Module } from '@nestjs/common';
import { MeasurementModule } from '../measurement/measurement.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    MeasurementModule,
  ],
  controllers: [
    AnalyticsController,
  ],
  providers: [
    AnalyticsService,
  ],
  exports: [
    AnalyticsService,
  ],
})
export class AnalyticsModule {}
