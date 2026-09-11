with workforce_latest as (
    select max(snapshot_date) as snapshot_date
    from {{ ref('fct_internal_workforce_snapshot') }}
),

workforce as (
    select *
    from {{ ref('fct_internal_workforce_snapshot') }}
    where snapshot_date = (select snapshot_date from workforce_latest)
),

pay as (
    select *
    from {{ ref('mart_internal_market_pay_benchmark') }}
),

categories as (
    select
        worker_category_id,
        worker_category_label,
        representative_nace_code
    from {{ ref('dim_worker_category') }}
),

joined as (
    select
        coalesce(w.country_code, p.country_code) as country_code,
        coalesce(w.worker_category_id, p.worker_category_id) as worker_category_id,
        c.worker_category_label,
        c.representative_nace_code,
        w.headcount,
        w.female_share,
        p.internal_gender_pay_gap,
        p.market_gender_pay_gap
    from workforce w
    full outer join pay p
        on w.country_code = p.country_code
       and w.worker_category_id = p.worker_category_id
    left join categories c
        on coalesce(w.worker_category_id, p.worker_category_id) = c.worker_category_id
),

scored as (
    select
        country_code,
        worker_category_id,
        worker_category_label,
        representative_nace_code,
        headcount,
        female_share,
        internal_gender_pay_gap,
        market_gender_pay_gap,
        case
            when coalesce(internal_gender_pay_gap, market_gender_pay_gap) is null then null
            else greatest(coalesce(internal_gender_pay_gap, market_gender_pay_gap), 0) * 5.5
        end as pay_gap_component,
        case
            when female_share is null then null
            else abs(female_share - 50.0) * 2.0
        end as representation_component,
        case
            when internal_gender_pay_gap is not null and female_share is not null then 'blended'
            when internal_gender_pay_gap is not null then 'internal'
            when market_gender_pay_gap is not null or female_share is not null then 'external'
            else 'unavailable'
        end as equity_risk_evidence_basis
    from joined
),

with_category_score as (
    select
        *,
        case
            when pay_gap_component is null and representation_component is null then null
            else least(
                100,
                greatest(
                    0,
                    round(
                        0.70 * coalesce(pay_gap_component, 0)
                        + 0.30 * coalesce(representation_component, 0)
                    )
                )
            )
        end as category_equity_risk_score
    from scored
),

country_rollup as (
    select
        country_code,
        case
            when sum(coalesce(headcount, 0)) = 0 then avg(category_equity_risk_score)
            else sum(category_equity_risk_score * coalesce(headcount, 0))
                / nullif(sum(case when category_equity_risk_score is not null then coalesce(headcount, 0) else 0 end), 0)
        end as blended_equity_risk_score
    from with_category_score
    group by 1
)

select
    concat_ws('::', s.country_code, s.worker_category_id) as equity_risk_row_id,
    s.country_code,
    s.worker_category_id,
    s.worker_category_label,
    s.representative_nace_code,
    s.headcount,
    s.female_share,
    s.internal_gender_pay_gap,
    s.market_gender_pay_gap,
    s.pay_gap_component,
    s.representation_component,
    s.category_equity_risk_score,
    r.blended_equity_risk_score,
    s.equity_risk_evidence_basis,
    '2.0' as formula_version,
    true as human_review_required
from with_category_score s
left join country_rollup r
    on s.country_code = r.country_code
