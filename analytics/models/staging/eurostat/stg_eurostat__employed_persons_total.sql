with source as (
    select *
    from {{ eu_parquet('employed_persons_total.parquet') }}
),

standardized as (
    select
        geo as region_code,
        geo_label as region_label,
        cast(time as varchar) as period_code,
        'year' as period_type,
        indic_em as indicator_code,
        sex as sex_code,
        age as age_code,
        unit as unit_code,
        cast(value as double) as metric_value,
        'employed_persons_total' as dataset_name,
        'lfsi_emp_a' as dataset_code,
        {{ get_pull_timestamp('employed_persons_total') }} as pulled_at
    from source
    where geo is not null
      and cast(value as double) is not null
)

select *
from standardized
