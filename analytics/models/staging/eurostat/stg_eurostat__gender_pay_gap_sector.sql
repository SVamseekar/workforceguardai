with source as (
    select *
    from {{ eu_parquet('gender_pay_gap_sector.parquet') }}
),

standardized as (
    select
        geo as region_code,
        geo_label as region_label,
        cast(time as varchar) as period_code,
        'year' as period_type,
        nace_r2 as sector_code,
        nace_r2_label as sector_label,
        unit as unit_code,
        cast(value as double) as metric_value,
        'gender_pay_gap_sector' as dataset_name
    from source
    where geo is not null
      and nace_r2 is not null
      and cast(value as double) is not null
)

select *
from standardized

