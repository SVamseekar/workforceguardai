{% macro eu_parquet(filename) -%}
read_parquet('{{ var("eu_raw_path") }}/{{ filename }}')
{%- endmacro %}
