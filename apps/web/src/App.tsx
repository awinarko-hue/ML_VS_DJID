import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ListingsTable } from './components/ListingsTable';
import { ListingDetailModal } from './components/ListingDetailModal';
import { FastReviewQueue } from './components/FastReviewQueue';
import { SingleTriageTester } from './components/SingleTriageTester';
import { BrandAliasesManager } from './components/BrandAliasesManager';
import { fetchDashboardStats, fetchListings, fetchListingDetail, triggerBatchTriage } from './api';
import { ListingDetail } from './types';

export const App: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [page, setPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 15000,
  });

  const { data: listingsData } = useQuery({
    queryKey: ['listings', page, searchQuery, statusFilter],
    queryFn: () => fetchListings(page, 20, searchQuery, statusFilter),
  });

  const { data: selectedListingDetail } = useQuery<ListingDetail>({
    queryKey: ['listingDetail', selectedListingId],
    queryFn: () => fetchListingDetail(selectedListingId!),
    enabled: !!selectedListingId,
  });

  // Batch triage mutation
  const batchMutation = useMutation({
    mutationFn: triggerBatchTriage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
    },
  });

  const snapshotDate = stats?.snapshot_djid_aktif.tanggal || '2026-03-01';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Navbar Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} stats={stats} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            stats={stats}
            onNavigate={setActiveTab}
            onTriggerBatch={() => batchMutation.mutate()}
            isBatchRunning={batchMutation.isPending}
          />
        )}

        {activeTab === 'listings' && (
          <ListingsTable
            listings={listingsData?.items || []}
            total={listingsData?.total || 0}
            page={page}
            limit={listingsData?.limit || 20}
            totalPages={listingsData?.total_pages || 1}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onPageChange={setPage}
            onSelectListing={setSelectedListingId}
            snapshotDate={snapshotDate}
          />
        )}

        {activeTab === 'review_queue' && <FastReviewQueue />}

        {activeTab === 'single_test' && <SingleTriageTester />}

        {activeTab === 'brands' && <BrandAliasesManager />}
      </main>

      {/* Detail Modal */}
      {selectedListingId && (
        <ListingDetailModal
          listing={selectedListingDetail || null}
          onClose={() => setSelectedListingId(null)}
          onReviewed={() => {
            queryClient.invalidateQueries({ queryKey: ['listings'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SITRUS v1.0.0 — Sistem Triase Sertifikasi Perangkat (DJID / Balmon)</span>
          <span className="font-mono text-slate-600">Dual-path Retrieval · SBERT + FAISS + Gradient Boosting</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
