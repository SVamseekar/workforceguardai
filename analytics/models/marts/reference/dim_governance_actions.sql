select
    action_code,
    action_name,
    requires_reason
from {{ ref('ref_governance_actions') }}
