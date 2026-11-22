import { useCallback, useEffect, useState } from 'react';
import { AboutSection } from './components/AboutSection';
import { AdminPanel } from './components/AdminPanel';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { GallerySection } from './components/GallerySection';
import { HeroSection } from './components/HeroSection';
import { LearningHubSection } from './components/LearningHubSection';
import { Navbar } from './components/Navbar';
import { TeacherProfileSection } from './components/TeacherProfileSection';
import type { SiteData } from './types/coaching';
import {
  applyRealtimeCloudUpdate,
  mergeSiteDataPreserveExisting,
} from './utils/coachingLogic';
import {
  loadPublicSiteFromFirestore,
  subscribeToPublicSiteFromFirestore,
} from './utils/firebaseClient';
import { DEFAULT_SITE_DATA } from './utils/seedData';

export default function App() {
  const [siteData, setSiteData] = useState<SiteData>(DEFAULT_SITE_DATA);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<
    'coaching' | 'teacher' | 'gallery' | 'hub' | 'enquiries'
  >('coaching');

  const openAdminTab = useCallback(
    (tab: 'coaching' | 'teacher' | 'gallery' | 'hub' | 'enquiries' = 'coaching') => {
      setAdminInitialTab(tab);
      setAdminOpen(true);
    },
    [],
  );

  const loadSiteData = useCallback(async () => {
    let baseData: SiteData = DEFAULT_SITE_DATA;
    try {
      const response = await fetch('/api/site');
      if (response.ok) {
        const apiData = (await response.json()) as SiteData;
        baseData = mergeSiteDataPreserveExisting(DEFAULT_SITE_DATA, apiData);
      }
    } catch {
      // Keep default seed data visible if backend fetch is unavailable
    }

    try {
      const cloudData = await loadPublicSiteFromFirestore();
      const hasCloudData = Boolean(
        cloudData.coaching ||
          cloudData.socialLinks ||
          cloudData.teacher ||
          (cloudData.gallery && cloudData.gallery.length > 0) ||
          (cloudData.learningHub && cloudData.learningHub.length > 0),
      );
      if (hasCloudData) {
        setSiteData({
          coaching: { ...baseData.coaching, ...(cloudData.coaching || {}) },
          socialLinks: { ...baseData.socialLinks, ...(cloudData.socialLinks || {}) },
          teacher: { ...baseData.teacher, ...(cloudData.teacher || {}) },
          gallery:
            cloudData.gallery && cloudData.gallery.length > 0
              ? cloudData.gallery
              : baseData.gallery,
          learningHub:
            cloudData.learningHub && cloudData.learningHub.length > 0
              ? cloudData.learningHub
              : baseData.learningHub,
        });
        return;
      }
    } catch {
      // Fall back cleanly to local/API data if cloud read fails
    }

    setSiteData(baseData);
  }, []);

  useEffect(() => {
    void loadSiteData();
    const unsubscribe = subscribeToPublicSiteFromFirestore((cloudData) => {
      setSiteData((prev) => applyRealtimeCloudUpdate(prev, cloudData));
    });
    return () => unsubscribe();
  }, [loadSiteData]);

  const jumpToContact = useCallback(() => {
    const section = document.getElementById('contact');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-slate-900">
      <Navbar
        coachingName={siteData.coaching.name}
        onContactClick={jumpToContact}
        onOpenAdminClick={() => openAdminTab('coaching')}
      />

      <main className="flex-1">
        <HeroSection coaching={siteData.coaching} />

        <AboutSection coaching={siteData.coaching} />

        <TeacherProfileSection teacher={siteData.teacher} />

        <LearningHubSection
          resources={siteData.learningHub}
          onManageHubClick={() => openAdminTab('hub')}
        />

        <GallerySection
          items={siteData.gallery}
          onManageMediaClick={() => openAdminTab('gallery')}
        />

        <ContactSection
          coaching={siteData.coaching}
          socialLinks={siteData.socialLinks}
        />
      </main>

      <Footer
        coaching={siteData.coaching}
        socialLinks={siteData.socialLinks}
        onOpenAdminClick={() => openAdminTab('coaching')}
      />

      <AdminPanel
        isOpen={adminOpen}
        initialTab={adminInitialTab}
        onClose={() => setAdminOpen(false)}
        onSiteUpdated={loadSiteData}
      />
    </div>
  );
}
