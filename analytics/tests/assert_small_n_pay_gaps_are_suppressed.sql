{{ config(tags=['internal']) }}

-- Categories with fewer than 5 women or 5 men must not publish a gap figure.
select *
from {{ ref('fct_internal_pay_snapshot') }}
where (female_count < 5 or male_count < 5)
  and (
      internal_gender_pay_gap is not null
      or median_gender_pay_gap is not null
      or mean_gap_base is not null
  )
