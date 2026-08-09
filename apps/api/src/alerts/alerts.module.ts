import { Module } from '@nestjs/common';
import { MeasurementModule } from '../measurement/measurement.module';
import { RelayClientModule } from '../relay-client/relay-client.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
 imports:[MeasurementModule,RelayClientModule],
 controllers:[AlertsController],
 providers:[AlertsService],
 exports:[AlertsService]
})
export class AlertsModule{}
