import {Injectable,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import os from 'node:os';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {MeasurementService} from '../measurement/measurement.service';

@Injectable()
export class CloudAgentService implements OnModuleInit,OnModuleDestroy{
 private file=join(process.cwd(),'data','cloud-agent.json');
 private timers:NodeJS.Timeout[]=[];
 private settings:any={enabled:false,cloudUrl:'https://nnit-internet-booster-enterprise-production.up.railway.app',apiKey:'',deviceId:null,deviceName:os.hostname(),heartbeatSeconds:30,telemetrySeconds:30};
 private status:any={cloudReachable:false,lastHeartbeatAt:null,lastTelemetryAt:null,lastCommandPollAt:null,lastError:null};
 constructor(private readonly measurement:MeasurementService){}
 async onModuleInit(){this.load();if(this.settings.enabled){try{await this.start()}catch{}}}
 onModuleDestroy(){this.stop()}
 getSettings(){return{...this.settings,apiKey:this.settings.apiKey?'********':''}}
 getStatus(){return{...this.status,enabled:this.settings.enabled,registered:Boolean(this.settings.deviceId),cloudUrl:this.settings.cloudUrl,deviceId:this.settings.deviceId,deviceName:this.settings.deviceName}}
 async updateSettings(v:any){
  if(v.enabled!==undefined)this.settings.enabled=Boolean(v.enabled);
  if(v.cloudUrl!==undefined)this.settings.cloudUrl=String(v.cloudUrl).replace(/\/+$/,'');
  if(v.apiKey&&v.apiKey!=='********')this.settings.apiKey=String(v.apiKey);
  if(v.deviceName!==undefined)this.settings.deviceName=String(v.deviceName)||os.hostname();
  if(v.heartbeatSeconds!==undefined)this.settings.heartbeatSeconds=Math.max(15,Number(v.heartbeatSeconds));
  if(v.telemetrySeconds!==undefined)this.settings.telemetrySeconds=Math.max(15,Number(v.telemetrySeconds));
  this.save(); if(this.settings.enabled)await this.start(); else this.stop(); return this.getSettings()
 }
 async start(){this.stop();if(!this.settings.apiKey){this.status.lastError='NNIT Cloud API key is required.';return this.getStatus()}
  await this.register();await this.heartbeat();await this.telemetry();await this.poll();
  this.timers.push(setInterval(()=>{void this.heartbeat().catch(()=>undefined)},this.settings.heartbeatSeconds*1000));
  this.timers.push(setInterval(()=>{void this.telemetry().catch(()=>undefined)},this.settings.telemetrySeconds*1000));
  this.timers.push(setInterval(()=>{void this.poll().catch(()=>undefined)},15000));
  this.timers.forEach(t=>t.unref());return this.getStatus()
 }
 async register(){
  const r=await this.req('/api/devices/register',{method:'POST',body:JSON.stringify({id:this.settings.deviceId??undefined,name:this.settings.deviceName,platform:'windows',agentVersion:'2.1.0',metadata:{hostname:os.hostname(),release:os.release(),arch:os.arch()}})});
  this.settings.deviceId=String(r.id);this.save();return this.getStatus()
 }
 async heartbeat(){
  if(!this.settings.deviceId)await this.register();
  const m:any=this.measurement.getLatest();
  await this.req(`/api/devices/${this.settings.deviceId}/heartbeat`,{method:'POST',body:JSON.stringify({agentVersion:'2.1.0',metadata:{score:m?.score??m?.unifiedScore??null,latencyMs:m?.internetTcpLatencyMs??m?.latencyMs??null,dnsLatencyMs:m?.dnsLatencyMs??null,packetLoss:m?.packetLoss??null}})});
  this.status.lastHeartbeatAt=new Date().toISOString();return this.getStatus()
 }
 async telemetry(){
  if(!this.settings.deviceId)await this.register();
  const m:any=this.measurement.getLatest();
  await this.req('/api/analytics',{method:'POST',body:JSON.stringify({deviceId:this.settings.deviceId,score:m?.score??m?.unifiedScore??null,latencyMs:m?.internetTcpLatencyMs??m?.latencyMs??null,dnsLatencyMs:m?.dnsLatencyMs??null,jitterMs:m?.jitterMs??m?.relayJitterMs??null,packetLoss:m?.packetLoss??m?.relayPacketLoss??null})});
  this.status.lastTelemetryAt=new Date().toISOString();return this.getStatus()
 }
 async poll(){
  if(!this.settings.deviceId)return this.getStatus();
  const r=await this.req(`/api/commands/device/${this.settings.deviceId}`,{method:'GET'});
  for(const c of Array.isArray(r.commands)?r.commands:[]){
   let result:any={success:false,error:`Unsupported command: ${c.type}`};
   if(c.type==='ping-agent')result={success:true,result:{hostname:os.hostname(),timestamp:new Date().toISOString()}};
   if(c.type==='send-telemetry'){await this.telemetry();result={success:true,result:{message:'Telemetry sent.'}}}
   if(c.type==='run-diagnostics'){result={success:true,result:{message:'Diagnostics requested locally. Use /api/remote-diagnostics/summary for the latest result.'}}}
   await this.req(`/api/commands/${c.id}/result`,{method:'POST',body:JSON.stringify(result)});
  }
  this.status.lastCommandPollAt=new Date().toISOString();return this.getStatus()
 }
 private async req(path:string,init:RequestInit){
  try{
   const r=await fetch(this.settings.cloudUrl+path,{...init,headers:{'content-type':'application/json','x-nnit-api-key':this.settings.apiKey,...(init.headers??{})},signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw new Error(`Cloud ${r.status}: ${await r.text()}`);
   this.status.cloudReachable=true;this.status.lastError=null;const t=await r.text();return t?JSON.parse(t):{}
  }catch(e){this.status.cloudReachable=false;this.status.lastError=e instanceof Error?e.message:String(e);throw e}
 }
 private stop(){this.timers.forEach(clearInterval);this.timers=[]}
 private load(){try{if(existsSync(this.file))this.settings={...this.settings,...JSON.parse(readFileSync(this.file,'utf8'))}}catch{}}
 private save(){mkdirSync(dirname(this.file),{recursive:true});writeFileSync(this.file,JSON.stringify(this.settings,null,2),'utf8')}
}


