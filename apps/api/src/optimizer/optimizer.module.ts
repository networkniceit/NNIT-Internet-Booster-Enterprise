import { Module } from '@nestjs/common';
import { MeasurementModule } from '../measurement/measurement.module';
import { OptimizerController } from './optimizer.controller';
import { OptimizerGateway } from './optimizer.gateway';
import { OptimizerService } from './optimizer.service';

@Module({
  imports: [
    MeasurementModule,
  ],
  controllers: [
    OptimizerController,
  ],
  providers: [
    OptimizerService,
    OptimizerGateway,
  ],
  exports: [
    OptimizerService,
  ],
})
export class OptimizerModule {}
