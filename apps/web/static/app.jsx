const { useState, useEffect, useCallback } = React;

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [listings, setListings] = useState([]);
  const [totalListings, setTotalListings] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Review Queue state
  const [queueItems, setQueueItems] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueDetail, setQueueDetail] = useState(null);
  const [queueNotes, setQueueNotes] = useState('');
  const [queueFeedback, setQueueFeedback] = useState(null);

  // Sandbox state
  const [sandboxInput, setSandboxInput] = useState('HT Baofeng UV-5R Dual Band Walkie Talkie 5W Garansi Resmi');
  const [sandboxResult, setSandboxResult] = useState(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState(null);

  // Brand Aliases state
  const [aliases, setAliases] = useState([]);
  const [aliasSearch, setAliasSearch] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newCanonical, setNewCanonical] = useState('');
  const [aliasSuccess, setAliasSuccess] = useState(null);
  const [aliasError, setAliasError] = useState(null);

  // Input Data Listing state
  const [inputMode, setInputMode] = useState('csv'); // 'csv' | 'manual' | 'extension'
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadSource, setUploadSource] = useState('tokopedia');
  const [uploadAutoTriage, setUploadAutoTriage] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const [manualJudul, setManualJudul] = useState('');
  const [manualHarga, setManualHarga] = useState('');
  const [manualPlatform, setManualPlatform] = useState('tokopedia');
  const [manualSeller, setManualSeller] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualAutoTriage, setManualAutoTriage] = useState(true);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult, setManualResult] = useState(null);
  const [manualError, setManualError] = useState(null);

  // Re-run Lucide icons on render
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

  // Handle CSV Upload
  const handleUploadCSV = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Pilih file CSV scraper terlebih dahulu');
      return;
    }
    setUploadLoading(true);
    setUploadError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('source', uploadSource);
    formData.append('auto_triage', uploadAutoTriage ? 'true' : 'false');

    try {
      const res = await fetch('/api/listings/upload-csv', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadResult(data);
        setUploadFile(null);
        loadStats();
        loadListings();
      } else {
        setUploadError(data.detail || 'Gagal mengunggah file CSV.');
      }
    } catch (err) {
      setUploadError(err.message || 'Terjadi kesalahan koneksi.');
    } finally {
      setUploadLoading(false);
    }
  };

  // Handle Manual Submit
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualJudul.trim()) {
      setManualError('Judul produk marketplace wajib diisi.');
      return;
    }
    setManualLoading(true);
    setManualError(null);
    setManualResult(null);

    try {
      const res = await fetch('/api/listings/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: manualJudul.trim(),
          harga: manualHarga.trim() || null,
          platform: manualPlatform,
          nama_penjual: manualSeller.trim() || null,
          url_produk: manualUrl.trim() || null,
          auto_triage: manualAutoTriage,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setManualResult(data);
        setManualJudul('');
        setManualHarga('');
        setManualSeller('');
        setManualUrl('');
        loadStats();
        loadListings();
      } else {
        setManualError(data.detail || 'Gagal menyimpan listing.');
      }
    } catch (err) {
      setManualError(err.message || 'Terjadi kesalahan koneksi.');
    } finally {
      setManualLoading(false);
    }
  };

  // Fetch Dashboard Stats
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats/dashboard');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  }, []);

  // Fetch Listings
  const loadListings = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (searchQuery) params.append('q', searchQuery);
      if (statusFilter) params.append('status_triase', statusFilter);

      const res = await fetch(`/api/listings?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.items);
        setTotalListings(data.total);
        setTotalPages(data.total_pages);
      }
    } catch (e) {
      console.error('Failed to load listings', e);
    }
  }, [page, searchQuery, statusFilter]);

  // Fetch Review Queue
  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/review-queue?limit=50');
      if (res.ok) {
        const data = await res.json();
        setQueueItems(data.items);
        setQueueIndex(0);
      }
    } catch (e) {
      console.error('Failed to load review queue', e);
    }
  }, []);

  // Fetch Brand Aliases
  const loadAliases = useCallback(async () => {
    try {
      const res = await fetch('/api/brands/aliases');
      if (res.ok) {
        const data = await res.json();
        setAliases(data);
      }
    } catch (e) {
      console.error('Failed to load aliases', e);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 15000);
    return () => clearInterval(interval);
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'listings') loadListings();
    if (activeTab === 'review_queue') loadQueue();
    if (activeTab === 'brands') loadAliases();
  }, [activeTab, loadListings, loadQueue, loadAliases]);

  // Load Listing Detail when selected
  useEffect(() => {
    if (selectedListing) {
      fetch(`/api/listings/${selectedListing.id}`)
        .then((r) => r.json())
        .then((data) => setSelectedDetail(data))
        .catch((e) => console.error(e));
    } else {
      setSelectedDetail(null);
    }
  }, [selectedListing]);

  // Load Queue Item Detail
  useEffect(() => {
    const currentQItem = queueItems[queueIndex];
    if (currentQItem) {
      fetch(`/api/listings/${currentQItem.listing_id}`)
        .then((r) => r.json())
        .then((data) => setQueueDetail(data))
        .catch((e) => console.error(e));
    } else {
      setQueueDetail(null);
    }
  }, [queueItems, queueIndex]);

  // Handle Trigger Batch
  const handleTriggerBatch = async () => {
    setIsBatchRunning(true);
    try {
      const res = await fetch('/api/triage/runs', { method: 'POST' });
      if (res.ok) {
        await loadStats();
        if (activeTab === 'listings') await loadListings();
        if (activeTab === 'review_queue') await loadQueue();
      }
    } catch (e) {
      console.error('Batch triage failed', e);
    } finally {
      setIsBatchRunning(false);
    }
  };

  // Fast review submit decision
  const handleQueueDecision = async (decision) => {
    const current = queueItems[queueIndex];
    if (!current) return;

    try {
      const res = await fetch(`/api/reviews/tasks/${current.task_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keputusan_manusia: decision,
          catatan: queueNotes || null,
          reviewer_id: 'analyst_web',
          durasi_detik: 3,
        }),
      });

      if (res.ok) {
        setQueueFeedback(`Keputusan "${decision}" tersimpan.`);
        setTimeout(() => setQueueFeedback(null), 2000);
        setQueueNotes('');
        loadStats();
        if (queueIndex < queueItems.length - 1) {
          setQueueIndex(queueIndex + 1);
        } else {
          loadQueue();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Keyboard shortcut for Fast Review
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTab !== 'review_queue') return;
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;

      if (e.key === '1') handleQueueDecision('TERKONFIRMASI_SESUAI');
      if (e.key === '2') handleQueueDecision('TERKONFIRMASI_TIDAK_SESUAI');
      if (e.key === '3') handleQueueDecision('PERLU_TINDAK_LANJUT');
      if (e.key === '4') handleQueueDecision('BUKAN_PERANGKAT_TELEKOMUNIKASI');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, queueItems, queueIndex, queueNotes]);

  // Sandbox execution
  const handleRunSandbox = async (title) => {
    if (!title.trim()) return;
    setSandboxLoading(true);
    setSandboxError(null);
    try {
      const res = await fetch('/api/triage/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judul: title }),
      });
      if (res.ok) {
        const data = await res.json();
        setSandboxResult(data);
      } else {
        const err = await res.json();
        setSandboxError(err.detail || 'Gagal menjalankan triase');
      }
    } catch (e) {
      setSandboxError(e.message || 'Gagal terhubung ke API');
    } finally {
      setSandboxLoading(false);
    }
  };

  // Add Brand Alias
  const handleAddAlias = async (e) => {
    e.preventDefault();
    if (!newAlias.trim() || !newCanonical.trim()) {
      setAliasError('Alias dan merek kanonik wajib diisi');
      return;
    }
    setAliasError(null);
    try {
      const res = await fetch('/api/brands/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: newAlias.trim(),
          merk_kanonik: newCanonical.trim(),
          sumber: 'analyst_web',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAliasSuccess(`Alias '${data.alias}' -> '${data.merk_kanonik}' berhasil ditambahkan.`);
        setNewAlias('');
        setNewCanonical('');
        loadAliases();
        setTimeout(() => setAliasSuccess(null), 3000);
      } else {
        const err = await res.json();
        setAliasError(err.detail || 'Gagal menambahkan alias');
      }
    } catch (e) {
      setAliasError(e.message || 'Gagal menambahkan alias');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const snapshotDate = stats?.snapshot_djid_aktif.tanggal || '2026-03-01';
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

    const disclaimer = [
      `# SITRUS - Sistem Triase Sertifikasi Perangkat (DJID / Balmon)`,
      `# Tanggal Snapshot DJID: ${snapshotDate}`,
      `# PERINGATAN HUKUM: Status TERINDIKASI_TIDAK_BERSERTIFIKAT bersifat indikasi algoritmik awal dan wajib diverifikasi analis sebelum tindakan administratif.`,
      headers.join(','),
    ];

    const csvContent = disclaimer.join('\n') + '\n' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitrus_triase_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dist = stats?.status_distribution || { bersertifikat: 0, terindikasi_tidak_bersertifikat: 0, perlu_verifikasi_manusia: 0, belum_ditriase: 0 };
  const total = stats?.total_listings || 1;
  const pctCert = Math.round((dist.bersertifikat / total) * 100);
  const pctUncert = Math.round((dist.terindikasi_tidak_bersertifikat / total) * 100);
  const pctReview = Math.round((dist.perlu_verifikasi_manusia / total) * 100);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <i data-lucide="shield-check" className="w-6 h-6 text-white"></i>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-200 to-white">
                    SITRUS
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    v1.0.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Sistem Triase Sertifikasi Alat dan atau Perangkat Telekomunikasi (DJID)
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
                <i data-lucide="database" className="w-3.5 h-3.5 text-blue-400"></i>
                <span className="text-slate-400">Snapshot DJID:</span>
                <span className="font-mono font-medium text-slate-200">
                  {stats?.snapshot_djid_aktif.tanggal || '2026-03-01'}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300 font-mono">
                  {stats?.snapshot_djid_aktif.total_entri.toLocaleString() || '1.333'} entri
                </span>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/40 text-xs text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-medium">Model & FAISS Aktif</span>
              </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex space-x-1 -mb-px overflow-x-auto pb-1 text-xs sm:text-sm font-medium">
            {[
              { id: 'dashboard', label: 'Dashboard Pengawasan', icon: 'layout-dashboard' },
              { id: 'input_data', label: 'Input Data Listing Baru', icon: 'upload-cloud' },
              { id: 'listings', label: 'Daftar Listing Marketplace', icon: 'database' },
              { id: 'review_queue', label: 'Antrean Peninjauan Cepat', icon: 'alert-triangle', badge: stats?.review_queue.antrean_prioritas_tinggi },
              { id: 'single_test', label: 'Uji Triase Langsung', icon: 'search' },
              { id: 'brands', label: 'Kamus Alias Merek', icon: 'tag' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <i data-lucide={tab.icon} className="w-4 h-4"></i>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Dashboard Triase Pengawasan Alat & Perangkat Telekomunikasi
                  </h1>
                  <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                    Penyaringan kepatuhan sertifikasi alat telekomunikasi DJID terhadap listing marketplace dengan dual-path retrieval dan model klasifikasi SBERT.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setActiveTab('input_data')}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/25 transition-all text-sm"
                  >
                    <i data-lucide="upload-cloud" className="w-4 h-4"></i>
                    <span>+ Input / Unggah Listing</span>
                  </button>
                  <button
                    onClick={handleTriggerBatch}
                    disabled={isBatchRunning}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all text-sm"
                  >
                    <i data-lucide="play" className={`w-4 h-4 ${isBatchRunning ? 'animate-spin' : ''}`}></i>
                    <span>{isBatchRunning ? 'Sedang Memproses...' : 'Jalankan Triase Batch'}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('review_queue')}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold shadow-lg shadow-rose-500/25 transition-all text-sm"
                  >
                    <i data-lucide="alert-octagon" className="w-4 h-4"></i>
                    <span>Tinjau Antrean ({stats?.review_queue.antrean_prioritas_tinggi || 0})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel rounded-xl p-5 border border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Listing Diperiksa</span>
                <div className="text-3xl font-extrabold text-white font-mono mt-3">
                  {total.toLocaleString()}
                </div>
                <p className="text-xs text-slate-400 mt-1">Listing radio & HT marketplace</p>
              </div>

              <div className="glass-panel rounded-xl p-5 border border-emerald-900/50 bg-emerald-950/20">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Tersertifikasi</span>
                <div className="text-3xl font-extrabold text-emerald-300 font-mono mt-3">
                  {dist.bersertifikat.toLocaleString()}
                </div>
                <p className="text-xs text-emerald-400/80 mt-1">{pctCert}% dari total listing</p>
              </div>

              <div className="glass-panel rounded-xl p-5 border border-rose-900/50 bg-rose-950/20">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Terindikasi Tidak</span>
                <div className="text-3xl font-extrabold text-rose-300 font-mono mt-3">
                  {dist.terindikasi_tidak_bersertifikat.toLocaleString()}
                </div>
                <p className="text-xs text-rose-400/80 mt-1">{pctUncert}% · Memerlukan verifikasi</p>
              </div>

              <div className="glass-panel rounded-xl p-5 border border-amber-900/50 bg-amber-950/20">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Zona Ambiguitas</span>
                <div className="text-3xl font-extrabold text-amber-300 font-mono mt-3">
                  {dist.perlu_verifikasi_manusia.toLocaleString()}
                </div>
                <p className="text-xs text-amber-400/80 mt-1">{pctReview}% · Perlu review analis</p>
              </div>
            </div>

            {/* Distribution and Legal Asymmetry Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="glass-panel rounded-xl p-6 border border-slate-800 lg:col-span-2 space-y-4">
                <h2 className="text-base font-semibold text-white">Distribusi Status Triase Perangkat</h2>
                <div className="h-4 rounded-full bg-slate-800 overflow-hidden flex">
                  <div style={{ width: `${pctCert}%` }} className="bg-emerald-500 h-full transition-all"></div>
                  <div style={{ width: `${pctUncert}%` }} className="bg-rose-500 h-full transition-all"></div>
                  <div style={{ width: `${pctReview}%` }} className="bg-amber-500 h-full transition-all"></div>
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
                  <span>Snapshot DJID: <strong className="text-slate-200">{stats?.snapshot_djid_aktif.tanggal}</strong></span>
                  <button onClick={() => setActiveTab('listings')} className="text-blue-400 hover:text-blue-300 font-medium">
                    Lihat Semua Listing →
                  </button>
                </div>
              </div>

              <div className="glass-panel rounded-xl p-6 border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
                    <i data-lucide="info" className="w-4 h-4"></i>
                    <span>Prinsip Asimetri Hukum DJID</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Keluaran sistem memiliki konsekuensi hukum langsung bagi penjual. Kesalahan menuduh produk bersertifikat sebagai tidak bersertifikat (Tipe I) jauh lebih mahal daripada kesalahan meloloskan produk (Tipe II).
                  </p>
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-300/90 leading-normal">
                    Status <strong>TERINDIKASI_TIDAK_BERSERTIFIKAT</strong> tidak pernah dieksekusi secara otomatis tanpa verifikasi manusia.
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Status Verifikasi:</span>
                  <span className="font-semibold text-amber-400 font-mono">
                    {stats?.verification.persen_belum_terverifikasi}% Belum Diverifikasi
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LISTINGS TABLE */}
        {activeTab === 'listings' && (
          <div className="space-y-4">
            <div className="glass-panel rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <input
                  type="text"
                  placeholder="Cari judul listing marketplace..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <i data-lucide="search" className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"></i>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto justify-between md:justify-end">
                <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
                  {[
                    { label: 'Semua Status', value: '' },
                    { label: 'Tersertifikasi', value: 'TERSERTIFIKASI' },
                    { label: 'Terindikasi Tidak', value: 'TERINDIKASI_TIDAK_BERSERTIFIKAT' },
                    { label: 'Perlu Review', value: 'PERLU_REVIEW' },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => {
                        setStatusFilter(tab.value);
                        setPage(1);
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                        statusFilter === tab.value ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExportCSV}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium"
                >
                  <i data-lucide="download" className="w-3.5 h-3.5"></i>
                  <span>Ekspor CSV</span>
                </button>
              </div>
            </div>

            {/* Table */}
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
                        <td colSpan="6" className="py-12 text-center text-slate-500">
                          Tidak ada listing yang cocok dengan kriteria pencarian.
                        </td>
                      </tr>
                    ) : (
                      listings.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-100 line-clamp-2 max-w-xl">{item.judul_mentah}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">ID: {item.id.slice(0, 8)}...</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {item.harga_angka ? `Rp ${item.harga_angka.toLocaleString()}` : item.harga_mentah || '-'}
                          </td>
                          <td className="py-3 px-4">
                            {item.brand_terdeteksi ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-blue-950/60 text-blue-300 border border-blue-800/40 uppercase">
                                {item.brand_terdeteksi}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 italic">Tidak terdeteksi</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {item.status_triase === 'TERSERTIFIKASI' || item.status_triase === 'BERSERTIFIKAT' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold badge-certified">
                                Tersertifikasi
                              </span>
                            ) : item.status_triase === 'TERINDIKASI_TIDAK_BERSERTIFIKAT' ? (
                              <div className="flex flex-col space-y-0.5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold badge-uncertified">
                                  Terindikasi Tidak
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  DJID: {stats?.snapshot_djid_aktif.tanggal} · Belum Diverifikasi
                                </span>
                              </div>
                            ) : item.status_triase === 'PERLU_REVIEW' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold badge-review">
                                Perlu Review
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold badge-nontelecom">
                                {item.status_triase}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs">
                            {item.max_prob !== null && item.max_prob !== undefined ? (
                              <span className={`font-semibold ${item.max_prob >= 0.8 ? 'text-emerald-400' : item.max_prob <= 0.3 ? 'text-rose-400' : 'text-amber-400'}`}>
                                {(item.max_prob * 100).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setSelectedListing(item)}
                              className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                              title="Lihat Detail & Bukti"
                            >
                              <i data-lucide="eye" className="w-4 h-4"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Menampilkan <strong className="text-slate-200">{listings.length}</strong> dari <strong className="text-slate-200">{totalListings}</strong> listing
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                  >
                    <i data-lucide="chevron-left" className="w-4 h-4"></i>
                  </button>
                  <span className="font-mono">Halaman {page} dari {totalPages || 1}</span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                  >
                    <i data-lucide="chevron-right" className="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FAST REVIEW QUEUE */}
        {activeTab === 'review_queue' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-xl border border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-white">Antrean Peninjauan Cepat (Fast Review)</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {queueIndex + 1} dari {queueItems.length} item
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gunakan tombol angka pada keyboard (1, 2, 3, 4) untuk verifikasi instan.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 font-mono">
                <i data-lucide="keyboard" className="w-3.5 h-3.5 text-blue-400"></i>
                <span>[1] Sesuai</span>
                <span>·</span>
                <span>[2] Tidak Sesuai</span>
                <span>·</span>
                <span>[3] Ragu</span>
                <span>·</span>
                <span>[4] Bukan Radio</span>
              </div>
            </div>

            {queueFeedback && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-medium">
                {queueFeedback}
              </div>
            )}

            {queueItems.length > 0 && queueItems[queueIndex] ? (
              <div className="glass-panel rounded-2xl border border-slate-700/80 p-6 space-y-6 shadow-2xl">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Listing Marketplace #{queueItems[queueIndex].listing_id.slice(0, 8)}</span>
                    <span className="font-mono text-slate-400">
                      {queueItems[queueIndex].harga_angka ? `Rp ${queueItems[queueIndex].harga_angka.toLocaleString()}` : '-'}
                    </span>
                  </div>
                  <h1 className="text-xl font-bold text-white leading-snug">
                    {queueItems[queueIndex].judul_mentah}
                  </h1>
                </div>

                <div className={`p-4 rounded-xl border flex items-start justify-between ${
                  queueItems[queueIndex].status_triase === 'TERINDIKASI_TIDAK_BERSERTIFIKAT'
                    ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                    : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                }`}>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider block">Indikasi Algoritma:</span>
                    <span className="text-sm font-bold text-white">{queueItems[queueIndex].status_triase}</span>
                    <div className="text-xs text-slate-300 mt-0.5">Alasan: {queueItems[queueIndex].reason_code}</div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-xl font-extrabold text-white">{(queueItems[queueIndex].max_prob * 100).toFixed(1)}%</span>
                    <span className="block text-[10px] text-slate-400">Match Prob</span>
                  </div>
                </div>

                {/* Top-3 Candidates */}
                {queueDetail?.triage_result?.bukti_semantik && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Padanan Teratas di Basis Data DJID (Top-3):
                    </span>
                    <div className="space-y-2">
                      {queueDetail.triage_result.bukti_semantik.slice(0, 3).map((cand, idx) => (
                        <div key={idx} className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 text-xs flex items-center justify-between">
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

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Catatan Tambahan Analis (Opsional):</label>
                  <input
                    type="text"
                    value={queueNotes}
                    onChange={(e) => setQueueNotes(e.target.value)}
                    placeholder="Tuliskan catatan singkat jika ada..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <button
                    onClick={() => handleQueueDecision('TERKONFIRMASI_SESUAI')}
                    className="p-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-600/40 font-semibold text-xs flex flex-col items-center justify-center space-y-1 transition-all"
                  >
                    <i data-lucide="check-circle" className="w-5 h-5"></i>
                    <span>[1] Bersertifikat</span>
                  </button>

                  <button
                    onClick={() => handleQueueDecision('TERKONFIRMASI_TIDAK_SESUAI')}
                    className="p-3.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/40 font-semibold text-xs flex flex-col items-center justify-center space-y-1 transition-all"
                  >
                    <i data-lucide="x-circle" className="w-5 h-5"></i>
                    <span>[2] Tidak Bersertifikat</span>
                  </button>

                  <button
                    onClick={() => handleQueueDecision('PERLU_TINDAK_LANJUT')}
                    className="p-3.5 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-600/40 font-semibold text-xs flex flex-col items-center justify-center space-y-1 transition-all"
                  >
                    <i data-lucide="help-circle" className="w-5 h-5"></i>
                    <span>[3] Perlu Klarifikasi</span>
                  </button>

                  <button
                    onClick={() => handleQueueDecision('BUKAN_PERANGKAT_TELEKOMUNIKASI')}
                    className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-semibold text-xs flex flex-col items-center justify-center space-y-1 transition-all"
                  >
                    <i data-lucide="ban" className="w-5 h-5"></i>
                    <span>[4] Bukan Radio</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-xl p-12 text-center border border-slate-800 text-slate-400">
                Antrean peninjauan kosong. Semua item telah diverifikasi.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SINGLE TRIAGE TESTER */}
        {activeTab === 'single_test' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="glass-panel rounded-xl p-5 border border-slate-800">
              <h1 className="text-lg font-bold text-white flex items-center space-x-2">
                <i data-lucide="sparkles" className="w-5 h-5 text-blue-400"></i>
                <span>Uji Triase Langsung (Sandbox Inferensi Real-time)</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Uji coba inferensi langsung sistem triase terhadap judul listing apa pun (&lt; 400ms).
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-slate-700/80 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Masukkan Judul Listing Marketplace:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sandboxInput}
                    onChange={(e) => setSandboxInput(e.target.value)}
                    placeholder="Contoh: Baofeng UV-5R, Pofung, Icom..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                    onKeyDown={(e) => e.key === 'Enter' && handleRunSandbox(sandboxInput)}
                  />
                  <button
                    onClick={() => handleRunSandbox(sandboxInput)}
                    disabled={sandboxLoading || !sandboxInput.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center space-x-2"
                  >
                    <i data-lucide="search" className={`w-4 h-4 ${sandboxLoading ? 'animate-spin' : ''}`}></i>
                    <span>{sandboxLoading ? 'Memproses...' : 'Uji Triase'}</span>
                  </button>
                </div>
              </div>

              {/* Sample Chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-medium">Contoh Kasus Uji Coba:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'HT Baofeng UV-5R Dual Band Walkie Talkie 5W Garansi Resmi',
                    'Pofung UV-5R Radio HT VHF UHF High Power',
                    'Walkie Talkie Icom IC-V88 Original Komplit Set',
                    'HT Motorola GP-328 Plus UHF VHF',
                    'Radio HT Antena RH771 Dual Band BNC (Aksesoris)',
                    'HT Icom IC-99999 Super Turbo Edition 50W',
                  ].map((t, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSandboxInput(t);
                        handleRunSandbox(t);
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs text-left"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {sandboxError && (
              <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {sandboxError}
              </div>
            )}

            {/* Sandbox Result */}
            {sandboxResult && (
              <div className="glass-panel rounded-2xl border border-slate-700 p-6 space-y-6 shadow-2xl">
                <div className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  sandboxResult.status === 'TERSERTIFIKASI' || sandboxResult.status === 'BERSERTIFIKAT'
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                    : sandboxResult.status === 'TERINDIKASI_TIDAK_BERSERTIFIKAT'
                    ? 'bg-rose-950/40 border-rose-700/60 text-rose-300'
                    : 'bg-amber-950/40 border-amber-700/60 text-amber-300'
                }`}>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider">Hasil Triase:</span>
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-slate-900/90 border">
                        {sandboxResult.status}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-white mt-1">{sandboxResult.reason}</div>
                    <p className="text-xs text-slate-300 mt-0.5">{sandboxResult.keterangan}</p>
                  </div>
                  <div className="sm:text-right font-mono">
                    <div className="text-3xl font-black text-white">{(sandboxResult.max_prob * 100).toFixed(1)}%</div>
                    <span className="text-[11px] text-slate-400">Confidence</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">Deteksi Merek & Alias</span>
                    <div className="text-slate-200 font-mono">
                      {sandboxResult.brand_terdeteksi ? (
                        <span>
                          {sandboxResult.brand_terdeteksi}{' '}
                          {sandboxResult.canonical_brand !== sandboxResult.brand_terdeteksi && (
                            <span className="text-blue-400">→ {sandboxResult.canonical_brand}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Tidak terdeteksi</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">Pencocokan Eksak Model</span>
                    <div className="text-slate-200 font-mono">
                      {sandboxResult.n_exact_hit > 0 ? (
                        <span className="text-emerald-400 font-semibold">{sandboxResult.n_exact_hit} model cocok</span>
                      ) : (
                        <span className="text-slate-400">0 kecocokan eksak</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block font-semibold uppercase tracking-wider text-[10px]">Kandidat Terbaik DJID</span>
                    <div className="text-blue-400 font-mono font-medium truncate">
                      {sandboxResult.kandidat_terbaik || '-'}
                    </div>
                  </div>
                </div>

                {/* Top-K Table */}
                {sandboxResult.bukti_semantik && sandboxResult.bukti_semantik.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Bukti Top-{sandboxResult.bukti_semantik.length} Kandidat DJID (FAISS + Classifier):
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
                          {sandboxResult.bukti_semantik.map((c, i) => (
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
        )}

        {/* TAB 5: BRAND ALIASES */}
        {activeTab === 'brands' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="glass-panel rounded-xl p-5 border border-slate-800">
              <h1 className="text-lg font-bold text-white flex items-center space-x-2">
                <i data-lucide="tag" className="w-5 h-5 text-blue-400"></i>
                <span>Kamus Alias & Varian Merek Marketplace</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Kamus pemetaan alias merek marketplace (contoh: <code>POFUNG</code> → <code>BAOFENG</code>).
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-slate-700/80 space-y-4">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Tambah Pemetaan Alias Baru</h2>
              {aliasSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs">
                  {aliasSuccess}
                </div>
              )}
              {aliasError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs">
                  {aliasError}
                </div>
              )}
              <form onSubmit={handleAddAlias} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Varian / Alias Marketplace:</label>
                  <input
                    type="text"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    placeholder="Contoh: pofung, baofeng tech"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono lowercase"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Merek Resmi DJID (Kanonik):</label>
                  <input
                    type="text"
                    value={newCanonical}
                    onChange={(e) => setNewCanonical(e.target.value)}
                    placeholder="Contoh: baofeng"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono lowercase"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
                >
                  Simpan Pemetaan
                </button>
              </form>
            </div>

            <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <input
                  type="text"
                  value={aliasSearch}
                  onChange={(e) => setAliasSearch(e.target.value)}
                  placeholder="Cari alias..."
                  className="w-64 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                />
                <span className="text-xs text-slate-400 font-mono">Total: {aliases.length} pemetaan</span>
              </div>
              <table className="w-full text-left text-xs text-slate-300 font-mono">
                <thead className="bg-slate-900 text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Alias / Variasi Marketplace</th>
                    <th className="py-3 px-4">Merek Resmi DJID</th>
                    <th className="py-3 px-4">Sumber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {aliases
                    .filter((a) => a.alias.toLowerCase().includes(aliasSearch.toLowerCase()) || a.merk_kanonik.toLowerCase().includes(aliasSearch.toLowerCase()))
                    .map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-bold text-amber-400">{a.alias}</td>
                        <td className="py-2.5 px-4 font-bold text-blue-400">{a.merk_kanonik}</td>
                        <td className="py-2.5 px-4 text-slate-400 font-sans">{a.sumber}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: INPUT DATA LISTING */}
        {activeTab === 'input_data' && (
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
                    <i data-lucide="upload-cloud" className="w-6 h-6 text-indigo-400"></i>
                    <span>Input & Unggah Data Listing Marketplace</span>
                  </h1>
                  <p className="text-slate-400 text-sm mt-1 max-w-3xl">
                    Tambahkan data listing produk marketplace baru untuk diperiksa. Setiap data yang masuk akan langsung menambah 
                    <strong className="text-blue-400 font-semibold"> Total Listing Diperiksa</strong> pada sistem dan dapat langsung ditriase secara otomatis.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-xs">
                    <span className="text-slate-400">Total di Database: </span>
                    <strong className="text-white font-mono">{stats?.total_listings.toLocaleString() || '1.019'}</strong> listing
                  </div>
                </div>
              </div>

              {/* Sub-mode Tabs */}
              <div className="flex flex-wrap gap-2 mt-6 border-b border-slate-800 pb-3">
                {[
                  { id: 'csv', label: '1. Unggah File CSV Scraper', icon: 'file-spreadsheet' },
                  { id: 'manual', label: '2. Input Formulir Manual', icon: 'edit-3' },
                  { id: 'extension', label: '3. Koneksi Ekstensi Browser', icon: 'zap' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setInputMode(m.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      inputMode === m.id
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <i data-lucide={m.icon} className="w-3.5 h-3.5"></i>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SUB-TAB 1: CSV UPLOAD */}
            {inputMode === 'csv' && (
              <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
                <form onSubmit={handleUploadCSV} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Platform Sumber Data
                      </label>
                      <select
                        value={uploadSource}
                        onChange={(e) => setUploadSource(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="tokopedia">Tokopedia (Format Web Scraper)</option>
                        <option value="shopee">Shopee (Format Web Scraper)</option>
                        <option value="csv_upload">Marketplace Lainnya / Format Fleksibel</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-2 md:pt-6">
                      <label className="flex items-center space-x-3 cursor-pointer bg-slate-900/80 p-3 rounded-xl border border-slate-800 w-full hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={uploadAutoTriage}
                          onChange={(e) => setUploadAutoTriage(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-white block">Jalankan Triase AI Otomatis</span>
                          <span className="text-[11px] text-slate-400">Langsung klasifikasikan status sertifikasi listing yang baru diunggah</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Drag & Drop Dropzone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Pilih Berkas CSV
                    </label>
                    <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-900/40 hover:bg-slate-900/70 transition-all cursor-pointer relative">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setUploadFile(e.target.files[0]);
                            setUploadError(null);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <i data-lucide="file-up" className="w-10 h-10 text-indigo-400 mx-auto mb-3"></i>
                      <div className="text-sm font-semibold text-white">
                        {uploadFile ? uploadFile.name : 'Klik untuk memilih file CSV atau seret ke sini'}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {uploadFile
                          ? `Ukuran: ${(uploadFile.size / 1024).toFixed(1)} KB`
                          : 'Mendukung file CSV hasil ekstensi scraper Tokopedia & Shopee (kolom data, data2, web_scraper_start_url)'}
                      </p>
                    </div>
                  </div>

                  {uploadError && (
                    <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs flex items-center space-x-2">
                      <i data-lucide="alert-circle" className="w-4 h-4 flex-shrink-0"></i>
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={uploadLoading || !uploadFile}
                      className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition-all text-sm"
                    >
                      <i data-lucide="upload" className={`w-4 h-4 ${uploadLoading ? 'animate-spin' : ''}`}></i>
                      <span>{uploadLoading ? 'Sedang Memproses & Mentriase...' : 'Unggah & Tambah Listing'}</span>
                    </button>
                  </div>
                </form>

                {/* Upload Success Banner */}
                {uploadResult && (
                  <div className="p-5 rounded-xl bg-emerald-950/50 border border-emerald-700 text-emerald-200 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-300 flex items-center space-x-2">
                        <i data-lucide="check-circle" className="w-5 h-5 text-emerald-400"></i>
                        <span>Berkas CSV Berhasil Diimpor & Ditriase!</span>
                      </span>
                      <span className="font-mono text-emerald-400">Batch ID: {uploadResult.batch_id.slice(0, 8)}...</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-lg border border-emerald-800/40 text-slate-300 font-mono">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Total Baris:</span>
                        <strong className="text-white text-base">{uploadResult.total_received}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Listing Valid:</span>
                        <strong className="text-emerald-400 text-base">{uploadResult.valid_listings}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Baris Karantina:</span>
                        <strong className="text-rose-400 text-base">{uploadResult.quarantined}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Total Listing Sekarang:</span>
                        <strong className="text-blue-400 text-base">{uploadResult.total_listings_now}</strong>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => setActiveTab('listings')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-xs"
                      >
                        Lihat di Tabel Listing →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 2: MANUAL FORM */}
            {inputMode === 'manual' && (
              <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Judul Produk Marketplace <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={manualJudul}
                      onChange={(e) => setManualJudul(e.target.value)}
                      placeholder="Contoh: Radio HT Handy Talky Baofeng UV-5R Dual Band VHF UHF 5W Garansi Resmi"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Harga (Rp)
                      </label>
                      <input
                        type="text"
                        value={manualHarga}
                        onChange={(e) => setManualHarga(e.target.value)}
                        placeholder="Contoh: 185.000 atau Rp185.000"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Platform Marketplace
                      </label>
                      <select
                        value={manualPlatform}
                        onChange={(e) => setManualPlatform(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="tokopedia">Tokopedia</option>
                        <option value="shopee">Shopee</option>
                        <option value="lazada">Lazada</option>
                        <option value="bukalapak">Bukalapak</option>
                        <option value="lainnya">Lainnya</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Nama Toko / Seller
                      </label>
                      <input
                        type="text"
                        value={manualSeller}
                        onChange={(e) => setManualSeller(e.target.value)}
                        placeholder="Contoh: Pusat HT Official Store"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      URL Produk / Link Toko (Opsional)
                    </label>
                    <input
                      type="url"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={manualAutoTriage}
                        onChange={(e) => setManualAutoTriage(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700"
                      />
                      <span>Otomatis lakukan triase pada listing ini</span>
                    </label>

                    <button
                      type="submit"
                      disabled={manualLoading || !manualJudul.trim()}
                      className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 text-xs transition-all"
                    >
                      <i data-lucide="plus-circle" className="w-4 h-4"></i>
                      <span>{manualLoading ? 'Menyimpan...' : 'Simpan & Tambah Listing'}</span>
                    </button>
                  </div>
                </form>

                {manualError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs">
                    {manualError}
                  </div>
                )}

                {manualResult && (
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-700 text-emerald-300 text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <i data-lucide="check-circle" className="w-4 h-4 text-emerald-400"></i>
                      <span>1 listing baru berhasil ditambahkan! Total listing kini: <strong>{manualResult.total_listings_now}</strong></span>
                    </div>
                    <button
                      onClick={() => setActiveTab('listings')}
                      className="px-3 py-1 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold"
                    >
                      Buka Tabel →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: EXTENSION INTEGRATION */}
            {inputMode === 'extension' && (
              <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
                <div className="flex items-start space-x-4 p-4 rounded-xl bg-indigo-950/40 border border-indigo-700/50">
                  <div className="p-3 bg-indigo-600 rounded-xl text-white">
                    <i data-lucide="radio" className="w-6 h-6"></i>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Integrasi Langsung Browser Scraper Extension</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Ekstensi Chrome <strong>Agus Winarko — HT Scraper</strong> dapat langsung mengirimkan data hasil scraping ke server SITRUS tanpa perlu menyimpan dan mengunggah berkas CSV secara manual.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase">
                      <span className="w-5 h-5 rounded-full bg-indigo-600/30 flex items-center justify-center text-xs">1</span>
                      <span>Buka Halaman Toko</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Buka toko penjual di <strong>Tokopedia</strong> atau <strong>Shopee</strong> (misal tab produk seller).
                    </p>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase">
                      <span className="w-5 h-5 rounded-full bg-indigo-600/30 flex items-center justify-center text-xs">2</span>
                      <span>Scrape Produk</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Buka popup ekstensi, klik <strong>Auto-scroll</strong> lalu klik <strong>Scrape produk di halaman ini</strong>.
                    </p>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase">
                      <span className="w-5 h-5 rounded-full bg-emerald-600/30 flex items-center justify-center text-xs">3</span>
                      <span>Kirim ke SITRUS</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Klik tombol <strong>🚀 Kirim Langsung ke SITRUS (API)</strong> pada popup ekstensi. Data langsung masuk dan ditriase!
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-slate-300">Endpoint Penerima Aktif:</span>
                    <code className="px-2 py-1 rounded bg-slate-800 text-indigo-300 font-mono">
                      POST http://127.0.0.1:3001/api/listings/ingest
                    </code>
                  </div>
                  <span className="text-emerald-400 font-semibold font-mono">STATUS: SIAP</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* DETAIL MODAL */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-4xl rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center space-x-3">
                <i data-lucide="scale" className="w-5 h-5 text-blue-400"></i>
                <div>
                  <h2 className="text-lg font-bold text-white">Detail Audit Trail Triase Listing</h2>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedDetail.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedListing(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                <i data-lucide="x" className="w-5 h-5"></i>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase">Data Listing Marketplace</span>
                <div className="text-base font-semibold text-white">{selectedDetail.judul_mentah}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="text-slate-500 block">Harga:</span>
                    <span className="font-mono text-slate-200">
                      {selectedDetail.harga_angka ? `Rp ${selectedDetail.harga_angka.toLocaleString()}` : selectedDetail.harga_mentah || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Penjual:</span>
                    <span className="text-slate-200">{selectedDetail.nama_penjual || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Merek:</span>
                    <span className="text-blue-400 font-mono uppercase">{selectedDetail.brand_terdeteksi || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">URL Scraper:</span>
                    {selectedDetail.url_start ? (
                      <a href={selectedDetail.url_start} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                        Buka Link Toko
                      </a>
                    ) : '-'}
                  </div>
                </div>
              </div>

              {selectedDetail.triage_result && (
                <div className={`p-5 rounded-xl border ${
                  selectedDetail.triage_result.status === 'TERSERTIFIKASI' || selectedDetail.triage_result.status === 'BERSERTIFIKAT'
                    ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                    : selectedDetail.triage_result.status === 'TERINDIKASI_TIDAK_BERSERTIFIKAT'
                    ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                    : 'bg-amber-950/30 border-amber-800/50 text-amber-300'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">Status Triase: {selectedDetail.triage_result.status}</div>
                      <div className="text-base font-bold text-white mt-1">{selectedDetail.triage_result.reason}</div>
                      <p className="text-xs text-slate-300 mt-1">{selectedDetail.triage_result.keterangan}</p>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-2xl font-black">{(selectedDetail.triage_result.max_prob * 100).toFixed(1)}%</div>
                      <span className="text-[11px] text-slate-400">Confidence</span>
                    </div>
                  </div>

                  {selectedDetail.triage_result.status === 'TERINDIKASI_TIDAK_BERSERTIFIKAT' && (
                    <div className="mt-4 p-3 rounded-lg bg-rose-950/80 border border-rose-700/60 text-xs text-rose-200">
                      <strong>Perhatian Hukum:</strong> Status negatif ini merujuk pada basis data DJID snapshot{' '}
                      <u>{selectedDetail.triage_result.snapshot_djid}</u> dan <strong>BELUM</strong> diverifikasi analis pengawasan.
                    </div>
                  )}
                </div>
              )}

              {/* Evidence Top-K */}
              {selectedDetail.triage_result?.bukti_semantik && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Bukti Kandidat DJID (Top-{selectedDetail.triage_result.bukti_semantik.length})
                  </span>
                  <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                          <th className="py-2.5 px-3">Identitas Perangkat DJID</th>
                          <th className="py-2.5 px-3">Nomor Sertifikat</th>
                          <th className="py-2.5 px-3 text-right">Cosine</th>
                          <th className="py-2.5 px-3 text-right">Prob Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selectedDetail.triage_result.bukti_semantik.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 text-center text-slate-400">{item.rank || idx + 1}</td>
                            <td className="py-2 px-3 font-sans font-medium">{item.identitas}</td>
                            <td className="py-2 px-3 text-blue-400">{item.sertifikat || '-'}</td>
                            <td className="py-2 px-3 text-right">{item.cosine?.toFixed(4)}</td>
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
            </div>

            <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedListing(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
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
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
