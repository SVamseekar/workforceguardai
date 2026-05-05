with source as (
    select *
    from {{ internal_parquet('job_architecture.parquet') }}
),

standardized as (
    select
        job_code,
        job_family,
        job_level,
        worker_category_id,
        worker_category_label,
        esco_uri,
        upper(nace_code) as nace_code,
        version as source_version,
        'internal_job_architecture' as dataset_name
    from source
    where job_code is not null
      and worker_category_id is not null
      and worker_category_label is not null
      and nace_code is not null
)

select *
from standardized
