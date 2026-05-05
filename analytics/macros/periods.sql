{% macro normalize_period(period_expression) -%}
case
    when {{ period_expression }} like '%Q%' then {{ period_expression }}
    else {{ period_expression }}
end
{%- endmacro %}

