import { useEffect, useState } from 'react';

interface RelayStatus {
  relayUrl: string;
  clientName: string;
  sessionId: string;
  token: string;
  connected: boolean;
  lastHeartbeatAt: string | null;
}

interface RelayTest {
  linkName: string;
  successCount: number;
  count: number;
  averageRoundTripMs: number | null;
}

const API_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000';

export function RelayPanel() {
  const [status, setStatus] =
    useState<RelayStatus | null>(null);

  const [relayUrl, setRelayUrl] =
    useState('http://localhost:4500');

  const [linkName, setLinkName] =
    useState('Wi-Fi');

  const [test, setTest] =
    useState<RelayTest | null>(null);

  const [message, setMessage] =
    useState('');

  async function loadStatus() {
    try {
      const response = await fetch(
        `${API_URL}/api/relay/status`,
        { cache: 'no-store' },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const value =
        (await response.json()) as RelayStatus;

      setStatus(value);
      setRelayUrl(value.relayUrl);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Relay status failed.',
      );
    }
  }

  async function createSession() {
    try {
      setMessage('Creating relay session...');

      const response = await fetch(
        `${API_URL}/api/relay/session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ relayUrl }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await loadStatus();
      setMessage('Relay session connected.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Relay connection failed.',
      );
    }
  }

  async function heartbeat() {
    try {
      setMessage('Sending heartbeat...');

      const response = await fetch(
        `${API_URL}/api/relay/heartbeat`,
        { method: 'POST' },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await loadStatus();
      setMessage('Relay heartbeat successful.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Heartbeat failed.',
      );
    }
  }

  async function testPath() {
    try {
      setMessage('Testing UDP relay path...');

      const response = await fetch(
        `${API_URL}/api/relay/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            linkName,
            count: 5,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const value =
        (await response.json()) as RelayTest;

      setTest(value);
      setMessage('Relay path test completed.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Relay path test failed.',
      );
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  return (
    <section className="card relay-panel-card">
      <div className="card-header">
        <div>
          <p className="section-label">
            NNIT RELAY CONTROL
          </p>
          <h2>Relay session and path diagnostics</h2>
        </div>

        <span
          className={`optimizer-live-badge ${
            status?.connected
              ? 'online'
              : 'offline'
          }`}
        >
          {status?.connected
            ? 'CONNECTED'
            : 'DISCONNECTED'}
        </span>
      </div>

      <div className="relay-grid">
        <label>
          Relay URL
          <input
            value={relayUrl}
            onChange={(event) =>
              setRelayUrl(event.target.value)
            }
          />
        </label>

        <label>
          Link name
          <input
            value={linkName}
            onChange={(event) =>
              setLinkName(event.target.value)
            }
          />
        </label>

        <button
          className="primary-button"
          onClick={createSession}
        >
          Create relay session
        </button>

        <button
          className="secondary-button"
          onClick={heartbeat}
        >
          Send heartbeat
        </button>

        <button
          className="secondary-button"
          onClick={testPath}
        >
          Test relay path
        </button>
      </div>

      <div className="relay-status-grid">
        <div>
          <span>Session</span>
          <strong>
            {status?.sessionId
              ? status.sessionId.slice(0, 8)
              : '--'}
          </strong>
        </div>

        <div>
          <span>Client</span>
          <strong>
            {status?.clientName ?? '--'}
          </strong>
        </div>

        <div>
          <span>Last heartbeat</span>
          <strong>
            {status?.lastHeartbeatAt
              ? new Date(
                  status.lastHeartbeatAt,
                ).toLocaleTimeString()
              : '--'}
          </strong>
        </div>

        <div>
          <span>UDP success</span>
          <strong>
            {test
              ? `${test.successCount}/${test.count}`
              : '--'}
          </strong>
        </div>

        <div>
          <span>Average UDP RTT</span>
          <strong>
            {test?.averageRoundTripMs ??
              '--'}{' '}
            ms
          </strong>
        </div>
      </div>

      <p className="action-message">
        {message}
      </p>
    </section>
  );
}
