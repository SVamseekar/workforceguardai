# scripts/generate_demo_company.py
"""
Generates realistic demo company data for AeroTech Europe SAS.
Run from the project root: python scripts/generate_demo_company.py
Output: data/internal_raw/payroll_snapshot.csv and data/internal_raw/job_architecture.csv
"""
import csv
import random
from pathlib import Path

SEED = 42
random.seed(SEED)

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "internal_raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

SNAPSHOT_DATE = "2025-12-31"
COUNTRY = "FR"
CURRENCY = "EUR"

# Job architecture: code, family, level, worker_category_id, label, nace, esco_uri
JOB_ARCHITECTURE = [
    ("SE-IC-1", "Engineering", "IC2", "eng_ic",        "Engineering Individual Contributor", "J62", "urn:esco:occupation:2512"),
    ("SE-IC-2", "Engineering", "IC3", "eng_ic",        "Engineering Individual Contributor", "J62", "urn:esco:occupation:2512"),
    ("SE-IC-3", "Engineering", "IC4", "eng_ic",        "Engineering Individual Contributor", "J62", "urn:esco:occupation:2512"),
    ("SE-SR-1", "Engineering", "IC5", "eng_senior",    "Senior Engineer",                    "J62", "urn:esco:occupation:2512"),
    ("SE-SR-2", "Engineering", "IC6", "eng_senior",    "Senior Engineer",                    "J62", "urn:esco:occupation:2512"),
    ("PD-1",    "Product",     "P2",  "product_design","Product & Design",                   "J62", "urn:esco:occupation:2166"),
    ("PD-2",    "Product",     "P3",  "product_design","Product & Design",                   "J62", "urn:esco:occupation:2166"),
    ("HR-1",    "People",      "P2",  "hr_generalist", "HR Generalist",                      "N78", "urn:esco:occupation:2423"),
    ("HR-2",    "People",      "P3",  "hr_generalist", "HR Generalist",                      "N78", "urn:esco:occupation:2423"),
    ("FIN-1",   "Finance",     "P2",  "finance_legal", "Finance & Legal",                    "K64", "urn:esco:occupation:2411"),
    ("SALES-1", "Sales",       "P2",  "sales_gtm",     "Sales & GTM",                        "J62", "urn:esco:occupation:3322"),
]

# category_id -> [(job_codes), female_count, male_count, female_median, male_median]
CATEGORY_CONFIG = {
    "eng_ic":        (["SE-IC-1", "SE-IC-2", "SE-IC-3"], 50,  130, 52000, 58000),
    "eng_senior":    (["SE-SR-1", "SE-SR-2"],             16,  49,  72000, 82000),
    "product_design":(["PD-1", "PD-2"],                   22,  18,  55000, 58000),
    "hr_generalist": (["HR-1", "HR-2"],                   20,  5,   42000, 48000),
    "finance_legal": (["FIN-1"],                          12,  8,   50000, 55000),
    "sales_gtm":     (["SALES-1"],                        9,   11,  48000, 52000),
}

JOB_TITLE_MAP = {
    "SE-IC-1": "Software Engineer",
    "SE-IC-2": "Software Engineer II",
    "SE-IC-3": "Senior Software Engineer",
    "SE-SR-1": "Staff Engineer",
    "SE-SR-2": "Principal Engineer",
    "PD-1":    "Product Manager",
    "PD-2":    "Senior Product Manager",
    "HR-1":    "HR Generalist",
    "HR-2":    "Senior HR Business Partner",
    "FIN-1":   "Financial Analyst",
    "SALES-1": "Account Executive",
}


def normal_pay(median: int) -> int:
    """Return a pay amount within ±15% of median, rounded to nearest 500."""
    low = int(median * 0.85)
    high = int(median * 1.15)
    raw = random.randint(low, high)
    return round(raw / 500) * 500


def generate_payroll():
    rows = []
    emp_id = 1

    for category_id, (job_codes, female_count, male_count, female_median, male_median) in CATEGORY_CONFIG.items():
        for gender, count, median in [("female", female_count, female_median), ("male", male_count, male_median)]:
            for _ in range(count):
                job_code = random.choice(job_codes)
                rows.append({
                    "employee_id": f"emp-{emp_id:04d}",
                    "job_code": job_code,
                    "job_title": JOB_TITLE_MAP[job_code],
                    "country_code": COUNTRY,
                    "worker_category_id": category_id,
                    "gender": gender,
                    "base_pay_amount": normal_pay(median),
                    "pay_currency": CURRENCY,
                    "snapshot_date": SNAPSHOT_DATE,
                    "employment_status": "active",
                    "version": "demo-v1",
                })
                emp_id += 1

    random.shuffle(rows)
    return rows


def write_payroll(rows):
    path = RAW_DIR / "payroll_snapshot.csv"
    fieldnames = ["employee_id", "job_code", "job_title", "country_code", "worker_category_id",
                  "gender", "base_pay_amount", "pay_currency", "snapshot_date", "employment_status", "version"]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Written {len(rows)} rows to {path}")


def write_job_architecture():
    path = RAW_DIR / "job_architecture.csv"
    fieldnames = ["job_code", "job_family", "job_level", "worker_category_id",
                  "worker_category_label", "nace_code", "esco_uri", "version"]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for code, family, level, cat_id, cat_label, nace, esco in JOB_ARCHITECTURE:
            writer.writerow({
                "job_code": code,
                "job_family": family,
                "job_level": level,
                "worker_category_id": cat_id,
                "worker_category_label": cat_label,
                "nace_code": nace,
                "esco_uri": esco,
                "version": "demo-v1",
            })
    print(f"Written {len(JOB_ARCHITECTURE)} job codes to {path}")


if __name__ == "__main__":
    rows = generate_payroll()
    write_payroll(rows)
    write_job_architecture()
    print("Demo company data generated.")
