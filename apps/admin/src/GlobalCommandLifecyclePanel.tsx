import {useEffect,useState} from 'react';

const API=import.meta.env.VITE_API_URL??'http://localhost:4000';

const TYPES=[
 ['ping-agent','Ping Agent'],
 ['send-telemetry','Request Telemetry'],
 ['run-diagnostics','Run Diagnostics'],
 ['flush-dns','Flush DNS'],
 ['renew-ip','Renew IP'],
];

export function GlobalCommandLifecyclePanel(){
 const[devices,setDevices]=useState<any[]>([]);
 const[deviceId,setDeviceId]=useState('');
 const[type,setType]=useState('ping-agent');
 const[rows,setRows]=useState<any[]>([]);
 const[msg,setMsg]=useState('');

 async function load(){
  try{
   const d=await fetch(`${API}/api/fleet/v3/devices`,{cache:'no-store'});
   if(d.ok){
    const x=await d.json();
    const list=Array.isArray(x?.devices)?x.devices:[];
    setDevices(list);
    if(!deviceId&&list[0]?.id)setDeviceId(String(list[0].id));
   }

   const h=await fetch(
    deviceId
      ?`${API}/api/fleet/commands/history?deviceId=${encodeURIComponent(deviceId)}`
      :`${API}/api/fleet/commands/history`,
    {cache:'no-store'},
   );

   if(h.ok){
    const x=await h.json();
    setRows(Array.isArray(x?.commands)?x.commands:[]);
   }
  }catch(e){
   setMsg(String(e));
  }
 }

 async function queue(){
  if(!deviceId)return;

  try{
   const r=await fetch(`${API}/api/fleet/commands`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({deviceId,type}),
   });

   const t=await r.text();
   if(!r.ok)throw new Error(t);

   setMsg(`Queued ${type}.`);
   await load();
  }catch(e){
   setMsg(String(e));
  }
 }

 useEffect(()=>{
  void load();
  const timer=setInterval(()=>void load(),10000);
  return()=>clearInterval(timer);
 },[deviceId]);

 return <section className="card command-lifecycle-card">
  <div className="card-header">
   <div>
    <p className="section-label">GLOBAL REMOTE COMMANDS</p>
    <h2>PostgreSQL command lifecycle</h2>
   </div>
   <span className="optimizer-live-badge">WHITELISTED</span>
  </div>

  <div className="command-compose">
   <select value={deviceId} onChange={e=>setDeviceId(e.target.value)}>
    {devices.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
   </select>

   <select value={type} onChange={e=>setType(e.target.value)}>
    {TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
   </select>

   <button className="primary-button" onClick={()=>void queue()}>
    Queue command
   </button>
  </div>

  <div className="command-history">
   {rows.map(r=><article className="command-row" key={r.id}>
    <div>
     <strong>{r.type}</strong>
     <span>{r.deviceName??r.deviceId}</span>
    </div>
    <div>
     <span className={`command-status command-${r.status}`}>
      {String(r.status).toUpperCase()}
     </span>
    </div>
    {r.error&&<p className="command-error">{r.error}</p>}
   </article>)}
  </div>

  <p className="traffic-note">
   Only predefined NNIT commands are allowed. Arbitrary shell and PowerShell execution remain disabled.
  </p>
  <p className="action-message">{msg}</p>
 </section>
}

