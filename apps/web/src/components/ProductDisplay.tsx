import type { ReactNode } from "react";

export function ProductHero({ label, title, description, example = false, identifier = false, actions }: {
  label: string;
  title: string;
  description?: ReactNode;
  example?: boolean;
  identifier?: boolean;
  actions?: ReactNode;
}) {
  return (
    <header className={`product-hero${identifier ? " product-hero-id" : ""}`}>
      <div className="product-hero-content">
        <div className="product-hero-meta">
          <span>{label}</span>
          <span className="product-network">{example ? "Datos ilustrativos" : "Stellar Testnet"}</span>
        </div>
        <h1 className={identifier ? "mono" : undefined}>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="product-hero-actions">{actions}</div>}
    </header>
  );
}

export function ProductMetrics({ items, label }: {
  items: { label: string; value: ReactNode; note?: string }[];
  label: string;
}) {
  return (
    <dl className="product-metrics" aria-label={label}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.note && <dd className="product-metric-note">{item.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
