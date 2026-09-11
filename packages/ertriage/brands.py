"""
Brand lexicon, alias resolution, and efficient brand detection.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Collection, Mapping

from ertriage.text import clean_text


@dataclass(frozen=True)
class BrandDetectionResult:
    """Hasil deteksi merek pada teks judul."""
    raw_match: str | None = None
    canonical_brand: str | None = None
    is_in_djid: bool = False
    is_known_market: bool = False


# Default alias awal untuk radio telekomunikasi
DEFAULT_BRAND_ALIASES: dict[str, str] = {
    "pofung": "baofeng",
    "mag one": "motorola",
    "magone": "motorola",
    "motorola magone": "motorola",
    "motorola mag one": "motorola",
}

# Default merek pasar tambahan yang dikenal analis
DEFAULT_MARKET_BRANDS: set[str] = {
    "baofeng", "motorola", "icom", "kenwood", "hytera", "yaesu", "alinco",
    "tyt", "quansheng", "voxter", "weierwei", "redell", "smp", "verxion",
    "firstcom", "berlin", "clarigo", "suicom", "toriphone", "lupax", "great",
    "pofung", "mag one", "magone", "merodith", "tait", "comba", "kirisun",
    "vertex standard", "global wave", "cerntel", "cenrf", "simoco", "harris",
}


class BrandDetector:
    """
    Detektor merek berbasis leksikon ganda dan resolusi alias kanonikal.
    """

    def __init__(
        self,
        brands_djid: Collection[str] | None = None,
        brands_market: Collection[str] | None = None,
        aliases: Mapping[str, str] | None = None,
    ) -> None:
        self.brands_djid = {b.strip().lower() for b in (brands_djid or []) if b and str(b).strip()}
        self.aliases = {k.strip().lower(): v.strip().lower() for k, v in (aliases or DEFAULT_BRAND_ALIASES).items()}
        
        # Gabungkan seluruh leksikon yang dikenal
        all_market = set(DEFAULT_MARKET_BRANDS)
        if brands_market:
            all_market.update(b.strip().lower() for b in brands_market if b and str(b).strip())
        all_market.update(self.brands_djid)
        all_market.update(self.aliases.keys())
        self.brands_market = all_market

        # Bangun regex alternation tunggal terurut berdasarkan panjang string (panjang -> pendek)
        self._compiled_regex = self._build_regex(self.brands_market)

    @staticmethod
    def _build_regex(lexicon: Collection[str]) -> re.Pattern | None:
        if not lexicon:
            return None
        sorted_lexicon = sorted([re.escape(b) for b in lexicon if b], key=len, reverse=True)
        if not sorted_lexicon:
            return None
        pattern = r"\b(" + "|".join(sorted_lexicon) + r")\b"
        return re.compile(pattern, flags=re.IGNORECASE)

    def detect(self, text: str) -> BrandDetectionResult:
        """
        Deteksi merek dalam teks, selesaikan alias ke bentuk kanonikal,
        dan verifikasi apakah merek tersebut terdaftar di DJID.
        """
        if not self._compiled_regex:
            return BrandDetectionResult()

        t_clean = clean_text(text)
        match = self._compiled_regex.search(t_clean)
        if not match:
            return BrandDetectionResult()

        raw_match = match.group(0).lower().strip()
        # Resolusi alias kanonikal
        canonical = self.aliases.get(raw_match, raw_match)
        is_djid = canonical in self.brands_djid
        is_market = raw_match in self.brands_market or canonical in self.brands_market

        return BrandDetectionResult(
            raw_match=raw_match,
            canonical_brand=canonical,
            is_in_djid=is_djid,
            is_known_market=is_market,
        )

    def update_aliases(self, new_aliases: Mapping[str, str]) -> None:
        """Perbarui tabel alias merek."""
        for k, v in new_aliases.items():
            self.aliases[k.strip().lower()] = v.strip().lower()
            self.brands_market.add(k.strip().lower())
        self._compiled_regex = self._build_regex(self.brands_market)
