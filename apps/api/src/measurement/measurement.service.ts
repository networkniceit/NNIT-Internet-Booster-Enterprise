import { Injectable,OnModuleDestroy,OnModuleInit } from '@nestjs/common';
import { execFile } from 'node:child_process';
import dns from 'node:dns/promises';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import { promisify } from 'node:util';
import { RelayClientService } from '../relay-client/relay-client.service';
import { UnifiedMeasurement } from './measurement.types';
const execFileAsync=promisify(execFile);

@Injectable()
export class MeasurementService implements OnModuleInit,OnModuleDestroy{
 private timer:NodeJS.Timeout|null=null;
 private latest:UnifiedMeasurement={timestamp:new Date().toISOString(),online:false,gatewayLatencyMs:null,internetTcpLatencyMs:null,dnsLatencyMs:null,relayUdpLatencyMs:null,relayUdpJitterMs:null,relayUdpPacketLoss:null,jitterMs:null,packetLoss:100,score:0,activeAdapter:null,source:'fallback'};
 private history:UnifiedMeasurement[]=[];
 constructor(private readonly relay:RelayClientService){}
 onModuleInit(){void this.refresh();this.timer=setInterval(()=>void this.refresh(),5000);this.timer.unref()}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer)}
 getLatest(){return this.latest}
 getHistory(limit=180){return this.history.slice(-Math.max(1,Math.min(5000,limit)))}
 clearHistory(){this.history=[];return{success:true,message:'Unified measurement history cleared.'}}
 async refresh(){
  const activeAdapter=this.selectActiveAdapter();
  const [gatewayLatencyMs,dnsLatencyMs,relay]=await Promise.all([
   this.gateway(activeAdapter),this.dnsLatency(),this.relay.quickQualityProbe(activeAdapter??'Wi-Fi')
  ]);
  const tcp:number[]=[];
  for(let i=0;i<5;i++){const v=await this.tcpLatency();if(v!==null&&v<=500)tcp.push(v);await new Promise<void>(r=>setTimeout(r,80))}
  const internetTcpLatencyMs=this.median(tcp);
  const tcpJitter=this.jitter(tcp);
  const relayUdpLatencyMs=relay?.averageRoundTripMs??null;
  const relayUdpJitterMs=relay?.jitterMs??null;
  const relayUdpPacketLoss=relay?.packetLoss??null;
  const jitterMs=relayUdpJitterMs??tcpJitter;
  const packetLoss=relayUdpPacketLoss??0;
  const online=internetTcpLatencyMs!==null||dnsLatencyMs!==null||relayUdpLatencyMs!==null;
  this.latest={timestamp:new Date().toISOString(),online,gatewayLatencyMs,internetTcpLatencyMs,dnsLatencyMs,relayUdpLatencyMs,relayUdpJitterMs,relayUdpPacketLoss,jitterMs,packetLoss,score:this.score(online,internetTcpLatencyMs,dnsLatencyMs,relayUdpLatencyMs,jitterMs,packetLoss),activeAdapter,source:relayUdpLatencyMs!==null?'relay-udp':online?'multi-metric':'fallback'};
  this.history.push(this.latest);this.history=this.history.slice(-10000);return this.latest;
 }
 private async gateway(adapter:string|null){
  if(!adapter)return null;
  const safe=adapter.replaceAll("'","''");
  const ps=["$ErrorActionPreference='Stop'",`$c=Get-NetIPConfiguration -InterfaceAlias '${safe}'`,"$g=$c.IPv4DefaultGateway.NextHop|Select-Object -First 1","if(-not $g){exit 2}","$p=[System.Net.NetworkInformation.Ping]::new();$v=@()","try{1..3|%{$r=$p.Send($g,600);if($r.Status -eq 'Success'){$v+=[double]$r.RoundtripTime}}}finally{$p.Dispose()}","if($v.Count -eq 0){exit 3}","[math]::Round(($v|Measure-Object -Average).Average,0)"].join(String.fromCharCode(10));
  try{const r=await execFileAsync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{timeout:5000,windowsHide:true});const n=Number(r.stdout.trim());return Number.isFinite(n)?Math.max(1,Math.round(n)):null}catch{return null}
 }
 private tcpLatency():Promise<number|null>{return new Promise(resolve=>{const start=performance.now(),s=net.createConnection({host:'1.1.1.1',port:443});let done=false;const finish=(v:number|null)=>{if(done)return;done=true;s.destroy();resolve(v)};s.setTimeout(1200);s.once('connect',()=>finish(Math.max(1,Math.round(performance.now()-start))));s.once('timeout',()=>finish(null));s.once('error',()=>finish(null))})}
 private async dnsLatency(){const start=performance.now();try{await Promise.race([dns.resolve4('cloudflare.com'),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),2000))]);return Math.max(1,Math.round(performance.now()-start))}catch{return null}}
 private median(v:number[]){if(!v.length)return null;const s=[...v].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2===0?Math.round((s[m-1]+s[m])/2):s[m]}
 private jitter(v:number[]){if(v.length<2)return null;return this.median(v.slice(1).map((x,i)=>Math.abs(x-v[i])))}
 private score(on:boolean,t:number|null,d:number|null,r:number|null,j:number|null,l:number){if(!on)return 0;let s=100;if(t!==null)s-=Math.min(30,Math.max(0,t-40)*.12);if(d!==null)s-=Math.min(12,Math.max(0,d-50)*.05);if(r!==null)s-=Math.min(20,Math.max(0,r-20)*.2);if(j!==null)s-=Math.min(20,j*.5);s-=Math.min(40,l*4);return Math.max(0,Math.round(s))}
 private selectActiveAdapter(){const n=Object.entries(networkInterfaces()).filter(([,a])=>(a??[]).some(x=>x.family==='IPv4'&&!x.internal)).map(([x])=>x);return n.find(x=>x.toLowerCase().includes('wi-fi'))??n.find(x=>{const v=x.toLowerCase();return!v.includes('vethernet')&&!v.includes('wsl')&&!v.includes('hyper-v')})??n[0]??null}
}
