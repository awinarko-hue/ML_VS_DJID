import { BrandAlias, DashboardStats, ListingDetail, ListingItem, ReviewQueueItem } from './types';

const API_BASE = '/api';

export async function fetchHealth(): Promise<any> {
  const res = await fetch('/health');
  if (!res.ok) throw new Error('Gagal mengambil status health');
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/stats/dashboard`);
  if (!res.ok) throw new Error('Gagal memuat statistik dashboard');
  return res.json();
}

export async function fetchListings(
  page: number = 1,
  limit: number = 20,
  q: string = '',
  statusTriase: string = '',
  sortBy: string = 'created_at',
  sortOrder: string = 'desc'
): Promise<{ items: ListingItem[]; total: number; page: number; limit: number; total_pages: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sort_by: sortBy,
    sort_order: sortOrder,
  });
  if (q) params.append('q', q);
  if (statusTriase) params.append('status_triase', statusTriase);

  const res = await fetch(`${API_BASE}/listings?${params.toString()}`);
  if (!res.ok) throw new Error('Gagal memuat daftar listing');
  return res.json();
}

export async function fetchListingDetail(id: string): Promise<ListingDetail> {
  const res = await fetch(`${API_BASE}/listings/${id}`);
  if (!res.ok) throw new Error('Gagal memuat detail listing');
  return res.json();
}

export async function triageSingle(judul: string): Promise<any> {
  const res = await fetch(`${API_BASE}/triage/single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ judul }),
  });
  if (!res.ok) throw new Error('Gagal melakukan triase tunggal');
  return res.json();
}

export async function fetchReviewQueue(
  prioritas?: number,
  page: number = 1,
  limit: number = 20
): Promise<{ items: ReviewQueueItem[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (prioritas !== undefined) params.append('prioritas', prioritas.toString());

  const res = await fetch(`${API_BASE}/review-queue?${params.toString()}`);
  if (!res.ok) throw new Error('Gagal memuat antrean peninjauan');
  return res.json();
}

export async function submitReviewDecision(
  taskId: string,
  keputusanManusia: string,
  catatan?: string,
  entriDjidId?: string,
  durasiDetik?: number
): Promise<any> {
  const res = await fetch(`${API_BASE}/reviews/tasks/${taskId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keputusan_manusia: keputusanManusia,
      catatan: catatan || null,
      entri_djid_terpilih_id: entriDjidId || null,
      reviewer_id: 'analyst_web',
      durasi_detik: durasiDetik || 0,
    }),
  });
  if (!res.ok) throw new Error('Gagal menyimpan keputusan peninjauan');
  return res.json();
}

export async function fetchBrandAliases(): Promise<BrandAlias[]> {
  const res = await fetch(`${API_BASE}/brands/aliases`);
  if (!res.ok) throw new Error('Gagal memuat kamus alias');
  return res.json();
}

export async function createBrandAlias(alias: string, merkKanonik: string): Promise<BrandAlias> {
  const res = await fetch(`${API_BASE}/brands/aliases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias, merk_kanonik: merkKanonik, sumber: 'analyst_ui' }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Gagal menambahkan alias merek');
  }
  return res.json();
}

export async function triggerBatchTriage(): Promise<any> {
  const res = await fetch(`${API_BASE}/triage/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Gagal memicu batch triase');
  return res.json();
}
