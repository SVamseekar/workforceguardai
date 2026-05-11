import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
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
}

export function MetricChart({
  chartType,
  data,
  dataKey = 'value',
  xKey = 'period',
  unit = '%',
  color = '#7ff4ea',
}: MetricChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {chartType === 'line' ? (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(159,185,214,0.08)" />
          <XAxis dataKey={xKey} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit={unit} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      ) : (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(159,185,214,0.08)" />
          <XAxis dataKey={xKey} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit={unit} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}
