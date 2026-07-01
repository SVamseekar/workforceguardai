import { LANDING_FACTS, type CountrySample } from '../landingFacts'
import { SectionLabel } from './SectionLabel'

function fmtPct(value: number) {
  return `${value}%`
}

function fmtOptional(value: number | undefined, suffix = '') {
  return value === undefined ? '—' : `${value}${suffix}`
}

export function CountrySamplePanel() {
  const { countrySamples, research } = LANDING_FACTS

  return (
    <section className="landing-section landing-reveal">
      <div className="landing-section__header">
        <SectionLabel>Live pipeline sample</SectionLabel>
        <h2>Finance sector gaps and composite indices by country</h2>
        <p className="landing-section__lede">
          Pulled from the local DuckDB mart after dbt run — Eurostat SES gender pay gap (NACE K) alongside
          Hiring Pressure and Equity Risk scores. EU27 finance average: {research.eu27FinanceSectorGapPct}%.
        </p>
      </div>

      <div className="landing-country-table-wrap">
        <table className="landing-country-table">
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col">Finance GPG</th>
              <th scope="col">HPI</th>
              <th scope="col">ERS</th>
              <th scope="col">Employment</th>
              <th scope="col">Period</th>
            </tr>
          </thead>
          <tbody>
            {countrySamples.map((row: CountrySample) => (
              <tr key={row.code}>
                <th scope="row">
                  <span className="landing-country-table__code">{row.code}</span>
                  {row.name}
                </th>
                <td>{fmtPct(row.financeGpgPct)}</td>
                <td>{row.hpi}</td>
                <td>{row.ers}</td>
                <td>{fmtOptional('employmentRatePct' in row ? row.employmentRatePct : undefined, '%')}</td>
                <td className="landing-country-table__period">{row.period}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
