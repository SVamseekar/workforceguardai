{% macro reference_parquet(filename) -%}
read_parquet('{{ var("reference_path") }}/{{ filename }}')
{%- endmacro %}
