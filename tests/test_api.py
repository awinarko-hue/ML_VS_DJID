"""
Unit & Integration Tests for SITRUS FastAPI endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.database import Base, engine


@pytest.fixture(scope="module")
def client() -> TestClient:
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "degraded"]
    assert "triage_system_ready" in data


def test_single_triage_certified(client: TestClient) -> None:
    response = client.post(
        "/api/triage/single",
        json={"judul": "HT Baofeng UV-5R Dual Band Walkie Talkie 5W"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["TERSERTIFIKASI", "BERSERTIFIKAT"]
    assert data["canonical_brand"] == "baofeng"
    assert data["max_prob"] >= 0.70
    assert len(data["bukti_semantik"]) > 0


def test_single_triage_alias(client: TestClient) -> None:
    response = client.post(
        "/api/triage/single",
        json={"judul": "Pofung UV-5R Radio HT VHF UHF"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["canonical_brand"] == "baofeng"
    assert data["status"] in ["TERSERTIFIKASI", "BERSERTIFIKAT"]


def test_single_triage_uncertified(client: TestClient) -> None:
    response = client.post(
        "/api/triage/single",
        json={"judul": "HT Icom IC-99999 Super Rare Model"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["TERINDIKASI_TIDAK_BERSERTIFIKAT", "PERLU_REVIEW", "PERLU_VERIFIKASI_MANUSIA"]


def test_listings_and_stats(client: TestClient) -> None:
    # Test listings endpoint
    res_list = client.get("/api/listings?limit=5")
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert "items" in list_data
    assert "total" in list_data

    # Test dashboard stats
    res_stats = client.get("/api/stats/dashboard")
    assert res_stats.status_code == 200
    stats_data = res_stats.json()
    assert "total_listings" in stats_data
    assert "status_distribution" in stats_data
    assert "verification" in stats_data


def test_brand_aliases_api(client: TestClient) -> None:
    # Get aliases
    res_get = client.get("/api/brands/aliases")
    assert res_get.status_code == 200
    assert isinstance(res_get.json(), list)

    # Add alias
    res_post = client.post(
        "/api/brands/aliases",
        json={"alias": "ht_bofeng_custom", "merk_kanonik": "baofeng"},
    )
    assert res_post.status_code in [200, 400]


def test_manual_listing_ingest(client: TestClient) -> None:
    res = client.post(
        "/api/listings/manual",
        json={
            "judul": "HT Motorola GP338 Plus VHF Radio",
            "harga": "Rp1.850.000",
            "platform": "tokopedia",
            "nama_penjual": "Toko HT Sentosa",
            "auto_triage": True,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["valid_listings"] == 1
    assert data["total_listings_now"] >= 1


def test_batch_listing_ingest(client: TestClient) -> None:
    res = client.post(
        "/api/listings/ingest",
        json={
            "source": "shopee",
            "auto_triage": True,
            "items": [
                {
                    "data2": "Handy Talky Baofeng UV-82 Dual Band",
                    "data": "Rp220.000",
                    "web_scraper_start_url": "https://shopee.co.id/ucomm.id",
                    "seller": "ucomm.id",
                },
                {
                    "data2": "Radio HT Icom IC-V80 Waterproof",
                    "data": "Rp1.450.000",
                    "seller": "ucomm.id",
                },
            ],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["valid_listings"] == 2


def test_csv_upload_listing_ingest(client: TestClient) -> None:
    csv_content = (
        "web_scraper_order,web_scraper_start_url,data,data2,data3,image\n"
        "1782-1,https://tokopedia.com/seller,Rp350.000,Baofeng BF-888S HT Walkie Talkie,Cashback,https://cdn.com/1.jpg\n"
        "1782-2,https://tokopedia.com/seller,Rp450.000,Walkie Talkie Anak Mainan Murah,Diskon,https://cdn.com/2.jpg\n"
    )
    res = client.post(
        "/api/listings/upload-csv",
        files={"file": ("test_scrape.csv", csv_content.encode("utf-8"), "text/csv")},
        data={"source": "tokopedia", "auto_triage": "true"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["valid_listings"] == 2

