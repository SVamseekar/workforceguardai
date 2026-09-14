with expected as (
    select
        cast(null as varchar) as employee_id,
        cast(null as varchar) as job_code,
        cast(null as varchar) as job_title,
        cast(null as varchar) as country_code,
        cast(null as varchar) as worker_category_id,
        cast(null as varchar) as gender,
        cast(null as double) as base_pay_amount,
        cast(null as double) as base_salary,
        cast(null as double) as variable_pay_amount,
        cast(null as double) as weekly_hours,
        cast(null as varchar) as pay_frequency,
        cast(null as varchar) as hours_basis,
        cast(null as double) as hourly_base,
        cast(null as double) as hourly_variable,
        cast(null as double) as hourly_total,
        cast(null as varchar) as pay_currency,
        cast(null as varchar) as snapshot_date,
        cast(null as varchar) as employment_status,
        cast(null as varchar) as version
    where 1 = 0
),

source as (
    select * from expected
    union all by name
    select * from {{ internal_parquet('payroll_snapshot.parquet') }}
),

normalized as (
    select
        employee_id,
        job_code,
        job_title,
        upper(country_code) as country_code,
        worker_category_id,
        lower(gender) as gender,
        coalesce(cast(base_pay_amount as double), cast(base_salary as double)) as base_pay_amount,
        coalesce(cast(variable_pay_amount as double), 0.0) as variable_pay_amount,
        cast(weekly_hours as double) as weekly_hours_raw,
        coalesce(cast(weekly_hours as double), 40.0) as weekly_hours,
        lower(coalesce(nullif(trim(pay_frequency), ''), 'annual')) as pay_frequency,
        hours_basis as hours_basis_raw,
        cast(hourly_base as double) as hourly_base_raw,
        cast(hourly_variable as double) as hourly_variable_raw,
        cast(hourly_total as double) as hourly_total_raw,
        upper(coalesce(pay_currency, 'EUR')) as pay_currency,
        cast(snapshot_date as date) as snapshot_date,
        lower(employment_status) as employment_status,
        version as source_version,
        'internal_payroll_snapshot' as dataset_name
    from source
    where employee_id is not null
      and job_code is not null
      and country_code is not null
      and worker_category_id is not null
      and coalesce(cast(base_pay_amount as double), cast(base_salary as double)) is not null
),

computed as (
    select
        employee_id,
        job_code,
        job_title,
        country_code,
        worker_category_id,
        gender,
        base_pay_amount,
        variable_pay_amount,
        weekly_hours,
        case
            when pay_frequency in ('annual', 'monthly', 'hourly') then pay_frequency
            else 'annual'
        end as pay_frequency,
        case
            when weekly_hours_raw is not null and weekly_hours_raw > 0 then coalesce(hours_basis_raw, 'reported')
            else coalesce(hours_basis_raw, 'assumed_default')
        end as hours_basis,
        hourly_base_raw,
        hourly_variable_raw,
        hourly_total_raw,
        pay_currency,
        snapshot_date,
        employment_status,
        source_version,
        dataset_name,
        case
            when pay_frequency = 'hourly' then 1.0
            when pay_frequency = 'monthly' then weekly_hours * 52.0 / 12.0
            else weekly_hours * 52.0
        end as period_hours
    from normalized
)

select
    employee_id,
    job_code,
    job_title,
    country_code,
    worker_category_id,
    gender,
    base_pay_amount,
    variable_pay_amount,
    weekly_hours,
    pay_frequency,
    hours_basis,
    coalesce(hourly_base_raw, case when period_hours > 0 then base_pay_amount / period_hours end) as hourly_base,
    coalesce(hourly_variable_raw, case when period_hours > 0 then variable_pay_amount / period_hours else 0.0 end) as hourly_variable,
    coalesce(
        hourly_total_raw,
        case
            when period_hours > 0 then (base_pay_amount + variable_pay_amount) / period_hours
        end
    ) as hourly_total,
    pay_currency,
    snapshot_date,
    employment_status,
    source_version,
    dataset_name
from computed
