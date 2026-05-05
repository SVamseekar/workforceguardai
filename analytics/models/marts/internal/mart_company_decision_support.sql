with pay as (
    select *
    from {{ ref('mart_internal_market_pay_benchmark') }}
),

workforce_latest as (
    select max(snapshot_date) as snapshot_date
    from {{ ref('fct_internal_workforce_snapshot') }}
),

workforce as (
    select *
    from {{ ref('fct_internal_workforce_snapshot') }}
    where snapshot_date = (select snapshot_date from workforce_latest)
),

hiring as (
    select *
    from {{ ref('fct_internal_hiring_demand') }}
),

skills as (
    select *
    from {{ ref('fct_internal_skill_snapshot') }}
),

semantic_market as (
    select
        geo_id as country_code,
        sector_id,
        max(case when metric_id = 'hiring_pressure_index' then metric_value end) as market_hiring_pressure_index,
        max(case when metric_id = 'transition_readiness' then metric_value end) as market_transition_readiness
    from {{ ref('mart_semantic_metrics') }}
    group by 1, 2
),

joined as (
    select
        p.benchmark_row_id as company_decision_row_id,
        p.country_code,
        p.snapshot_date,
        p.worker_category_id,
        p.worker_category_label,
        p.primary_job_family,
        p.representative_job_level,
        p.representative_nace_code,
        p.headcount as pay_headcount,
        p.internal_gender_pay_gap,
        p.market_gender_pay_gap,
        p.gap_to_market,
        w.headcount as workforce_headcount,
        w.female_share,
        w.avg_tenure_years,
        h.open_requisition_count,
        h.avg_requisition_age_days,
        s.employees_with_skills,
        s.distinct_skill_count,
        s.digital_skill_count,
        s.green_skill_count,
        m.market_hiring_pressure_index,
        m.market_transition_readiness
    from pay p
    left join workforce w
        on p.country_code = w.country_code
       and p.worker_category_id = w.worker_category_id
    left join hiring h
        on p.country_code = h.country_code
       and p.worker_category_id = h.worker_category_id
    left join skills s
        on p.country_code = s.country_code
       and p.worker_category_id = s.worker_category_id
    left join semantic_market m
        on p.country_code = m.country_code
       and (
            m.sector_id = left(p.representative_nace_code, 1)
            or (m.sector_id = 'ALL' and p.representative_nace_code is null)
       )
)

select
    *,
    case
        when open_requisition_count is not null and market_hiring_pressure_index is not null then 'blended'
        when open_requisition_count is not null then 'internal'
        when market_hiring_pressure_index is not null then 'external'
        else 'unavailable'
    end as hiring_evidence_basis,
    case
        when employees_with_skills is not null and market_transition_readiness is not null then 'blended'
        when employees_with_skills is not null then 'internal'
        when market_transition_readiness is not null then 'external'
        else 'unavailable'
    end as skills_evidence_basis
from joined
