-- Regression guard for issue #31: Denmark reports vacancy data only at the
-- single-letter NACE section level (no 'ALL', 'A-S' or 'B-S' rollup), which
-- previously fell through every coalesce(..., 0) and reported hiring
-- pressure as if there were zero unfilled roles. The sector-letter-average
-- fallback in mart_semantic_metrics should recover a real value here rather
-- than either a fabricated 0 or an unnecessary 'unavailable'. See issue #79.
select
    semantic_metric_id,
    metric_value,
    implementation_status
from {{ ref('mart_semantic_metrics') }}
where geo_id = 'DK'
  and sector_id = 'ALL'
  and metric_id = 'hiring_pressure_index'
  and (metric_value is null or implementation_status = 'unavailable')
