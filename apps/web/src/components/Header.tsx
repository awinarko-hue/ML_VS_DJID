import React from 'react';
import { Radio, Database, ShieldCheck, CheckCircle2, AlertTriangle, Cpu, Tag, Search } from 'lucide-react';
import { DashboardStats } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  stats?: DashboardStats;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, stats }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard Pengawasan', icon: Radio },
    { id: 'listings', label: 'Daftar Listing Marketplace', icon: Database },
    { id: 'review_queue', label: 'Antrean Peninjauan Cepat', icon: AlertTriangle, badge: stats?.review_queue.antrean_prioritas_tinggi },
    { id: 'single_test', label: 'Uji Triase Langsung', icon: Search },
    { id: 'brands', label: 'Kamus Alias Merek', icon: Tag },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-white">
                  SITRUS
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  v1.0.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sistem Triase Sertifikasi Alat dan atau Perangkat Telekomunikasi
              </p>
            </div>
          </div>

          {/* Badges & System Info */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Snapshot DJID Badge */}
            <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400">Snapshot DJID:</span>
              <span className="font-mono font-medium text-slate-200">
                {stats?.snapshot_djid_aktif.tanggal || '2026-03-01'}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 font-mono">
                {stats?.snapshot_djid_aktif.total_entri.toLocaleString() || '1.333'} entri
              </span>
            </div>

            {/* Health / System Ready Badge */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/40 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium">FAISS & Model Siap</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 -mb-px overflow-x-auto pb-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-blue-500 text-blue-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
