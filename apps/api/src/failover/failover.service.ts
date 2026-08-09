import {Injectable,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {SteeringService} from '../steering/steering.service';
import {FailoverEvent,FailoverSettings} from './failover.types';

@Injectable()
export class FailoverService implements OnModuleInit,OnModuleDestroy{
 private timer:NodeJS.Timeout|null=null;
 private settings:FailoverSettings={enabled:false,minimumImprovement:8,holdCycles:3,cooldownSeconds:30,emergencyPacketLoss:100};
 private events:FailoverEvent[]=[];
 private currentAdapter:string|null=null;
 private pendingAdapter:string|null=null;
 private pendingCycles=0;
 private lastSwitchAt=0;
 private lastDecision='Automatic failover is disabled.';
 private running=false;
 constructor(private readonly steering:SteeringService){}
 onModuleInit(){this.timer=setInterval(()=>void this.evaluate(),5000);this.timer.unref()}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer)}
 getStatus(){return{settings:this.settings,currentAdapter:this.currentAdapter,pendingAdapter:this.pendingAdapter,pendingCycles:this.pendingCycles,cooldownRemainingSeconds:this.cooldown(),lastDecision:this.lastDecision,events:this.events.slice(-30).reverse(),timestamp:new Date().toISOString()}}
 updateSettings(v:Partial<FailoverSettings>){this.settings={...this.settings,...v,minimumImprovement:Math.max(0,Math.min(100,Number(v.minimumImprovement??this.settings.minimumImprovement))),holdCycles:Math.max(1,Math.min(20,Number(v.holdCycles??this.settings.holdCycles))),cooldownSeconds:Math.max(0,Math.min(3600,Number(v.cooldownSeconds??this.settings.cooldownSeconds))),emergencyPacketLoss:Math.max(1,Math.min(100,Number(v.emergencyPacketLoss??this.settings.emergencyPacketLoss)))};this.lastDecision=this.settings.enabled?'Automatic failover enabled.':'Automatic failover disabled.';return this.settings}
 clearHistory(){this.events=[];return{success:true}}
 async evaluate(){
  if(!this.settings.enabled||this.running)return this.getStatus();
  this.running=true;
  try{
   const s=await this.steering.getStatus();
   const links=(s.links??[]).filter((x:any)=>x.eligible).sort((a:any,b:any)=>b.score-a.score);
   if(!links.length){this.lastDecision='No eligible physical interface is available.';return this.getStatus()}
   const best=links[0];
   const active=links.find((x:any)=>x.name===this.currentAdapter)??links.find((x:any)=>x.name===(s.selectedAdapter))??best;
   if(!this.currentAdapter)this.currentAdapter=active.name;
   const emergency=active.packetLoss>=this.settings.emergencyPacketLoss||active.score<=0;
   if(emergency&&best.name!==active.name){await this.switchTo(active,best,'Emergency failover: active interface is unavailable.');return this.getStatus()}
   const improvement=best.score-active.score;
   if(best.name===active.name||improvement<this.settings.minimumImprovement){this.resetPending();this.lastDecision=best.name===active.name?`${active.name} remains the best interface.`:`No switch: improvement is ${improvement} points, below threshold.`;return this.getStatus()}
   if(this.cooldown()>0){this.lastDecision=`No switch: cooldown has ${this.cooldown()} seconds remaining.`;return this.getStatus()}
   if(this.pendingAdapter!==best.name){this.pendingAdapter=best.name;this.pendingCycles=1}else this.pendingCycles+=1;
   if(this.pendingCycles<this.settings.holdCycles){this.lastDecision=`${best.name} is better by ${improvement} points. Waiting ${this.pendingCycles}/${this.settings.holdCycles} cycles.`;return this.getStatus()}
   await this.switchTo(active,best,`${best.name} remained better by ${improvement} points for ${this.settings.holdCycles} cycles.`);
   return this.getStatus();
  }finally{this.running=false}
 }
 private async switchTo(previous:any,next:any,reason:string){const r=await this.steering.applyPreferredAdapter(next.name);if(!r.applied){this.lastDecision=r.message;return}this.events.push({timestamp:new Date().toISOString(),previousAdapter:previous?.name??null,newAdapter:next.name,reason,previousScore:previous?.score??null,newScore:next.score});this.events=this.events.slice(-500);this.currentAdapter=next.name;this.lastSwitchAt=Date.now();this.lastDecision=`Switched from ${previous.name} to ${next.name}. ${reason}`;this.resetPending()}
 private resetPending(){this.pendingAdapter=null;this.pendingCycles=0}
 private cooldown(){if(!this.lastSwitchAt)return 0;return Math.max(0,Math.ceil(this.settings.cooldownSeconds-(Date.now()-this.lastSwitchAt)/1000))}
}

