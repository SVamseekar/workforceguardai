{{ config(tags=['internal']) }}

-- Sector letter match, else country all-sector fallback, else unavailable.
select *
from {{ ref('mart_internal_market_pay_benchmark') }}
where market_match not in ('sector', 'country_all_sector', 'unavailable')
