import{useEffect,useMemo,useState}from'react';

const CLOUD='https://nnit-internet-booster-enterprise-production.up.railway.app';

export function CloudDevicesPanel(){
 const[key,setKey]=useState('');
 const[devices,setDevices]=useState<any[]>([]);
 const[analytics,setAnalytics]=useState<any[]>([]);
 const[alerts,setAlerts]=useState<any[]>([]);
 const[msg,setMsg]=useState('');
 const[busy,setBusy]=useState(false);

 const headers=useMemo(()=>({'x-nnit-api-key':key}),[key]);

 const load=async()=>{
  if(!key)return;
  try{
   setBusy(true);
   const [d,a,al]=await Promise.all([
    fetch(`${CLOUD}/api/devices`,{headers}),
    fetch(`${CLOUD}/api/analytics?limit=500`,{headers}),
    fetch(`${CLOUD}/api/alerts`,{headers})
   ]);
   if(!d.ok)throw new Error(await d.text());
   if(!a.ok)throw new Error(await a.text());
   if(!al.ok)throw new Error(await al.text());
   setDevices((await d.json()).devices??[]);
   setAnalytics((await a.json()).analytics??[]);
   setAlerts((await al.json()).alerts??[]);
   setMsg('');
  }catch(e){setMsg(String(e))}
  finally{setBusy(false)}
 };

 const latestFor=(deviceId:string)=>{
  const rows=analytics.filter(x=>x.deviceId===deviceId);
  return rows.length?rows[rows.length-1]:null;
 };

 const alertCount=(deviceId:string)=>
  alerts.filter(x=>x.deviceId===deviceId&&!x.resolved).length;

 const command=async(deviceId:string,type:string)=>{
  if(!key)return;
  try{
   setBusy(true);
   const r=await fetch(`${CLOUD}/api/commands`,{
    method:'POST',
    headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({deviceId,type,payload:{}})
   });
   if(!r.ok)throw new Error(await r.text());
   const v=await r.json();
   setMsg(`Queued ${type} for ${deviceId}. Command ${v.id}`);
  }catch(e){setMsg(String(e))}
  finally{setBusy(false)}
 };

 useEffect(()=>{
  if(!key)return;
  load();
  const t=setInterval(load,10000);
  return()=>clearInterval(t);
 },[key]);

 return <section className="card cloud-devices-card">
  <div className="card-header">
   <div>
    <p className="section-label">CLOUD DEVICE DASHBOARD</p>
    <h2>Railway-managed NNIT devices</h2>
   </div>
   <span className="optimizer-live-badge online">{devices.length} DEVICES</span>
  </div>

  <div className="cloud-dashboard-auth">
   <label>Railway NNIT API key
    <input
      type="password"
      placeholder="Enter NNIT_API_KEY for cloud dashboard"
      value={key}
      onChange={e=>setKey(e.target.value)}
    />
   </label>
   <button className="secondary-button" disabled={!key||busy} onClick={load}>
    Refresh cloud
   </button>
  </div>

  <div className="cloud-device-grid">
   {devices.map(device=>{
    const latest=latestFor(device.id);
    return <article className="cloud-device-card" key={device.id}>
      <div className="cloud-device-title">
       <div>
        <strong>{device.name}</strong>
        <span>{device.platform} · agent {device.agentVersion}</span>
       </div>
       <span className={`cloud-device-state ${device.online?'online':'offline'}`}>
        {device.online?'ONLINE':'OFFLINE'}
       </span>
      </div>

      <div className="cloud-device-stats">
       <div><span>Score</span><strong>{latest?.score??device.metadata?.score??'--'}</strong></div>
       <div><span>Latency</span><strong>{latest?.latencyMs??device.metadata?.latencyMs??'--'} ms</strong></div>
       <div><span>DNS</span><strong>{latest?.dnsLatencyMs??device.metadata?.dnsLatencyMs??'--'} ms</strong></div>
       <div><span>Jitter</span><strong>{latest?.jitterMs??'--'} ms</strong></div>
       <div><span>Loss</span><strong>{latest?.packetLoss??device.metadata?.packetLoss??'--'}%</strong></div>
       <div><span>Alerts</span><strong>{alertCount(device.id)}</strong></div>
      </div>

      <div className="cloud-device-meta">
       <span>Device ID: {device.id}</span>
       <span>Last seen: {device.lastSeenAt?new Date(device.lastSeenAt).toLocaleString():'--'}</span>
      </div>

      <div className="cloud-device-actions">
       <button className="secondary-button" disabled={busy} onClick={()=>command(device.id,'ping-agent')}>
        Ping agent
       </button>
       <button className="secondary-button" disabled={busy} onClick={()=>command(device.id,'send-telemetry')}>
        Request telemetry
       </button>
      </div>
    </article>
   })}

   {key&&!devices.length&&!busy&&
    <p className="empty-state">No cloud devices returned.</p>}
  </div>

  <p className="action-message">{msg}</p>
  <p className="traffic-note">
   This dashboard only queues whitelisted NNIT commands. The Railway cloud cannot execute arbitrary PowerShell or shell commands on Windows agents.
  </p>
 </section>
}



