import{useEffect,useState}from'react';
const API=import.meta.env.VITE_API_URL??'http://localhost:4000';
export function CloudAgentPanel(){
 const[s,setS]=useState<any>(null),[v,setV]=useState<any>(null),[key,setKey]=useState(''),[msg,setMsg]=useState('');
 const load=async()=>{try{const[a,b]=await Promise.all([fetch(`${API}/api/cloud-agent/status`),fetch(`${API}/api/cloud-agent/settings`)]);setS(await a.json());setV(await b.json())}catch(e){setMsg(String(e))}};
 useEffect(()=>{load();const t=setInterval(load,5000);return()=>clearInterval(t)},[]);
 const save=async()=>{const body={...v,apiKey:key||v.apiKey};const r=await fetch(`${API}/api/cloud-agent/settings`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){setMsg(await r.text());return}setKey('');setMsg('Cloud settings saved.');await load()};
 const act=async(x:string)=>{const r=await fetch(`${API}/api/cloud-agent/${x}`,{method:'POST'});setMsg(r.ok?`${x} completed.`:await r.text());await load()};
 if(!v)return null;
 return <section className="card cloud-agent-card"><div className="card-header"><div><p className="section-label">NNIT CLOUD AGENT</p><h2>Railway device connection</h2></div><span className={`optimizer-live-badge ${s?.cloudReachable?'online':''}`}>{s?.cloudReachable?'CONNECTED':'OFFLINE'}</span></div>
 <div className="cloud-agent-summary"><div><span>Device</span><strong>{s?.deviceName??'--'}</strong></div><div><span>Device ID</span><strong>{s?.deviceId??'--'}</strong></div><div><span>Heartbeat</span><strong>{s?.lastHeartbeatAt?new Date(s.lastHeartbeatAt).toLocaleTimeString():'--'}</strong></div><div><span>Telemetry</span><strong>{s?.lastTelemetryAt?new Date(s.lastTelemetryAt).toLocaleTimeString():'--'}</strong></div></div>
 <div className="cloud-agent-form"><label>Enable cloud agent<input type="checkbox" checked={!!v.enabled} onChange={e=>setV({...v,enabled:e.target.checked})}/></label><label>Cloud URL<input value={v.cloudUrl} onChange={e=>setV({...v,cloudUrl:e.target.value})}/></label><label>Device name<input value={v.deviceName} onChange={e=>setV({...v,deviceName:e.target.value})}/></label><label>Cloud API key<input type="password" placeholder={v.apiKey||'Enter Railway NNIT_API_KEY'} value={key} onChange={e=>setKey(e.target.value)}/></label><label>Heartbeat seconds<input type="number" min="15" value={v.heartbeatSeconds} onChange={e=>setV({...v,heartbeatSeconds:e.target.value})}/></label><label>Telemetry seconds<input type="number" min="15" value={v.telemetrySeconds} onChange={e=>setV({...v,telemetrySeconds:e.target.value})}/></label></div>
 <div className="cloud-agent-actions"><button className="primary-button" onClick={save}>Save cloud settings</button><button className="secondary-button" onClick={()=>act('register')}>Register now</button><button className="secondary-button" onClick={()=>act('heartbeat')}>Send heartbeat</button><button className="secondary-button" onClick={()=>act('telemetry')}>Send telemetry</button><button className="secondary-button" onClick={()=>act('commands/poll')}>Poll commands</button></div><p className="action-message">{msg||s?.lastError||''}</p></section>
}



