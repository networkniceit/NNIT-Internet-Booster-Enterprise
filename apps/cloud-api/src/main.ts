import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import crypto from 'node:crypto';

const app = express();
app.use(helmet());
app.use(cors({origin:true}));
app.use(express.json({limit:'1mb'}));
app.use(morgan('combined'));

const devices = new Map<string, any>();
const alerts:any[] = [];
const analytics:any[] = [];
const commands:any[] = [];

app.get('/api/health', (_req,res)=>{
  res.json({healthy:true,service:'NNIT Cloud API',version:'0.1.0',timestamp:new Date().toISOString()});
});

app.use('/api',(req,res,next)=>{
  const expected=process.env.NNIT_API_KEY;
  const supplied=req.header('x-nnit-api-key') ?? req.header('authorization')?.replace(/^Bearer\s+/i,'');
  if(!expected) return res.status(503).json({error:'NNIT_API_KEY_not_configured'});
  if(supplied!==expected) return res.status(401).json({error:'unauthorized'});
  next();
});

app.get('/api/summary',(_req,res)=>{
  res.json({
    devices:devices.size,
    onlineDevices:[...devices.values()].filter(x=>x.online).length,
    activeAlerts:alerts.filter(x=>!x.resolved).length,
    analyticsSamples:analytics.length,
    queuedCommands:commands.filter(x=>x.status==='queued').length,
    timestamp:new Date().toISOString()
  });
});

app.get('/api/devices',(_req,res)=>res.json({devices:[...devices.values()]}));

app.post('/api/devices/register',(req,res)=>{
  const b=req.body??{};
  const id=String(b.id??crypto.randomUUID());
  const record={
    id,
    name:String(b.name??'NNIT Device'),
    platform:String(b.platform??'windows'),
    agentVersion:String(b.agentVersion??'unknown'),
    metadata:typeof b.metadata==='object'&&b.metadata?b.metadata:{},
    online:true,
    lastSeenAt:new Date().toISOString()
  };
  devices.set(id,record);
  res.status(201).json(record);
});

app.post('/api/devices/:id/heartbeat',(req,res)=>{
  const d=devices.get(req.params.id);
  if(!d)return res.status(404).json({error:'device_not_found'});
  d.online=true;
  d.lastSeenAt=new Date().toISOString();
  if(req.body?.metadata)d.metadata={...d.metadata,...req.body.metadata};
  devices.set(d.id,d);
  res.json(d);
});

app.post('/api/alerts',(req,res)=>{
  const b=req.body??{};
  if(!b.deviceId||!b.type||!b.message)return res.status(400).json({error:'deviceId_type_message_required'});
  const item={id:crypto.randomUUID(),deviceId:String(b.deviceId),type:String(b.type),severity:String(b.severity??'warning'),message:String(b.message),resolved:false,createdAt:new Date().toISOString()};
  alerts.push(item);
  res.status(201).json(item);
});

app.get('/api/alerts',(req,res)=>{
  const deviceId=req.query.deviceId?String(req.query.deviceId):null;
  res.json({alerts:(deviceId?alerts.filter(x=>x.deviceId===deviceId):alerts).slice(-500).reverse()});
});

app.post('/api/analytics',(req,res)=>{
  const b=req.body??{};
  if(!b.deviceId)return res.status(400).json({error:'deviceId_required'});
  const n=(v:any)=>Number.isFinite(Number(v))?Number(v):null;
  const item={id:crypto.randomUUID(),deviceId:String(b.deviceId),score:n(b.score),latencyMs:n(b.latencyMs),dnsLatencyMs:n(b.dnsLatencyMs),jitterMs:n(b.jitterMs),packetLoss:n(b.packetLoss),createdAt:new Date().toISOString()};
  analytics.push(item);
  if(analytics.length>10000)analytics.splice(0,analytics.length-10000);
  res.status(201).json(item);
});

app.get('/api/analytics',(req,res)=>{
  const deviceId=req.query.deviceId?String(req.query.deviceId):null;
  const limit=Math.max(1,Math.min(2000,Number(req.query.limit??200)));
  const rows=deviceId?analytics.filter(x=>x.deviceId===deviceId):analytics;
  res.json({analytics:rows.slice(-limit)});
});

app.post('/api/commands',(req,res)=>{
  const b=req.body??{};
  if(!b.deviceId||!b.type)return res.status(400).json({error:'deviceId_and_type_required'});
  const now=new Date().toISOString();
  const item={id:crypto.randomUUID(),deviceId:String(b.deviceId),type:String(b.type),payload:typeof b.payload==='object'&&b.payload?b.payload:{},status:'queued',createdAt:now,updatedAt:now};
  commands.push(item);
  res.status(201).json(item);
});

app.get('/api/commands/device/:deviceId',(req,res)=>{
  const rows=commands.filter(x=>x.deviceId===req.params.deviceId&&x.status==='queued');
  for(const x of rows){x.status='delivered';x.updatedAt=new Date().toISOString()}
  res.json({commands:rows});
});

app.post('/api/commands/:id/result',(req,res)=>{
  const item=commands.find(x=>x.id===req.params.id);
  if(!item)return res.status(404).json({error:'command_not_found'});
  item.status=req.body?.success===false?'failed':'completed';
  item.updatedAt=new Date().toISOString();
  res.json(item);
});

const port=Number(process.env.PORT??8080);
app.listen(port,'0.0.0.0',()=>console.log(`NNIT Cloud API listening on ${port}`));
