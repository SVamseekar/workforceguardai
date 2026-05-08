-- Aggregates Égapro scores by year + NACE section + size band.
-- Only published when company_count >= 5 (privacy threshold).
with base as (
    select *
    from {{ ref('stg_public_company__egapro') }}
    where nace_section is not null
      and size_band != 'unknown'
),

aggregated as (
    select
        year,
        nace_section,
        size_band,
        count(*) as company_count,
        percentile_cont(0.25) within group (order by index_score) as p25_score,
        percentile_cont(0.50) within group (order by index_score) as p50_score,
        percentile_cont(0.75) within group (order by index_score) as p75_score,
        avg(index_score) as mean_score,
        percentile_cont(0.50) within group (order by score_pay_gap) as p50_pay_gap_score,
        percentile_cont(0.50) within group (order by score_top_earners) as p50_top_earners_score
    from base
    group by 1, 2, 3
)

-- Only expose rows with at least 5 companies (data suppression)
select *
from aggregated
where company_count >= 5
