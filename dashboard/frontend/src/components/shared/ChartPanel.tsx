const SOURCE_LABELS = {
  eurostat_lfs: 'Eurostat LFS',
  eurostat_jvs: 'Eurostat JVS',
  eurostat_ses: 'Eurostat SES',
}

export function ChartPanel({ title, sourceId, children }) {
  return (
    <div className="panel">
      <div className="panel__header panel__header--tight">
        <div>
          <p className="panel__eyebrow">
            {sourceId ? SOURCE_LABELS[sourceId] ?? sourceId : 'Market data'}
          </p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="panel__body panel__body--chart">
        {children}
      </div>
    </div>
  )
}
