with benchmark_rows as (
    select *
    from {{ ref('mart_internal_market_pay_benchmark') }}
    where internal_gender_pay_gap is not null
),

classified as (
    select
        benchmark_row_id as pay_transparency_review_id,
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
        market_benchmark_available,
        5.0 as observed_gap_threshold_pct,
        10.0 as unresolved_review_threshold_pct,
        2.0 as market_delta_threshold_pct,
        case
            when abs(internal_gender_pay_gap) >= 10.0
                or abs(coalesce(gap_to_market, 0)) >= 2.0
                then 'unresolved_review_item'
            when abs(internal_gender_pay_gap) >= 5.0
                then 'observed_gap'
            else 'justified_difference'
        end as review_state,
        case
            when abs(internal_gender_pay_gap) >= 10.0
                then 'high'
            when abs(coalesce(gap_to_market, 0)) >= 2.0
                or abs(internal_gender_pay_gap) >= 5.0
                then 'medium'
            else 'low'
        end as review_priority,
        'pay-transparency-review-v1' as formula_version,
        true as human_review_required
    from benchmark_rows
)

select *
from classified
