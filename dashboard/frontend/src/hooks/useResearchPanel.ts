import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export type ResearchPanel = {
  panel: {
    countries: number
    sectors: number
    year_range: string
    all_sector_id?: string
    employment_gpg_correlation: number | null
    eu27_gpg_mean: number | null
    eu27_finance_gpg_mean: number | null
  }
  figures: {
    tightness_gpg_scatter: {
      title: string
      points: Array<{
        geo_id: string
        country_label: string
        employment_rate: number
        gender_pay_gap: number
        finance_gpg: number | null
        period: string
      }>
      correlation: number | null
    }
    risk_quadrant: {
      title: string
      points: Array<{
        geo_id: string
        country_label: string
        hpi: number
        ers: number
        finance_gpg: number | null
      }>
    }
    sector_heatmap: {
      title: string
      sectors: Array<{ id: string; label: string }>
      cells: Array<{
        geo_id: string
        country_label: string
        sector_id: string
        sector_label: string
        gender_pay_gap: number
      }>
    }
    finance_vs_overall: {
      title: string
      rows: Array<{
        geo_id: string
        country_label: string
        overall_gpg: number
        finance_gpg: number
        finance_premium_pp: number
      }>
    }
    employment_trajectories: {
      title: string
      group_id: string
      group_label: string
      note: string
      groups: Array<{ id: string; label: string }>
      series: Array<{
        geo_id: string
        country_label: string
        series: Array<{ period: string; value: number }>
      }>
    }
  }
  insights: Array<{
    id: string
    title: string
    summary: string
    detail: string
    countries: string[]
  }>
}

export function useResearchPanel(trajectoryGroup: string) {
  return useQuery({
    queryKey: ['research-panel', trajectoryGroup],
    queryFn: async () => {
      const response = await api.get<ResearchPanel>('/research/panel', {
        params: { trajectory_group: trajectoryGroup },
      })
      return response.data
    },
    staleTime: 5 * 60_000,
  })
}
