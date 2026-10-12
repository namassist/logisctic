import type { EntityDetails, Tone } from '../state/details';

interface Props {
  details: EntityDetails;
  onClose: () => void;
}

/** Side panel for the selected object. Purely presentational. */
export function InspectorPanel({ details, onClose }: Props) {
  const { shipment } = details;
  return (
    <aside className="inspector" aria-label={`${details.kind} ${details.title}`}>
      <header className="inspector__header">
        <div className="inspector__heading">
          <span className="inspector__kind">{details.kind}</span>
          <h2 className="inspector__title">{details.title}</h2>
          <p className="inspector__subtitle">{details.subtitle}</p>
        </div>
        <button className="inspector__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <div className="inspector__state">
        <Badge tone={details.state.tone}>{details.state.label}</Badge>
      </div>

      <section className="inspector__section">
        <h3>{shipment?.heading ?? 'Shipment'}</h3>
        {shipment ? (
          <div className="shipment">
            <div className="shipment__top">
              <span className="shipment__id">{shipment.id}</span>
              <span className="shipment__direction">{shipment.direction}</span>
              <Badge tone={shipment.status.tone}>{shipment.status.label}</Badge>
            </div>
            <div className="shipment__route">
              <span>{shipment.from}</span>
              <span className="shipment__arrow">→</span>
              <span>{shipment.to}</span>
            </div>
            {shipment.progress !== null && (
              <div className="progress-row">
                <span className="progress-row__label">{shipment.progressLabel}</span>
                <div className="progress">
                  <div className="progress__bar" style={{ width: `${shipment.progress * 100}%` }} />
                </div>
                <span className="progress-row__value">{Math.round(shipment.progress * 100)}%</span>
              </div>
            )}
            <div className="shipment__meta">
              <span>{shipment.timing}</span>
              <Badge tone={shipment.delay.tone} subtle>
                {shipment.delay.label}
              </Badge>
            </div>
            <div className="shipment__load">{shipment.load}</div>
          </div>
        ) : (
          <p className="inspector__empty">{details.noShipment}</p>
        )}
      </section>

      <section className="inspector__section">
        <h3>Details</h3>
        <dl className="fields">
          {details.fields.map((f) => (
            <div key={f.label} className="fields__row">
              <dt>{f.label}</dt>
              <dd className={f.tone ? `tone-text--${f.tone}` : undefined}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {details.list && (
        <section className="inspector__section">
          <h3>{details.list.heading}</h3>
          {details.list.rows.length ? (
            <dl className="fields">
              {details.list.rows.map((r) => (
                <div key={r.label} className="fields__row">
                  <dt>{r.label}</dt>
                  <dd className={r.tone ? `tone-text--${r.tone}` : undefined}>{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="inspector__empty">Empty</p>
          )}
        </section>
      )}

      <footer className="inspector__footer">
        <span className="live-dot" />
        Last update
        {/* Keyed so the flash animation replays whenever the time changes */}
        <time key={details.updatedAt} className="inspector__updated" dateTime={details.updatedAt}>
          {details.updatedLabel}
        </time>
      </footer>
    </aside>
  );
}

function Badge({ tone, subtle, children }: { tone: Tone; subtle?: boolean; children: string }) {
  return <span className={`badge badge--${tone}${subtle ? ' badge--subtle' : ''}`}>{children}</span>;
}
