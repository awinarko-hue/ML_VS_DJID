import React, { useState } from 'react';
import { X, ShieldCheck, AlertOctagon, HelpCircle, ExternalLink, Check, AlertTriangle, Clock, User, Tag, Scale } from 'lucide-react';
import { ListingDetail } from '../types';
import { submitReviewDecision } from '../api';

interface ListingDetailModalProps {
  listing: ListingDetail | null;
  onClose: () => void;
  onReviewed: () => void;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({ listing, onClose, onReviewed }) => {
  const [decision, setDecision] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!listing) return null;

  const tRes = listing.triage_result;

  const handleSubmitReview = async () => {
    if (!decision) {
      setErrorMsg('Pilih keputusan verifikasi sebelum menyimpan.');
      return;
    }
    if (!listing.review_task) {
      setErrorMsg('Tidak ada antrean review task untuk listing ini.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await submitReviewDecision(listing.review_task.id, decision, notes);
      onReviewed();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan verifikasi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-4xl rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
              <Scale className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">Detail Audit Trail Triase Listing</h2>
              <p className="text-xs text-slate-400 font-mono">ID: {listing.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Marketplace Listing Card */}
          <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Data Listing Marketplace
            </span>
            <div className="text-base font-semibold text-white">{listing.judul_mentah}</div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-slate-500 block">Harga Tertera:</span>
                <span className="font-mono text-slate-200 font-medium">
                  {listing.harga_angka ? `Rp ${listing.harga_angka.toLocaleString()}` : listing.harga_mentah || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Nama Penjual:</span>
                <span className="text-slate-200">{listing.nama_penjual || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Merek Terdeteksi:</span>
                <span className="text-blue-400 font-mono uppercase">{listing.brand_terdeteksi || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">URL Toko / Scraper:</span>
                {listing.url_start ? (
                  <a
                    href={listing.url_start}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline flex items-center space-x-1"
                  >
                    <span>Buka URL</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </div>
            </div>
          </div>

          {/* Decision Summary Card */}
          {tRes ? (
            <div
              className={`p-5 rounded-xl border ${
                tRes.status === 'TERSERTIFIKASI' || tRes.status === 'BERSERTIFIKAT'
                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                  : tRes.status === 'TERINDIKASI_TIDAK_BERSERTIFIKAT'
                  ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                  : 'bg-amber-950/30 border-amber-800/50 text-amber-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Hasil Triase Algoritmik:</span>
                    <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-slate-900/80 border">
                      {tRes.status}
                    </span>
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    {tRes.reason}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{tRes.keterangan}</p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-2xl font-black">
                    {(tRes.max_prob * 100).toFixed(1)}%
                  </div>
                  <span className="text-[11px] text-slate-400">Confidence Match</span>
                </div>
              </div>

              {/* Negative Status Mandatory Legal Coupling */}
              {tRes.status === 'TERINDIKASI_TIDAK_BERSERTIFIKAT' && (
                <div className="mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-700/60 text-xs text-rose-200 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Perhatian Hukum:</strong> Status negatif ini merujuk pada basis data DJID snapshot{' '}
                    <u>{tRes.snapshot_djid}</u> dan <strong>BELUM</strong> diverifikasi oleh analis pengawasan.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
              Listing ini belum diproses oleh pipeline triase.
            </div>
          )}

          {/* Top-K Evidence Table */}
          {tRes && tRes.bukti_semantik && tRes.bukti_semantik.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Bukti Kandidat Sertifikasi DJID (Top-{tRes.bukti_semantik.length})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Dual-path: Eksak ({tRes.n_exact_hit}) · Semantik FAISS
                </span>
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                      <th className="py-2.5 px-3">Identitas Perangkat DJID</th>
                      <th className="py-2.5 px-3">Nomor Sertifikat</th>
                      <th className="py-2.5 px-3 text-right">Cosine Sim</th>
                      <th className="py-2.5 px-3 text-right">Prob Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {tRes.bukti_semantik.map((item, idx) => (
                      <tr key={idx} className={idx === 0 ? 'bg-blue-950/20 font-semibold text-slate-100' : ''}>
                        <td className="py-2 px-3 text-center text-slate-400">{item.rank || idx + 1}</td>
                        <td className="py-2 px-3 font-sans font-medium">{item.identitas}</td>
                        <td className="py-2 px-3 text-blue-400">{item.sertifikat || '-'}</td>
                        <td className="py-2 px-3 text-right">{item.cosine !== undefined ? item.cosine.toFixed(4) : '-'}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">
                          {item.prob_match !== undefined ? `${(item.prob_match * 100).toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Human Review Decision Section */}
          <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center space-x-1.5">
                <User className="w-4 h-4" />
                <span>Formulir Verifikasi Analis Pengawasan</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Status Antrean: {listing.review_task?.status_antrean || 'N/A'}
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Decision Radio Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                { id: 'TERKONFIRMASI_SESUAI', label: 'Terkonfirmasi Bersertifikat', desc: 'Model sesuai dengan entri DJID', color: 'border-emerald-700 bg-emerald-950/30 text-emerald-300' },
                { id: 'TERKONFIRMASI_TIDAK_SESUAI', label: 'Terkonfirmasi Tidak Bersertifikat', desc: 'Perangkat tidak terdaftar di DJID', color: 'border-rose-700 bg-rose-950/30 text-rose-300' },
                { id: 'PERLU_TINDAK_LANJUT', label: 'Perlu Klarifikasi Pemilik / Lab', desc: 'Karakteristik teknis meragukan', color: 'border-amber-700 bg-amber-950/30 text-amber-300' },
                { id: 'BUKAN_PERANGKAT_TELEKOMUNIKASI', label: 'Bukan Perangkat Telekomunikasi', desc: 'Aksesoris, antena pasif, mainan, dll', color: 'border-slate-700 bg-slate-800/40 text-slate-300' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start space-x-2.5 ${
                    decision === opt.id ? `${opt.color} ring-1 ring-blue-500` : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="review_decision"
                    value={opt.id}
                    checked={decision === opt.id}
                    onChange={(e) => setDecision(e.target.value)}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-semibold text-slate-200">{opt.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Catatan Analis (Wajib jika meragukan atau tidak sesuai):
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tuliskan justifikasi verifikasi, nomor referensi manual, atau temuan tambahan..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={isSubmitting || !decision}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-blue-500/20"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Keputusan Verifikasi'}
              </button>
            </div>
          </div>

          {/* Past Review History Log */}
          {listing.review_history && listing.review_history.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Riwayat Keputusan Verifikasi Sebelumnya
              </span>
              <div className="space-y-2">
                {listing.review_history.map((rev) => (
                  <div key={rev.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-400">{rev.keputusan_manusia}</span>
                      <span className="text-slate-500 text-[10px] font-mono">{rev.waktu_putusan}</span>
                    </div>
                    {rev.catatan && <p className="text-slate-300 text-[11px] italic">"{rev.catatan}"</p>}
                    <div className="text-[10px] text-slate-500 font-mono">Oleh: {rev.reviewer_id}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
