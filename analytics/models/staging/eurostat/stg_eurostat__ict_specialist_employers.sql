with source as (
    select *
    from {{ eu_parquet('ict_specialist_employers.parquet') }}
),

standardized as (
    select
        geo as region_code,
        geo_label as region_label,
        cast(time as varchar) as period_code,
        'year' as period_type,
        size_emp as size_class_code,
        unit as unit_code,
        cast(value as double) as metric_value,
        'ict_specialist_employers' as dataset_name,
        'isoc_ske_itspe' as dataset_code,
        {{ get_pull_timestamp('ict_specialist_employers') }} as pulled_at
    from source
    where geo is not null
      and cast(value as double) is not null
)

select *
from standardized
