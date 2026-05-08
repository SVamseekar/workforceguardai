with source as (
    select *
    from {{ public_company_parquet('uk_gpg.parquet') }}
),

standardized as (
    select
        cast(year as integer) as year,
        cast(employer_id as varchar) as employer_id,
        cast(company_name as varchar) as company_name,
        cast(size_band as varchar) as size_band,
        cast(mean_pay_gap as double) as mean_pay_gap,
        cast(median_pay_gap as double) as median_pay_gap,
        cast(country_code as varchar) as country_code,
        'uk_gpg' as source_id
    from source
    where company_name is not null
      and median_pay_gap is not null
)

select *
from standardized
