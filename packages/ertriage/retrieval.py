"""
Retrieval mechanisms: Semantic (FAISS), Lexical (BM25), Hybrid (RRF), and Exact Scan (Aho-Corasick).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

import numpy as np
import pandas as pd

from ertriage.config import MIN_MODEL_LENGTH
from ertriage.text import clean_text, normalize_model

logger = logging.getLogger(__name__)

try:
    import ahocorasick
except ImportError:
    ahocorasick = None  # type: ignore


@dataclass
class ExactMatchResult:
    idx_djid: int
    nomor_sertifikat: str
    identitas: str
    model_norm: str
    brand_djid: str


class ExactModelMatcher:
    """
    Pencocokan nomor model eksak pada seluruh entri DJID.
    Menggunakan Aho-Corasick automaton bila tersedia, dengan fallback linear scan yang efisien.
    """

    def __init__(
        self,
        djid_entries: Sequence[Mapping[str, Any]],
        min_model_length: int = MIN_MODEL_LENGTH,
    ) -> None:
        self.min_model_length = min_model_length
        self.entries = djid_entries
        self._automaton = None
        self._model_lookup: list[tuple[int, str, str, str, str]] = []

        # Siapkan data lookup
        for idx, row in enumerate(djid_entries):
            m_norm = normalize_model(row.get("model", ""))
            if len(m_norm) >= self.min_model_length:
                b_norm = clean_text(row.get("merk", ""))
                cert = str(row.get("nomor_sertifikat", ""))
                ident = str(row.get("identitas", f"{b_norm} {m_norm}"))
                self._model_lookup.append((idx, m_norm, b_norm, cert, ident))

        # Bangun Aho-Corasick jika library tersedia
        if ahocorasick is not None and self._model_lookup:
            A = ahocorasick.Automaton()
            for idx, m_norm, b_norm, cert, ident in self._model_lookup:
                # Key di automaton adalah normalized model
                if not A.exists(m_norm):
                    A.add_word(m_norm, [(idx, m_norm, b_norm, cert, ident)])
                else:
                    existing = A.get(m_norm)
                    existing.append((idx, m_norm, b_norm, cert, ident))
            A.make_automaton()
            self._automaton = A

    def match(
        self,
        judul_listing: str,
        detected_brand: str | None = None,
    ) -> list[ExactMatchResult]:
        """
        Cari entri DJID yang nomor modelnya muncul di dalam judul listing.
        """
        title_norm = normalize_model(judul_listing)
        if len(title_norm) < self.min_model_length:
            return []

        brand_q = clean_text(detected_brand) if detected_brand else None
        hits: list[ExactMatchResult] = []
        seen_idx = set()

        if self._automaton is not None:
            # Aho-Corasick scan
            for end_idx, entry_list in self._automaton.iter(title_norm):
                for idx, m_norm, b_norm, cert, ident in entry_list:
                    if idx in seen_idx:
                        continue
                    # Jika merek terdeteksi di judul, merek DJID harus konsisten
                    if brand_q and b_norm and b_norm != brand_q:
                        continue
                    seen_idx.add(idx)
                    hits.append(
                        ExactMatchResult(
                            idx_djid=idx,
                            nomor_sertifikat=cert,
                            identitas=ident,
                            model_norm=m_norm,
                            brand_djid=b_norm,
                        )
                    )
        else:
            # Fallback scan
            for idx, m_norm, b_norm, cert, ident in self._model_lookup:
                if m_norm in title_norm:
                    if idx in seen_idx:
                        continue
                    if brand_q and b_norm and b_norm != brand_q:
                        continue
                    seen_idx.add(idx)
                    hits.append(
                        ExactMatchResult(
                            idx_djid=idx,
                            nomor_sertifikat=cert,
                            identitas=ident,
                            model_norm=m_norm,
                            brand_djid=b_norm,
                        )
                    )

        return hits


def reciprocal_rank_fusion(
    dense_ranks: list[int],
    sparse_ranks: list[int],
    k_rrf: int = 60,
    top_k: int = 20,
) -> list[tuple[int, float]]:
    """
    Menggabungkan hasil retrieval dense dan sparse menggunakan Reciprocal Rank Fusion (RRF).

    Score(d) = 1/(k + rank_dense) + 1/(k + rank_sparse)
    """
    scores: dict[int, float] = {}

    for rank, doc_id in enumerate(dense_ranks, start=1):
        scores[doc_id] = scores.get(doc_id, 0.0) + (1.0 / (k_rrf + rank))

    for rank, doc_id in enumerate(sparse_ranks, start=1):
        scores[doc_id] = scores.get(doc_id, 0.0) + (1.0 / (k_rrf + rank))

    sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_docs[:top_k]
