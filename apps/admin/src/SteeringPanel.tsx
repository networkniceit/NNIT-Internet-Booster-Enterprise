import {useEffect,useState} from'react';
const API=import.meta.env.VITE_API_URL??'http://localhost:4000';
export function SteeringPanel(){
 const[s,setS]=useState<any>(null),[auto,setAuto]=useState(false),[min,setMin]=useState(8),[msg,setMsg]=useState('');
 const load=async()=>{try{const r=await fetch(`${API}/api/steering/status`,{cache:'no-store'});const v=await r.json();setS(v);setAuto(v.automatic)}catch(e){setMsg(String(e))}};
 const save=async()=>{await fetch(`${API}/api/steering/settings`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({automatic:auto,minimumImprovement:min})});setMsg('Steering settings saved.');load()};
 const apply=async(name:string)=>{const r=await fetch(`${API}/api/steering/apply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adapterName:name})});const v=await r.json();setMsg(v.message);load()};
 const restore=async()=>{const r=await fetch(`${API}/api/steering/restore`,{method:'POST'});const v=await r.json();setMsg(v.message);load()};
 useEffect(()=>{load();const t=setInterval(load,15000);return()=>clearInterval(t)},[]);
 return <section className="card steering-card"><div className="card-header"><div><p className="section-label">SMART TRAFFIC ENGINE</p><h2>Per-interface scoring and route steering</h2></div><span className={`optimizer-live-badge ${s?.bestAdapter?'online':'offline'}`}>{s?.bestAdapter?'ACTIVE':'WAITING'}</span></div>
 <div className="steering-summary"><div><span>Best interface</span><strong>{s?.bestAdapter??'--'}</strong></div><div><span>Applied route</span><strong>{s?.selectedAdapter??'Windows automatic'}</strong></div><div><span>Automatic steering</span><strong>{auto?'Enabled':'Disabled'}</strong></div></div>
 <div className="steering-link-list">{(s?.links??[]).map((x:any)=><div className="steering-link-row" key={x.name}><div><strong>{x.name}</strong><span>{x.ipv4??'No IPv4'}</span></div><div><span>Latency</span><strong>{x.latencyMs??'--'} ms</strong></div><div><span>Jitter</span><strong>{x.jitterMs??'--'} ms</strong></div><div><span>Loss</span><strong>{x.packetLoss}%</strong></div><div><span>Score</span><strong>{x.score}</strong></div><button className="secondary-button" disabled={!x.eligible} onClick={()=>apply(x.name)}>{x.selected?'Selected':'Prefer'}</button></div>)}</div>
 <div className="steering-controls"><label className="optimizer-switch"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/><span>Automatic best-route steering</span></label><label>Minimum score improvement<input type="number" min="0" max="100" value={min} onChange={e=>setMin(Number(e.target.value))}/></label><button className="primary-button" onClick={save}>Save steering settings</button><button className="secondary-button" onClick={restore}>Restore Windows automatic</button></div><p className="action-message">{msg}</p></section>
}



