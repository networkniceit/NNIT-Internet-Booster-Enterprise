import{useEffect,useState}from'react';

const API=import.meta.env.VITE_API_URL??'http://localhost:4000';

export function AlertsPanel(){
 const[status,setStatus]=useState<any>(null);
 const[enabled,setEnabled]=useState(true);
 const[latency,setLatency]=useState(180);
 const[dns,setDns]=useState(250);
 const[jitter,setJitter]=useState(80);
 const[loss,setLoss]=useState(5);
 const[score,setScore]=useState(45);
 const[relayRequired,setRelayRequired]=useState(false);
 const[msg,setMsg]=useState('');

 const load=async()=>{
  try{
   const r=await fetch(`${API}/api/alerts/status`,{cache:'no-store'});
   if(!r.ok)throw new Error(`HTTP ${r.status}`);
   const v=await r.json();
   setStatus(v);
   setEnabled(v.settings.enabled);
   setLatency(v.settings.latencyThresholdMs);
   setDns(v.settings.dnsThresholdMs);
   setJitter(v.settings.jitterThresholdMs);
   setLoss(v.settings.packetLossThreshold);
   setScore(v.settings.scoreThreshold);
   setRelayRequired(v.settings.relayRequired);
   setMsg('');
  }catch(e){setMsg(String(e))}
 };

 const save=async()=>{
  const r=await fetch(`${API}/api/alerts/settings`,{
   method:'PUT',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({
    enabled,
    latencyThresholdMs:latency,
    dnsThresholdMs:dns,
    jitterThresholdMs:jitter,
    packetLossThreshold:loss,
    scoreThreshold:score,
    relayRequired,
    cooldownSeconds:60
   })
  });
  if(!r.ok){setMsg(`HTTP ${r.status}`);return}
  setMsg('Alert settings saved.');
  await load();
 };

 const ack=async(id:string)=>{
  await fetch(`${API}/api/alerts/acknowledge`,{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({id})
  });
  await load();
 };

 const clear=async()=>{
  await fetch(`${API}/api/alerts`,{method:'DELETE'});
  await load();
 };

 useEffect(()=>{
  load();
  const t=setInterval(load,5000);
  return()=>clearInterval(t);
 },[]);

 return <section className="card alerts-card">
  <div className="card-header">
   <div>
    <p className="section-label">ENTERPRISE ALERTS</p>
    <h2>Network warnings and incident history</h2>
   </div>
   <span className={`optimizer-live-badge ${(status?.active?.length??0)>0?'offline':'online'}`}>
    {(status?.active?.length??0)>0?`${status.active.length} ACTIVE`:'CLEAR'}
   </span>
  </div>

  <div className="alerts-controls">
   <label className="optimizer-switch">
    <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>
    <span>Enable alerts</span>
   </label>
   <label>Latency threshold<input type="number" value={latency} onChange={e=>setLatency(Number(e.target.value))}/></label>
   <label>DNS threshold<input type="number" value={dns} onChange={e=>setDns(Number(e.target.value))}/></label>
   <label>Jitter threshold<input type="number" value={jitter} onChange={e=>setJitter(Number(e.target.value))}/></label>
   <label>Packet loss threshold<input type="number" value={loss} onChange={e=>setLoss(Number(e.target.value))}/></label>
   <label>Score threshold<input type="number" value={score} onChange={e=>setScore(Number(e.target.value))}/></label>
   <label className="optimizer-switch">
    <input type="checkbox" checked={relayRequired} onChange={e=>setRelayRequired(e.target.checked)}/>
    <span>Relay required</span>
   </label>
   <button className="primary-button" onClick={save}>Save alert settings</button>
   <button className="secondary-button" onClick={clear}>Clear alerts</button>
  </div>

  <p className="action-message">{msg}</p>

  <div className="alerts-list">
   {(status?.active??[]).map((item:any)=>
    <div className={`alert-row ${item.severity}`} key={item.id}>
     <div>
      <strong>{item.title}</strong>
      <span>{item.message}</span>
     </div>
     <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
     <button className="secondary-button" onClick={()=>ack(item.id)}>Acknowledge</button>
    </div>
   )}
   {!(status?.active?.length)&&<p className="empty-state">No active alerts.</p>}
  </div>
 </section>
}
