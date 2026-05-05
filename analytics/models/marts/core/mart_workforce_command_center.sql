with latest_periods as (
    select
        signal_name,
        max(period_code) as latest_period_code
    from {{ ref('fct_labour_market_region_sector') }}
    group by 1
),

latest_signals as (
    select
        f.signal_id,
        f.geo_id,
        f.sector_id,
        f.period_code,
        f.period_type,
        f.signal_name,
        f.signal_value
    from {{ ref('fct_labour_market_region_sector') }} f
    inner join latest_periods p
        on f.signal_name = p.signal_name
       and f.period_code = p.latest_period_code
),

joined as (
    select
        concat_ws('::', s.geo_id, coalesce(s.sector_id, 'all'), s.signal_name) as mart_row_id,
        s.signal_name,
        s.signal_value,
        s.period_code,
        s.period_type,
        g.country_code,
        g.region_name,
        g.nuts_level,
        se.sector_name
    from latest_signals s
    left join {{ ref('dim_geography') }} g
        on s.geo_id = g.geo_id
    left join {{ ref('dim_sector') }} se
        on s.sector_id = se.sector_id
)

select *
from joined

