with benchmark_rows as (
    select *
    from {{ ref('mart_internal_market_pay_benchmark') }}
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
        market_benchmark_available,
        5.0 as observed_gap_threshold_pct,
        10.0 as unresolved_review_threshold_pct,
        2.0 as market_delta_threshold_pct,
        5 as min_cell_size,
        case
            when female_count < 5 or male_count < 5 or internal_gender_pay_gap is null
                then 'insufficient_sample'
            when abs(internal_gender_pay_gap) >= 10.0
                then 'unresolved_review_item'
            when abs(internal_gender_pay_gap) >= 5.0
                then 'observed_gap'
            else 'below_trigger'
        end as review_state,
        case
            when female_count < 5 or male_count < 5 or internal_gender_pay_gap is null
                then 'low'
            when abs(internal_gender_pay_gap) >= 10.0
                then 'high'
            when abs(internal_gender_pay_gap) >= 5.0
                then 'medium'
            else 'low'
        end as review_priority,
        abs(coalesce(gap_to_market, 0)) >= 2.0 as market_outlier,
        'pay-transparency-review-v2' as formula_version,
        true as human_review_required
    from benchmark_rows
)

select *
from classified
