with requisitions as (
    select *
    from {{ ref('stg_internal__ats_requisition_snapshot') }}
),

aggregated as (
    select
        concat_ws('::', country_code, worker_category_id) as internal_hiring_demand_id,
        country_code,
        worker_category_id,
        count(distinct requisition_id) as requisition_count,
        count(distinct case when requisition_status in ('open', 'approved', 'posted') then requisition_id end) as open_requisition_count,
        avg(
            case
                when requisition_status in ('open', 'approved', 'posted')
                    then date_diff('day', opened_date, current_date)
                when closed_date is not null
                    then date_diff('day', opened_date, closed_date)
                else null
            end
        ) as avg_requisition_age_days
    from requisitions
    group by 1, 2, 3
),

final as (
    select
        internal_hiring_demand_id,
        country_code,
        worker_category_id,
        requisition_count,
        open_requisition_count,
        round(avg_requisition_age_days, 1) as avg_requisition_age_days
    from aggregated
)

select *
from final
