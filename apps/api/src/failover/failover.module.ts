import {Module} from '@nestjs/common';
import {SteeringModule} from '../steering/steering.module';
import {FailoverController} from './failover.controller';
import {FailoverService} from './failover.service';
@Module({imports:[SteeringModule],controllers:[FailoverController],providers:[FailoverService],exports:[FailoverService]})
export class FailoverModule{}
