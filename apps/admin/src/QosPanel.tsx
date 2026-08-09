import{useEffect,useState}from'react';
const API=import.meta.env.VITE_API_URL??'http://localhost:4000';
export function QosPanel(){
 const[s,setS]=useState<any>(null),[name,setName]=useState('Priority application'),[path,setPath]=useState(''),[priority,setPriority]=useState('high'),[throttle,setThrottle]=useState(''),[msg,setMsg]=useState('');
 const load=async()=>{try{const r=await fetch(`${API}/api/qos/status`,{cache:'no-store'});setS(await r.json())}catch(e){setMsg(String(e))}};
 const create=async()=>{
  if(!path.trim()){setMsg('Enter the full application executable path.');return;}try{const r=await fetch(`${API}/api/qos/rules`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,applicationPath:path,priority,throttleMbps:throttle===''?null:Number(throttle),enabled:true})});if(!r.ok)throw new Error(await r.text());setPath('');setThrottle('');setMsg('QoS rule created.');await load()}catch(e){setMsg(String(e))}};
 const act=async(id:string,verb:string)=>{try{const r=await fetch(`${API}/api/qos/rules/${id}/${verb}`,{method:'POST'});if(!r.ok)throw new Error(await r.text());await load()}catch(e){setMsg(String(e))}};
 const del=async(id:string)=>{try{const r=await fetch(`${API}/api/qos/rules/${id}`,{method:'DELETE'});if(!r.ok)throw new Error(await r.text());await load()}catch(e){setMsg(String(e))}};
 useEffect(()=>{load();const t=setInterval(load,5000);return()=>clearInterval(t)},[]);
 return <section className="card qos-card"><div className="card-header"><div><p className="section-label">APPLICATION QoS ENGINE</p><h2>Windows application priority policies</h2></div><span className="optimizer-live-badge online">{s?.appliedCount??0} APPLIED</span></div>
 <div className="qos-create-grid"><label>Rule name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Application executable path<input placeholder="C:\Program Files\App\App.exe" value={path} onChange={e=>setPath(e.target.value)}/></label><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="critical">Critical</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label><label>Throttle Mbps<input type="number" min="0" value={throttle} onChange={e=>setThrottle(e.target.value)}/></label><button className="primary-button" disabled={!path.trim()} onClick={create}>Create QoS rule</button></div>
 <p className="action-message">{msg}</p><div className="qos-rules">{(s?.rules??[]).map((r:any)=><div className="qos-rule" key={r.id}><div><strong>{r.name}</strong><span>{r.applicationPath}</span><span>{r.priority} · DSCP {r.dscpValue} · Throttle {r.throttleMbps??'None'} Mbps</span><span>{r.lastMessage}</span></div><span className={`qos-state ${r.applied?'applied':'draft'}`}>{r.applied?'APPLIED':'DRAFT'}</span><div className="qos-actions">{!r.applied&&<button className="primary-button" onClick={()=>act(r.id,'apply')}>Apply</button>}{r.applied&&<button className="secondary-button" onClick={()=>act(r.id,'remove')}>Remove policy</button>}<button className="secondary-button" onClick={()=>del(r.id)}>Delete</button></div></div>)}{!(s?.rules?.length)&&<p className="empty-state">No QoS rules created.</p>}</div>
 <p className="traffic-note">Run the backend from Administrator PowerShell. This uses native Windows QoS policies and does not inspect encrypted packet contents.</p></section>
}




