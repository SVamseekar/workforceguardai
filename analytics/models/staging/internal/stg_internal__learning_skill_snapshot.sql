with source as (
    select *
    from {{ internal_parquet('learning_skill_snapshot.parquet') }}
),

standardized as (
    select
        employee_id,
        skill_uri,
        skill_label,
        lower(skill_type) as skill_type,
        cast(proficiency_level as double) as proficiency_level,
        cast(last_observed_date as date) as last_observed_date,
        version as source_version,
        'internal_learning_skill_snapshot' as dataset_name
    from source
    where employee_id is not null
      and skill_uri is not null
      and skill_label is not null
      and cast(last_observed_date as date) is not null
)

select *
from standardized
