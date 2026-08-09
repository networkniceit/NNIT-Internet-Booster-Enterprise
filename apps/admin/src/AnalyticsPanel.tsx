import {useEffect,useMemo,useState} from'react';
const API=import.meta.env.VITE_API_URL??'http://localhost:4000';
export function AnalyticsPanel(){
 const[h,setH]=useState<any[]>([]),[s,setS]=useState<any>(null),[m,setM]=useState('');
 const load=async()=>{try{const[a,b]=await Promise.all([fetch(`${API}/api/analytics/history?limit=120`,{cache:'no-store'}),fetch(`${API}/api/analytics/summary`,{cache:'no-store'})]);setH(await a.json());setS(await b.json())}catch(e){setM(String(e))}};
 useEffect(()=>{load();const t=setInterval(load,10000);return()=>clearInterval(t)},[]);
 const path=(v:number[],max:number)=>v.map((x,i)=>`${i?'L':'M'} ${v.length===1?0:(i/(v.length-1))*600} ${170-(Math.max(0,Math.min(max,x))/max)*160}`).join(' ');
 const score=useMemo(()=>path(h.map(x=>x.score),100),[h]);
 const vals=h.map(x=>x.latencyMs??0),mx=Math.max(100,...vals);
 const latency=useMemo(()=>path(vals,mx),[h,mx]);
 const clear=async()=>{await fetch(`${API}/api/analytics/history`,{method:'DELETE'});setM('History cleared.');load()};
 return <section className="card analytics-card"><div className="card-header"><div><p className="section-label">LIVE ANALYTICS</p><h2>Historical network performance</h2></div><span className="optimizer-live-badge online">RECORDING</span></div>
 <div className="analytics-summary"><div><span>Average score</span><strong>{s?.averageScore??'--'}</strong></div><div><span>Average latency</span><strong>{s?.averageLatency??'--'} ms</strong></div><div><span>Uptime</span><strong>{s?.uptimePercent??'--'}%</strong></div><div><span>Samples</span><strong>{s?.samples??0}</strong></div></div>
 <div className="analytics-charts"><article><div className="chart-title"><span>Network score</span><strong>0-100</strong></div><svg viewBox="0 0 600 180"><path className="chart-grid-line" d="M0 45 H600 M0 90 H600 M0 135 H600"/><path className="chart-score-line" d={score}/></svg></article><article><div className="chart-title"><span>Latency</span><strong>ms</strong></div><svg viewBox="0 0 600 180"><path className="chart-grid-line" d="M0 45 H600 M0 90 H600 M0 135 H600"/><path className="chart-latency-line" d={latency}/></svg></article></div>
 <div className="analytics-actions"><button className="primary-button" onClick={()=>window.open(`${API}/api/analytics/export`,'_blank')}>Download diagnostics</button><button className="secondary-button" onClick={clear}>Clear history</button></div><p className="action-message">{m}</p></section>
}
