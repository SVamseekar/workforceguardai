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
        p.pay_currency,
        j.nace_code,
        j.esco_uri
    from payroll p
    left join job_architecture j
        on p.job_code = j.job_code
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
        avg(case when gender = 'male' then base_pay_amount end) as male_avg_base_pay
    from joined
    where worker_category_id is not null
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
        case
            when female_count > 0 and male_count > 0 and male_avg_base_pay > 0
                then round(((male_avg_base_pay - female_avg_base_pay) / male_avg_base_pay) * 100, 1)
            else null
        end as internal_gender_pay_gap
    from aggregated
)

select *
from final
