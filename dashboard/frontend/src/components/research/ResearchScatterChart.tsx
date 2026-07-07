import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ZAxis, Cell,
} from 'recharts'

type ScatterPoint = Record<string, string | number | null | undefined> & {
  geo_id: string
  country_label: string
}

function ScatterTooltip({
  active,
  payload,
  xKey,
  yKey,
  xUnit = '',
  yUnit = '',
}: {
  active?: boolean
  payload?: Array<{ payload: ScatterPoint }>
  xKey: string
  yKey: string
  xUnit?: string
  yUnit?: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const xValue = Number(point[xKey])
  const yValue = Number(point[yKey])
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">{point.country_label} ({point.geo_id})</p>
      <p className="chart-tooltip__value">{xKey}: {xValue.toFixed(1)}{xUnit}</p>
      <p className="chart-tooltip__value">{yKey}: {yValue.toFixed(1)}{yUnit}</p>
      {point.finance_gpg != null && (
        <p className="chart-tooltip__value">Finance {Number(point.finance_gpg).toFixed(1)}%</p>
      )}
    </div>
  )
}

export function ResearchScatterChart({
  points,
  xKey,
  yKey,
  zKey,
  correlation,
  xUnit = '',
  yUnit = '',
}: {
  points: ScatterPoint[]
  xKey: string
  yKey: string
  zKey?: string
  correlation?: number | null
  xUnit?: string
  yUnit?: string
}) {
  const data = points.map((point) => ({
    ...point,
    z: zKey && point[zKey] != null ? Number(point[zKey]) : 12,
  }))

  return (
    <div className="research-chart-wrap">
      {correlation != null && (
        <p className="research-chart-meta">Pearson r ≈ {correlation.toFixed(2)} · n={points.length}</p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            type="number"
            dataKey={xKey}
            name={xKey}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            unit={xUnit}
          />
          <YAxis
            type="number"
            dataKey={yKey}
            name={yKey}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            unit={yUnit}
          />
          <ZAxis type="number" dataKey="z" range={[48, 220]} />
          <Tooltip content={<ScatterTooltip xKey={xKey} yKey={yKey} xUnit={xUnit} yUnit={yUnit} />} />
          <Scatter data={data} fill="var(--accent-primary)">
            {data.map((entry) => (
              <Cell key={entry.geo_id} fill="var(--accent-teal)" />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
