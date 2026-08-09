import {Body,Controller,Get,Post} from '@nestjs/common';
import {ResourceOptimizerService} from './resource-optimizer.service';
@Controller('api/resource-optimizer')
export class ResourceOptimizerController{
 constructor(private readonly o:ResourceOptimizerService){}
 @Get('analyze')analyze(){return this.o.analyze()}
 @Post('close')close(@Body()b:any){return this.o.closeProcess(String(b.processName??''))}
}
