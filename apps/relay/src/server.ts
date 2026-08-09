import crypto from 'node:crypto';
import dgram from 'node:dgram';
import express from 'express';
import cors from 'cors';

interface RelaySession { id:string; token:string; clientName:string; createdAt:string; lastSeenAt:string; links:string[] }
const HTTP_PORT=Number(process.env.RELAY_HTTP_PORT ?? 4500);
const UDP_PORT=Number(process.env.RELAY_UDP_PORT ?? 4501);
const SECRET=process.env.RELAY_SECRET ?? 'change-this-before-public-deployment';
const sessions=new Map<string,RelaySession>();
const app=express(); app.use(cors()); app.use(express.json({limit:'256kb'}));
const sign=(v:string)=>crypto.createHmac('sha256',SECRET).update(v).digest('hex');
const tokenFor=(id:string)=>`${id}.${sign(id)}`;
function verify(token?:string){ if(!token) return null; const [id,sig]=token.split('.'); if(!id||!sig) return null; const exp=sign(id); if(sig.length!==exp.length) return null; return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(exp)) ? sessions.get(id) ?? null : null; }
app.get('/',(_q,r)=>r.json({name:'NNIT Relay Service',version:'0.1.0',status:'online',httpPort:HTTP_PORT,udpPort:UDP_PORT,activeSessions:sessions.size,capability:'control-plane and UDP path diagnostics',note:'Full packet bonding tunnel is not enabled in this release.'}));
app.get('/health',(_q,r)=>r.json({healthy:true,activeSessions:sessions.size,timestamp:new Date().toISOString()}));
app.post('/sessions',(q,r)=>{ const clientName=String(q.body?.clientName??'').trim(); if(!clientName) return r.status(400).json({error:'clientName is required.'}); const id=crypto.randomUUID(); const now=new Date().toISOString(); const s={id,token:tokenFor(id),clientName,createdAt:now,lastSeenAt:now,links:[]}; sessions.set(id,s); return r.status(201).json({sessionId:id,token:s.token,udpHost:q.hostname,udpPort:UDP_PORT,createdAt:now}); });
app.post('/sessions/heartbeat',(q,r)=>{ const token=q.headers.authorization?.replace(/^Bearer\s+/i,'') ?? String(q.body?.token??''); const s=verify(token); if(!s) return r.status(401).json({error:'Invalid relay session token.'}); s.lastSeenAt=new Date().toISOString(); s.links=Array.isArray(q.body?.links)?q.body.links.map(String).slice(0,8):s.links; return r.json({ok:true,sessionId:s.id,activeLinks:s.links,timestamp:s.lastSeenAt}); });
app.get('/sessions/:id',(q,r)=>{ const s=sessions.get(q.params.id); return s ? r.json({id:s.id,clientName:s.clientName,createdAt:s.createdAt,lastSeenAt:s.lastSeenAt,links:s.links}) : r.status(404).json({error:'Session not found.'}); });
const udp=dgram.createSocket('udp4');
udp.on('message',(m,remote)=>{ try { const p=JSON.parse(m.toString('utf8')) as {token?:string;sequence?:number;sentAt?:number;linkName?:string}; const s=verify(p.token); const out=Buffer.from(JSON.stringify({ok:Boolean(s),sequence:p.sequence??null,linkName:p.linkName??null,sentAt:p.sentAt??null,relayReceivedAt:Date.now(),relaySentAt:Date.now()})); udp.send(out,remote.port,remote.address); } catch { udp.send(Buffer.from(JSON.stringify({ok:false,error:'Invalid UDP payload.'})),remote.port,remote.address); } });
udp.bind(UDP_PORT,'0.0.0.0',()=>console.log(`NNIT Relay UDP diagnostics listening on 0.0.0.0:${UDP_PORT}`));
app.listen(HTTP_PORT,'0.0.0.0',()=>console.log(`NNIT Relay HTTP service running at http://localhost:${HTTP_PORT}`));
