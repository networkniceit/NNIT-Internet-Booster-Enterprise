import {Module} from '@nestjs/common';
import {ResourcePressureController} from './resource-pressure.controller';
import {ResourcePressureService} from './resource-pressure.service';
@Module({controllers:[ResourcePressureController],providers:[ResourcePressureService]})
export class ResourcePressureModule{}
