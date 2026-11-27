import { useCallback, useEffect, useState } from 'react';
import { AboutSection } from './components/AboutSection';
import { AdminPanel, type AdminTab } from './components/AdminPanel';
import { ContactSection } from './components/ContactSection';
import { DailyUpdatesSection } from './components/DailyUpdatesSection';
import { FeedbackRatingSection } from './components/FeedbackRatingSection';
import { Footer } from './components/Footer';
import { GallerySection } from './components/GallerySection';
import { HeroSection } from './components/HeroSection';
import { LearningHubSection } from './components/LearningHubSection';
import { MissionAI } from './components/MissionAI';
import { Navbar } from './components/Navbar';
import { TeacherProfileSection } from './components/TeacherProfileSection';
import type { SiteData } from './types/coaching';
import {
  applyRealtimeCloudUpdate,
  mergeSiteDataPreserveExisting,
  normalizeSiteBrandData,
} from './utils/coachingLogic';
import {
  loadPublicSiteFromFirestore,
  subscribeToPublicSiteFromFirestore,
} from './utils/firebaseClient';
import { DEFAULT_SITE_DATA } from './utils/seedData';

export default function App() {
  const [siteData, setSiteData] = useState<SiteData>(DEFAULT_SITE_DATA);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<AdminTab>('coaching');
  const [aiFocusTrigger, setAiFocusTrigger] = useState(0);
  const [aiExternalPrompt, setAiExternalPrompt] = useState<{
    text: string;
    id: number;
  } | null>(null);

  const openAdminTab = useCallback((tab: AdminTab = 'coaching') => {
    setAdminInitialTab(tab);
    setAdminOpen(true);
  }, []);

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
          (cloudData.learningHub && cloudData.learningHub.length > 0) ||
          (cloudData.dailyUpdates && cloudData.dailyUpdates.length > 0),
      );
      if (hasCloudData) {
        setSiteData(
          normalizeSiteBrandData({
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
            dailyUpdates:
              cloudData.dailyUpdates && cloudData.dailyUpdates.length > 0
                ? cloudData.dailyUpdates
                : baseData.dailyUpdates,
          }),
        );
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

  const jumpToMissionAI = useCallback((promptText?: string) => {
    if (promptText) {
      setAiExternalPrompt({ text: promptText, id: Date.now() });
    }
    setAiFocusTrigger((n) => n + 1);
    const section = document.getElementById('mission-ai');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const clearExternalPrompt = useCallback(() => {
    setAiExternalPrompt(null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#09090B] text-slate-100">
      <Navbar
        coachingName={siteData.coaching.name}
        onAskDoubtClick={() => jumpToMissionAI()}
        onOpenAdminClick={() => openAdminTab('coaching')}
      />

      <main className="flex-1">
        <HeroSection
          coaching={siteData.coaching}
          onAskQuestionClick={() => jumpToMissionAI()}
        />

        <AboutSection coaching={siteData.coaching} />

        <TeacherProfileSection teacher={siteData.teacher} />

        <DailyUpdatesSection
          updates={siteData.dailyUpdates || []}
          onManageUpdatesClick={() => openAdminTab('updates')}
        />

        <LearningHubSection
          resources={siteData.learningHub}
          onAskAIAboutTopic={(title) =>
            jumpToMissionAI(`Explain "${title}" step by step with an easy example.`)
          }
          onManageHubClick={() => openAdminTab('hub')}
        />

        <MissionAI
          coachingName={siteData.coaching.name}
          externalPrompt={aiExternalPrompt}
          onExternalPromptConsumed={clearExternalPrompt}
          focusTrigger={aiFocusTrigger}
        />

        <GallerySection
          items={siteData.gallery}
          onManageMediaClick={() => openAdminTab('gallery')}
        />

        <FeedbackRatingSection />

        <ContactSection
          coaching={siteData.coaching}
          socialLinks={siteData.socialLinks}
        />
      </main>

      <Footer
        coaching={siteData.coaching}
        socialLinks={siteData.socialLinks}
        onAskDoubtClick={() => jumpToMissionAI()}
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
