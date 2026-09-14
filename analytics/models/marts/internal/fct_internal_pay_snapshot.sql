with payroll as (
    select *
    from {{ ref('stg_internal__payroll_snapshot') }}
    where employment_status in ('active', 'employed')
      and gender in ('female', 'male')
      and base_pay_amount > 0
),

job_architecture as (
    select *
    from {{ ref('stg_internal__job_architecture') }}
),

joined as (
    select
        p.employee_id,
        p.country_code,
        p.snapshot_date,
        p.job_code,
        coalesce(p.worker_category_id, j.worker_category_id) as worker_category_id,
        p.gender,
        p.base_pay_amount,
        p.variable_pay_amount,
        p.weekly_hours,
        p.pay_frequency,
        p.hours_basis,
        p.hourly_base,
        p.hourly_variable,
        p.hourly_total,
        p.pay_currency,
        j.nace_code,
        j.esco_uri
    from payroll p
    left join job_architecture j
        on p.job_code = j.job_code
),

ranked as (
    select
        *,
        ntile(4) over (
            partition by country_code, worker_category_id, snapshot_date
            order by hourly_total
        ) as pay_quartile
    from joined
    where worker_category_id is not null
      and hourly_total is not null
),

aggregated as (
    select
        concat_ws('::', country_code, worker_category_id, cast(snapshot_date as varchar)) as internal_pay_snapshot_id,
        country_code,
        snapshot_date,
        worker_category_id,
        max(nace_code) as nace_code,
        max(esco_uri) as esco_uri,
        max(pay_currency) as pay_currency,
        count(*) as headcount,
        sum(case when gender = 'female' then 1 else 0 end) as female_count,
        sum(case when gender = 'male' then 1 else 0 end) as male_count,
        avg(base_pay_amount) as avg_base_pay,
        avg(case when gender = 'female' then base_pay_amount end) as female_avg_base_pay,
        avg(case when gender = 'male' then base_pay_amount end) as male_avg_base_pay,
        avg(case when gender = 'female' then hourly_base end) as female_avg_hourly_base,
        avg(case when gender = 'male' then hourly_base end) as male_avg_hourly_base,
        median(case when gender = 'female' then hourly_base end) as female_median_hourly_base,
        median(case when gender = 'male' then hourly_base end) as male_median_hourly_base,
        avg(case when gender = 'female' then hourly_variable end) as female_avg_hourly_variable,
        avg(case when gender = 'male' then hourly_variable end) as male_avg_hourly_variable,
        median(case when gender = 'female' then hourly_variable end) as female_median_hourly_variable,
        median(case when gender = 'male' then hourly_variable end) as male_median_hourly_variable,
        avg(case when gender = 'female' then hourly_total end) as female_avg_hourly_total,
        avg(case when gender = 'male' then hourly_total end) as male_avg_hourly_total,
        median(case when gender = 'female' then hourly_total end) as female_median_hourly_total,
        median(case when gender = 'male' then hourly_total end) as male_median_hourly_total,
        avg(case when gender = 'female' then variable_pay_amount end) as female_avg_variable_pay,
        avg(case when gender = 'male' then variable_pay_amount end) as male_avg_variable_pay,
        round(
            100.0 * sum(case when gender = 'female' and variable_pay_amount > 0 then 1 else 0 end)
            / nullif(sum(case when gender = 'female' then 1 else 0 end), 0),
            1
        ) as female_variable_incidence_pct,
        round(
            100.0 * sum(case when gender = 'male' and variable_pay_amount > 0 then 1 else 0 end)
            / nullif(sum(case when gender = 'male' then 1 else 0 end), 0),
            1
        ) as male_variable_incidence_pct,
        round(
            100.0 * count(*) filter (where gender = 'female' and pay_quartile = 1)
            / nullif(count(*) filter (where pay_quartile = 1), 0),
            1
        ) as q1_female_share_pct,
        round(
            100.0 * count(*) filter (where gender = 'female' and pay_quartile = 2)
            / nullif(count(*) filter (where pay_quartile = 2), 0),
            1
        ) as q2_female_share_pct,
        round(
            100.0 * count(*) filter (where gender = 'female' and pay_quartile = 3)
            / nullif(count(*) filter (where pay_quartile = 3), 0),
            1
        ) as q3_female_share_pct,
        round(
            100.0 * count(*) filter (where gender = 'female' and pay_quartile = 4)
            / nullif(count(*) filter (where pay_quartile = 4), 0),
            1
        ) as q4_female_share_pct,
        max(case when hours_basis = 'reported' then 1 else 0 end) = 1 as hours_reported,
        bool_or(hours_basis = 'assumed_default') as hours_assumed
    from ranked
    group by 1, 2, 3, 4
),

final as (
    select
        internal_pay_snapshot_id,
        country_code,
        snapshot_date,
        worker_category_id,
        nace_code,
        esco_uri,
        pay_currency,
        headcount,
        female_count,
        male_count,
        avg_base_pay,
        female_avg_base_pay,
        male_avg_base_pay,
        female_avg_hourly_base,
        male_avg_hourly_base,
        female_median_hourly_base,
        male_median_hourly_base,
        female_avg_hourly_variable,
        male_avg_hourly_variable,
        female_median_hourly_variable,
        male_median_hourly_variable,
        female_avg_hourly_total,
        male_avg_hourly_total,
        female_median_hourly_total,
        male_median_hourly_total,
        female_avg_variable_pay,
        male_avg_variable_pay,
        female_variable_incidence_pct,
        male_variable_incidence_pct,
        q1_female_share_pct,
        q2_female_share_pct,
        q3_female_share_pct,
        q4_female_share_pct,
        case
            when hours_reported and hours_assumed then 'mixed'
            when hours_reported then 'reported'
            else 'assumed_default'
        end as hours_basis,
        case
            when female_count >= 5 and male_count >= 5
                and male_avg_hourly_total is not null and male_avg_hourly_total > 0
                and female_avg_hourly_total is not null
                then round(((male_avg_hourly_total - female_avg_hourly_total) / male_avg_hourly_total) * 100, 1)
            else null
        end as internal_gender_pay_gap,
        case
            when female_count >= 5 and male_count >= 5
                and male_median_hourly_total is not null and male_median_hourly_total > 0
                and female_median_hourly_total is not null
                then round(((male_median_hourly_total - female_median_hourly_total) / male_median_hourly_total) * 100, 1)
            else null
        end as median_gender_pay_gap,
        case
            when female_count >= 5 and male_count >= 5
                and male_avg_hourly_base is not null and male_avg_hourly_base > 0
                and female_avg_hourly_base is not null
                then round(((male_avg_hourly_base - female_avg_hourly_base) / male_avg_hourly_base) * 100, 1)
            else null
        end as mean_gap_base,
        case
            when female_count >= 5 and male_count >= 5
                and male_avg_hourly_variable is not null and male_avg_hourly_variable > 0
                and female_avg_hourly_variable is not null
                then round(((male_avg_hourly_variable - female_avg_hourly_variable) / male_avg_hourly_variable) * 100, 1)
            else null
        end as mean_gap_variable,
        case
            when female_count >= 5 and male_count >= 5
                and male_median_hourly_variable is not null and male_median_hourly_variable > 0
                and female_median_hourly_variable is not null
                then round(((male_median_hourly_variable - female_median_hourly_variable) / male_median_hourly_variable) * 100, 1)
            else null
        end as median_gap_variable
    from aggregated
)

select *
from final
