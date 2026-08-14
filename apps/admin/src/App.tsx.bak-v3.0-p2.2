import { useCallback, useEffect, useState } from 'react';
import {
  applyOptimization,
  getNetworkStatus,
  runSpeedTest,
  type NetworkStatus,
} from './api';
import './App.css';
import { ResourceOptimizerPanel } from './ResourceOptimizerPanel';
import { FleetAlertsPanel } from './FleetAlertsPanel';
import { ResourcePressurePanel } from './ResourcePressurePanel';
import { RemoteActionsPanel } from './RemoteActionsPanel';
import { RemoteDiagnosticsPanel } from './RemoteDiagnosticsPanel';
import { FleetPanel } from './FleetPanel';
import { CloudAgentPanel } from './CloudAgentPanel';
import { QosProfilesPanel } from './QosProfilesPanel';
import { QosPanel } from './QosPanel';
import { TrafficPanel } from './TrafficPanel';
import { AlertsPanel } from './AlertsPanel';
import { FailoverPanel } from './FailoverPanel';
import { MultiMetricPanel } from './MultiMetricPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { SteeringPanel } from './SteeringPanel';
import { OptimizerPanel } from './OptimizerPanel';
import { BondingPanel } from './BondingPanel';
import { RelayPanel } from './RelayPanel';

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }

  return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function App() {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('balanced');
  const [dnsProfile, setDnsProfile] = useState('automatic');
  const [actionMessage, setActionMessage] = useState('');
  const [speedTesting, setSpeedTesting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const result = await getNetworkStatus();
      setStatus(result);
      setError('');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to reach the NNIT API.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();

    const interval = window.setInterval(() => {
      void loadStatus();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadStatus]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <strong>NNIT</strong>
            <span>Enterprise</span>
          </div>
        </div>

        <nav>
          <button className="nav-item active">Overview</button>
          <button className="nav-item">Network</button>
          <button className="nav-item">Devices</button>
          <button className="nav-item">Optimizer</button>
          <button className="nav-item">Bonding</button>
          <button className="nav-item">Security</button>
          <button className="nav-item">Diagnostics</button>
          <button className="nav-item">Settings</button>
        </nav>

        <div className="sidebar-footer">
          <span>Enterprise v2.0</span>
          <small>Windows development build</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">NETWORK CONTROL CENTER</p>
            <h1>Internet Booster</h1>
          </div>

          <div
            className={`connection-pill ${
              status?.online ? 'online' : 'offline'
            }`}
          >
            <span />
            {loading
              ? 'Connecting'
              : status?.online
                ? 'Online'
                : 'Offline'}
          </div>
        </header>

        {error && (
          <div className="error-banner">
            Backend connection failed: {error}
          </div>
        )}

        <section className="hero-grid">
          <article className="card health-card">
            <div>
              <p className="section-label">NETWORK HEALTH</p>
              <div className="score-row">
                <strong>{status?.score ?? '--'}</strong>
                <span>/100</span>
              </div>
              <p className="health-message">
                {(status?.score ?? 0) >= 85
                  ? 'Excellent connection quality'
                  : 'Connection optimization recommended'}
              </p>
            </div>

            <div className="score-ring">
              <div>
                <strong>{status?.score ?? 0}%</strong>
                <span>Quality</span>
              </div>
            </div>
          </article>

          <article className="card active-link-card">
            <p className="section-label">ACTIVE CONNECTION</p>
            <h2>{status?.activeAdapter?.name ?? 'Detecting...'}</h2>
            <p>
              {status?.activeAdapter?.ipv4 ??
                'No active IPv4 address'}
            </p>
            <div className="link-status">
              <span className="signal-bars">▂▄▆█</span>
              Primary route
            </div>
          </article>
        </section>

        <section className="metrics-grid">
          <article className="metric-card">
            <span>Latency</span>
            <strong>{status?.latencyMs ?? '--'}</strong>
            <small>ms</small>
          </article>

          <article className="metric-card">
            <span>Packet loss</span>
            <strong>{status?.packetLoss ?? '--'}</strong>
            <small>%</small>
          </article>

          <article className="metric-card">
            <span>Download</span>
            <strong>{status?.downloadMbps ?? '--'}</strong>
            <small>Mbps</small>
          </article>

          <article className="metric-card">
            <span>Upload</span>
            <strong>{status?.uploadMbps ?? '--'}</strong>
            <small>Mbps</small>
          </article>
        </section>

        <section className="content-grid">
          <article className="card">
            <div className="card-header">
              <div>
                <p className="section-label">LIVE INTERFACES</p>
                <h2>Network adapters</h2>
              </div>

              <button className="secondary-button" onClick={loadStatus}>
                Refresh
              </button>
            </div>

            <div className="adapter-list">
              {(status?.adapters ?? []).map((adapter) => (
                <div className="adapter-row" key={`${adapter.name}-${adapter.ipv4}`}>
                  <div className="adapter-icon">↗</div>

                  <div className="adapter-details">
                    <strong>{adapter.name}</strong>
                    <span>{adapter.ipv4}</span>
                    <small>{adapter.mac}</small>
                  </div>

                  {status?.activeAdapter?.name === adapter.name && (
                    <span className="active-badge">ACTIVE</span>
                  )}
                </div>
              ))}
            </div>
          </article>

          <article className="card control-card">
            <p className="section-label">BOOSTER CONTROL</p>
            <h2>Optimization profile</h2>

            <label>
              Traffic mode
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value)}
              >
                <option value="balanced">Balanced</option>
                <option value="developer">Developer</option>
                <option value="streaming">Streaming</option>
                <option value="gaming">Gaming</option>
                <option value="business">Business</option>
              </select>
            </label>

            <label>
              DNS profile
              <select
                value={dnsProfile}
                onChange={(event) => setDnsProfile(event.target.value)}
              >
                <option value="automatic">Automatic</option>
                <option value="cloudflare">Cloudflare</option>
                <option value="google">Google</option>
                <option value="quad9">Quad9</option>
              </select>
            </label>

            <button
              className="primary-button"
              onClick={async () => {
                try {
                  setActionMessage("Applying optimization...");
                  const result = await applyOptimization(
                    mode,
                    dnsProfile,
                  );
                  setActionMessage(result.message);
                  await loadStatus();
                } catch (requestError) {
                  setActionMessage(
                    requestError instanceof Error
                      ? requestError.message
                      : "Optimization failed",
                  );
                }
              }}
            >
              Apply optimization
            </button>

            <button
              className="secondary-button speed-button"
              disabled={speedTesting}
              onClick={async () => {
                try {
                  setSpeedTesting(true);
                  setActionMessage("Running download speed test...");
                  const result = await runSpeedTest();
                  setActionMessage(
                    `Download measured at ${result.downloadMbps} Mbps`,
                  );
                  await loadStatus();
                } catch (requestError) {
                  setActionMessage(
                    requestError instanceof Error
                      ? requestError.message
                      : "Speed test failed",
                  );
                } finally {
                  setSpeedTesting(false);
                }
              }}
            >
              {speedTesting ? "Testing..." : "Run speed test"}
            </button>

            <p className="action-message">{actionMessage}</p>

            <div className="control-status">
              <div>
                <span>Automatic failover</span>
                <strong>
                  {status?.booster.failoverEnabled
                    ? 'Enabled'
                    : 'Disabled'}
                </strong>
              </div>

              <div>
                <span>Multi-link bonding</span>
                <strong>
                  {status?.booster.bondingEnabled
                    ? 'Enabled'
                    : 'Not configured'}
                </strong>
              </div>
            </div>
          </article>
        </section>

        <OptimizerPanel
          adapters={(status?.adapters ?? []).map(
            (adapter) => adapter.name,
          )}
        />

        <BondingPanel />        <RelayPanel />

        <SteeringPanel />        <AnalyticsPanel />        <MultiMetricPanel />        <FailoverPanel />        <AlertsPanel />        <TrafficPanel />        <QosPanel />        <QosProfilesPanel />        <CloudAgentPanel />
        <FleetPanel />        <RemoteDiagnosticsPanel />

        <ResourcePressurePanel />        <RemoteActionsPanel />        <FleetAlertsPanel />        <ResourceOptimizerPanel />`r`n`r`n        <section className="card system-card">
          <div>
            <p className="section-label">SYSTEM</p>
            <h2>{status?.computer.hostname ?? 'Unknown computer'}</h2>
          </div>

          <div>
            <span>Platform</span>
            <strong>{status?.computer.platform ?? '--'}</strong>
          </div>

          <div>
            <span>System uptime</span>
            <strong>
              {status
                ? formatUptime(status.computer.uptimeSeconds)
                : '--'}
            </strong>
          </div>

          <div>
            <span>Last update</span>
            <strong>
              {status
                ? new Date(status.timestamp).toLocaleTimeString()
                : '--'}
            </strong>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

































