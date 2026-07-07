with source as (
    select *
    from {{ eu_parquet('employment_rate.parquet') }}
),

standardized as (
    select
        geo as region_code,
        geo_label as region_label,
        cast(time as varchar) as period_code,
        'year' as period_type,
        indic_em as indicator_code,
        indic_em_label as indicator_label,
        sex as sex_code,
        age as age_code,
        unit as unit_code,
        cast(value as double) as metric_value,
        'employment_rate' as dataset_name,
        'lfsi_emp_a' as dataset_code,
        {{ get_pull_timestamp('employment_rate') }} as pulled_at
    from source
    where geo is not null
      and cast(value as double) is not null
)

select *
from standardized
