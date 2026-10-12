interface Props {
  legend: [label: string, color: string][];
}

/** Bottom bar: simulation status, legend and controls. */
export function StatusBar({ legend }: Props) {
  return (
    <footer className="statusbar">
      <div className="statusbar__status">
        <span className="live-dot" />
        Simulation running · 60× · updates every 2 s
      </div>
      <ul className="statusbar__legend">
        {legend.map(([label, color]) => (
          <li key={label}>
            <span className="legend__swatch" style={{ background: color }} />
            {label}
          </li>
        ))}
      </ul>
      <div className="statusbar__hint">Click to inspect · Drag to pan · Scroll to zoom · Esc to close</div>
    </footer>
  );
}
