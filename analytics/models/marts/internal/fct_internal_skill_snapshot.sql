with latest_payroll as (
    select max(snapshot_date) as snapshot_date
    from {{ ref('stg_internal__payroll_snapshot') }}
),

employee_scope as (
    select distinct
        employee_id,
        country_code,
        worker_category_id
    from {{ ref('stg_internal__payroll_snapshot') }}
    where snapshot_date = (select snapshot_date from latest_payroll)
      and employment_status in ('active', 'employed')
),

skills as (
    select *
    from {{ ref('stg_internal__learning_skill_snapshot') }}
),

classified as (
    select
        e.country_code,
        e.worker_category_id,
        s.employee_id,
        s.skill_uri,
        s.skill_label,
        s.proficiency_level,
        case
            when regexp_matches(
                lower(coalesce(s.skill_label, '')),
                '(software|digital|computer|database|data|ict|information system|programming|cyber|automation|robot|cloud)'
            ) then true
            else false
        end as is_digital_skill,
        case
            when regexp_matches(
                lower(coalesce(s.skill_label, '')),
                '(environment|sustainability|sustainable|renewable|energy efficiency|climate|carbon|emission|pollution|waste|recycling|biodiversity)'
            ) then true
            else false
        end as is_green_skill
    from skills s
    inner join employee_scope e
        on s.employee_id = e.employee_id
),

aggregated as (
    select
        concat_ws('::', country_code, worker_category_id) as internal_skill_snapshot_id,
        country_code,
        worker_category_id,
        count(distinct employee_id) as employees_with_skills,
        count(distinct skill_uri) as distinct_skill_count,
        avg(proficiency_level) as avg_proficiency_level,
        count(distinct case when is_digital_skill then skill_uri end) as digital_skill_count,
        count(distinct case when is_green_skill then skill_uri end) as green_skill_count
    from classified
    group by 1, 2, 3
),

final as (
    select
        internal_skill_snapshot_id,
        country_code,
        worker_category_id,
        employees_with_skills,
        distinct_skill_count,
        round(avg_proficiency_level, 1) as avg_proficiency_level,
        digital_skill_count,
        green_skill_count
    from aggregated
)

select *
from final
