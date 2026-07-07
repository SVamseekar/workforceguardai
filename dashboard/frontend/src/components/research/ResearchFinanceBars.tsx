import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

type FinanceRow = {
  geo_id: string
  country_label: string
  overall_gpg: number
  finance_gpg: number
}

export function ResearchFinanceBars({ rows }: { rows: FinanceRow[] }) {
  const top = rows.slice(0, 12).map((row) => ({
    code: row.geo_id,
    label: row.country_label,
    overall: row.overall_gpg,
    finance: row.finance_gpg,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={top} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="code" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" />
        <Tooltip
          formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`}
          labelFormatter={(label) => top.find((row) => row.code === label)?.label ?? String(label)}
        />
        <Legend />
        <Bar dataKey="overall" name="All sectors" fill="var(--accent-primary)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="finance" name="Finance (K)" fill="var(--tone-watch)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
