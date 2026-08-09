import{useEffect,useState}from'react';
const API=import.meta.env.VITE_API_URL??'http://localhost:4000';
export function FleetAlertsPanel(){
 const[alerts,setAlerts]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=async()=>{try{const r=await fetch(`${API}/api/fleet/alerts`,{cache:'no-store'});if(!r.ok)throw new Error(await r.text());setAlerts((await r.json()).alerts??[]);setMsg('')}catch(e){setMsg(String(e))}};
 const action=async(id:string,type:'acknowledge'|'resolve')=>{try{const r=await fetch(`${API}/api/fleet/alerts/${type}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw new Error(await r.text());await load()}catch(e){setMsg(String(e))}};
 useEffect(()=>{load();const t=setInterval(load,15000);return()=>clearInterval(t)},[]);
 const active=alerts.filter(a=>!['resolved','closed'].includes(a.status));
 return <section className="card fleet-alerts-card"><div className="card-header"><div><p className="section-label">FLEET INCIDENTS</p><h2>Cloud alert lifecycle</h2></div><span className="optimizer-live-badge">{active.length} ACTIVE</span></div><div className="fleet-alert-list">{alerts.map(a=><article className="fleet-alert-row" key={a.id}><div><strong>{a.type}</strong><span>{a.severity} Â· {a.status}</span><p>{a.message}</p><small>{new Date(a.updatedAt).toLocaleString()}</small></div><div className="fleet-alert-actions">{a.status==='open'&&<button className="secondary-button" onClick={()=>action(a.id,'acknowledge')}>Acknowledge</button>}{!['resolved','closed'].includes(a.status)&&<button className="secondary-button" onClick={()=>action(a.id,'resolve')}>Resolve</button>}</div></article>)}{!alerts.length&&<p className="empty-state">No fleet incidents.</p>}</div><p className="action-message">{msg}</p></section>
}
