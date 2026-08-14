import type { Express, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { getPool, initGlobalSchema } from './global-db';

const ORG_ID =
  process.env.NNIT_DEFAULT_ORG_ID ??
  '11111111-1111-4111-8111-111111111111';

function auth(req:Request,res:Response,next:NextFunction){
  const configured=String(process.env.NNIT_API_KEY??'');
  const supplied=String(req.header('x-nnit-api-key')??'');
  if(!configured||configured!==supplied){
    return res.status(401).json({message:'Unauthorized'});
  }
  next();
}

async function ensureOrg(){
  const db=getPool();
  if(!db)throw new Error('DATABASE_URL not configured');
  await db.query(
    `INSERT INTO nnit_organizations(id,name,slug)
     VALUES($1,$2,$3)
     ON CONFLICT(id) DO NOTHING`,
    [
      ORG_ID,
      process.env.NNIT_DEFAULT_ORG_NAME??'NNIT Enterprise',
      process.env.NNIT_DEFAULT_ORG_SLUG??'nnit-enterprise',
    ],
  );
  return ORG_ID;
}

function n(v:unknown){
  const x=Number(v);
  return Number.isFinite(x)?x:null;
}

export function installGlobalPersistenceRoutes(app:Express){
  void initGlobalSchema().then(()=>ensureOrg()).catch(()=>undefined);

  app.get('/api/v3/persistence/health',async(_req,res)=>{
    try{
      const ok=await initGlobalSchema();
      if(!ok)return res.status(503).json({configured:false,connected:false,message:'DATABASE_URL not configured'});
      const db=getPool()!;
      await db.query('SELECT 1');
      return res.json({configured:true,connected:true,service:'NNIT Global Persistence',version:'3.0.0-phase1'});
    }catch(e){
      return res.status(503).json({configured:true,connected:false,message:e instanceof Error?e.message:String(e)});
    }
  });

  app.use('/api/v3',auth);

  app.post('/api/v3/devices/register',async(req,res)=>{
    try{
      await initGlobalSchema();
      const org=await ensureOrg();
      const id=String(req.body?.deviceId??'')||crypto.randomUUID();
      const db=getPool()!;
      const r=await db.query(
        `INSERT INTO nnit_devices(id,organization_id,name,platform,agent_version,country,city,metadata,last_seen_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW(),NOW())
         ON CONFLICT(id) DO UPDATE SET
           name=EXCLUDED.name,
           platform=EXCLUDED.platform,
           agent_version=EXCLUDED.agent_version,
           country=EXCLUDED.country,
           city=EXCLUDED.city,
           metadata=EXCLUDED.metadata,
           last_seen_at=NOW(),
           updated_at=NOW()
         RETURNING id,organization_id AS "organizationId",name,platform,agent_version AS "agentVersion",country,city,last_seen_at AS "lastSeenAt"`,
        [
          id,org,
          String(req.body?.name??'unnamed-device'),
          String(req.body?.platform??'unknown'),
          req.body?.agentVersion?String(req.body.agentVersion):null,
          req.body?.country?String(req.body.country):null,
          req.body?.city?String(req.body.city):null,
          JSON.stringify(req.body?.metadata??{}),
        ],
      );
      res.status(201).json({device:r.rows[0]});
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });

  app.post('/api/v3/devices/:id/heartbeat',async(req,res)=>{
    try{
      await initGlobalSchema();
      const db=getPool()!;
      const r=await db.query(
        `UPDATE nnit_devices
         SET last_seen_at=NOW(),updated_at=NOW()
         WHERE id=$1
         RETURNING id,name,last_seen_at AS "lastSeenAt"`,
        [String(req.params.id)],
      );
      if(!r.rowCount)return res.status(404).json({message:'Device not registered'});
      res.json({success:true,device:r.rows[0]});
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });

  app.post('/api/v3/devices/:id/telemetry',async(req,res)=>{
    try{
      await initGlobalSchema();
      const db=getPool()!;
      const d=await db.query(`SELECT organization_id FROM nnit_devices WHERE id=$1`,[String(req.params.id)]);
      if(!d.rowCount)return res.status(404).json({message:'Device not registered'});
      const b=req.body??{};
      await db.query(
        `INSERT INTO nnit_telemetry(
          organization_id,device_id,score,latency_ms,dns_ms,jitter_ms,packet_loss,
          cpu_percent,memory_percent,free_memory_gb,disk_free_gb,download_mbps,upload_mbps,payload
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
        [
          d.rows[0].organization_id,String(req.params.id),
          n(b.score),n(b.latencyMs??b.latency),n(b.dnsMs??b.dns),n(b.jitterMs??b.jitter),
          n(b.packetLoss??b.loss),n(b.cpuPercent??b.cpu),n(b.memoryPercent??b.memory),
          n(b.freeMemoryGb),n(b.diskFreeGb),n(b.downloadMbps),n(b.uploadMbps),JSON.stringify(b),
        ],
      );
      await db.query(`UPDATE nnit_devices SET last_seen_at=NOW(),updated_at=NOW() WHERE id=$1`,[String(req.params.id)]);
      res.status(201).json({success:true,timestamp:new Date().toISOString()});
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });

  app.post('/api/v3/devices/:id/incidents',async(req,res)=>{
    try{
      await initGlobalSchema();
      const db=getPool()!;
      const id=String(req.params.id);
      const d=await db.query(`SELECT organization_id FROM nnit_devices WHERE id=$1`,[id]);
      if(!d.rowCount)return res.status(404).json({message:'Device not registered'});
      const type=String(req.body?.type??'generic');
      const key=String(req.body?.incidentKey??`${id}::${type}`);
      const r=await db.query(
        `INSERT INTO nnit_incidents(id,organization_id,device_id,incident_key,type,severity,status,message,metadata)
         VALUES($1,$2,$3,$4,$5,$6,'open',$7,$8::jsonb)
         ON CONFLICT(device_id,incident_key) DO UPDATE SET
           severity=EXCLUDED.severity,
           message=EXCLUDED.message,
           metadata=EXCLUDED.metadata,
           status=CASE WHEN nnit_incidents.status IN ('resolved','closed') THEN 'open' ELSE nnit_incidents.status END,
           opened_at=CASE WHEN nnit_incidents.status IN ('resolved','closed') THEN NOW() ELSE nnit_incidents.opened_at END,
           resolved_at=NULL,
           updated_at=NOW()
         RETURNING id,incident_key AS "incidentKey",type,severity,status,message,opened_at AS "openedAt",updated_at AS "updatedAt"`,
        [
          crypto.randomUUID(),d.rows[0].organization_id,id,key,type,
          String(req.body?.severity??'warning'),String(req.body?.message??''),
          JSON.stringify(req.body?.metadata??{}),
        ],
      );
      res.status(201).json({incident:r.rows[0]});
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });

  app.post('/api/v3/incidents/:id/acknowledge',async(req,res)=>{
    try{
      const db=getPool()!;
      const r=await db.query(
        `UPDATE nnit_incidents
         SET status='acknowledged',acknowledged_at=NOW(),updated_at=NOW()
         WHERE id=$1
         RETURNING id,status,acknowledged_at AS "acknowledgedAt",updated_at AS "updatedAt"`,
        [String(req.params.id)],
      );
      if(!r.rowCount)return res.status(404).json({message:'Incident not found'});
      res.json({incident:r.rows[0]});
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });

  app.post('/api/v3/incidents/:id/resolve',async(req,res)=>{
    try{
      const db=getPool()!;
      const r=await db.query(
        `UPDATE nnit_incidents
         SET status='resolved',resolved_at=NOW(),updated_at=NOW()
         WHERE id=$1
         RETURNING id,status,resolved_at AS "resolvedAt",updated_at AS "updatedAt"`,
        [String(req.params.id)],
      );
      if(!r.rowCount)return res.status(404).json({message:'Incident not found'});
      res.json({incident:r.rows[0]});
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });

  app.get('/api/v3/dashboard',async(_req,res)=>{
    try{
      await initGlobalSchema();
      const org=await ensureOrg();
      const db=getPool()!;
      const ds=await db.query(
        `SELECT COUNT(*)::int total,
                COUNT(*) FILTER(WHERE last_seen_at>=NOW()-INTERVAL '90 seconds')::int online
         FROM nnit_devices WHERE organization_id=$1`,
        [org],
      );
      const ins=await db.query(
        `SELECT COUNT(*) FILTER(WHERE status NOT IN ('resolved','closed'))::int active,
                COUNT(*) FILTER(WHERE status NOT IN ('resolved','closed') AND severity='critical')::int critical
         FROM nnit_incidents WHERE organization_id=$1`,
        [org],
      );
      const fleet=await db.query(
        `SELECT id,name,platform,agent_version AS "agentVersion",country,city,
                (last_seen_at>=NOW()-INTERVAL '90 seconds') AS online,
                last_seen_at AS "lastSeenAt"
         FROM nnit_devices
         WHERE organization_id=$1
         ORDER BY last_seen_at DESC NULLS LAST
         LIMIT 200`,
        [org],
      );
      const total=ds.rows[0]?.total??0;
      const online=ds.rows[0]?.online??0;
      res.json({
        organizationId:org,
        devices:{total,online,offline:total-online},
        incidents:{active:ins.rows[0]?.active??0,critical:ins.rows[0]?.critical??0},
        fleet:fleet.rows,
        timestamp:new Date().toISOString(),
      });
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });

  app.get('/api/v3/devices/:id/history',async(req,res)=>{
    try{
      const hours=Math.max(1,Math.min(720,Number(req.query.hours??24)));
      const db=getPool()!;
      const r=await db.query(
        `SELECT score,latency_ms AS "latencyMs",dns_ms AS "dnsMs",jitter_ms AS "jitterMs",
                packet_loss AS "packetLoss",cpu_percent AS "cpuPercent",memory_percent AS "memoryPercent",
                free_memory_gb AS "freeMemoryGb",disk_free_gb AS "diskFreeGb",
                download_mbps AS "downloadMbps",upload_mbps AS "uploadMbps",created_at AS "createdAt"
         FROM nnit_telemetry
         WHERE device_id=$1 AND created_at>=NOW()-($2::text||' hours')::interval
         ORDER BY created_at ASC
         LIMIT 10000`,
        [String(req.params.id),String(hours)],
      );
      res.json({deviceId:String(req.params.id),hours,samples:r.rows});
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });
  app.post('/api/v3/commands',async(req,res)=>{
    try{
      await initGlobalSchema();
      const db=getPool()!;
      const deviceId=String(req.body?.deviceId??'');
      const type=String(req.body?.type??'');
      const allowed=['ping-agent','send-telemetry','run-diagnostics','flush-dns','renew-ip'];

      if(!deviceId)return res.status(400).json({message:'deviceId required'});
      if(!allowed.includes(type))return res.status(400).json({message:`Unsupported command: ${type}`});

      const device=await db.query(
        `SELECT organization_id FROM nnit_devices WHERE id=$1`,
        [deviceId],
      );

      if(!device.rowCount)return res.status(404).json({message:'Device not registered'});

      const id=crypto.randomUUID();

      const result=await db.query(
        `INSERT INTO nnit_commands(id,organization_id,device_id,type,payload,status)
         VALUES($1,$2,$3,$4,$5::jsonb,'queued')
         RETURNING id,device_id AS "deviceId",type,payload,status,queued_at AS "queuedAt"`,
        [
          id,
          device.rows[0].organization_id,
          deviceId,
          type,
          JSON.stringify(req.body?.payload??{}),
        ],
      );

      res.status(201).json({command:result.rows[0]});
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });

  app.get('/api/v3/devices/:id/commands',async(req,res)=>{
    try{
      await initGlobalSchema();
      const db=getPool()!;
      const deviceId=String(req.params.id);

      const result=await db.query(
        `SELECT id,device_id AS "deviceId",type,payload,status,queued_at AS "queuedAt"
         FROM nnit_commands
         WHERE device_id=$1 AND status='queued'
         ORDER BY queued_at ASC
         LIMIT 20`,
        [deviceId],
      );

      if(result.rows.length){
        await db.query(
          `UPDATE nnit_commands
           SET status='delivered',delivered_at=NOW()
           WHERE id = ANY($1::uuid[])`,
          [result.rows.map((x:any)=>x.id)],
        );
      }

      res.json({commands:result.rows});
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });

  app.post('/api/v3/commands/:id/result',async(req,res)=>{
    try{
      await initGlobalSchema();
      const db=getPool()!;
      const ok=Boolean(req.body?.success);
      const result=await db.query(
        `UPDATE nnit_commands
         SET status=$2,
             completed_at=NOW(),
             result=$3::jsonb,
             error=$4
         WHERE id=$1
         RETURNING id,status,completed_at AS "completedAt"`,
        [
          String(req.params.id),
          ok?'completed':'failed',
          JSON.stringify(req.body?.result??{}),
          ok?null:String(req.body?.error??'Command failed'),
        ],
      );

      if(!result.rowCount)return res.status(404).json({message:'Command not found'});
      res.json({command:result.rows[0]});
    }catch(e){
      res.status(500).json({message:e instanceof Error?e.message:String(e)});
    }
  });
}
