"""
Golden Test: Memastikan proses pipeline deterministik.
"""

from __future__ import annotations

import json
from pathlib import Path
import pytest
from ertriage.artifacts import calculate_file_checksum, load_system


def test_artifacts_exist_and_match_manifest() -> None:
    manifest_path = Path("Artefak/manifest.json")
    assert manifest_path.exists(), "Manifest artefak harus ada di folder Artefak"

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    artifacts = manifest.get("artifacts", {})
    assert len(artifacts) >= 4, "Minimal 4 artefak terdaftar di manifest"

    for art_name, art_info in artifacts.items():
        rel_path = art_info["path"]
        expected_sha = art_info["sha256"]
        file_path = Path("Artefak") / Path(rel_path).name
        if not file_path.exists():
            file_path = Path(rel_path)

        assert file_path.exists(), f"File artefak {rel_path} harus ada di disk"
        actual_sha = calculate_file_checksum(file_path)
        assert actual_sha == expected_sha, (
            f"Checksum artefak {art_name} ({file_path}) tidak cocok dengan manifest. "
            f"Expected {expected_sha}, got {actual_sha}"
        )


def test_system_loads_cleanly() -> None:
    system = load_system()
    assert system.df_djid is not None
    assert len(system.df_djid) > 0
    assert system.index is not None
    assert system.classifier is not None
    assert system.brand_detector is not None
