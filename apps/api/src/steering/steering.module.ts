import {Module} from '@nestjs/common';
import {SteeringController} from './steering.controller';
import {SteeringService} from './steering.service';
@Module({controllers:[SteeringController],providers:[SteeringService],exports:[SteeringService]})
export class SteeringModule{}
