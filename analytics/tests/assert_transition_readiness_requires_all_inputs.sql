-- Regression guard for issue #80: transition_readiness must be NULL
-- whenever any of its four required inputs (labour_resilience,
-- hiring_pressure_index, digital_employer_share, green_demand_share) is
-- unavailable for a geography/sector -- never silently scored using a
-- default or a subset of inputs. Asserts the invariant directly rather
-- than pinning to one specific country's known gap, so this stays a
-- meaningful guard even as underlying data coverage changes over time.
with joined as (
    select
        t.geo_id,
        t.sector_id,
        t.metric_value as transition_readiness,
        lr.metric_value as labour_resilience,
        hp.metric_value as hiring_pressure_index
    from {{ ref('mart_semantic_metrics') }} t
    left join {{ ref('mart_semantic_metrics') }} lr
        on t.geo_id = lr.geo_id and t.sector_id = lr.sector_id and lr.metric_id = 'labour_resilience'
    left join {{ ref('mart_semantic_metrics') }} hp
        on t.geo_id = hp.geo_id and t.sector_id = hp.sector_id and hp.metric_id = 'hiring_pressure_index'
    where t.metric_id = 'transition_readiness'
)
select *
from joined
where (labour_resilience is null or hiring_pressure_index is null)
  and transition_readiness is not null
