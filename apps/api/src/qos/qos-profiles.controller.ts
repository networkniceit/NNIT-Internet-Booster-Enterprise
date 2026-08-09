import {Controller,Get,Param,Post} from '@nestjs/common';
import {QosProfilesService} from './qos-profiles.service';
@Controller('api/qos/profiles')
export class QosProfilesController{
 constructor(private readonly p:QosProfilesService){}
 @Get()list():unknown{return this.p.getProfiles()}
 @Get(':name/preview')preview(@Param('name')name:string):Promise<unknown>{return this.p.preview(name)}
 @Post(':name/apply')apply(@Param('name')name:string):Promise<unknown>{return this.p.apply(name)}
}
