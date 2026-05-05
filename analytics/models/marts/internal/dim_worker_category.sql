with job_architecture as (
    select *
    from {{ ref('stg_internal__job_architecture') }}
),

final as (
    select
        worker_category_id,
        max(worker_category_label) as worker_category_label,
        max(job_family) as primary_job_family,
        max(job_level) as representative_job_level,
        min(esco_uri) as representative_esco_uri,
        min(nace_code) as representative_nace_code,
        count(distinct job_code) as mapped_job_code_count
    from job_architecture
    group by 1
)

select *
from final
