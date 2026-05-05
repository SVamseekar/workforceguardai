select
    metric_id,
    metric_name,
    metric_group,
    grain,
    definition,
    owner,
    formula_version,
    human_review_required,
    implementation_status,
    notes
from {{ ref('ref_metric_registry') }}
