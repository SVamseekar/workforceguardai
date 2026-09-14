with latest_market_period as (
    select max(period_code) as period_code
    from {{ ref('fct_labour_market_region_sector') }}
    where signal_name = 'gender_pay_gap'
),

market_sector as (
    select
        geo_id as country_code,
        sector_id,
        period_code as market_period_code,
        signal_value as market_gender_pay_gap
    from {{ ref('fct_labour_market_region_sector') }}
    where signal_name = 'gender_pay_gap'
      and period_code = (select period_code from latest_market_period)
      and sector_id is not null
      and length(sector_id) = 1
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

market_country as (
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
        i.median_gender_pay_gap,
        i.mean_gap_base,
        i.mean_gap_variable,
        i.median_gap_variable,
        i.female_variable_incidence_pct,
        i.male_variable_incidence_pct,
        i.q1_female_share_pct,
        i.q2_female_share_pct,
        i.q3_female_share_pct,
        i.q4_female_share_pct,
        i.hours_basis,
        coalesce(ms.sector_id, mc.market_sector_id) as market_sector_id,
        coalesce(ms.market_period_code, mc.market_period_code) as market_period_code,
        coalesce(ms.market_gender_pay_gap, mc.market_gender_pay_gap) as market_gender_pay_gap,
        case
            when ms.market_gender_pay_gap is not null then 'sector'
            when mc.market_gender_pay_gap is not null then 'country_all_sector'
            else 'unavailable'
        end as market_match,
        round(
            i.internal_gender_pay_gap - coalesce(ms.market_gender_pay_gap, mc.market_gender_pay_gap),
            1
        ) as gap_to_market
    from internal_snapshot i
    left join {{ ref('dim_worker_category') }} w
        on i.worker_category_id = w.worker_category_id
    left join market_sector ms
        on i.country_code = ms.country_code
       and upper(left(coalesce(w.representative_nace_code, i.nace_code, ''), 1)) = ms.sector_id
    left join market_country mc
        on i.country_code = mc.country_code
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
        median_gender_pay_gap,
        mean_gap_base,
        mean_gap_variable,
        median_gap_variable,
        female_variable_incidence_pct,
        male_variable_incidence_pct,
        q1_female_share_pct,
        q2_female_share_pct,
        q3_female_share_pct,
        q4_female_share_pct,
        hours_basis,
        market_sector_id,
        market_period_code,
        market_gender_pay_gap,
        market_match,
        gap_to_market,
        case
            when market_gender_pay_gap is not null then true
            else false
        end as market_benchmark_available
    from joined
)

select *
from final
