with source as (
    select *
    from {{ internal_parquet('ats_requisition_snapshot.parquet') }}
),

standardized as (
    select
        requisition_id,
        job_code,
        upper(country_code) as country_code,
        worker_category_id,
        lower(requisition_status) as requisition_status,
        cast(opened_date as date) as opened_date,
        cast(closed_date as date) as closed_date,
        version as source_version,
        'internal_ats_requisition_snapshot' as dataset_name
    from source
    where requisition_id is not null
      and job_code is not null
      and country_code is not null
      and worker_category_id is not null
      and cast(opened_date as date) is not null
)

select *
from standardized
