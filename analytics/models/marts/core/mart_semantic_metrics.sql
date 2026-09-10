with latest_signal_periods as (
    select
        signal_name,
        max(period_code) as period_code
    from {{ ref('fct_labour_market_region_sector') }}
    group by 1
),

latest_signals as (
    select
        f.geo_id,
        coalesce(f.sector_id, 'ALL') as sector_id,
        f.signal_name,
        f.signal_value,
        f.period_code
    from {{ ref('fct_labour_market_region_sector') }} f
    inner join latest_signal_periods p
        on f.signal_name = p.signal_name
       and f.period_code = p.period_code
),

country_signals as (
    select
        geo_id,
        max(case when signal_name = 'employment_rate' then signal_value end) as employment_rate,
        max(case when signal_name = 'unemployment_rate' then signal_value end) as unemployment_rate,
        max(case when signal_name = 'labour_market_slack_rate' then signal_value end) as labour_slack_rate,
        max(case when signal_name = 'labour_flow_to_employment' then signal_value end) as flow_to_employment,
        max(case when signal_name = 'labour_flow_to_inactivity' then signal_value end) as flow_to_inactivity,
        max(case when signal_name = 'employment_continuity' then signal_value end) as employment_continuity
    from latest_signals
    where sector_id = 'ALL'
    group by 1
),

sector_pairs as (
    select distinct
        geo_id,
        sector_id
    from latest_signals
    where sector_id != 'ALL'

    union

    select distinct
        geo_id,
        'ALL' as sector_id
    from latest_signals
),

sector_signals as (
    select
        geo_id,
        sector_id,
        max(case when signal_name = 'job_vacancy_rate' then signal_value end) as vacancy_rate,
        max(case when signal_name = 'gender_pay_gap' then signal_value end) as gender_pay_gap
    from latest_signals
    where sector_id != 'ALL'
    group by 1, 2
),

default_sector_signals as (
    -- A handful of countries report the country-wide aggregate under a
    -- different NACE rollup than the EU27 majority uses (A-S for vacancy,
    -- B-S for pay gap): B-S for vacancy, B-S_X_O for pay gap. Both
    -- fallbacks are tried so these countries aren't silently scored as 0.
    select
        geo_id,
        coalesce(
            max(case when sector_id = 'A-S' and signal_name = 'job_vacancy_rate' then signal_value end),
            max(case when sector_id = 'B-S' and signal_name = 'job_vacancy_rate' then signal_value end)
        ) as default_vacancy_rate,
        coalesce(
            max(case when sector_id = 'B-S' and signal_name = 'gender_pay_gap' then signal_value end),
            max(case when sector_id = 'B-S_X_O' and signal_name = 'gender_pay_gap' then signal_value end)
        ) as default_gender_pay_gap
    from latest_signals
    group by 1
),

geo_sector_letter_signals as (
    -- Some countries (e.g. Denmark) report vacancy/pay-gap data only at the
    -- single-letter NACE section level, with no 'ALL', 'A-S' or 'B-S'
    -- rollup at all. Average across that country's own reported sections
    -- (single uppercase letters only, so combined rollups like 'B-E' or
    -- 'G-N' don't double-count) as a last real-data fallback before we
    -- admit the metric is unavailable. See issue #31 / #79.
    select
        geo_id,
        avg(case when signal_name = 'job_vacancy_rate' then signal_value end) as avg_vacancy_rate,
        avg(case when signal_name = 'gender_pay_gap' then signal_value end) as avg_gender_pay_gap
    from latest_signals
    where regexp_matches(sector_id, '^[A-Z]$')
    group by 1
),

skill_flags as (
    select
        r.occupation_uri,
        max(
            case
                when lower(coalesce(s.digital_skill_indicator, '')) in ('true', '1', 'yes') then 1
                when regexp_matches(
                    lower(concat_ws(' ', s.preferred_label, s.description)),
                    '(software|digital|computer|database|data|ict|information system|programming|cyber|automation|robot|cloud)'
                ) then 1
                else 0
            end
        ) as has_digital_skill,
        max(
            case
                when lower(coalesce(s.green_skill_indicator, '')) in ('true', '1', 'yes') then 1
                when regexp_matches(
                    lower(concat_ws(' ', s.preferred_label, s.description)),
                    '(environment|sustainability|sustainable|renewable|energy efficiency|climate|carbon|emission|pollution|waste|recycling|biodiversity)'
                ) then 1
                else 0
            end
        ) as has_green_skill
    from {{ reference_parquet('esco_occupation_skill_relations.parquet') }} r
    left join {{ reference_parquet('esco_skills.parquet') }} s
        on r.skill_uri = s.skill_uri
    group by 1
),

sector_skill_context as (
    select
        upper(left(c.nace_rev2_code, 1)) as sector_id,
        avg(has_digital_skill) * 100 as digital_skill_coverage,
        avg(has_green_skill) * 100 as green_skill_coverage,
        count(distinct c.esco_uri) as mapped_occupation_count
    from {{ reference_parquet('esco_nace_crosswalk.parquet') }} c
    left join skill_flags s
        on c.esco_uri = s.occupation_uri
    where c.nace_rev2_code is not null
    group by 1
),

overall_skill_context as (
    select
        avg(digital_skill_coverage) as digital_skill_coverage,
        avg(green_skill_coverage) as green_skill_coverage
    from sector_skill_context
),

scored_context as (
    select
        p.geo_id,
        p.sector_id,
        -- Three-tier fallback, never a fabricated zero: this country/sector's
        -- own signal -> known alternate country rollup -> average of this
        -- country's reported NACE sections -> NULL (metric reported as
        -- unavailable downstream, not silently scored as "no risk").
        coalesce(s.vacancy_rate, d.default_vacancy_rate, g.avg_vacancy_rate) as vacancy_rate,
        c.unemployment_rate,
        c.employment_rate,
        case
            when coalesce(d.default_gender_pay_gap, s.gender_pay_gap, g.avg_gender_pay_gap) is null then null
            else greatest(coalesce(d.default_gender_pay_gap, s.gender_pay_gap, g.avg_gender_pay_gap), 0)
        end as pay_gap,
        c.labour_slack_rate,
        c.flow_to_employment,
        c.flow_to_inactivity,
        c.employment_continuity,
        coalesce(k.digital_skill_coverage, o.digital_skill_coverage) as digital_skill_coverage,
        coalesce(k.green_skill_coverage, o.green_skill_coverage) as green_skill_coverage
    from sector_pairs p
    left join country_signals c
        on p.geo_id = c.geo_id
    left join sector_signals s
        on p.geo_id = s.geo_id
       and p.sector_id = s.sector_id
    left join default_sector_signals d
        on p.geo_id = d.geo_id
    left join geo_sector_letter_signals g
        on p.geo_id = g.geo_id
    left join sector_skill_context k
        on p.sector_id = k.sector_id
    cross join overall_skill_context o
),

raw_scores as (
    select
        geo_id,
        sector_id,
        vacancy_rate,
        unemployment_rate,
        employment_rate,
        pay_gap,
        labour_slack_rate,
        flow_to_employment,
        flow_to_inactivity,
        employment_continuity,
        digital_skill_coverage,
        green_skill_coverage,
        vacancy_rate * 11
            + greatest(0, 9 - unemployment_rate) * 4
            + case when labour_slack_rate is not null then greatest(0, 12 - labour_slack_rate) * 2.8 else 0 end
            + coalesce(flow_to_employment, 0) * 0.9
            + coalesce(flow_to_inactivity, 0) * 0.6 as hiring_pressure_raw,
        employment_rate * 0.95
            - unemployment_rate * 3.8
            + coalesce(employment_continuity, 0) * 0.3 as labour_resilience_raw,
        pay_gap * 5.5 as equity_risk_raw
    from scored_context
),

clamped_scores as (
    select
        *,
        -- DuckDB's greatest()/least() ignore NULL arguments (greatest(0, NULL) = 0),
        -- so clamping a NULL raw score would silently reintroduce the fabricated-zero
        -- bug this model just removed upstream. Guard explicitly: no raw score, no
        -- clamped score.
        case when hiring_pressure_raw is null then null
             else least(100, greatest(0, round(hiring_pressure_raw))) end as hiring_pressure_index,
        case when labour_resilience_raw is null then null
             else least(100, greatest(0, round(labour_resilience_raw))) end as labour_resilience,
        case when equity_risk_raw is null then null
             else least(100, greatest(0, round(equity_risk_raw))) end as equity_risk_score
    from raw_scores
),

final_scores as (
    select
        geo_id,
        sector_id,
        vacancy_rate,
        unemployment_rate,
        employment_rate,
        pay_gap,
        labour_slack_rate,
        flow_to_employment,
        flow_to_inactivity,
        employment_continuity,
        digital_skill_coverage,
        green_skill_coverage,
        hiring_pressure_index,
        labour_resilience,
        equity_risk_score,
        case
            when labour_resilience is null or hiring_pressure_index is null then null
            else least(
                100,
                greatest(
                    0,
                    round(
                        labour_resilience * 0.45
                        + greatest(0, 100 - hiring_pressure_index) * 0.25
                        + least(100, (digital_skill_coverage + green_skill_coverage) * 4) * 0.30
                    )
                )
            )
        end as transition_readiness
    from clamped_scores
),

unioned as (
    select
        geo_id,
        sector_id,
        'hiring_pressure_index' as metric_id,
        hiring_pressure_index as metric_value,
        'eurostat_jvs' as primary_source_id,
        case when hiring_pressure_index is null then 'unavailable' else 'proxy_live' end as implementation_status,
        case
            when vacancy_rate is null then 'Vacancy data unavailable for this geography/sector; hiring pressure not scored.'
            else concat(
                'Vacancy ', round(vacancy_rate, 1),
                '%, unemployment ',
                case when unemployment_rate is null then 'unavailable' else concat(round(unemployment_rate, 1), '%') end,
                case when labour_slack_rate is null then '' else concat(', slack ', round(labour_slack_rate, 1)) end
            )
        end as evidence_summary
    from final_scores

    union all

    select
        geo_id,
        sector_id,
        'labour_resilience' as metric_id,
        labour_resilience as metric_value,
        'eurostat_lfs' as primary_source_id,
        case when labour_resilience is null then 'unavailable' else 'live' end as implementation_status,
        case
            when labour_resilience is null then 'Employment/unemployment data unavailable for this geography/sector.'
            else concat('Employment ', round(employment_rate, 1), '%, unemployment ', round(unemployment_rate, 1), '%')
        end as evidence_summary
    from final_scores

    union all

    select
        geo_id,
        sector_id,
        'equity_risk_score' as metric_id,
        equity_risk_score as metric_value,
        'eurostat_lfs' as primary_source_id,
        case when equity_risk_score is null then 'unavailable' else 'proxy_live' end as implementation_status,
        case
            when pay_gap is null then 'Pay-gap data unavailable for this geography/sector.'
            else concat('Market pay-gap input ', round(pay_gap, 1), '%')
        end as evidence_summary
    from final_scores

    union all

    select
        geo_id,
        sector_id,
        'transition_readiness' as metric_id,
        transition_readiness as metric_value,
        'esco_taxonomy' as primary_source_id,
        case when transition_readiness is null then 'unavailable' else 'proxy_live' end as implementation_status,
        case
            when transition_readiness is null then 'Underlying hiring pressure or labour resilience unavailable; transition readiness not scored.'
            else concat(
                'ESCO skill coverage proxy: digital ',
                round(digital_skill_coverage, 1),
                '%, green ',
                round(green_skill_coverage, 1),
                '%'
            )
        end as evidence_summary
    from final_scores
)

select
    concat_ws('::', u.geo_id, u.sector_id, u.metric_id) as semantic_metric_id,
    u.geo_id,
    u.sector_id,
    u.metric_id,
    cast(u.metric_value as double) as metric_value,
    u.primary_source_id,
    u.implementation_status,
    r.formula_version,
    u.evidence_summary
from unioned u
left join {{ ref('dim_metric_registry') }} r
    on u.metric_id = r.metric_id
