{#
  Routes models tagged "internal" into a per-tenant DuckDB schema, driven by
  the `tenant_schema` dbt var. Every other model keeps dbt's default schema
  (the shared "main" schema holding EU/reference/public_company marts).

  Without this, every tenant's payroll-derived tables (fct_internal_pay_snapshot,
  etc.) would land in the same shared schema and overwrite/leak across tenants
  the moment more than one tenant uploads payroll data — see
  AnalyticsRepository._connect(), which sets `search_path` to put a tenant's
  own schema first so unqualified references to internal-tagged tables never
  cross tenant boundaries.
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if node.tags is defined and 'internal' in node.tags and var('tenant_schema', none) is not none -%}
        {{ var('tenant_schema') }}
    {%- else -%}
        {{ target.schema }}
    {%- endif -%}
{%- endmacro %}
