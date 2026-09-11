import React, { useState } from 'react';
import { Search, Sparkles, ShieldCheck, AlertOctagon, HelpCircle, Tag, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';
import { triageSingle } from '../api';

export const SingleTriageTester: React.FC = () => {
  const [inputTitle, setInputTitle] = useState('HT Baofeng UV-5R Dual Band Walkie Talkie 5W Garansi Resmi');
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleTitles = [
    'HT Baofeng UV-5R Dual Band Walkie Talkie 5W Garansi Resmi',
    'Pofung UV-5R Radio HT VHF UHF High Power',
    'Walkie Talkie Icom IC-V88 Original Komplit Set',
    'HT Motorola GP-328 Plus UHF VHF',
    'Radio HT Antena RH771 Dual Band BNC (Aksesoris)',
    'HT Icom IC-99999 Super Turbo Edition 50W',
  ];

  const handleRunTriage = async (titleToRun: string) => {
    if (!titleToRun.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await triageSingle(titleToRun);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Gagal menjalankan triase');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="glass-panel rounded-xl p-5 border border-slate-800">
        <h1 className="text-lg font-bold text-white flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <span>Uji Triase Langsung (Sandbox Inferensi Real-time)</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Uji coba inferensi langsung sistem triase terhadap judul listing apa pun. Pipeline mengeksekusi normalisasi teks, deteksi kamus alias merek, pencocokan eksak Aho-Corasick, dense retrieval FAISS, dan inferensi model Gradient Boosting (&lt; 400ms).
        </p>
      </div>

      {/* Input Box & Preset Samples */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-700/80 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
            Masukkan Judul Listing Marketplace:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
              placeholder="Ketik judul produk marketplace (contoh: Baofeng UV-5R, Pofung, Icom...)"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
              onKeyDown={(e) => e.key === 'Enter' && handleRunTriage(inputTitle)}
            />
            <button
              onClick={() => handleRunTriage(inputTitle)}
              disabled={loading || !inputTitle.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center space-x-2"
            >
              <Search className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Memproses...' : 'Uji Triase'}</span>
            </button>
          </div>
        </div>

        {/* Preset Samples Chips */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] text-slate-400 font-medium">Contoh Kasus Uji Coba:</span>
          <div className="flex flex-wrap gap-2">
            {sampleTitles.map((t, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputTitle(t);
                  handleRunTriage(t);
                }}
                className="px-3 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs text-left transition-all hover:border-slate-700"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="glass-panel rounded-2xl border border-slate-700 p-6 space-y-6 shadow-2xl animate-fade-in">
          {/* Decision Banner */}
          <div
            className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              result.status === 'TERSERTIFIKASI' || result.status === 'BERSERTIFIKAT'
                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                : result.status === 'TERINDIKASI_TIDAK_BERSERTIFIKAT'
                ? 'bg-rose-950/40 border-rose-700/60 text-rose-300'
                : 'bg-amber-950/40 border-amber-700/60 text-amber-300'
            }`}
          >
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider">Hasil Triase:</span>
                <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-slate-900/90 border">
                  {result.status}
                </span>
              </div>
              <div className="text-lg font-bold text-white mt-1">{result.reason}</div>
              <p className="text-xs text-slate-300 mt-0.5">{result.keterangan}</p>
            </div>
            <div className="sm:text-right font-mono">
              <div className="text-3xl font-black text-white">{(result.max_prob * 100).toFixed(1)}%</div>
              <span className="text-[11px] text-slate-400">Tingkat Keyakinan (Confidence)</span>
            </div>
          </div>

          {/* Pipeline Features Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">
                Deteksi Merek & Alias
              </span>
              <div className="text-slate-200 font-mono">
                {result.brand_terdeteksi ? (
                  <span>
                    {result.brand_terdeteksi}{' '}
                    {result.canonical_brand !== result.brand_terdeteksi && (
                      <span className="text-blue-400">→ {result.canonical_brand}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">Tidak terdeteksi</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">
                Pencocokan Eksak (Aho-Corasick)
              </span>
              <div className="text-slate-200 font-mono">
                {result.n_exact_hit > 0 ? (
                  <span className="text-emerald-400 font-semibold">{result.n_exact_hit} model cocok</span>
                ) : (
                  <span className="text-slate-400">0 kecocokan eksak</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">
                Kandidat Terbaik DJID
              </span>
              <div className="text-blue-400 font-mono font-medium truncate">
                {result.kandidat_terbaik || '-'}
              </div>
            </div>
          </div>

          {/* Top-K Semantic Candidates Table */}
          {result.bukti_semantik && result.bukti_semantik.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Bukti Top-{result.bukti_semantik.length} Kandidat DJID (FAISS + Classifier):
              </span>
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
                <table className="w-full text-left text-xs text-slate-300 font-mono">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                      <th className="py-2.5 px-3 font-sans">Identitas DJID</th>
                      <th className="py-2.5 px-3">Nomor Sertifikat</th>
                      <th className="py-2.5 px-3 text-right">Cosine Sim</th>
                      <th className="py-2.5 px-3 text-right">Prob Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {result.bukti_semantik.map((c: any, i: number) => (
                      <tr key={i} className={i === 0 ? 'bg-blue-950/20 text-slate-100 font-semibold' : ''}>
                        <td className="py-2 px-3 text-center text-slate-500">{c.rank || i + 1}</td>
                        <td className="py-2 px-3 font-sans font-medium">{c.identitas}</td>
                        <td className="py-2 px-3 text-blue-400">{c.sertifikat || '-'}</td>
                        <td className="py-2 px-3 text-right">{c.cosine?.toFixed(4)}</td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                          {c.prob_match !== undefined ? `${(c.prob_match * 100).toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
