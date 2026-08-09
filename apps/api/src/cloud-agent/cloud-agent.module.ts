import {Module} from '@nestjs/common';
import {MeasurementModule} from '../measurement/measurement.module';
import {CloudAgentController} from './cloud-agent.controller';
import {CloudAgentService} from './cloud-agent.service';
@Module({imports:[MeasurementModule],controllers:[CloudAgentController],providers:[CloudAgentService],exports:[CloudAgentService]})
export class CloudAgentModule{}
