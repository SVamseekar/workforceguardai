{% macro internal_parquet(filename) -%}
read_parquet('{{ var("internal_path") }}/{{ filename }}')
{%- endmacro %}
