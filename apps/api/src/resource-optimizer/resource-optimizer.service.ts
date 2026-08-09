import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run=promisify(execFile);

@Injectable()
export class ResourceOptimizerService{
 private readonly allowed=new Set(['Code','chrome','studio64','Docker Desktop','com.docker.backend','CrossDeviceService','msedge','msedgewebview2','PhoneExperienceHost','PAD.Console.Host','PAD.AutomationServer']);

 async analyze(){
  const ps=`$ErrorActionPreference='SilentlyContinue';Get-Process|ForEach-Object{[pscustomobject]@{processName=$_.ProcessName;ramMb=[math]::Round($_.WorkingSet64/1MB,1);cpuSeconds=if($_.CPU-ne$null){[math]::Round($_.CPU,1)}else{0}}}|ConvertTo-Json -Compress`;
  const {stdout}=await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{timeout:12000,windowsHide:true});
  const parsed=JSON.parse(stdout.trim()||'[]');
  const rows=Array.isArray(parsed)?parsed:[parsed];
  const map=new Map<string,any>();
  for(const row of rows){
   const name=String(row.processName??'');
   const x=map.get(name)??{processName:name,processCount:0,ramMb:0,cpuSeconds:0,canClose:this.allowed.has(name)};
   x.processCount++; x.ramMb+=Number(row.ramMb??0); x.cpuSeconds+=Number(row.cpuSeconds??0); map.set(name,x);
  }
  const groups=[...map.values()].map(x=>({...x,ramMb:Number(x.ramMb.toFixed(1)),cpuSeconds:Number(x.cpuSeconds.toFixed(1))})).sort((a,b)=>b.ramMb-a.ramMb);
  const candidates=groups.filter(x=>x.canClose).slice(0,10);
  const mb=Number(candidates.reduce((s,x)=>s+x.ramMb,0).toFixed(1));
  return{topConsumers:groups.slice(0,20),optimizationCandidates:candidates,estimatedRecoverableRamMb:mb,estimatedRecoverableRamGb:Number((mb/1024).toFixed(2)),recommendation:mb>=4096?'High recovery potential':mb>=2048?'Moderate recovery potential':'Low recovery potential',timestamp:new Date().toISOString()};
 }

 async closeProcess(processName:string){
  if(!this.allowed.has(processName))return{success:false,message:`Not on NNIT safe-close whitelist: ${processName}`};
  const escaped=processName.replace(/'/g,"''");
  const ps=`$ErrorActionPreference='Stop';$p=Get-Process -Name '${escaped}' -ErrorAction SilentlyContinue;if(-not$p){[pscustomobject]@{closed=0;message='Process not running.'}|ConvertTo-Json -Compress;exit 0};$c=@($p).Count;$p|Stop-Process -Force;[pscustomobject]@{closed=$c;message='Process group closed.'}|ConvertTo-Json -Compress`;
  try{
   const {stdout}=await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{timeout:15000,windowsHide:true});
   return{success:true,processName,result:JSON.parse(stdout.trim()||'{}'),timestamp:new Date().toISOString()};
  }catch(e){return{success:false,processName,message:e instanceof Error?e.message:String(e),timestamp:new Date().toISOString()}}
 }
}
