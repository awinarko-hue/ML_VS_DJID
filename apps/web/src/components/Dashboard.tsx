import React from 'react';
import { ShieldCheck, AlertOctagon, HelpCircle, FileCheck, ArrowRight, Play, AlertTriangle, Layers, Info } from 'lucide-react';
import { DashboardStats } from '../types';

interface DashboardProps {
  stats?: DashboardStats;
  onNavigate: (tab: string) => void;
  onTriggerBatch: () => void;
  isBatchRunning: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, onNavigate, onTriggerBatch, isBatchRunning }) => {
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
        Memuat statistik triase pengawasan...
      </div>
    );
  }

  const dist = stats.status_distribution;
  const total = stats.total_listings || 1;
  const pctCert = Math.round((dist.bersertifikat / total) * 100);
  const pctUncert = Math.round((dist.terindikasi_tidak_bersertifikat / total) * 100);
  const pctReview = Math.round((dist.perlu_verifikasi_manusia / total) * 100);

  return (
    <div className="space-y-6">
      {/* Welcome & Action Banner */}
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Dashboard Triase Pengawasan Alat & Perangkat Telekomunikasi
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Penyaringan kepatuhan sertifikasi alat telekomunikasi DJID terhadap listing marketplace dengan dual-path retrieval dan model klasifikasi SBERT.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onTriggerBatch}
              disabled={isBatchRunning}
              className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 transition-all text-sm"
            >
              <Play className={`w-4 h-4 ${isBatchRunning ? 'animate-spin' : ''}`} />
              <span>{isBatchRunning ? 'Sedang Memproses...' : 'Jalankan Triase Batch'}</span>
            </button>
            <button
              onClick={() => onNavigate('review_queue')}
              className="flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium shadow-lg shadow-rose-500/25 transition-all text-sm"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Tinjau Antrean ({stats.review_queue.antrean_prioritas_tinggi})</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Listings */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Listing Diperiksa</span>
            <Layers className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white font-mono">
              {stats.total_listings.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">Listing radio & HT marketplace</p>
          </div>
        </div>

        {/* Bersertifikat */}
        <div className="glass-panel rounded-xl p-5 border border-emerald-900/50 bg-emerald-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Tersertifikasi</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-emerald-300 font-mono">
              {dist.bersertifikat.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-emerald-400/80 mt-1">
              <span>{pctCert}% dari total listing</span>
            </div>
          </div>
        </div>

        {/* Terindikasi Tidak Bersertifikat */}
        <div className="glass-panel rounded-xl p-5 border border-rose-900/50 bg-rose-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Terindikasi Tidak</span>
            <AlertOctagon className="w-5 h-5 text-rose-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-rose-300 font-mono">
              {dist.terindikasi_tidak_bersertifikat.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-rose-400/80 mt-1">
              <span>{pctUncert}% · Memerlukan verifikasi</span>
            </div>
          </div>
        </div>

        {/* Perlu Verifikasi Manusia */}
        <div className="glass-panel rounded-xl p-5 border border-amber-900/50 bg-amber-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Zona Ambiguitas</span>
            <HelpCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-amber-300 font-mono">
              {dist.perlu_verifikasi_manusia.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-amber-400/80 mt-1">
              <span>{pctReview}% · Perlu review analis</span>
            </div>
          </div>
        </div>
      </div>

      {/* Distribution & Asymmetry Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown Bar */}
        <div className="glass-panel rounded-xl p-6 border border-slate-800 lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-white">Distribusi Status Triase Perangkat</h2>
          
          {/* Progress Bar Stack */}
          <div className="h-4 rounded-full bg-slate-800 overflow-hidden flex">
            <div style={{ width: `${pctCert}%` }} className="bg-emerald-500 h-full transition-all" title={`Tersertifikasi: ${pctCert}%`}></div>
            <div style={{ width: `${pctUncert}%` }} className="bg-rose-500 h-full transition-all" title={`Terindikasi Tidak: ${pctUncert}%`}></div>
            <div style={{ width: `${pctReview}%` }} className="bg-amber-500 h-full transition-all" title={`Perlu Review: ${pctReview}%`}></div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-slate-300">Tersertifikasi ({dist.bersertifikat})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <span className="text-slate-300">Terindikasi Tidak ({dist.terindikasi_tidak_bersertifikat})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-slate-300">Perlu Review ({dist.perlu_verifikasi_manusia})</span>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Snapshot DJID Aktif: <strong className="text-slate-200">{stats.snapshot_djid_aktif.tanggal}</strong> ({stats.snapshot_djid_aktif.total_entri} sertifikat)</span>
            <button
              onClick={() => onNavigate('listings')}
              className="text-blue-400 hover:text-blue-300 flex items-center space-x-1 font-medium"
            >
              <span>Lihat Semua Listing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Legal Disclaimer & Asymmetry Rule Box */}
        <div className="glass-panel rounded-xl p-6 border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
              <Info className="w-4 h-4 text-amber-400" />
              <span>Prinsip Asimetri Hukum DJID</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Keluaran sistem memiliki konsekuensi hukum langsung bagi pemilik listing. Kesalahan menuduh perangkat bersertifikat sebagai tidak bersertifikat (Tipe I) jauh lebih mahal daripada kesalahan meloloskan perangkat tanpa sertifikat (Tipe II).
            </p>
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-300/90 leading-normal">
              Status <strong>TERINDIKASI_TIDAK_BERSERTIFIKAT</strong> bersifat indikasi awal dan tidak pernah dieksekusi secara otomatis tanpa verifikasi manusia.
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Status Verifikasi:</span>
            <span className="font-semibold text-amber-400 font-mono">
              {stats.verification.persen_belum_terverifikasi}% Belum Diverifikasi
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
