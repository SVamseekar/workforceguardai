"""Directive-aligned pay-gap heat metrics.

Computes unadjusted gender pay gaps on comparable hourly pay, including
base and variable components, mean and median, small-n suppression, and
honest review labels. This is a heat map for human review — not a legal
compliance determination.
"""

from __future__ import annotations

from statistics import median as _median
from typing import Any, Iterable, Mapping, MutableMapping, Optional, Sequence

MIN_CELL_SIZE = 5
DEFAULT_WEEKLY_HOURS = 40.0
WEEKS_PER_YEAR = 52.0
OBSERVED_GAP_PCT = 5.0
UNRESOLVED_GAP_PCT = 10.0
MARKET_OUTLIER_PCT = 2.0

REVIEW_STATE_LABELS = {
    "insufficient_sample": "Too few people to report",
    "below_trigger": "Below 5% trigger",
    "observed_gap": "Pay gap identified",
    "unresolved_review_item": "Needs review",
    # Legacy warehouse values must not read as "justified".
    "justified_difference": "Below 5% trigger",
}


def period_hours(pay_frequency: Optional[str], weekly_hours: float) -> float:
    freq = (pay_frequency or "annual").strip().lower()
    if weekly_hours <= 0:
        return 0.0
    if freq == "hourly":
        return 1.0
    if freq == "monthly":
        return weekly_hours * WEEKS_PER_YEAR / 12.0
    return weekly_hours * WEEKS_PER_YEAR


def hourly_rate(
    amount: Optional[float],
    pay_frequency: Optional[str],
    weekly_hours: float,
) -> Optional[float]:
    if amount is None:
        return None
    hours = period_hours(pay_frequency, weekly_hours)
    if hours <= 0:
        return None
    return float(amount) / hours


def gender_pay_gap(male_avg: Optional[float], female_avg: Optional[float]) -> Optional[float]:
    if male_avg is None or female_avg is None or male_avg <= 0:
        return None
    return round(((male_avg - female_avg) / male_avg) * 100, 1)


def median(values: Sequence[float]) -> Optional[float]:
    cleaned = [float(v) for v in values if v is not None]
    if not cleaned:
        return None
    return float(_median(cleaned))


def classify_review_state(
    female_count: int,
    male_count: int,
    gap_pct: Optional[float],
) -> str:
    if female_count < MIN_CELL_SIZE or male_count < MIN_CELL_SIZE or gap_pct is None:
        return "insufficient_sample"
    absolute = abs(gap_pct)
    if absolute >= UNRESOLVED_GAP_PCT:
        return "unresolved_review_item"
    if absolute >= OBSERVED_GAP_PCT:
        return "observed_gap"
    return "below_trigger"


def review_state_label(state: Optional[str]) -> str:
    if not state:
        return "Unavailable"
    return REVIEW_STATE_LABELS.get(state, state.replace("_", " "))


def market_outlier(internal_gap: Optional[float], market_gap: Optional[float]) -> bool:
    if internal_gap is None or market_gap is None:
        return False
    return abs(internal_gap - market_gap) >= MARKET_OUTLIER_PCT


def sector_letter(nace_code: Optional[str]) -> Optional[str]:
    if not nace_code:
        return None
    letter = str(nace_code).strip()[:1].upper()
    return letter if letter.isalpha() else None


def _as_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def enrich_payroll_rows(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for raw in rows:
        row: dict[str, Any] = dict(raw)
        base = _as_float(row.get("base_pay_amount"), None)
        if base is None:
            base = _as_float(row.get("base_salary"), None)
        variable = _as_float(row.get("variable_pay_amount"), 0.0) or 0.0
        weekly = _as_float(row.get("weekly_hours"), None)
        hours_basis = "reported"
        if weekly is None or weekly <= 0:
            weekly = DEFAULT_WEEKLY_HOURS
            hours_basis = "assumed_default"
        frequency = str(row.get("pay_frequency") or "annual").strip().lower()
        if frequency not in {"annual", "monthly", "hourly"}:
            frequency = "annual"
        hourly_base = hourly_rate(base, frequency, weekly)
        hourly_variable = hourly_rate(variable, frequency, weekly) or 0.0
        hourly_total = None if hourly_base is None else hourly_base + hourly_variable
        row["base_pay_amount"] = base
        row["variable_pay_amount"] = variable
        row["weekly_hours"] = weekly
        row["pay_frequency"] = frequency
        row["hours_basis"] = hours_basis
        row["hourly_base"] = hourly_base
        row["hourly_variable"] = hourly_variable
        row["hourly_total"] = hourly_total
        enriched.append(row)
    return enriched


def _values(rows: Sequence[Mapping[str, Any]], gender: str, field: str) -> list[float]:
    out: list[float] = []
    for row in rows:
        if str(row.get("gender", "")).lower() != gender:
            continue
        value = _as_float(row.get(field), None)
        if value is not None:
            out.append(value)
    return out


def _mean(values: Sequence[float]) -> Optional[float]:
    if not values:
        return None
    return sum(values) / len(values)


def quartile_female_shares(rows: Sequence[Mapping[str, Any]]) -> list[float]:
    ranked = [
        row
        for row in rows
        if _as_float(row.get("hourly_total"), None) is not None
        and str(row.get("gender", "")).lower() in {"female", "male"}
    ]
    ranked.sort(key=lambda row: float(row["hourly_total"]))
    if not ranked:
        return [0.0, 0.0, 0.0, 0.0]
    n = len(ranked)
    shares: list[float] = []
    for band in range(4):
        start = int(band * n / 4)
        end = int((band + 1) * n / 4)
        bucket = ranked[start:end] or ranked[start : start + 1]
        female = sum(1 for row in bucket if str(row.get("gender")).lower() == "female")
        shares.append(round((female / len(bucket)) * 100, 1) if bucket else 0.0)
    return shares


def summarise_category(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    female_rows = [row for row in rows if str(row.get("gender", "")).lower() == "female"]
    male_rows = [row for row in rows if str(row.get("gender", "")).lower() == "male"]
    female_count = len(female_rows)
    male_count = len(male_rows)

    mean_base_f = _mean(_values(rows, "female", "hourly_base"))
    mean_base_m = _mean(_values(rows, "male", "hourly_base"))
    mean_var_f = _mean(_values(rows, "female", "hourly_variable"))
    mean_var_m = _mean(_values(rows, "male", "hourly_variable"))
    mean_tot_f = _mean(_values(rows, "female", "hourly_total"))
    mean_tot_m = _mean(_values(rows, "male", "hourly_total"))
    med_base_f = median(_values(rows, "female", "hourly_base"))
    med_base_m = median(_values(rows, "male", "hourly_base"))
    med_var_f = median(_values(rows, "female", "hourly_variable"))
    med_var_m = median(_values(rows, "male", "hourly_variable"))
    med_tot_f = median(_values(rows, "female", "hourly_total"))
    med_tot_m = median(_values(rows, "male", "hourly_total"))

    mean_gap_total = gender_pay_gap(mean_tot_m, mean_tot_f)
    reportable = female_count >= MIN_CELL_SIZE and male_count >= MIN_CELL_SIZE
    review_state = classify_review_state(female_count, male_count, mean_gap_total)

    def incidence(group: Sequence[Mapping[str, Any]]) -> Optional[float]:
        if not group:
            return None
        receiving = sum(1 for row in group if (_as_float(row.get("variable_pay_amount"), 0.0) or 0.0) > 0)
        return round((receiving / len(group)) * 100, 1)

    return {
        "headcount": female_count + male_count,
        "female_count": female_count,
        "male_count": male_count,
        "mean_gap_base": gender_pay_gap(mean_base_m, mean_base_f) if reportable else None,
        "median_gap_base": gender_pay_gap(med_base_m, med_base_f) if reportable else None,
        "mean_gap_variable": gender_pay_gap(mean_var_m, mean_var_f) if reportable else None,
        "median_gap_variable": gender_pay_gap(med_var_m, med_var_f) if reportable else None,
        "mean_gap_total": mean_gap_total if reportable else None,
        "median_gap_total": gender_pay_gap(med_tot_m, med_tot_f) if reportable else None,
        "female_avg_hourly_total": mean_tot_f,
        "male_avg_hourly_total": mean_tot_m,
        "female_variable_incidence_pct": incidence(female_rows),
        "male_variable_incidence_pct": incidence(male_rows),
        "quartile_female_share_pct": quartile_female_shares(rows) if reportable else [None, None, None, None],
        "review_state": review_state,
        "review_label": review_state_label(review_state),
        "sample_status": "reportable" if reportable else "suppressed",
        "hours_basis": "reported"
        if any(row.get("hours_basis") == "reported" for row in rows)
        else "assumed_default",
    }


def attach_review_fields(row: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    """Fill API review fields from a warehouse / mart row."""
    female_count = int(row.get("female_count") or 0)
    male_count = int(row.get("male_count") or 0)
    gap = row.get("mean_gap_total")
    if gap is None:
        gap = row.get("internal_gender_pay_gap")
    gap_f = _as_float(gap, None)
    state = classify_review_state(female_count, male_count, gap_f)
    row["review_state"] = state
    row["review_label"] = review_state_label(state)
    row["sample_status"] = "reportable" if state != "insufficient_sample" else "suppressed"
    row["mean_gap_total"] = None if state == "insufficient_sample" else gap_f
    market_gap = _as_float(row.get("market_gender_pay_gap"), None)
    internal_for_market = gap_f if state != "insufficient_sample" else None
    row["market_outlier"] = market_outlier(internal_for_market, market_gap)
    return row
