import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, Search, CheckCircle2, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { fetchBrandAliases, createBrandAlias } from '../api';
import { BrandAlias } from '../types';

export const BrandAliasesManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [canonicalInput, setCanonicalInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: aliases = [], isLoading } = useQuery<BrandAlias[]>({
    queryKey: ['brandAliases'],
    queryFn: fetchBrandAliases,
  });

  const addAliasMutation = useMutation({
    mutationFn: ({ alias, canonical }: { alias: string; canonical: string }) =>
      createBrandAlias(alias, canonical),
    onSuccess: (newAlias) => {
      setSuccessMsg(`Alias '${newAlias.alias}' -> '${newAlias.merk_kanonik}' berhasil ditambahkan.`);
      setErrorMsg(null);
      setAliasInput('');
      setCanonicalInput('');
      queryClient.invalidateQueries({ queryKey: ['brandAliases'] });
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Gagal menambahkan alias merek.');
      setSuccessMsg(null);
    },
  });

  const handleAddAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasInput.trim() || !canonicalInput.trim()) {
      setErrorMsg('Alias dan merek kanonik wajib diisi.');
      return;
    }
    addAliasMutation.mutate({
      alias: aliasInput.trim(),
      canonical: canonicalInput.trim(),
    });
  };

  const filtered = aliases.filter(
    (a) =>
      a.alias.toLowerCase().includes(search.toLowerCase()) ||
      a.merk_kanonik.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="glass-panel rounded-xl p-5 border border-slate-800">
        <h1 className="text-lg font-bold text-white flex items-center space-x-2">
          <Tag className="w-5 h-5 text-blue-400" />
          <span>Kamus Alias & Varian Merek Marketplace</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Penjual marketplace sering menggunakan variasi ejaan atau merek turunan (contoh: <code>POFUNG</code> untuk <code>BAOFENG</code>, <code>MAG ONE</code> untuk <code>MOTOROLA</code>). Kamus ini secara otomatis dipetakan sebelum pencocokan sertifikasi di DJID.
        </p>
      </div>

      {/* Add Alias Form */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-700/80 space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center space-x-2">
          <Plus className="w-4 h-4 text-blue-400" />
          <span>Tambah Pemetaan Alias Baru</span>
        </h2>

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleAddAlias} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Varian / Alias Marketplace:</label>
            <input
              type="text"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              placeholder="Contoh: pofung, baofeng tech"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono lowercase"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Merek Resmi DJID (Kanonik):</label>
            <input
              type="text"
              value={canonicalInput}
              onChange={(e) => setCanonicalInput(e.target.value)}
              placeholder="Contoh: baofeng"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono lowercase"
            />
          </div>

          <button
            type="submit"
            disabled={addAliasMutation.isPending}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{addAliasMutation.isPending ? 'Menyimpan...' : 'Simpan Pemetaan'}</span>
          </button>
        </form>
      </div>

      {/* Aliases Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari alias atau merek..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Total: {aliases.length} pemetaan terdaftar
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Memuat daftar alias merek...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 font-mono">
              <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Alias / Variasi Marketplace</th>
                  <th className="py-3 px-4">Merek Resmi DJID (Kanonik)</th>
                  <th className="py-3 px-4 w-32">Sumber</th>
                  <th className="py-3 px-4 w-40">Dibuat Pada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 font-sans">
                      Tidak ada alias yang cocok dengan kata kunci.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-bold text-amber-400">{item.alias}</td>
                      <td className="py-2.5 px-4 font-bold text-blue-400">{item.merk_kanonik}</td>
                      <td className="py-2.5 px-4 text-slate-400 font-sans">{item.sumber}</td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {new Date(item.dibuat_pada).toLocaleDateString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
