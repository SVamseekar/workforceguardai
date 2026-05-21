import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'

type AnyObj = Record<string, unknown>

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ value: unknown }>
  label?: string
  unit?: string
}

function ChartTooltip({ active, payload, label, unit = '%' }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">{label}</p>
      <p className="chart-tooltip__value">
        {unit === '%' ? `${Number(payload[0].value).toFixed(1)}%` : String(payload[0].value)}
      </p>
    </div>
  )
}

interface MetricChartProps {
  chartType: 'line' | 'bar'
  data: AnyObj[]
  dataKey?: string
  xKey?: string
  unit?: string
  color?: string
  referenceValue?: number
  referenceLabel?: string
}

export function MetricChart({
  chartType,
  data,
  dataKey = 'value',
  xKey = 'period',
  unit = '%',
  color = '#7ff4ea',
  referenceValue,
  referenceLabel,
}: MetricChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {chartType === 'line' ? (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit={unit} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          {referenceValue != null && (
            <ReferenceLine
              y={referenceValue}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: referenceLabel ?? `EU avg ${referenceValue.toFixed(1)}${unit}`, fill: 'var(--text-muted)', fontSize: 10, position: 'insideTopRight' }}
            />
          )}
        </LineChart>
      ) : (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit={unit} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
          {referenceValue != null && (
            <ReferenceLine
              y={referenceValue}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: referenceLabel ?? `EU avg ${referenceValue.toFixed(1)}${unit}`, fill: 'var(--text-muted)', fontSize: 10, position: 'insideTopRight' }}
            />
          )}
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}
