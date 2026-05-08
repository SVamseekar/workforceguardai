-- Aggregates UK GPG by year + size band.
-- Only published when company_count >= 5.
with base as (
    select *
    from {{ ref('stg_public_company__uk_gpg') }}
    where size_band != 'unknown'
),

aggregated as (
    select
        year,
        country_code,
        size_band,
        count(*) as company_count,
        percentile_cont(0.25) within group (order by median_pay_gap) as p25_median_gap,
        percentile_cont(0.50) within group (order by median_pay_gap) as p50_median_gap,
        percentile_cont(0.75) within group (order by median_pay_gap) as p75_median_gap,
        avg(median_pay_gap) as mean_median_gap
    from base
    group by 1, 2, 3
)

select *
from aggregated
where company_count >= 5
