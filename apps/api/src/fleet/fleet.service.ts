import {Injectable} from '@nestjs/common';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

@Injectable()
export class FleetService{
 private file=join(process.cwd(),'data','cloud-agent.json');
 private config(){
  if(!existsSync(this.file))throw new Error('Cloud agent settings missing.');
  const v=JSON.parse(readFileSync(this.file,'utf8'));
  const cloudUrl=String(v.cloudUrl??'').replace(/\/+$/,'');
  const apiKey=String(v.apiKey??'');
  if(!cloudUrl||!apiKey)throw new Error('Cloud URL/API key missing.');
  return{cloudUrl,apiKey};
 }
 private async req(path:string,init:RequestInit={}){
  const{cloudUrl,apiKey}=this.config();
  const r=await fetch(cloudUrl+path,{...init,headers:{'content-type':'application/json','x-nnit-api-key':apiKey,...(init.headers??{})},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(`Cloud ${r.status}: ${await r.text()}`);
  const t=await r.text();return t?JSON.parse(t):{};
 }
 summary(){return this.req('/api/summary')}
 devices(){return this.req('/api/devices')}
 analytics(limit=500){return this.req(`/api/analytics?limit=${Math.max(1,Math.min(2000,Number(limit)))}`)}
 alerts(){return this.req('/api/alerts')}
 command(deviceId:string,type:string){
  if(!['ping-agent','send-telemetry'].includes(type))throw new Error(`Unsupported command: ${type}`);
  return this.req('/api/commands',{method:'POST',body:JSON.stringify({deviceId,type,payload:{}})});
 }
}
