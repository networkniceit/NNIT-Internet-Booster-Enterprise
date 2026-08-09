import { useEffect, useState } from 'react';
interface BondingLink { name:string; ipv4:string|null; mac:string|null; virtual:boolean; connected:boolean; latencyMs:number|null; packetLoss:number; score:number; eligible:boolean; }
interface BondingStatus { enabled:boolean; strategy:'failover'|'balanced'|'latency'; relayConfigured:boolean; readyForRelay:boolean; independentLinksDetected:number; links:BondingLink[]; recommendation:string; timestamp:string; }
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
export function BondingPanel() {
  const [status,setStatus]=useState<BondingStatus|null>(null);
  const [enabled,setEnabled]=useState(false);
  const [strategy,setStrategy]=useState<'failover'|'balanced'|'latency'>('failover');
  const [relayHost,setRelayHost]=useState('');
  const [relayPort,setRelayPort]=useState(51820);
  const [message,setMessage]=useState('');
  async function loadStatus(){ try { const r=await fetch(`${API_URL}/api/bonding/status`,{cache:'no-store'}); if(!r.ok) throw new Error(`HTTP ${r.status}`); const v=await r.json() as BondingStatus; setStatus(v); setEnabled(v.enabled); setStrategy(v.strategy);} catch(e){setMessage(e instanceof Error?e.message:'Bonding status failed.');}}
  async function saveSettings(){ try { setMessage('Saving bonding settings...'); const r=await fetch(`${API_URL}/api/bonding/settings`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled,strategy,relayHost,relayPort,encryption:true})}); if(!r.ok) throw new Error(`HTTP ${r.status}`); setMessage('Bonding settings saved.'); await loadStatus(); } catch(e){ setMessage(e instanceof Error?e.message:'Bonding settings failed.'); }}
  useEffect(()=>{void loadStatus(); const t=window.setInterval(()=>void loadStatus(),10000); return()=>window.clearInterval(t);},[]);
  return <section className="card bonding-card"><div className="card-header"><div><p className="section-label">MULTI-LINK BONDING</p><h2>Local link manager</h2></div><span className={`optimizer-live-badge ${status?.readyForRelay?'online':'offline'}`}>{status?.readyForRelay?'READY':'SETUP'}</span></div>
  <div className="bonding-summary"><div><span>Independent links</span><strong>{status?.independentLinksDetected??0}</strong></div><div><span>Relay configured</span><strong>{status?.relayConfigured?'Yes':'No'}</strong></div><div><span>Bonding mode</span><strong>{status?.strategy??strategy}</strong></div></div>
  <div className="bonding-link-list">{(status?.links??[]).map(link=><div className="bonding-link-row" key={`${link.name}-${link.ipv4}`}><div><strong>{link.name}</strong><span>{link.ipv4??'No IPv4 address'}</span></div><div><span>Score</span><strong>{link.score}</strong></div><div><span>Latency</span><strong>{link.latencyMs??'--'} ms</strong></div><div><span>Eligible</span><strong>{link.eligible?'Yes':'No'}</strong></div></div>)}</div>
  <div className="bonding-settings-grid"><label className="optimizer-switch"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/><span>Enable bonding manager</span></label><label>Strategy<select value={strategy} onChange={e=>setStrategy(e.target.value as any)}><option value="failover">Failover</option><option value="balanced">Balanced</option><option value="latency">Lowest latency</option></select></label><label>Relay host<input value={relayHost} onChange={e=>setRelayHost(e.target.value)} placeholder="relay.example.com"/></label><label>Relay port<input type="number" min="1" max="65535" value={relayPort} onChange={e=>setRelayPort(Number(e.target.value))}/></label><button className="primary-button" onClick={saveSettings}>Save bonding settings</button></div><p className="action-message">{message||status?.recommendation}</p></section>;
}
