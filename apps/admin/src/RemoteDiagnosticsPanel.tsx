import {
  useEffect,
  useState,
} from 'react';

const API =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000';

function formatBytes(value:any){
  const n=Number(value);

  if(!Number.isFinite(n)){
    return '--';
  }

  const units=[
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
  ];

  let x=n;
  let i=0;

  while(
    x>=1024 &&
    i<units.length-1
  ){
    x/=1024;
    i++;
  }

  return `${x.toFixed(i>=3?1:0)} ${units[i]}`;
}

export function RemoteDiagnosticsPanel(){
  const [telemetry,setTelemetry]=
    useState<any>(null);

  const [diagnostics,setDiagnostics]=
    useState<any>(null);

  const [message,setMessage]=
    useState('');

  const [busy,setBusy]=
    useState(false);

  async function loadTelemetry(){
    try{
      const response=
        await fetch(
          `${API}/api/remote-diagnostics/telemetry`,
          {cache:'no-store'},
        );

      if(!response.ok){
        throw new Error(
          await response.text(),
        );
      }

      setTelemetry(
        await response.json(),
      );
    }catch(error){
      setMessage(String(error));
    }
  }

  async function run(){
    try{
      setBusy(true);

      const response=
        await fetch(
          `${API}/api/remote-diagnostics/run`,
          {method:'POST'},
        );

      if(!response.ok){
        throw new Error(
          await response.text(),
        );
      }

      setDiagnostics(
        await response.json(),
      );

      setMessage(
        'Diagnostics completed.',
      );

      await loadTelemetry();
    }catch(error){
      setMessage(String(error));
    }finally{
      setBusy(false);
    }
  }

  useEffect(()=>{
    void loadTelemetry();

    const timer=setInterval(
      ()=>void loadTelemetry(),
      15000,
    );

    return()=>clearInterval(timer);
  },[]);

  return(
    <section className="card remote-diag-card">
      <div className="card-header">
        <div>
          <p className="section-label">
            REMOTE DIAGNOSTICS
          </p>

          <h2>
            System health and diagnostics
          </h2>
        </div>

        <span
          className={
            `optimizer-live-badge ${
              diagnostics?.healthy
                ? 'online'
                : ''
            }`
          }
        >
          {diagnostics
            ? diagnostics.healthy
              ? 'HEALTHY'
              : 'ATTENTION'
            : 'READY'}
        </span>
      </div>

      <div className="remote-diag-stats">
        <div>
          <span>CPU</span>
          <strong>
            {telemetry?.cpuPercent ??
              '--'}%
          </strong>
        </div>

        <div>
          <span>Memory</span>
          <strong>
            {telemetry?.memoryUsedPercent ??
              '--'}%
          </strong>
        </div>

        <div>
          <span>RAM free</span>
          <strong>
            {formatBytes(
              telemetry?.freeMemoryBytes,
            )}
          </strong>
        </div>

        <div>
          <span>Disk free</span>
          <strong>
            {formatBytes(
              telemetry?.systemDriveFreeBytes,
            )}
          </strong>
        </div>

        <div>
          <span>Uptime</span>
          <strong>
            {telemetry?.uptimeSeconds
              ? `${Math.floor(
                  telemetry.uptimeSeconds /
                  3600,
                )}h`
              : '--'}
          </strong>
        </div>
      </div>

      <div className="remote-diag-actions">
        <button
          className="primary-button"
          disabled={busy}
          onClick={run}
        >
          Run diagnostics
        </button>
      </div>

      {diagnostics && (
        <div className="remote-diag-results">
          <div>
            <span>Active adapter</span>
            <strong>
              {diagnostics.activeAdapter ??
                '--'}
            </strong>
          </div>

          <div>
            <span>Default gateway</span>
            <strong>
              {diagnostics.defaultGateway ??
                '--'}
            </strong>
          </div>

          <div>
            <span>DNS</span>
            <strong>
              {diagnostics.dnsResolved
                ? 'PASS'
                : 'FAIL'}
            </strong>
          </div>

          <div>
            <span>Internet</span>
            <strong>
              {diagnostics.internetReachable
                ? 'PASS'
                : 'FAIL'}
            </strong>
          </div>
        </div>
      )}

      {diagnostics?.notes?.length>0 && (
        <div className="remote-diag-notes">
          {diagnostics.notes.map(
            (note:string)=>(
              <span key={note}>
                {note}
              </span>
            ),
          )}
        </div>
      )}

      <p className="action-message">
        {message}
      </p>

      <p className="traffic-note">
        Diagnostics are restricted to read-only system health checks. This module does not expose a general remote shell.
      </p>
    </section>
  );
}



