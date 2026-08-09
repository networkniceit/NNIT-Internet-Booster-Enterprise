import {Module} from '@nestjs/common';
import {TrafficModule} from '../traffic/traffic.module';
import {QosController} from './qos.controller';
import {QosProfilesController} from './qos-profiles.controller';
import {QosProfilesService} from './qos-profiles.service';
import {QosService} from './qos.service';
@Module({imports:[TrafficModule],controllers:[QosController,QosProfilesController],providers:[QosService,QosProfilesService],exports:[QosService]})
export class QosModule{}
