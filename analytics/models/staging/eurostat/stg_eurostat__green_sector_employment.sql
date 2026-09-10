with source as (
    select *
    from {{ eu_parquet('green_sector_employment.parquet') }}
),

standardized as (
    select
        geo as region_code,
        geo_label as region_label,
        cast(time as varchar) as period_code,
        'year' as period_type,
        nace_r2 as sector_code,
        unit as unit_code,
        cast(value as double) as metric_value,
        'green_sector_employment' as dataset_name,
        'env_ac_egss1' as dataset_code,
        {{ get_pull_timestamp('green_sector_employment') }} as pulled_at
    from source
    where geo is not null
      and cast(value as double) is not null
)

select *
from standardized
