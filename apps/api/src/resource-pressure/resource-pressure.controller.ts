import {Controller,Get} from '@nestjs/common';
import {ResourcePressureService} from './resource-pressure.service';
@Controller('api/resource-pressure')
export class ResourcePressureController{
 constructor(private readonly p:ResourcePressureService){}
 @Get('status')status(){return this.p.status()}
}
