import React, { useState } from 'react';
import { Search, Download, Filter, ChevronLeft, ChevronRight, Eye, ShieldCheck, AlertOctagon, HelpCircle, Tag } from 'lucide-react';
import { ListingItem } from '../types';

interface ListingsTableProps {
  listings: ListingItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  onPageChange: (p: number) => void;
  onSelectListing: (id: string) => void;
  snapshotDate: string;
}

export const ListingsTable: React.FC<ListingsTableProps> = ({
  listings,
  total,
  page,
  limit,
  totalPages,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onPageChange,
  onSelectListing,
  snapshotDate,
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch);
    onPageChange(1);
  };

  const handleExportCSV = () => {
    const headers = ['id', 'judul_mentah', 'harga_angka', 'brand_terdeteksi', 'status_triase', 'max_prob', 'reason_code', 'snapshot_djid'];
    const rows = listings.map((l) => [
      l.id,
      `"${l.judul_mentah.replace(/"/g, '""')}"`,
      l.harga_angka || '',
      l.brand_terdeteksi || '',
      l.status_triase,
      l.max_prob !== null && l.max_prob !== undefined ? l.max_prob : '',
      l.reason_code || '',
      snapshotDate,
    ]);

    const disclaimerHeader = [
      `# SITRUS - Sistem Triase Sertifikasi Perangkat (DJID / Balmon)`,
      `# Tanggal Snapshot DJID: ${snapshotDate}`,
      `# CATATAN HUKUM: Status TERINDIKASI_TIDAK_BERSERTIFIKAT bersifat indikasi algoritmik awal dan wajib diverifikasi analis sebelum tindakan administratif.`,
      headers.join(','),
    ];

    const csvContent = disclaimerHeader.join('\n') + '\n' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sitrus_triase_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderStatusBadge = (status: string, reason?: string | null) => {
    switch (status) {
      case 'TERSERTIFIKASI':
      case 'BERSERTIFIKAT':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold badge-certified">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Tersertifikasi
          </span>
        );
      case 'TERINDIKASI_TIDAK_BERSERTIFIKAT':
        return (
          <div className="flex flex-col space-y-0.5">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold badge-uncertified">
              <AlertOctagon className="w-3.5 h-3.5 mr-1" />
              Terindikasi Tidak
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              DJID: {snapshotDate} · Belum Diverifikasi
            </span>
          </div>
        );
      case 'PERLU_REVIEW':
      case 'PERLU_VERIFIKASI_MANUSIA':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold badge-review">
            <HelpCircle className="w-3.5 h-3.5 mr-1" />
            Perlu Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold badge-nontelecom">
            {status}
          </span>
        );
    }
  };

  const filterTabs = [
    { label: 'Semua Status', value: '' },
    { label: 'Tersertifikasi', value: 'TERSERTIFIKASI' },
    { label: 'Terindikasi Tidak', value: 'TERINDIKASI_TIDAK_BERSERTIFIKAT' },
    { label: 'Perlu Review', value: 'PERLU_REVIEW' },
  ];

  return (
    <div className="space-y-4">
      {/* Controls & Search Bar */}
      <div className="glass-panel rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Cari judul listing marketplace..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </form>

        {/* Filter Chips & Export Button */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto justify-between md:justify-end">
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusFilter(tab.value);
                  onPageChange(1);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  statusFilter === tab.value
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-all"
            title="Export data dengan disclaimer hukum"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Judul Listing Marketplace</th>
                <th className="py-3.5 px-4 w-32">Harga</th>
                <th className="py-3.5 px-4 w-36">Merek Terdeteksi</th>
                <th className="py-3.5 px-4 w-52">Status Triase</th>
                <th className="py-3.5 px-4 w-28 text-center">Confidence</th>
                <th className="py-3.5 px-4 w-20 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-normal">
              {listings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Tidak ada listing yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                listings.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-100 line-clamp-2 max-w-xl">
                        {item.judul_mentah}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        ID: {item.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {item.harga_angka ? `Rp ${item.harga_angka.toLocaleString()}` : item.harga_mentah || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {item.brand_terdeteksi ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-blue-950/60 text-blue-300 border border-blue-800/40 uppercase">
                          <Tag className="w-3 h-3 mr-1" />
                          {item.brand_terdeteksi}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Tidak terdeteksi</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {renderStatusBadge(item.status_triase, item.reason_code)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-xs">
                      {item.max_prob !== null && item.max_prob !== undefined ? (
                        <span
                          className={`font-semibold ${
                            item.max_prob >= 0.8
                              ? 'text-emerald-400'
                              : item.max_prob <= 0.3
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {(item.max_prob * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectListing(item.id)}
                        className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                        title="Lihat Bukti Top-K & Verifikasi"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Menampilkan <strong className="text-slate-200">{listings.length}</strong> dari{' '}
            <strong className="text-slate-200">{total}</strong> listing
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono">
              Halaman {page} dari {totalPages || 1}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
