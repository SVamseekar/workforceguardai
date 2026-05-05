with source as (
    select *
    from {{ internal_parquet('hris_workforce_snapshot.parquet') }}
),

standardized as (
    select
        employee_id,
        upper(country_code) as country_code,
        worker_category_id,
        lower(gender) as gender,
        lower(employment_type) as employment_type,
        cast(hire_date as date) as hire_date,
        cast(termination_date as date) as termination_date,
        cast(snapshot_date as date) as snapshot_date,
        lower(employment_status) as employment_status,
        version as source_version,
        'internal_hris_workforce_snapshot' as dataset_name
    from source
    where employee_id is not null
      and country_code is not null
      and worker_category_id is not null
      and cast(snapshot_date as date) is not null
)

select *
from standardized
