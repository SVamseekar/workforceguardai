with source as (
    select *
    from {{ eu_parquet('job_vacancy_rate.parquet') }}
),

standardized as (
    select
        geo as region_code,
        geo_label as region_label,
        cast(time as varchar) as period_code,
        'quarter' as period_type,
        nace_r2 as sector_code,
        nace_r2_label as sector_label,
        indic_em as indicator_code,
        indic_em_label as indicator_label,
        sizeclas as size_class_code,
        s_adj as seasonal_adjustment_code,
        cast(value as double) as metric_value,
        'job_vacancy_rate' as dataset_name
    from source
    where geo is not null
      and nace_r2 is not null
      and cast(value as double) is not null
)

select *
from standardized

