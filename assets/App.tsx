import React, { useState, useMemo, useRef, useEffect } from 'react';
import { INITIAL_MATERIALS } from './data/materialsData';
import { Material, MaterialOrigin, MaterialCategory } from './types';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { FilterBar } from './components/FilterBar';
import { MaterialCard } from './components/MaterialCard';
import { ComparisonBar } from './components/ComparisonBar';
import { ComparisonModal } from './components/ComparisonModal';
import { DatasheetModal } from './components/DatasheetModal';
import { NewMaterialModal } from './components/NewMaterialModal';
import { AboutModal } from './components/AboutModal';
import { TrendsSection } from './components/TrendsSection';
import { Footer } from './components/Footer';
import { OfflineExportModal } from './components/OfflineExportModal';
import { DeployGuideModal } from './components/DeployGuideModal';
import { OnlineResultsSection } from './components/OnlineResultsSection';
import { downloadStandaloneHtmlFile } from './utils/exportHtml';
import { Sparkles, Layers, SearchX, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [materials, setMaterials] = useState<Material[]>(() => {
    try {
      const saved = localStorage.getItem('materialplus_user_materials');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_MATERIALS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState<MaterialOrigin | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'eco' | 'studies'>('newest');

  // Online Search Mode
  const [isOnlineMode, setIsOnlineMode] = useState(true);
  const [onlineResults, setOnlineResults] = useState<Material[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineSearchMessage, setOnlineSearchMessage] = useState('');
  const [onlineSearchToast, setOnlineSearchToast] = useState<string | null>(null);

  // Deploy / Online Guide Modal
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);
  
  // Comparison State
  const [comparisonList, setComparisonList] = useState<Material[]>(() => [
    INITIAL_MATERIALS[5],
    INITIAL_MATERIALS[2]
  ]);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

  // Datasheet Details Modal
  const [activeDatasheetMaterial, setActiveDatasheetMaterial] = useState<Material | null>(null);

  // New Material Modal
  const [isNewMaterialModalOpen, setIsNewMaterialModalOpen] = useState(false);

  // About Modal
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  // Offline Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Bookmarks
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('materialplus_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Persist materials whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('materialplus_user_materials', JSON.stringify(materials));
    } catch {
      // ignore
    }
  }, [materials]);

  useEffect(() => {
    try {
      localStorage.setItem('materialplus_bookmarks', JSON.stringify(bookmarkedIds));
    } catch {
      // ignore local storage errors
    }
  }, [bookmarkedIds]);

  // Online Search Trigger
  const handleOnlineSearch = async (customQuery?: string) => {
    const queryToUse = (customQuery !== undefined ? customQuery : searchQuery).trim();
    setIsSearchingOnline(true);
    setOnlineSearchMessage('در حال کاوش در پایگاه متریال‌های ۲۰۲۵ جهان و ایران...');

    try {
      const res = await fetch('/api/materials/online-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToUse,
          origin: selectedOrigin,
          category: selectedCategory,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      if (data && Array.isArray(data.materials)) {
        setOnlineResults(data.materials);
        setOnlineSearchMessage(data.message || 'یافته‌های زنده با موفقیت دریافت شدند.');
        setTimeout(() => {
          const el = document.getElementById('online-results-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    } catch (err) {
      console.error('Online search error:', err);
      setOnlineSearchMessage('خطا در دریافت نتایج زنده. اتصال بررسی شد.');
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // Add found material from online search to active catalog
  const handleAddToCatalog = (mat: Material) => {
    setMaterials((prev) => {
      if (prev.some((m) => m.id === mat.id)) return prev;
      return [mat, ...prev];
    });
    setOnlineSearchToast(`متریال «${mat.title}» به کاتالوگ دائمی افزوده شد.`);
    setTimeout(() => setOnlineSearchToast(null), 3500);
  };

  // Iranian materials count
  const nativeCount = useMemo(() => {
    return materials.filter((m) => m.origin === 'iran').length;
  }, [materials]);

  const existingIdsSet = useMemo(() => {
    return new Set(materials.map((m) => m.id));
  }, [materials]);

  // Filter and Sort Materials
  const filteredMaterials = useMemo(() => {
    let result = [...materials];

    // Filter by Origin
    if (selectedOrigin !== 'all') {
      result = result.filter((m) => m.origin === selectedOrigin);
    }

    // Filter by Category
    if (selectedCategory !== 'all') {
      result = result.filter((m) => m.category === selectedCategory);
    }

    // Filter by Search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.location.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          m.categoryLabel.toLowerCase().includes(q) ||
          (m.trendTag && m.trendTag.toLowerCase().includes(q)) ||
          (m.specs.compressiveStrength && m.specs.compressiveStrength.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortBy === 'eco') {
      result.sort((a, b) => (b.ecoScore || 0) - (a.ecoScore || 0));
    } else if (sortBy === 'studies') {
      result.sort((a, b) => b.studiesCount - a.studiesCount);
    } else if (sortBy === 'newest') {
      result.sort((a, b) => (b.isCustom ? 1 : 0) - (a.isCustom ? 1 : 0));
    }

    return result;
  }, [materials, selectedOrigin, selectedCategory, searchQuery, sortBy]);

  // Toggle comparison item
  const handleToggleComparison = (material: Material) => {
    setComparisonList((prev) => {
      const exists = prev.some((m) => m.id === material.id);
      if (exists) {
        return prev.filter((m) => m.id !== material.id);
      }
      if (prev.length >= 2) {
        return [prev[1], material];
      }
      return [...prev, material];
    });
  };

  const handleRemoveFromComparison = (id: string) => {
    setComparisonList((prev) => prev.filter((m) => m.id !== id));
  };

  const handleClearComparison = () => {
    setComparisonList([]);
  };

  // Toggle Bookmark
  const handleToggleBookmark = (id: string) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Add new material
  const handleAddNewMaterial = (newMat: Material) => {
    setMaterials((prev) => [newMat, ...prev]);
    scrollToCatalog();
  };

  // Quick navigation handlers
  const scrollToCatalog = () => {
    const el = document.getElementById('catalog-controls');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToTrends = () => {
    const el = document.getElementById('trends-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleFilterNative = () => {
    setSelectedOrigin('iran');
    scrollToCatalog();
  };

  const handleSearchFocus = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleQuickKeyword = (kw: string) => {
    setSearchQuery(kw);
    scrollToCatalog();
  };

  return (
    <div className="min-h-screen bg-[#0b101b] text-slate-100 flex flex-col font-['Vazirmatn',sans-serif]">
      
      {/* Toast notification */}
      {onlineSearchToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-xl shadow-emerald-950/50 flex items-center gap-2 border border-emerald-400 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{onlineSearchToast}</span>
        </div>
      )}

      {/* Header */}
      <Header
        onOpenNewModal={() => setIsNewMaterialModalOpen(true)}
        onFilterNative={handleFilterNative}
        onScrollToTrends={scrollToTrends}
        onScrollToCatalog={scrollToCatalog}
        onOpenAbout={() => setIsAboutModalOpen(true)}
        onExportHtml={() => setIsExportModalOpen(true)}
        onOpenSearchFocus={handleSearchFocus}
        onOpenDeployGuide={() => setIsDeployGuideOpen(true)}
        nativeCount={nativeCount}
      />

      {/* Main Container */}
      <main className="flex-1">
        
        {/* Hero Section */}
        <Hero
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={(e) => {
            e.preventDefault();
            if (isOnlineMode) {
              handleOnlineSearch();
            } else {
              scrollToCatalog();
            }
          }}
          searchInputRef={searchInputRef}
          onQuickKeyword={handleQuickKeyword}
          isOnlineMode={isOnlineMode}
          onToggleOnlineMode={setIsOnlineMode}
          isSearchingOnline={isSearchingOnline}
          onTriggerOnlineSearch={handleOnlineSearch}
        />

        {/* Live Online Search Results Section */}
        <div id="online-results-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <OnlineResultsSection
            onlineResults={onlineResults}
            isSearchingOnline={isSearchingOnline}
            onlineSearchMessage={onlineSearchMessage}
            onAddToCatalog={handleAddToCatalog}
            onOpenDatasheet={setActiveDatasheetMaterial}
            onToggleCompare={handleToggleComparison}
            comparisonList={comparisonList}
            existingIds={existingIdsSet}
            onClearOnlineResults={() => setOnlineResults([])}
          />
        </div>

        {/* Catalog Section */}
        <section id="materials-catalog" className="pb-16">
          
          {/* Filters and Controls */}
          <FilterBar
            selectedOrigin={selectedOrigin}
            onSelectOrigin={setSelectedOrigin}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            sortBy={sortBy}
            onSelectSort={setSortBy}
            totalShown={filteredMaterials.length}
            totalAll={materials.length}
          />

          {/* Cards Grid */}
          <div id="materials-grid" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {filteredMaterials.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMaterials.map((mat) => {
                  const isInComparison = comparisonList.some((c) => c.id === mat.id);
                  const isBookmarked = bookmarkedIds.includes(mat.id);

                  return (
                    <MaterialCard
                      key={mat.id}
                      material={mat}
                      isInComparison={isInComparison}
                      onToggleComparison={handleToggleComparison}
                      onOpenDatasheet={setActiveDatasheetMaterial}
                      isBookmarked={isBookmarked}
                      onToggleBookmark={handleToggleBookmark}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#111928] border border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto my-8">
                <SearchX className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">متریالی با این مشخصات در کاتالوگ یافت نشد</h3>
                <p className="text-xs sm:text-sm text-slate-400 mb-6">
                  می‌توانید با استفاده از دکمه «جستجوی آنلاین متریال‌های روز» در بالای صفحه، متریال‌های نوین جهان را به صورت زنده استخراج نمایید.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => {
                      setIsOnlineMode(true);
                      handleOnlineSearch(searchQuery);
                    }}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-700/30 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>جستجوی آنلاین همین عبارت در منابع جهانی</span>
                  </button>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedOrigin('all');
                      setSelectedCategory('all');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    نمایش مجدد همه
                  </button>
                </div>
              </div>
            )}
          </div>

        </section>

        {/* 2025 Megatrends Section */}
        <TrendsSection
          onSelectTrendTag={(tag) => {
            setSearchQuery(tag);
            scrollToCatalog();
          }}
        />

      </main>

      {/* Floating Comparison Bar */}
      <ComparisonBar
        comparisonList={comparisonList}
        onRemoveFromComparison={handleRemoveFromComparison}
        onClearComparison={handleClearComparison}
        onOpenComparisonModal={() => setIsComparisonModalOpen(true)}
      />

      {/* Comparison Modal */}
      {isComparisonModalOpen && (
        <ComparisonModal
          items={comparisonList}
          onClose={() => setIsComparisonModalOpen(false)}
          onClear={handleClearComparison}
          onRemoveItem={handleRemoveFromComparison}
        />
      )}

      {/* Datasheet Modal */}
      {activeDatasheetMaterial && (
        <DatasheetModal
          material={activeDatasheetMaterial}
          onClose={() => setActiveDatasheetMaterial(null)}
          onAddToComparison={handleToggleComparison}
          isInComparison={comparisonList.some((c) => c.id === activeDatasheetMaterial.id)}
        />
      )}

      {/* Submit New Material Modal */}
      <NewMaterialModal
        isOpen={isNewMaterialModalOpen}
        onClose={() => setIsNewMaterialModalOpen(false)}
        onAddNewMaterial={handleAddNewMaterial}
      />

      {/* About Modal */}
      {isAboutModalOpen && (
        <AboutModal
          isOpen={isAboutModalOpen}
          onClose={() => setIsAboutModalOpen(false)}
        />
      )}

      {/* Single File Offline HTML Exporter Modal */}
      <OfflineExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        materials={materials}
      />

      {/* Online & Deploy Guide Modal */}
      <DeployGuideModal
        isOpen={isDeployGuideOpen}
        onClose={() => setIsDeployGuideOpen(false)}
      />

      {/* Footer */}
      <Footer
        onCategoryClick={(catKey) => {
          setSelectedCategory(catKey as MaterialCategory);
          scrollToCatalog();
        }}
        onExportHtml={() => setIsExportModalOpen(true)}
      />

    </div>
  );
}
