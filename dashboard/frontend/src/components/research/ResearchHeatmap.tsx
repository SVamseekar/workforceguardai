type HeatmapCell = {
  geo_id: string
  country_label: string
  sector_id: string
  gender_pay_gap: number
}

type HeatmapSector = { id: string; label: string }

function gpgColor(value: number): string {
  if (value >= 25) return 'rgba(239, 68, 68, 0.85)'
  if (value >= 18) return 'rgba(245, 158, 11, 0.8)'
  if (value >= 10) return 'rgba(59, 130, 246, 0.65)'
  if (value >= 0) return 'rgba(16, 185, 129, 0.55)'
  return 'rgba(148, 163, 184, 0.45)'
}

export function ResearchHeatmap({
  sectors,
  cells,
}: {
  sectors: HeatmapSector[]
  cells: HeatmapCell[]
}) {
  const countries = [...new Map(cells.map((cell) => [cell.geo_id, cell.country_label])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))

  const lookup = new Map<string, number>()
  cells.forEach((cell) => lookup.set(`${cell.geo_id}:${cell.sector_id}`, cell.gender_pay_gap))

  return (
    <div className="research-heatmap">
      <div className="research-heatmap__scroll">
        <table className="research-heatmap__table">
          <thead>
            <tr>
              <th scope="col">Country</th>
              {sectors.map((sector) => (
                <th key={sector.id} scope="col">{sector.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {countries.map(([geoId, label]) => (
              <tr key={geoId}>
                <th scope="row">{label}</th>
                {sectors.map((sector) => {
                  const value = lookup.get(`${geoId}:${sector.id}`)
                  if (value == null) {
                    return <td key={sector.id} className="research-heatmap__missing">—</td>
                  }
                  return (
                    <td
                      key={sector.id}
                      className="research-heatmap__cell"
                      style={{ background: gpgColor(value) }}
                      title={`${label} · ${sector.label}: ${value.toFixed(1)}%`}
                    >
                      {value.toFixed(1)}%
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
