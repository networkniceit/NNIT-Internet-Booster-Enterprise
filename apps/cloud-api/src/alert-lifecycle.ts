import type { Express, Request, Response } from 'express';

type Status='open'|'acknowledged'|'resolved'|'closed';
type Alert={id:string;deviceId:string;type:string;severity:string;message:string;status:Status;createdAt:string;updatedAt:string;acknowledgedAt?:string;resolvedAt?:string;metadata?:Record<string,unknown>};

const alerts=new Map<string,Alert>();
const keyFor=(deviceId:string,type:string)=>`${deviceId}::${type}`;

export function installAlertLifecycleRoutes(app:Express){
 app.post('/api/alerts',(req:Request,res:Response)=>{
  const deviceId=String(req.body?.deviceId??'');
  const type=String(req.body?.type??'generic');
  const severity=String(req.body?.severity??'warning');
  const message=String(req.body?.message??'');
  const metadata=req.body?.metadata??{};
  if(!deviceId)return res.status(400).json({message:'deviceId required'});

  const key=keyFor(deviceId,type);
  const now=new Date().toISOString();
  const existing=alerts.get(key);

  if(existing && !['resolved','closed'].includes(existing.status)){
   existing.severity=severity;
   existing.message=message;
   existing.metadata=metadata;
   existing.updatedAt=now;
   alerts.set(key,existing);
   return res.json(existing);
  }

  const alert:Alert={id:crypto.randomUUID(),deviceId,type,severity,message,metadata,status:'open',createdAt:now,updatedAt:now};
  alerts.set(key,alert);
  return res.status(201).json(alert);
 });

 app.get('/api/alerts',(_req:Request,res:Response)=>{
  res.json({alerts:[...alerts.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});
 });

 app.post('/api/alerts/:id/acknowledge',(req:Request,res:Response)=>{
  const row=[...alerts.values()].find(a=>a.id===req.params.id);
  if(!row)return res.status(404).json({message:'Alert not found'});
  row.status='acknowledged';
  row.acknowledgedAt=new Date().toISOString();
  row.updatedAt=row.acknowledgedAt;
  return res.json(row);
 });

 app.post('/api/alerts/:id/resolve',(req:Request,res:Response)=>{
  const found=[...alerts.entries()].find(([,a])=>a.id===req.params.id);
  if(!found)return res.status(404).json({message:'Alert not found'});
  const [key,row]=found;
  row.status='resolved';
  row.resolvedAt=new Date().toISOString();
  row.updatedAt=row.resolvedAt;
  alerts.set(key,row);
  return res.json(row);
 });
}
