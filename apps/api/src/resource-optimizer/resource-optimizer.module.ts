import {Module} from '@nestjs/common';
import {ResourceOptimizerController} from './resource-optimizer.controller';
import {ResourceOptimizerService} from './resource-optimizer.service';
@Module({controllers:[ResourceOptimizerController],providers:[ResourceOptimizerService]})
export class ResourceOptimizerModule{}
