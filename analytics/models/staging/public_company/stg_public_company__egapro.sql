with source as (
    select *
    from {{ public_company_parquet('egapro_index.parquet') }}
),

standardized as (
    select
        cast(year as integer) as year,
        cast(siren as varchar) as siren,
        cast(company_name as varchar) as company_name,
        cast(size_band as varchar) as size_band,
        cast(naf_code as varchar) as naf_code,
        cast(nace_section as varchar) as nace_section,
        cast(index_score as integer) as index_score,
        cast(score_pay_gap as double) as score_pay_gap,
        cast(score_top_earners as double) as score_top_earners,
        cast(score_maternity as double) as score_maternity,
        cast(region as varchar) as region,
        'egapro' as source_id
    from source
    where siren is not null
      and year is not null
      and index_score is not null
      and index_score between 0 and 100
)

select *
from standardized
