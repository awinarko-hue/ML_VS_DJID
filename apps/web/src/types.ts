export interface CandidateEvidence {
  idx_djid?: number;
  rank?: number;
  identitas: string;
  sertifikat: string;
  model_norm?: string;
  brand_djid?: string;
  cosine?: number;
  prob_match?: number;
}

export interface TriageResultDetail {
  status: string;
  reason: string;
  keterangan: string;
  max_prob: number;
  n_exact_hit: number;
  kandidat_terbaik?: string | null;
  sertifikat_terbaik?: string | null;
  bukti_semantik: CandidateEvidence[];
  bukti_eksak: CandidateEvidence[];
  snapshot_djid: string;
}

export interface ReviewDecisionRecord {
  id: string;
  keputusan_manusia: string;
  catatan?: string | null;
  reviewer_id: string;
  waktu_putusan?: string | null;
}

export interface ReviewTaskRecord {
  id: string;
  status_antrean: string;
  prioritas: number;
  ditugaskan_ke?: string | null;
  dibuat_pada?: string | null;
}

export interface ListingItem {
  id: string;
  judul_mentah: string;
  judul_bersih: string;
  harga_angka?: number | null;
  harga_mentah?: string | null;
  url_gambar?: string | null;
  url_start?: string | null;
  nama_penjual?: string | null;
  brand_terdeteksi?: string | null;
  status_triase: string;
  max_prob?: number | null;
  reason_code?: string | null;
  dibuat_pada?: string | null;
}

export interface ListingDetail extends ListingItem {
  triage_result?: TriageResultDetail | null;
  review_task?: ReviewTaskRecord | null;
  review_history: ReviewDecisionRecord[];
  disclaimer: string;
}

export interface DashboardStats {
  total_listings: number;
  status_distribution: {
    bersertifikat: number;
    terindikasi_tidak_bersertifikat: number;
    perlu_verifikasi_manusia: number;
    bukan_perangkat_telekomunikasi: number;
    belum_ditriase: number;
  };
  verification: {
    total_terverifikasi: number;
    total_belum_terverifikasi: number;
    persen_belum_terverifikasi: number;
  };
  review_queue: {
    total_antrean_menunggu: number;
    antrean_prioritas_tinggi: number;
  };
  snapshot_djid_aktif: {
    tanggal: string;
    total_entri: number;
  };
}

export interface BrandAlias {
  id: string;
  alias: string;
  merk_kanonik: string;
  sumber: string;
  dibuat_oleh: string;
  dibuat_pada: string;
}

export interface ReviewQueueItem {
  task_id: string;
  triage_result_id: string;
  listing_id: string;
  judul_mentah: string;
  harga_angka?: number | null;
  prioritas: number;
  status_triase: string;
  max_prob: number;
  reason_code: string;
  dibuat_pada?: string | null;
}
