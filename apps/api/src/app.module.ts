import { Module } from '@nestjs/common';
import { QosModule } from './qos/qos.module';
import { TrafficModule } from './traffic/traffic.module';
import { AlertsModule } from './alerts/alerts.module';
import { FailoverModule } from './failover/failover.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppController } from './app.controller';
import { BondingModule } from './bonding/bonding.module';
import { MeasurementModule } from './measurement/measurement.module';
import { OptimizerModule } from './optimizer/optimizer.module';
import { RelayClientModule } from './relay-client/relay-client.module';
import { SteeringModule } from './steering/steering.module';

@Module({
  imports: [QosModule, TrafficModule, AlertsModule, FailoverModule, 
    MeasurementModule,
    AnalyticsModule,
    OptimizerModule,
    BondingModule,
    RelayClientModule,
    SteeringModule,
  ],
  controllers: [
    AppController,
  ],
})
export class AppModule {}




