with employment as (
    select
        region_code,
        null as sector_code,
        period_code,
        period_type,
        'employment_rate' as signal_name,
        metric_value as signal_value
    from {{ ref('stg_eurostat__employment_rate') }}
    where indicator_code = 'EMP_LFS'
      and sex_code = 'T'
      and age_code = 'Y20-64'
      and unit_code = 'PC_POP'
),

unemployment as (
    select
        region_code,
        null as sector_code,
        period_code,
        period_type,
        'unemployment_rate' as signal_name,
        metric_value as signal_value
    from {{ ref('stg_eurostat__unemployment_rate') }}
    where sex_code = 'T'
      and age_code = 'Y15-74'
      and unit_code = 'PC_ACT'
),

vacancies_ranked as (
    select
        region_code,
        sector_code,
        period_code,
        period_type,
        'job_vacancy_rate' as signal_name,
        metric_value as signal_value,
        row_number() over (
            partition by region_code, sector_code, period_code
            order by case when seasonal_adjustment_code = 'SA' then 0 else 1 end
        ) as adjustment_rank
    from {{ ref('stg_eurostat__job_vacancy_rate') }}
    where indicator_code = 'JVR'
      and size_class_code = 'TOTAL'
      and seasonal_adjustment_code in ('SA', 'NSA')
),

vacancies as (
    select
        region_code,
        sector_code,
        period_code,
        period_type,
        signal_name,
        signal_value
    from vacancies_ranked
    where adjustment_rank = 1
),

pay_gap as (
    select
        region_code,
        sector_code,
        period_code,
        period_type,
        'gender_pay_gap' as signal_name,
        metric_value as signal_value
    from {{ ref('stg_eurostat__gender_pay_gap_sector') }}
    where unit_code = 'PC'
),

flows_to_employment_ranked as (
    select
        region_code,
        null as sector_code,
        period_code,
        period_type,
        'labour_flow_to_employment' as signal_name,
        metric_value as signal_value,
        row_number() over (
            partition by region_code, period_code
            order by case when seasonal_adjustment_code = 'SA' then 0 else 1 end
        ) as adjustment_rank
    from {{ ref('stg_eurostat__labour_market_flows') }}
    where indicator_code = 'U_E'
      and sex_code = 'T'
      and unit_code = 'PC_UNE'
      and seasonal_adjustment_code in ('SA', 'NSA')
),

flows_to_employment as (
    select region_code, sector_code, period_code, period_type, signal_name, signal_value
    from flows_to_employment_ranked
    where adjustment_rank = 1
),

flows_to_inactivity_ranked as (
    select
        region_code,
        null as sector_code,
        period_code,
        period_type,
        'labour_flow_to_inactivity' as signal_name,
        metric_value as signal_value,
        row_number() over (
            partition by region_code, period_code
            order by case when seasonal_adjustment_code = 'SA' then 0 else 1 end
        ) as adjustment_rank
    from {{ ref('stg_eurostat__labour_market_flows') }}
    where indicator_code = 'U_I'
      and sex_code = 'T'
      and unit_code = 'PC_UNE'
      and seasonal_adjustment_code in ('SA', 'NSA')
),

flows_to_inactivity as (
    select region_code, sector_code, period_code, period_type, signal_name, signal_value
    from flows_to_inactivity_ranked
    where adjustment_rank = 1
),

employment_continuity_ranked as (
    select
        region_code,
        null as sector_code,
        period_code,
        period_type,
        'employment_continuity' as signal_name,
        metric_value as signal_value,
        row_number() over (
            partition by region_code, period_code
            order by case when seasonal_adjustment_code = 'SA' then 0 else 1 end
        ) as adjustment_rank
    from {{ ref('stg_eurostat__labour_market_flows') }}
    where indicator_code = 'E_E'
      and sex_code = 'T'
      and unit_code = 'PC_EMP'
      and seasonal_adjustment_code in ('SA', 'NSA')
),

employment_continuity as (
    select region_code, sector_code, period_code, period_type, signal_name, signal_value
    from employment_continuity_ranked
    where adjustment_rank = 1
),

labour_slack_rate_ranked as (
    select
        region_code,
        null as sector_code,
        period_code,
        period_type,
        'labour_market_slack_rate' as signal_name,
        metric_value as signal_value,
        row_number() over (
            partition by region_code, period_code
            order by case when seasonal_adjustment_code = 'SA' then 0 else 1 end
        ) as adjustment_rank
    from {{ ref('stg_eurostat__labour_market_slack') }}
    where slack_status_code = 'SLACK'
      and sex_code = 'T'
      and age_code = 'Y15-74'
      and unit_code = 'PC_ELF'
      and seasonal_adjustment_code in ('SA', 'NSA')
),

labour_slack_rate as (
    select region_code, sector_code, period_code, period_type, signal_name, signal_value
    from labour_slack_rate_ranked
    where adjustment_rank = 1
),

unioned as (
    select * from employment
    union all
    select * from unemployment
    union all
    select * from vacancies
    union all
    select * from pay_gap
    union all
    select * from flows_to_employment
    union all
    select * from flows_to_inactivity
    union all
    select * from employment_continuity
    union all
    select * from labour_slack_rate
)

select
    concat_ws('::', region_code, coalesce(sector_code, 'all'), period_code, signal_name) as signal_id,
    region_code as geo_id,
    sector_code as sector_id,
    period_code,
    period_type,
    signal_name,
    signal_value
from unioned
