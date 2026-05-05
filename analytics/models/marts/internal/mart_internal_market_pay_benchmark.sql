with latest_market_period as (
    select max(period_code) as period_code
    from {{ ref('fct_labour_market_region_sector') }}
    where signal_name = 'gender_pay_gap'
),

market_candidates as (
    select
        geo_id as country_code,
        sector_id,
        period_code,
        signal_value as market_gender_pay_gap,
        case
            when sector_id = 'B-S' then 1
            when sector_id = 'A-S' then 2
            else 3
        end as sector_rank
    from {{ ref('fct_labour_market_region_sector') }}
    where signal_name = 'gender_pay_gap'
      and period_code = (select period_code from latest_market_period)
      and sector_id in ('B-S', 'A-S')
),

market_benchmark as (
    select
        country_code,
        sector_id as market_sector_id,
        period_code as market_period_code,
        market_gender_pay_gap
    from (
        select
            *,
            row_number() over (
                partition by country_code
                order by sector_rank, sector_id
            ) as benchmark_rank
        from market_candidates
    )
    where benchmark_rank = 1
),

latest_internal_snapshot as (
    select max(snapshot_date) as snapshot_date
    from {{ ref('fct_internal_pay_snapshot') }}
),

internal_snapshot as (
    select *
    from {{ ref('fct_internal_pay_snapshot') }}
    where snapshot_date = (select snapshot_date from latest_internal_snapshot)
      and internal_gender_pay_gap is not null
),

joined as (
    select
        concat_ws('::', i.country_code, i.worker_category_id, cast(i.snapshot_date as varchar)) as benchmark_row_id,
        i.country_code,
        i.snapshot_date,
        i.worker_category_id,
        w.worker_category_label,
        w.primary_job_family,
        w.representative_job_level,
        w.representative_nace_code,
        i.headcount,
        i.female_count,
        i.male_count,
        i.internal_gender_pay_gap,
        m.market_sector_id,
        m.market_period_code,
        m.market_gender_pay_gap,
        round(i.internal_gender_pay_gap - m.market_gender_pay_gap, 1) as gap_to_market
    from internal_snapshot i
    left join {{ ref('dim_worker_category') }} w
        on i.worker_category_id = w.worker_category_id
    left join market_benchmark m
        on i.country_code = m.country_code
),

final as (
    select
        benchmark_row_id,
        country_code,
        snapshot_date,
        worker_category_id,
        worker_category_label,
        primary_job_family,
        representative_job_level,
        representative_nace_code,
        headcount,
        female_count,
        male_count,
        internal_gender_pay_gap,
        market_sector_id,
        market_period_code,
        market_gender_pay_gap,
        gap_to_market,
        case
            when market_gender_pay_gap is not null then true
            else false
        end as market_benchmark_available
    from joined
)

select *
from final
