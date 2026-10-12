import type { SiteId } from '../data';

export interface SiteOption {
  id: SiteId;
  code: string;
  name: string;
  city: string;
}

interface Props {
  sites: SiteOption[];
  activeId: SiteId;
  onSelectSite: (id: SiteId) => void;
  clock: string;
  date: string;
}

/** Brand, site selector and live clock. */
export function TopBar({ sites, activeId, onSelectSite, clock, date }: Props) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__mark" aria-hidden />
        <div>
          <div className="topbar__name">
            Ware<span>Track</span>
          </div>
          <div className="topbar__tagline">Warehouse operations</div>
        </div>
      </div>

      <nav className="site-select" aria-label="Site">
        {sites.map((s) => (
          <button
            key={s.id}
            className="site-select__option"
            aria-pressed={s.id === activeId}
            onClick={() => onSelectSite(s.id)}
            title={s.name}
          >
            <span className="site-select__code">{s.code}</span>
            <span className="site-select__city">{s.city}</span>
          </button>
        ))}
      </nav>

      <div className="topbar__clock" title="Simulated time (60× real time)">
        <span className="live-dot" />
        <span className="topbar__live">Live</span>
        <span className="topbar__time">{clock}</span>
        <span className="topbar__date">{date}</span>
      </div>
    </header>
  );
}
