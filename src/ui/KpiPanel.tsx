import type { InventoryItemId } from '../data';
import type { KpiView } from '../state/kpis';

interface Props {
  siteName: string;
  view: KpiView;
  onPickItem: (id: InventoryItemId) => void;
}

const MAX_ALERTS = 4;

/** Site KPI cards plus the low-stock alert list. */
export function KpiPanel({ siteName, view, onPickItem }: Props) {
  const shown = view.lowStock.slice(0, MAX_ALERTS);
  return (
    <section className="panel kpis" aria-label="Site KPIs">
      <header className="panel__header">
        <h2>Site KPIs</h2>
        <span className="panel__meta">{siteName}</span>
      </header>
      <div className="kpis__grid">
        {view.cards.map((card) => (
          <div key={card.id} className={`kpi kpi--${card.tone}`} title={card.definition}>
            <div className="kpi__label">{card.label}</div>
            <div className="kpi__value">{card.value}</div>
            {card.meter !== null && (
              <div className="kpi__meter">
                <div className="kpi__meter-fill" style={{ width: `${Math.round(card.meter * 100)}%` }} />
              </div>
            )}
            <div className="kpi__detail">{card.detail}</div>
          </div>
        ))}
      </div>
      {shown.length > 0 && (
        <ul className="alerts">
          {shown.map((row) => (
            <li key={row.itemId}>
              <button className={`alerts__row tone-border--${row.tone}`} onClick={() => onPickItem(row.itemId)}>
                <span className="alerts__name">{row.name}</span>
                <span className={`alerts__level tone-text--${row.tone}`}>{row.level}</span>
              </button>
            </li>
          ))}
          {view.lowStock.length > MAX_ALERTS && (
            <li className="alerts__more">+{view.lowStock.length - MAX_ALERTS} more</li>
          )}
        </ul>
      )}
    </section>
  );
}
