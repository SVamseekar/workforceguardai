with sector_codes as (
    select distinct sector_code, sector_label
    from {{ ref('stg_eurostat__job_vacancy_rate') }}

    union

    select distinct sector_code, sector_label
    from {{ ref('stg_eurostat__gender_pay_gap_sector') }}
),

final as (
    select
        sector_code as sector_id,
        sector_code,
        max(sector_label) as sector_name
    from sector_codes
    where sector_code is not null
    group by 1, 2
)

select *
from final

