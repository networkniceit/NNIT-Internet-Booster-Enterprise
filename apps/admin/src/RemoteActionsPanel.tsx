import{useState}from'react';
const API=import.meta.env.VITE_API_URL??'http://localhost:4000';
export function RemoteActionsPanel(){
 const[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const run=async(type:string)=>{try{setBusy(true);const r=await fetch(`${API}/api/remote-actions/execute`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type})});if(!r.ok)throw new Error(await r.text());const x=await r.json();setMsg(x.message??`${type} completed.`)}catch(e){setMsg(String(e))}finally{setBusy(false)}};
 return <section className="card remote-actions-card"><div className="card-header"><div><p className="section-label">SAFE REMOTE ACTIONS</p><h2>Local network maintenance</h2></div><span className="optimizer-live-badge online">WHITELISTED</span></div><div className="remote-actions-grid"><button className="secondary-button" disabled={busy} onClick={()=>run('flush-dns')}>Flush DNS</button><button className="secondary-button" disabled={busy} onClick={()=>run('renew-ip')}>Renew IP</button><button className="secondary-button" disabled={busy} onClick={()=>run('restart-active-adapter')}>Restart active adapter</button></div><p className="action-message">{msg}</p><p className="traffic-note">Only predefined NNIT actions are allowed. Arbitrary shell execution remains disabled.</p></section>
}


