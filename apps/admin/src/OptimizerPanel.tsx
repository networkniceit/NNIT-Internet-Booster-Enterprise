import { useEffect, useState } from 'react';

interface OptimizerTelemetry {
  timestamp: string;
  online: boolean;
  latencyMs: number | null;
  packetLoss: number;
  score: number;
  activeAdapter: string | null;
  settings: {
    enabled: boolean;
    automaticFailover: boolean;
    minimumScore: number;
    preferredAdapter: string;
    probeIntervalMs: number;
  };
}

interface OptimizerPanelProps {
  adapters: string[];
}

const API_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000';

export function OptimizerPanel({
  adapters,
}: OptimizerPanelProps) {
  const [telemetry, setTelemetry] =
    useState<OptimizerTelemetry | null>(null);

  const [
    automaticFailover,
    setAutomaticFailover,
  ] = useState(false);

  const [minimumScore, setMinimumScore] =
    useState(45);

  const [
    preferredAdapter,
    setPreferredAdapter,
  ] = useState('');

  const [message, setMessage] =
    useState('');

  async function loadTelemetry() {
    try {
      const response = await fetch(
        `${API_URL}/api/optimizer/status`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`,
        );
      }

      const value =
        (await response.json()) as OptimizerTelemetry;

      setTelemetry(value);
      setAutomaticFailover(
        value.settings.automaticFailover,
      );
      setMinimumScore(
        value.settings.minimumScore,
      );
      setPreferredAdapter(
        value.settings.preferredAdapter,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Optimizer connection failed: ${error.message}`
          : 'Optimizer connection failed.',
      );
    }
  }

  async function saveSettings() {
    try {
      setMessage(
        'Saving optimizer settings...',
      );

      const response = await fetch(
        `${API_URL}/api/optimizer/settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            automaticFailover,
            minimumScore,
            preferredAdapter,
            probeIntervalMs: 5000,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`,
        );
      }

      setMessage(
        'Optimizer settings saved.',
      );

      await loadTelemetry();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Optimizer update failed.',
      );
    }
  }

  useEffect(() => {
    void loadTelemetry();

    const timer = window.setInterval(
      () => {
        void loadTelemetry();
      },
      5000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="card optimizer-live-card">
      <div className="card-header">
        <div>
          <p className="section-label">
            LIVE OPTIMIZER ENGINE
          </p>

          <h2>
            Automatic network control
          </h2>
        </div>

        <span
          className={`optimizer-live-badge ${
            telemetry?.online
              ? 'online'
              : 'offline'
          }`}
        >
          {telemetry?.online
            ? 'LIVE'
            : 'OFFLINE'}
        </span>
      </div>

      <div className="optimizer-live-grid">
        <div className="optimizer-stat">
          <span>Live score</span>
          <strong>
            {telemetry?.score ?? '--'}
          </strong>
        </div>

        <div className="optimizer-stat">
          <span>Live latency</span>
          <strong>
            {telemetry?.latencyMs ??
              '--'}{' '}
            ms
          </strong>
        </div>

        <div className="optimizer-stat">
          <span>Packet loss</span>
          <strong>
            {telemetry?.packetLoss ??
              '--'}
            %
          </strong>
        </div>

        <div className="optimizer-stat">
          <span>Active route</span>
          <strong>
            {telemetry?.activeAdapter ??
              '--'}
          </strong>
        </div>
      </div>

      <div className="optimizer-settings-grid">
        <label className="optimizer-switch">
          <input
            type="checkbox"
            checked={automaticFailover}
            onChange={(event) =>
              setAutomaticFailover(
                event.target.checked,
              )
            }
          />

          <span>
            Automatic failover
          </span>
        </label>

        <label>
          Minimum acceptable score

          <input
            type="number"
            min="1"
            max="100"
            value={minimumScore}
            onChange={(event) =>
              setMinimumScore(
                Number(
                  event.target.value,
                ),
              )
            }
          />
        </label>

        <label>
          Preferred adapter

          <select
            value={preferredAdapter}
            onChange={(event) =>
              setPreferredAdapter(
                event.target.value,
              )
            }
          >
            <option value="">
              Automatic
            </option>

            {adapters.map(
              (adapter) => (
                <option
                  key={adapter}
                  value={adapter}
                >
                  {adapter}
                </option>
              ),
            )}
          </select>
        </label>

        <button
          className="primary-button"
          onClick={saveSettings}
        >
          Save optimizer settings
        </button>
      </div>

      <p className="action-message">
        {message}
      </p>
    </section>
  );
}



