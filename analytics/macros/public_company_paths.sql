{% macro public_company_parquet(filename) -%}
read_parquet('{{ var("public_company_path", "/Users/souravamseekarmarti/Projects/WorkforceGuard-AI/data/public_company") }}/{{ filename }}')
{%- endmacro %}
