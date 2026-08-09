import { Module } from '@nestjs/common';
import { RelayClientModule } from '../relay-client/relay-client.module';
import { MeasurementController } from './measurement.controller';
import { MeasurementService } from './measurement.service';
@Module({imports:[RelayClientModule],controllers:[MeasurementController],providers:[MeasurementService],exports:[MeasurementService]})
export class MeasurementModule{}
