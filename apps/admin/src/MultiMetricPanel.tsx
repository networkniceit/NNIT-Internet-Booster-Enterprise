import{useEffect,useState}from'react';
const API=import.meta.env.VITE_API_URL??'http://localhost:4000';
export function MultiMetricPanel(){
 const[m,setM]=useState<any>(null),[msg,setMsg]=useState('');
 useEffect(()=>{const load=async()=>{try{const r=await fetch(`${API}/api/measurement/latest`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);setM(await r.json());setMsg('')}catch(e){setMsg(String(e))}};load();const t=setInterval(load,5000);return()=>clearInterval(t)},[]);
 return <section className="card metric-detail-card"><div className="card-header"><div><p className="section-label">UNIFIED MEASUREMENT ENGINE</p><h2>Connection quality breakdown</h2></div><span className={`optimizer-live-badge ${m?.online?'online':'offline'}`}>{m?.online?'LIVE':'OFFLINE'}</span></div><div className="metric-detail-grid">
 <div><span>Gateway latency</span><strong>{m?.gatewayLatencyMs??'--'} ms</strong></div>
 <div><span>Internet TCP latency</span><strong>{m?.internetTcpLatencyMs??'--'} ms</strong></div>
 <div><span>DNS latency</span><strong>{m?.dnsLatencyMs??'--'} ms</strong></div>
 <div><span>Relay UDP latency</span><strong>{m?.relayUdpLatencyMs??'--'} ms</strong></div>
 <div><span>Relay UDP jitter</span><strong>{m?.relayUdpJitterMs??'--'} ms</strong></div>
 <div><span>Relay packet loss</span><strong>{m?.relayUdpPacketLoss??'--'}%</strong></div>
 <div><span>Unified score</span><strong>{m?.score??'--'}</strong></div>
 <div><span>Measurement source</span><strong>{m?.source??'--'}</strong></div>
 </div><p className="action-message">{msg}</p></section>
}

