import{useEffect,useMemo,useState}from'react';
const API=import.meta.env.VITE_API_URL??'http://localhost:4000';
export function TrafficPanel(){
 const[s,setS]=useState<any>(null),[q,setQ]=useState('');
 const load=async()=>{const r=await fetch(`${API}/api/traffic/live`,{cache:'no-store'});setS(await r.json())};
 useEffect(()=>{load();const t=setInterval(load,2000);return()=>clearInterval(t)},[]);
 const rows=useMemo(()=>{const v=q.toLowerCase();return(s?.processes??[]).filter((x:any)=>!v||x.name.toLowerCase().includes(v)||String(x.pid).includes(v)||(x.path??'').toLowerCase().includes(v))},[s,q]);
 return <section className="card traffic-card"><div className="card-header"><div><p className="section-label">APPLICATION TRAFFIC MONITOR</p><h2>Windows network connections</h2></div><span className="optimizer-live-badge online">LIVE</span></div>
 <div className="traffic-summary"><div><span>Interface</span><strong>{s?.interfaceName??'--'}</strong></div><div><span>Download</span><strong>{s?.downloadMbps??'--'} Mbps</strong></div><div><span>Upload</span><strong>{s?.uploadMbps??'--'} Mbps</strong></div><div><span>Total</span><strong>{s?.totalMbps??'--'} Mbps</strong></div></div>
 <div className="traffic-toolbar"><input type="search" placeholder="Search application, PID, or path" value={q} onChange={e=>setQ(e.target.value)}/><button className="secondary-button" onClick={load}>Refresh now</button></div>
 <div className="traffic-table-wrap"><table className="traffic-table"><thead><tr><th>Application</th><th>PID</th><th>Connections</th><th>Established</th><th>Listening</th><th>Remote endpoints</th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.pid}><td><strong>{x.name}</strong><span>{x.path??'Path unavailable'}</span></td><td>{x.pid}</td><td>{x.connectionCount}</td><td>{x.establishedCount}</td><td>{x.listeningCount}</td><td>{(x.remoteEndpoints??[]).slice(0,3).join(', ')||'--'}</td></tr>)}</tbody></table></div>
 <p className="traffic-note">Throughput is measured for the active interface. Process rows show verified connection activity; Windows standard APIs do not provide exact per-process Mbps.</p></section>
}


