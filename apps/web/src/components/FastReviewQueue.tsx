import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, CheckCircle2, XCircle, HelpCircle, Ban, ArrowRight, Keyboard, Sparkles, RefreshCw } from 'lucide-react';
import { fetchReviewQueue, submitReviewDecision, fetchListingDetail } from '../api';
import { ReviewQueueItem, ListingDetail } from '../types';

export const FastReviewQueue: React.FC = () => {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: queueData, isLoading, refetch } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: () => fetchReviewQueue(undefined, 1, 50),
  });

  const items = queueData?.items || [];
  const currentItem: ReviewQueueItem | undefined = items[currentIndex];

  // Fetch full detail for the current item
  const { data: currentDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['listingDetail', currentItem?.listing_id],
    queryFn: () => fetchListingDetail(currentItem!.listing_id),
    enabled: !!currentItem,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ taskId, decision, note }: { taskId: string; decision: string; note: string }) =>
      submitReviewDecision(taskId, decision, note),
    onSuccess: (_, variables) => {
      setFeedback(`Keputusan "${variables.decision}" berhasil disimpan.`);
      setTimeout(() => setFeedback(null), 2500);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      if (currentIndex < items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        refetch();
        setCurrentIndex(0);
      }
    },
  });

  const handleDecision = (decision: string) => {
    if (!currentItem || reviewMutation.isPending) return;
    reviewMutation.mutate({
      taskId: currentItem.task_id,
      decision,
      note: notes,
    });
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkeys if typing in textarea
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        return;
      }

      if (e.key === '1') handleDecision('TERKONFIRMASI_SESUAI');
      if (e.key === '2') handleDecision('TERKONFIRMASI_TIDAK_SESUAI');
      if (e.key === '3') handleDecision('PERLU_TINDAK_LANJUT');
      if (e.key === '4') handleDecision('BUKAN_PERANGKAT_TELEKOMUNIKASI');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItem, notes, reviewMutation.isPending]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-blue-500" />
        Memuat antrean verifikasi analis...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800 space-y-4 max-w-xl mx-auto my-12">
        <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-700/50 flex items-center justify-center mx-auto text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Antrean Peninjauan Bersih!</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Seluruh listing yang memerlukan verifikasi manual telah selesai ditinjau. Sistem akan memperbarui antrean saat ada batch scraper baru atau triase baru yang dijalankan.
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
        >
          Periksa Ulang Antrean
        </button>
      </div>
    );
  }

  const tRes = currentDetail?.triage_result;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header & Keyboard Shortcut Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-white">Antrean Peninjauan Cepat (Fast Review)</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {currentIndex + 1} dari {items.length} item
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Gunakan tombol angka pada keyboard (1, 2, 3, 4) untuk memutuskan secara instan.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 font-mono">
          <Keyboard className="w-3.5 h-3.5 text-blue-400" />
          <span>[1] Sesuai</span>
          <span>·</span>
          <span>[2] Tidak Sesuai</span>
          <span>·</span>
          <span>[3] Ragu</span>
          <span>·</span>
          <span>[4] Bukan Radio</span>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-medium animate-fade-in flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Review Card */}
      <div className="glass-panel rounded-2xl border border-slate-700/80 p-6 space-y-6 shadow-2xl">
        {/* Marketplace Listing Details */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Listing Marketplace #{currentItem.listing_id.slice(0, 8)}</span>
            <span className="font-mono text-slate-400">
              {currentItem.harga_angka ? `Rp ${currentItem.harga_angka.toLocaleString()}` : '-'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white leading-snug">
            {currentItem.judul_mentah}
          </h1>
        </div>

        {/* Current Algorithmic Indication */}
        <div
          className={`p-4 rounded-xl border flex items-start justify-between ${
            currentItem.status_triase === 'TERINDIKASI_TIDAK_BERSERTIFIKAT'
              ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
              : currentItem.status_triase === 'TERSERTIFIKASI' || currentItem.status_triase === 'BERSERTIFIKAT'
              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
              : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider block">Indikasi Algoritma:</span>
            <span className="text-sm font-bold text-white">{currentItem.status_triase}</span>
            <div className="text-xs text-slate-300 mt-0.5">Alasan: {currentItem.reason_code}</div>
          </div>
          <div className="text-right font-mono">
            <span className="text-xl font-extrabold text-white">{(currentItem.max_prob * 100).toFixed(1)}%</span>
            <span className="block text-[10px] text-slate-400">Match Prob</span>
          </div>
        </div>

        {/* Top-3 DJID Matches Candidate Evidence */}
        {tRes && tRes.bukti_semantik && tRes.bukti_semantik.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Padanan Teratas di Basis Data DJID (Top-3):
            </span>
            <div className="space-y-2">
              {tRes.bukti_semantik.slice(0, 3).map((cand, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    idx === 0 ? 'bg-blue-950/30 border-blue-800/60 text-slate-200' : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-white">{cand.identitas}</div>
                    <div className="text-[11px] text-blue-400 font-mono mt-0.5">Sertifikat: {cand.sertifikat || '-'}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-emerald-400">
                      {cand.prob_match !== undefined ? `${(cand.prob_match * 100).toFixed(1)}%` : '-'}
                    </div>
                    <div className="text-[10px] text-slate-500">Cosine: {cand.cosine?.toFixed(3)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optional Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Catatan Tambahan Analis (Opsional):
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tuliskan catatan singkat jika ada temuan spesifik..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Action Decision Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <button
            onClick={() => handleDecision('TERKONFIRMASI_SESUAI')}
            disabled={reviewMutation.isPending}
            className="p-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-600/40 font-semibold text-xs flex flex-col items-center justify-center space-y-1 transition-all group"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 group-hover:text-white" />
            <span>[1] Bersertifikat</span>
          </button>

          <button
            onClick={() => handleDecision('TERKONFIRMASI_TIDAK_SESUAI')}
            disabled={reviewMutation.isPending}
            className="p-3.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/40 font-semibold text-xs flex flex-col items-center justify-center space-y-1 transition-all group"
          >
            <XCircle className="w-5 h-5 text-rose-400 group-hover:text-white" />
            <span>[2] Tidak Bersertifikat</span>
          </button>

          <button
            onClick={() => handleDecision('PERLU_TINDAK_LANJUT')}
            disabled={reviewMutation.isPending}
            className="p-3.5 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-600/40 font-semibold text-xs flex flex-col items-center justify-center space-y-1 transition-all group"
          >
            <HelpCircle className="w-5 h-5 text-amber-400 group-hover:text-white" />
            <span>[3] Perlu Klarifikasi</span>
          </button>

          <button
            onClick={() => handleDecision('BUKAN_PERANGKAT_TELEKOMUNIKASI')}
            disabled={reviewMutation.isPending}
            className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-semibold text-xs flex flex-col items-center justify-center space-y-1 transition-all group"
          >
            <Ban className="w-5 h-5 text-slate-400 group-hover:text-white" />
            <span>[4] Bukan Radio</span>
          </button>
        </div>
      </div>
    </div>
  );
};
