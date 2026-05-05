with workforce as (
    select *
    from {{ ref('stg_internal__hris_workforce_snapshot') }}
    where employment_status in ('active', 'employed')
),

aggregated as (
    select
        concat_ws('::', country_code, worker_category_id, cast(snapshot_date as varchar)) as internal_workforce_snapshot_id,
        country_code,
        snapshot_date,
        worker_category_id,
        count(distinct employee_id) as headcount,
        count(distinct case when gender = 'female' then employee_id end) as female_count,
        count(distinct case when gender = 'male' then employee_id end) as male_count,
        count(distinct case when employment_type like '%part%' then employee_id end) as part_time_count,
        count(distinct case when employment_type like '%contract%' then employee_id end) as contractor_count,
        avg(date_diff('year', hire_date, snapshot_date)) as avg_tenure_years
    from workforce
    group by 1, 2, 3, 4
),

final as (
    select
        internal_workforce_snapshot_id,
        country_code,
        snapshot_date,
        worker_category_id,
        headcount,
        female_count,
        male_count,
        part_time_count,
        contractor_count,
        round(avg_tenure_years, 1) as avg_tenure_years,
        case
            when headcount > 0 then round((female_count / headcount) * 100, 1)
            else null
        end as female_share
    from aggregated
)

select *
from final
