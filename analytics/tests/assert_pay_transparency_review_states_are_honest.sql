{{ config(tags=['internal']) }}

-- Review states must never auto-label a gap as legally justified.
select *
from {{ ref('mart_pay_transparency_category_review') }}
where review_state not in (
    'insufficient_sample',
    'below_trigger',
    'observed_gap',
    'unresolved_review_item'
)
