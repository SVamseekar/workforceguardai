-- A semantic metric must be NULL exactly when it is marked unavailable, and
-- populated exactly when it is not. This guards against the mart silently
-- fabricating a 0 (or any other value) for a metric it can't actually score,
-- and against marking a metric 'unavailable' while still emitting a value.
-- See issue #79.
select
    semantic_metric_id,
    metric_value,
    implementation_status
from {{ ref('mart_semantic_metrics') }}
where (metric_value is null) != (implementation_status = 'unavailable')
