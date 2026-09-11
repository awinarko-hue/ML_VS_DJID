"""
Gold Set Export Pipeline.

Exports verified human annotations from review_decision table to structured CSV/JSON
with support for inter-annotator agreement calculation (Cohen's Kappa).
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any

import pandas as pd

from apps.api.database import SessionLocal
from apps.api.models import Listing, ReviewDecision, ReviewTask, TriageResult

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("sitrus.export_goldset")


def export_gold_set(
    output_path: Path = Path("Artefak/gold_set_annotated.csv"),
    format_type: str = "csv",
) -> int:
    db = SessionLocal()
    try:
        # Query all listings that have human review decisions
        decisions = (
            db.query(ReviewDecision, ReviewTask, TriageResult, Listing)
            .join(ReviewTask, ReviewDecision.review_task_id == ReviewTask.id)
            .join(TriageResult, ReviewTask.triage_result_id == TriageResult.id)
            .join(Listing, TriageResult.listing_id == Listing.id)
            .all()
        )

        rows = []
        for dec, task, t_res, listing in decisions:
            rows.append({
                "decision_id": dec.id,
                "listing_id": listing.id,
                "judul_mentah": listing.judul_mentah,
                "judul_bersih": listing.judul_bersih,
                "harga_angka": listing.harga_angka,
                "brand_terdeteksi": listing.brand_terdeteksi,
                "status_triase_algoritmik": t_res.status,
                "reason_code_algoritmik": t_res.reason_code,
                "max_prob_algoritmik": t_res.max_prob,
                "keputusan_manusia": dec.keputusan_manusia,
                "entri_djid_terpilih_id": dec.entri_djid_terpilih_id,
                "catatan_analis": dec.catatan,
                "reviewer_id": dec.reviewer_id,
                "durasi_detik": dec.durasi_detik,
                "waktu_putusan": dec.waktu_putusan.isoformat() if dec.waktu_putusan else None,
            })

        df = pd.DataFrame(rows)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if format_type == "json":
            df.to_json(output_path, orient="records", indent=2, force_ascii=False)
        else:
            df.to_csv(output_path, index=False, encoding="utf-8-sig")

        logger.info("Berhasil mengekspor %d entri gold set ke %s", len(df), output_path)
        return len(df)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Export SITRUS Human Gold Set")
    parser.add_argument("--output", type=Path, default=Path("Artefak/gold_set_annotated.csv"), help="Output path")
    parser.add_argument("--format", type=str, default="csv", choices=["csv", "json"], help="Output format")
    args = parser.parse_args()

    count = export_gold_set(args.output, args.format)
    print(f"Export selesai: {count} entri tersimpan di {args.output}")


if __name__ == "__main__":
    main()
