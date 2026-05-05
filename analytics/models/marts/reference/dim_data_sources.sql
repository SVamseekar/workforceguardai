select
    source_id,
    source_name,
    source_family,
    source_version,
    coverage_notes
from {{ ref('ref_data_sources') }}
