import {
  useEffect,
  useState,
} from 'react';

const API =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000';

function safeDate(
  value: unknown,
) {
  if (!value) {
    return '--';
  }

  const date =
    new Date(
      String(value),
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? String(value)
    : date.toLocaleString();
}

export function FleetAlertsPanel() {
  const [
    active,
    setActive,
  ] =
    useState<any[]>([]);

  const [
    history,
    setHistory,
  ] =
    useState<any[]>([]);

  const [
    sourceCount,
    setSourceCount,
  ] =
    useState(0);

  const [
    message,
    setMessage,
  ] =
    useState('');

  async function load() {
    try {
      const response =
        await fetch(
          `${API}/api/fleet/alerts`,
          {
            cache:
              'no-store',
          },
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await response.text(),
        );
      }

      const data =
        await response.json();

      setActive(
        data.active ??
          [],
      );

      setHistory(
        data.history ??
          [],
      );

      setSourceCount(
        data.sourceCount ??
          0,
      );
    } catch (error) {
      setMessage(
        String(error),
      );
    }
  }

  async function action(
    alert: any,
    type:
      | 'acknowledge'
      | 'resolve',
  ) {
    try {
      const response =
        await fetch(
          `${API}/api/fleet/alerts/${type}`,
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                id:
                  alert.id,
                incidentKey:
                  alert.incidentKey,
              }),
          },
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await response.text(),
        );
      }

      const result =
        await response.json();

      setMessage(
        result.message ??
          'Incident updated.',
      );

      await load();
    } catch (error) {
      setMessage(
        String(error),
      );
    }
  }

  useEffect(
    () => {
      void load();

      const timer =
        setInterval(
          () =>
            void load(),
          15000,
        );

      return () =>
        clearInterval(
          timer,
        );
    },
    [],
  );

  return (
    <section className="card fleet-alerts-card">
      <div className="card-header">
        <div>
          <p className="section-label">
            FLEET INCIDENTS
          </p>

          <h2>
            Cloud alert lifecycle
          </h2>
        </div>

        <span className="optimizer-live-badge">
          {active.length} ACTIVE
        </span>
      </div>

      <p className="traffic-note">
        Cloud records: {sourceCount}. NNIT groups repeated records by device and incident type.
      </p>

      <div className="fleet-alert-list">
        {active.map(
          (alert) => (
            <article
              className="fleet-alert-row"
              key={
                alert.incidentKey
              }
            >
              <div>
                <strong>
                  {alert.type}
                </strong>

                <span>
                  {alert.severity} - {alert.status}
                </span>

                <p>
                  {alert.message}
                </p>

                <small>
                  {safeDate(
                    alert.updatedAt,
                  )}
                </small>
              </div>

              <div className="fleet-alert-actions">
                {alert.status ===
                  'open' && (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      action(
                        alert,
                        'acknowledge',
                      )
                    }
                  >
                    Acknowledge
                  </button>
                )}

                <button
                  className="secondary-button"
                  onClick={() =>
                    action(
                      alert,
                      'resolve',
                    )
                  }
                >
                  Resolve
                </button>
              </div>
            </article>
          ),
        )}

        {!active.length && (
          <p className="empty-state">
            No active fleet incidents.
          </p>
        )}
      </div>

      {history.length > 0 && (
        <details className="fleet-history">
          <summary>
            Resolved incident history ({history.length})
          </summary>

          <div className="fleet-alert-list">
            {history.map(
              (alert) => (
                <article
                  className="fleet-alert-row"
                  key={
                    `history-${alert.incidentKey}`
                  }
                >
                  <div>
                    <strong>
                      {alert.type}
                    </strong>

                    <span>
                      {alert.severity} - {alert.status}
                    </span>

                    <p>
                      {alert.message}
                    </p>

                    <small>
                      {safeDate(
                        alert.updatedAt,
                      )}
                    </small>
                  </div>
                </article>
              ),
            )}
          </div>
        </details>
      )}

      <p className="action-message">
        {message}
      </p>
    </section>
  );
}

