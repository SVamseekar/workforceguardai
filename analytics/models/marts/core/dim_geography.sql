with region_codes as (
    select distinct region_code, region_label
    from {{ ref('stg_eurostat__employment_rate') }}

    union

    select distinct region_code, region_label
    from {{ ref('stg_eurostat__unemployment_rate') }}

    union

    select distinct region_code, region_label
    from {{ ref('stg_eurostat__job_vacancy_rate') }}

    union

    select distinct region_code, region_label
    from {{ ref('stg_eurostat__gender_pay_gap_sector') }}
),

cleaned as (
    select
        region_code,
        max(region_label) as region_name
    from region_codes
    where region_code is not null
    group by 1
),

final as (
    select
        region_code as geo_id,
        region_code as nuts_code,
        case
            when length(region_code) = 4 then 2
            when length(region_code) = 5 then 3
            when length(region_code) = 2 then 0
            else null
        end as nuts_level,
        case
            when length(region_code) >= 2 then substring(region_code, 1, 2)
            else null
        end as country_code,
        region_name,
        case
            when length(region_code) = 4 then true
            when length(region_code) = 5 then false
            else true
        end as has_full_coverage
    from cleaned
)

select *
from final

