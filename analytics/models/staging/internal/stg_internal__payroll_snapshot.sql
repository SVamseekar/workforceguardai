with source as (
    select *
    from {{ internal_parquet('payroll_snapshot.parquet') }}
),

standardized as (
    select
        employee_id,
        job_code,
        job_title,
        upper(country_code) as country_code,
        worker_category_id,
        lower(gender) as gender,
        cast(base_pay_amount as double) as base_pay_amount,
        upper(pay_currency) as pay_currency,
        cast(snapshot_date as date) as snapshot_date,
        lower(employment_status) as employment_status,
        version as source_version,
        'internal_payroll_snapshot' as dataset_name
    from source
    where employee_id is not null
      and job_code is not null
      and country_code is not null
      and worker_category_id is not null
      and cast(base_pay_amount as double) is not null
)

select *
from standardized
