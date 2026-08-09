import{useEffect,useState}from'react';
const API=import.meta.env.VITE_API_URL??'http://localhost:4000';
export function QosProfilesPanel(){
 const[profiles,setProfiles]=useState<any[]>([]),[selected,setSelected]=useState('balanced'),[preview,setPreview]=useState<any>(null),[msg,setMsg]=useState('');
 const load=async()=>{const r=await fetch(`${API}/api/qos/profiles`);setProfiles(await r.json())};
 const show=async()=>{const r=await fetch(`${API}/api/qos/profiles/${selected}/preview`);setPreview(await r.json())};
 const apply=async()=>{const r=await fetch(`${API}/api/qos/profiles/${selected}/apply`,{method:'POST'});const v=await r.json();setMsg(`Applied ${v.applied}/${v.detected} detected applications.`);await show()};
 useEffect(()=>{load()},[]);
 useEffect(()=>{show()},[selected]);
 return <section className="card qos-profile-card"><div className="card-header"><div><p className="section-label">QoS PROFILES</p><h2>One-click application priorities</h2></div><span className="optimizer-live-badge online">READY</span></div>
 <div className="qos-profile-toolbar"><select value={selected} onChange={e=>setSelected(e.target.value)}>{profiles.map(p=><option key={p.name} value={p.name}>{p.label}</option>)}</select><button className="secondary-button" onClick={show}>Preview</button><button className="primary-button" onClick={apply}>Apply profile</button></div>
 <div className="qos-profile-preview">{(preview?.detectedApplications??[]).map((x:any)=><div className="qos-profile-row" key={x.applicationPath}><div><strong>{x.processName}</strong><span>{x.applicationPath}</span></div><span>{x.priority}</span><span>{x.throttleMbps===null?'No limit':`${x.throttleMbps} Mbps`}</span></div>)}{!preview?.count&&<p className="empty-state">No matching detected applications.</p>}</div><p className="action-message">{msg}</p></section>
}


