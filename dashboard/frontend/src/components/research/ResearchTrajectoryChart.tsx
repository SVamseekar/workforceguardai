import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

const LINE_COLORS = [
  'var(--accent-primary)',
  'var(--accent-teal)',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
]

type TrajectorySeries = {
  geo_id: string
  country_label: string
  series: Array<{ period: string; value: number }>
}

export function ResearchTrajectoryChart({ series }: { series: TrajectorySeries[] }) {
  const periods = [...new Set(series.flatMap((item) => item.series.map((row) => row.period)))].sort()
  const chartData = periods.map((period) => {
    const row: Record<string, string | number> = { period }
    series.forEach((item) => {
      const match = item.series.find((point) => point.period === period)
      if (match) row[item.geo_id] = match.value
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" domain={['auto', 'auto']} />
        <Tooltip
          formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`}
          contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}
        />
        <Legend />
        {series.map((item, index) => (
          <Line
            key={item.geo_id}
            type="monotone"
            dataKey={item.geo_id}
            name={item.country_label}
            stroke={LINE_COLORS[index % LINE_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
