{% macro get_pull_timestamp(dataset_name) -%}
(
    select datasets."{{ dataset_name }}".pulled_at
    from read_json_auto('{{ var("eu_meta_path") }}/manifest.json')
)
{%- endmacro %}
