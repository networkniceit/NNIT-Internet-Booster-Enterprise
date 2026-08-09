import{useEffect,useState}from'react';
const API=import.meta.env.VITE_API_URL??'http://localhost:4000';
export function ResourcePressurePanel(){
 const[s,setS]=useState<any>(null);
 useEffect(()=>{const load=async()=>{try{const r=await fetch(`${API}/api/resource-pressure/status`);if(r.ok)setS(await r.json())}catch{}};load();const t=setInterval(load,10000);return()=>clearInterval(t)},[]);
 return <section className="card pressure-card"><div className="card-header"><div><p className="section-label">RESOURCE PRESSURE</p><h2>Workstation load monitor</h2></div><span className={`optimizer-live-badge ${s?.pressure==='normal'?'online':''}`}>{(s?.pressure??'checking').toUpperCase()}</span></div><div className="pressure-stats"><div><span>CPU</span><strong>{s?.cpuPercent??'--'}%</strong></div><div><span>Memory</span><strong>{s?.memoryUsedPercent??'--'}%</strong></div><div><span>RAM free</span><strong>{s?.freeMemoryGb??'--'} GB</strong></div><div><span>RAM total</span><strong>{s?.totalMemoryGb??'--'} GB</strong></div></div>{s?.warnings?.length>0&&<div className="pressure-warnings">{s.warnings.map((w:string)=><span key={w}>{w}</span>)}</div>}</section>
}



