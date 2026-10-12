import type { TruckFilters, FilterResult, StatusOption } from '../state/filters';

interface Props {
  filters: TruckFilters;
  onChange: (patch: Partial<TruckFilters>) => void;
  statusOptions: StatusOption[];
  delayedCount: number;
  results: FilterResult[];
  onPickResult: (row: FilterResult) => void;
}

/** Truck filters for the scene, with the matching trucks listed. */
export function FilterPanel({ filters, onChange, statusOptions, delayedCount, results, onPickResult }: Props) {
  const active = filters.delayedOnly || filters.status !== 'all';
  return (
    <section className="panel filters" aria-label="Filters">
      <header className="panel__header">
        <h2>Filters</h2>
        {active && (
          <button className="panel__action" onClick={() => onChange({ delayedOnly: false, status: 'all' })}>
            Clear
          </button>
        )}
      </header>

      <label className="switch">
        <input
          type="checkbox"
          checked={filters.delayedOnly}
          onChange={(e) => onChange({ delayedOnly: e.target.checked })}
        />
        <span className="switch__track" aria-hidden />
        <span className="switch__label">Delayed shipments only</span>
        <span className="count">{delayedCount}</span>
      </label>

      <div className="filters__group">
        <div className="filters__caption">Truck status</div>
        <div className="chips" role="group" aria-label="Truck status">
          {statusOptions.map((o) => (
            <button
              key={o.value}
              aria-pressed={filters.status === o.value}
              className="chip"
              onClick={() => onChange({ status: o.value })}
            >
              {o.label}
              <span className="chip__count">{o.count}</span>
            </button>
          ))}
        </div>
      </div>

      {active && (
        <div className="results">
          <div className="filters__caption">
            {results.length} matching truck{results.length === 1 ? '' : 's'}
          </div>
          {results.length ? (
            <ul className="results__list">
              {results.map((r) => (
                <li key={r.truckId}>
                  <button className="results__row" onClick={() => onPickResult(r)}>
                    <span className="results__id">{r.truckId}</span>
                    <span className={`badge badge--subtle badge--${r.state.tone}`}>{r.state.label}</span>
                    <span className="results__where">{r.location}</span>
                    {r.lateLabel && <span className="results__late">{r.lateLabel}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="results__empty">No trucks match right now.</p>
          )}
        </div>
      )}
    </section>
  );
}
