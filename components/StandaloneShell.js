'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ImageStudio, VideoStudio, CinemaStudio, AudioStudio, AppsStudio, AiInfluencerStudio, getUserBalance, INTERNAL_SESSION_KEY } from 'studio';
import axios from 'axios';
import ArticogAccessScreen from './ArticogAccessScreen';
import ArticogLogo from './ArticogLogo';
import {
  clearStoredAccessProfile,
  readStoredAccessProfile,
  saveStoredAccessProfile,
} from '@/lib/accessProfileStorage';
import { completeProfileFromDraft } from '@/lib/supabase/auth';
import { supabaseBrowser } from '@/lib/supabase/client';
import { getCommonCopy, getLocaleConfig, localizeStudioPath } from '@/lib/locales';

// Tab/category ids, icons, and English `label` fallbacks are stable
// identifiers, not locale copy — the actual rendered label is resolved
// per-locale from `copy.tabs`/`copy.categories` via tabLabel()/categoryLabel()
// inside the component below, with these English strings as the fallback
// when a locale bundle is missing the key.
const TABS = [
  {
    id: 'image',
    label: 'Image Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    )
  },
  {
    id: 'video',
    label: 'Video Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    )
  },
  {
    id: 'cinema',
    label: 'Cinema Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
        <line x1="7" y1="2" x2="7" y2="22"/>
        <line x1="17" y1="2" x2="17" y2="22"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <line x1="2" y1="7" x2="7" y2="7"/>
        <line x1="2" y1="17" x2="7" y2="17"/>
        <line x1="17" y1="17" x2="22" y2="17"/>
        <line x1="17" y1="7" x2="22" y2="7"/>
      </svg>
    )
  },
  {
    id: 'ai-influencer',
    label: 'AI Influencer Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    )
  },
  {
    id: 'audio',
    label: 'Audio Studio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    )
  },
  {
    id: 'apps',
    label: 'Explore Apps',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
    )
  }
];

const NAVIGATION_CATEGORIES = [
  {
    id: 'images',
    label: 'Images',
    tabIds: ['image', 'cinema', 'ai-influencer'],
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
    )
  },
  {
    id: 'video',
    label: 'Video',
    tabIds: ['video'],
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="15" height="16" rx="2"/>
        <path d="M17 9l5-3v12l-5-3"/>
        <path d="M8 9l4 3-4 3z"/>
      </svg>
    )
  },
  {
    id: 'audio',
    label: 'Audio',
    tabIds: ['audio'],
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    )
  },
];

const EXPLORE_APPS_TAB = TABS.find((tab) => tab.id === 'apps');

const getNavigationCategory = (tabId) => (
  NAVIGATION_CATEGORIES.find((category) => category.tabIds.includes(tabId))
);

const STORAGE_KEY = 'muapi_key';
const NOTIFICATIONS_STORAGE_KEY = 'open_gen_notifications_v1';
const MAX_VISIBLE_NOTIFICATIONS = 3;

const loadStoredNotifications = () => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = JSON.parse(window.sessionStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]');
    const now = Date.now();
    return Array.isArray(stored)
      ? stored.filter((notification) => notification.expiresAt > now).slice(0, MAX_VISIBLE_NOTIFICATIONS)
      : [];
  } catch {
    return [];
  }
};

const persistNotifications = (notifications) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(notifications),
    );
  } catch {
    // Notification persistence is optional; rendering still works without storage.
  }
};

export default function StandaloneShell({ locale = 'en' }) {
  const params = useParams();
  const slug = params?.slug || [];

  const copy = getCommonCopy(locale);
  const tabLabel = useCallback(
    (tabId) => copy.tabs?.[tabId] || TABS.find((t) => t.id === tabId)?.label || tabId,
    [copy],
  );
  const categoryLabel = useCallback(
    (categoryId) => copy.categories?.[categoryId] || NAVIGATION_CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId,
    [copy],
  );
  const studioPath = useCallback((tabId) => localizeStudioPath(locale, tabId), [locale]);

  // Initialize activeTab from URL slug/params or default to 'image'
  const getInitialTab = () => {
    const firstSegment = slug[0];
    return TABS.find((tab) => tab.id === firstSegment)?.id || 'image';
  };
  
  const [apiKey, setApiKey] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [activeTab, setActiveTab] = useState(getInitialTab());

  const [balance, setBalance] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState(null);

  // Sidebar Collapsed & Mobile Drawer State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sidebar_collapsed') === 'true';
    return false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState(() => (
      getNavigationCategory(getInitialTab())?.id || NAVIGATION_CATEGORIES[0].id
  ));
  const activeCategory = getNavigationCategory(activeTab);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem('sidebar_collapsed', next ? 'true' : 'false');
      return next;
    });
  }, []);

  const handleCategoryToggle = useCallback((categoryId) => {
    const isCollapsedNavigation = isSidebarCollapsed && !isMobileOpen;

    if (!isCollapsedNavigation) {
      setExpandedCategoryId((currentId) => (
        currentId === categoryId ? null : categoryId
      ));
      return;
    }

    setExpandedCategoryId(categoryId);
    toggleSidebar();
  }, [isMobileOpen, isSidebarCollapsed, toggleSidebar]);

  useEffect(() => {
    if (activeCategory?.id) {
      setExpandedCategoryId(activeCategory.id);
    }
  }, [activeCategory?.id]);

  // Global generation notifications remain mounted while users switch studios.
  const [notifications, setNotifications] = useState([]);
  const [notificationsHydrated, setNotificationsHydrated] = useState(false);
  const [generationCounts, setGenerationCounts] = useState({});

  useEffect(() => {
    setNotifications(loadStoredNotifications());
    setNotificationsHydrated(true);
  }, []);

  const pushNotification = useCallback((notif) => {
    const now = Date.now();
    const id = `notif-${Date.now()}-${Math.random()}`;
    const ttl = 12000;
    const entry = { ...notif, id, expiresAt: now + ttl };
    setNotifications((previous) => {
      const next = [
        ...previous.filter((notification) => notification.expiresAt > now),
        entry,
      ].slice(-MAX_VISIBLE_NOTIFICATIONS);
      persistNotifications(next);
      return next;
    });
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((previous) => {
      const next = previous.filter((notification) => notification.id !== id);
      persistNotifications(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!notificationsHydrated) return;

    persistNotifications(notifications);
  }, [notifications, notificationsHydrated]);

  useEffect(() => {
    if (notifications.length === 0) return undefined;

    const nextExpiry = Math.min(...notifications.map((notification) => notification.expiresAt));
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setNotifications((previous) => previous.filter((notification) => notification.expiresAt > now));
    }, Math.max(0, nextExpiry - Date.now()));

    return () => window.clearTimeout(timer);
  }, [notifications]);

  const fetchBalance = useCallback(async (key) => {
    try {
      const data = await getUserBalance(key);
      setBalance(data.balance);
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        setBalance(null);
        return;
      }
      console.error('Balance fetch failed:', err);
    }
  }, []);

  const makeSuccessCallback = useCallback((tabId) => (data) => {
    const tab = TABS.find(t => t.id === tabId);
    pushNotification({
      type: 'success',
      tabId,
      label: tab?.label || tabId,
      resultUrl: data?.url || null,
    });
  }, [pushNotification]);

  const makeErrorCallback = useCallback((tabId) => (errorOrMessage) => {
    const tab = TABS.find(t => t.id === tabId);
    const message = typeof errorOrMessage === 'string'
      ? errorOrMessage
      : (errorOrMessage?.message || errorOrMessage?.error || String(errorOrMessage || 'Generation failed'));
    pushNotification({ type: 'error', tabId, label: tab?.label || tabId, message });
    if (apiKey) void fetchBalance(apiKey);
  }, [apiKey, fetchBalance, pushNotification]);

  const makeGenerationStartCallback = useCallback((tabId) => () => {
    setGenerationCounts((previous) => ({
      ...previous,
      [tabId]: (previous[tabId] || 0) + 1,
    }));
  }, []);

  const makeGenerationEndCallback = useCallback((tabId) => () => {
    setGenerationCounts((previous) => {
      const currentCount = previous[tabId] || 0;
      if (currentCount <= 1) {
        const next = { ...previous };
        delete next[tabId];
        return next;
      }

      return {
        ...previous,
        [tabId]: currentCount - 1,
      };
    });
  }, []);

  const activeGenerations = TABS
    .filter((tab) => generationCounts[tab.id] > 0)
    .map((tab) => ({
      tabId: tab.id,
      label: tabLabel(tab.id),
      count: generationCounts[tab.id],
    }));

  // Popstate event listener to sync tab state with URL on back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      // Strip the locale root prefix (if any) before reading the
      // /studio/<tab> segment, so this works for both /studio/<tab> and
      // /<locale>/studio/<tab>.
      const { rootPath } = getLocaleConfig(locale);
      const localeAwarePath = rootPath && path.startsWith(rootPath) ? path.slice(rootPath.length) : path;
      const segments = localeAwarePath.split('/').filter(Boolean);
      const tabId = segments[1] || 'image';
      setActiveTab(TABS.find((tab) => tab.id === tabId)?.id || 'image');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [locale]);

  const handleTabChange = useCallback((tabId) => {
    const nextTab = TABS.find((tab) => tab.id === tabId)?.id || 'image';
    window.history.pushState(null, '', studioPath(nextTab));
    setActiveTab(nextTab);
  }, [studioPath]);

  const handleOpenNotification = useCallback((notification) => {
    handleTabChange(notification.tabId);
    dismissNotification(notification.id);
  }, [dismissNotification, handleTabChange]);

  const handleTabClick = (e, tabId) => {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleTabChange(tabId);
      return true;
    }
    return false;
  };

  const handleNavigationItemClick = (event, tabId) => {
    if (handleTabClick(event, tabId)) {
      setIsMobileOpen(false);
    }
  };

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const callbackError = currentUrl.searchParams.get('auth_error');
    if (callbackError) {
      setAuthError('That sign-in link could not be used. Request a new link and open it before it expires.');
      currentUrl.searchParams.delete('auth_error');
      window.history.replaceState(null, '', currentUrl);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const storedProfile = readStoredAccessProfile();
    setProfile(storedProfile);

    async function loadAuthenticatedProfile() {
      try {
        const response = await fetch('/api/profile', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const result = await response.json();
        if (!isCurrent || !response.ok || !result.authenticated) return;

        const verifiedProfile = await completeProfileFromDraft({
          profileCheck: result,
          draft: storedProfile,
        });
        if (!isCurrent) return;

        if (verifiedProfile) {
          const savedProfile = saveStoredAccessProfile(verifiedProfile);
          setProfile(savedProfile);
          setApiKey(INTERNAL_SESSION_KEY);
          void fetchBalance(INTERNAL_SESSION_KEY);
        } else {
          setProfile({
            ...storedProfile,
            ...result.profile,
            fullName: result.profile.fullName || storedProfile?.fullName || '',
          });
        }
      } catch (error) {
        console.error('[auth] profile check failed', error?.name || 'unknown');
      } finally {
        if (isCurrent) setHasMounted(true);
      }
    }

    void loadAuthenticatedProfile();
    return () => { isCurrent = false; };
  }, [fetchBalance]);

  const handleKeySave = useCallback((key) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
    fetchBalance(key);
    document.cookie = `muapi_key=${key}; path=/; max-age=31536000; SameSite=Lax`;
  }, [fetchBalance]);

  const handleKeyChange = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey(null);
    setBalance(null);
    document.cookie = "muapi_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }, []);

  const handleAccessComplete = useCallback((savedProfile) => {
    const persistedProfile = saveStoredAccessProfile(savedProfile);
    setProfile(persistedProfile);
    setApiKey(INTERNAL_SESSION_KEY);
    void fetchBalance(INTERNAL_SESSION_KEY);
  }, [fetchBalance]);

  const handleSignOut = useCallback(async () => {
    try {
      const { error } = await supabaseBrowser().auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('[auth] sign out failed', error?.name || 'unknown');
      return;
    }
    clearStoredAccessProfile();
    setProfile(null);
    setApiKey(null);
    setBalance(null);
    setShowSettings(false);
  }, []);

  // Inject API key into all outgoing Axios requests (prop-based approach)
  // We use an interceptor to be selective and NOT send the key to external domains like S3
  useEffect(() => {
    // Safety: Clear any global defaults that might have been set previously
    delete axios.defaults.headers.common['x-api-key'];

    if (!apiKey) return;

    const interceptorId = axios.interceptors.request.use((config) => {
      // Check if URL is local/proxied
      const isRelative = config.url.startsWith('/') || !config.url.startsWith('http');
      const isInternalProxy = config.url.includes('/api/app') || config.url.includes('/api/workflow') || config.url.includes('/api/agents') || config.url.includes('/api/api') || config.url.includes('/api/v1');

      if (isRelative || isInternalProxy) {
        config.headers['x-api-key'] = apiKey;
      }
      
      return config;
    });

    return () => {
      axios.interceptors.request.eject(interceptorId);
    };
  }, [apiKey]);

  // Poll for balance every 30 seconds if key is present
  useEffect(() => {
    if (!apiKey) return;
    const interval = setInterval(() => fetchBalance(apiKey), 30000);
    return () => clearInterval(interval);
  }, [apiKey, fetchBalance]);

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const isFileDrag = e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');
    if (
      isFileDrag &&
      e.dataTransfer.items &&
      e.dataTransfer.items.length > 0 &&
      (activeTab === 'image' || activeTab === 'video' || activeTab === 'audio')
    ) {
      setIsDragging(true);
    }
  }, [activeTab]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the container itself, not moving between children
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && (activeTab === 'image' || activeTab === 'video' || activeTab === 'audio')) {
      setDroppedFiles(files);
    }
  }, [activeTab]);

  const handleFilesHandled = useCallback(() => {
    setDroppedFiles(null);
  }, []);

  if (!hasMounted) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="animate-spin text-white/70 text-3xl">◌</div>
    </div>
  );

  if (!apiKey) {
    return (
      <ArticogAccessScreen
        initialProfile={profile}
        authError={authError}
        onComplete={handleAccessComplete}
      />
    );
  }

  return (
    <div 
      className="h-dvh bg-black flex flex-col overflow-hidden text-white relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-white/5 border border-dashed border-white/30 flex items-center justify-center pointer-events-none transition-colors duration-300">
          <div className="bg-[#0a0a0a] p-8 rounded-xl border border-white/10 shadow-2xl flex flex-col items-center gap-4 animate-pulse">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold text-white">{copy.shell.dropHere}</span>
              <span className="text-sm text-white/55">{copy.shell.dropHereHint}</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-white/[0.08] flex items-center justify-between px-4 bg-black z-50 gap-4">
          {/* Left: Mobile menu toggle + Logo + Desktop Sidebar Toggle */}
          <div className="flex items-center gap-3">
            {/* Mobile drawer toggle */}
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className="md:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              aria-label={copy.shell.toggleNavMenu}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Desktop Sidebar Toggle Button (Single Toggle Button) */}
            <div className="hidden md:block relative group">
              <button
                onClick={toggleSidebar}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/5"
                aria-label={isSidebarCollapsed ? copy.shell.expandSidebar : copy.shell.collapseSidebar}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`}
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                  <path d="M14 9l-3 3 3 3" />
                </svg>
              </button>
              {/* Custom Tooltip */}
              <div className="absolute left-0 top-full mt-2 px-2.5 py-1 bg-[#080808] text-white text-[11px] font-medium rounded-md shadow-2xl border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-colors duration-200 z-50 whitespace-nowrap">
                {isSidebarCollapsed ? copy.shell.expandSidebar : copy.shell.collapseSidebar}
              </div>
            </div>

            {/* Logo & Title */}
            <div className="flex items-center gap-2.5">
              <ArticogLogo />
              <span className="text-sm font-bold tracking-tight hidden sm:block text-white">
                {copy.shell.brand}
              </span>
            </div>
          </div>

          {/* Active Tab Breadcrumb Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05] text-xs text-white/60">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span className="font-medium text-white/80">
              {tabLabel(activeTab) || copy.shell.studioFallback}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex-shrink-0 flex items-center gap-3">
              <div className="flex items-center gap-2.5 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.08] transition-colors">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-white/90">
                ${balance !== null ? `${balance}` : '---'}
              </span>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-[13px] font-bold text-white/80 hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors"
              aria-label={copy.shell.settings}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="hidden sm:inline">{copy.shell.settings}</span>
            </button>
          </div>
      </header>

      {/* Main Body Layout: Left Sidebar + Studio Content Area */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* Mobile Backdrop Overlay */}
        {isMobileOpen && (
          <div 
            className="fixed inset-0 bg-black/70 z-40 md:hidden animate-fade-in"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Left Sidebar Navigation */}
        <aside
              className={`
              fixed top-14 bottom-0 left-0 md:static md:h-full z-30 bg-black border-r border-white/[0.08] flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 select-none
              ${isMobileOpen ? 'translate-x-0 w-60 z-50' : '-translate-x-full md:translate-x-0'}
              ${isSidebarCollapsed ? 'md:w-16' : 'md:w-52'}
            `}
          >
            <nav aria-label={copy.shell.studioNavigation} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none py-3 px-2">
              <div className="space-y-2">
                {NAVIGATION_CATEGORIES.map((category) => {
                  const isCategoryActive = activeCategory?.id === category.id;
                  const isCollapsed = isSidebarCollapsed && !isMobileOpen;
                  const isCategoryOpen = !isCollapsed && expandedCategoryId === category.id;
                  const categoryPanelId = `navigation-category-${category.id}`;
                  const categoryLabelText = categoryLabel(category.id);

                  return (
                    <div key={category.id} className="relative">
                      <button
                        type="button"
                        onClick={() => handleCategoryToggle(category.id)}
                        aria-label={categoryLabelText}
                        aria-expanded={isCategoryOpen}
                        aria-controls={isCollapsed ? undefined : categoryPanelId}
                        title={isCollapsed ? categoryLabelText : undefined}
                        className={`
                          group relative flex h-10 items-center rounded-xl transition-colors font-semibold
                          ${isCollapsed ? 'w-10 justify-center mx-auto' : 'px-3 w-full gap-3 text-left'}
                          ${isCategoryActive
                            ? 'bg-white/[0.05] text-white border border-white/[0.08]'
                            : isCategoryOpen
                              ? 'bg-white/[0.03] text-white border border-white/[0.08]'
                              : 'text-white/55 hover:text-white hover:bg-white/[0.05] border border-transparent'
                          }
                        `}
                      >
                        {isCategoryActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-white rounded-r-full" />
                        )}

                        <span className={`flex-shrink-0 transition-colors [&_svg]:h-4 [&_svg]:w-4 ${isCategoryActive ? 'text-white' : 'text-white/55 group-hover:text-white'}`}>
                          {category.icon}
                        </span>

                        {!isCollapsed && (
                          <>
                            <span className="flex-1 min-w-0 text-[11px] leading-4 uppercase tracking-[0.16em]">
                              {categoryLabelText}
                            </span>
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`flex-shrink-0 transition-transform duration-200 ${isCategoryOpen ? 'rotate-180' : ''}`}
                              aria-hidden="true"
                            >
                              <path d="M6 9l6 6 6-6"/>
                            </svg>
                          </>
                        )}
                      </button>

                      {!isCollapsed && isCategoryOpen && (
                        <div
                          id={categoryPanelId}
                          role="group"
                          aria-label={`${categoryLabelText} ${copy.shell.toolsSuffix}`}
                          className="mt-2 ml-2 pl-2 border-l border-white/[0.08] space-y-2 max-h-64 overflow-y-auto scrollbar-none"
                        >
                          {category.tabIds.map((tabId) => {
                            const tab = TABS.find((item) => item.id === tabId);
                            if (!tab) return null;
                            const isActive = activeTab === tab.id;

                            return (
                              <a
                                key={tab.id}
                                href={studioPath(tab.id)}
                                onClick={(event) => handleNavigationItemClick(event, tab.id)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`
                                  group relative flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-medium transition-colors
                                  ${isActive
                                    ? 'bg-white/[0.05] text-white border border-white/[0.08]'
                                    : 'text-white/55 hover:text-white hover:bg-white/[0.05] border border-transparent'
                                  }
                                `}
                              >
                                {isActive && (
                                  <span className="absolute -left-[11px] top-2 bottom-2 w-0.5 rounded-full bg-white" />
                                )}
                                <span className={`flex-shrink-0 [&_svg]:h-4 [&_svg]:w-4 ${isActive ? 'text-white' : 'text-white/45 group-hover:text-white/80'}`}>
                                  {tab.icon}
                                </span>
                                <span className="truncate">{tabLabel(tab.id)}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {EXPLORE_APPS_TAB && (
                <div className="mt-3 pt-3 border-t border-white/[0.07]">
                  <a
                    href={studioPath(EXPLORE_APPS_TAB.id)}
                    onClick={(event) => handleNavigationItemClick(event, EXPLORE_APPS_TAB.id)}
                    aria-current={activeTab === EXPLORE_APPS_TAB.id ? 'page' : undefined}
                    aria-label={tabLabel(EXPLORE_APPS_TAB.id)}
                    title={isSidebarCollapsed && !isMobileOpen ? tabLabel(EXPLORE_APPS_TAB.id) : undefined}
                    className={`
                      group relative flex items-center rounded-xl transition-all duration-150 text-[13px] font-semibold
                      ${isSidebarCollapsed && !isMobileOpen ? 'h-10 w-10 justify-center mx-auto' : 'h-10 px-3 w-full gap-3'}
                      ${activeTab === EXPLORE_APPS_TAB.id
                        ? 'bg-white/[0.05] text-white border border-white/[0.08]'
                        : 'text-white/55 hover:text-white hover:bg-white/[0.05] border border-transparent'
                      }
                    `}
                  >
                    {activeTab === EXPLORE_APPS_TAB.id && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-white rounded-r-full" />
                    )}
                    <span className={`flex-shrink-0 [&_svg]:h-4 [&_svg]:w-4 ${activeTab === EXPLORE_APPS_TAB.id ? 'text-white' : 'text-white/50 group-hover:text-white'}`}>
                      {EXPLORE_APPS_TAB.icon}
                    </span>
                    {(!isSidebarCollapsed || isMobileOpen) && (
                      <span className="truncate">{tabLabel(EXPLORE_APPS_TAB.id)}</span>
                    )}
                  </a>
                </div>
              )}

            </nav>
        </aside>

        {/* Studio Content */}
        <div className="flex-1 min-h-0 h-full relative overflow-hidden bg-black">
        <div className={activeTab === 'image' ? "h-full w-full" : "hidden"}>
          <ImageStudio apiKey={apiKey} locale={locale} droppedFiles={activeTab === 'image' ? droppedFiles : null} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('image')} onGenerationEnd={makeGenerationEndCallback('image')} onGenerationComplete={makeSuccessCallback('image')} onGenerationError={makeErrorCallback('image')} />
        </div>
        <div className={activeTab === 'video' ? "h-full w-full" : "hidden"}>
          <VideoStudio apiKey={apiKey} locale={locale} droppedFiles={activeTab === 'video' ? droppedFiles : null} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('video')} onGenerationEnd={makeGenerationEndCallback('video')} onGenerationComplete={makeSuccessCallback('video')} onGenerationError={makeErrorCallback('video')} />
        </div>
        <div className={activeTab === 'cinema' ? "h-full w-full" : "hidden"}>
          <CinemaStudio apiKey={apiKey} locale={locale} onGenerationStart={makeGenerationStartCallback('cinema')} onGenerationEnd={makeGenerationEndCallback('cinema')} onGenerationComplete={makeSuccessCallback('cinema')} onGenerationError={makeErrorCallback('cinema')} />
        </div>
        <div className={activeTab === 'audio' ? "h-full w-full" : "hidden"}>
          <AudioStudio apiKey={apiKey} locale={locale} droppedFiles={activeTab === 'audio' ? droppedFiles : null} onFilesHandled={handleFilesHandled} onGenerationStart={makeGenerationStartCallback('audio')} onGenerationEnd={makeGenerationEndCallback('audio')} onGenerationComplete={makeSuccessCallback('audio')} onGenerationError={makeErrorCallback('audio')} />
        </div>
        <div className={activeTab === 'apps' ? "h-full w-full" : "hidden"}>
          <AppsStudio apiKey={apiKey} locale={locale} />
        </div>
        <div className={activeTab === 'ai-influencer' ? "h-full w-full" : "hidden"}>
          <AiInfluencerStudio
            apiKey={apiKey}
            locale={locale}
            onGenerationStart={makeGenerationStartCallback('ai-influencer')}
            onGenerationEnd={makeGenerationEndCallback('ai-influencer')}
            onGenerationComplete={makeSuccessCallback('ai-influencer')}
            onGenerationError={makeErrorCallback('ai-influencer')}
          />
        </div>
      </div>
    </div>

      {/* Global generation activity and notification stack */}
      {(activeGenerations.length > 0 || notifications.length > 0) && (
        <div
          aria-live="polite"
          aria-label={copy.notifications.ariaLabel}
          className="fixed top-16 right-5 z-[200] flex max-h-[calc(100vh-80px)] w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2 overflow-x-hidden overflow-y-auto global-notif-stack pointer-events-none"
          data-testid="global-notification-stack"
        >
          {activeGenerations.map((generation) => (
            <div
              key={generation.tabId}
              role="status"
              data-generation-tab={generation.tabId}
              className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-[#080808] px-3.5 py-3 text-[13px] text-white shadow-xl"
              data-testid="generation-activity"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white"
                  aria-hidden="true"
                />
              </span>
              <p className="min-w-0 flex-1 font-medium leading-5 text-white">
                {generation.label} {copy.notifications.generating}
                {generation.count > 1 ? ` (${generation.count})` : ''}
              </p>
            </div>
          ))}

          {notifications.map((notif) => (
            <div
              key={notif.id}
              role={notif.type === 'error' ? 'alert' : 'status'}
              data-notification-type={notif.type}
              data-notification-tab={notif.tabId}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-white/10 bg-[#080808] px-3.5 py-3 text-[13px] text-white shadow-xl"
              style={{
                borderColor: notif.type === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
                animation: 'slideInRight 500ms ease-out forwards',
              }}
            >
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                  notif.type === 'success'
                    ? 'border-green-400/30 bg-green-400/10 text-green-300'
                    : 'border-red-400/30 bg-red-400/10 text-red-300'
                }`}
              >
                {notif.type === 'success' ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v6" />
                    <path d="M12 17h.01" />
                  </svg>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-5 text-white">
                  {notif.label}
                  <span className="font-normal text-white/55">
                    {' '}
                    {notif.type === 'success' ? copy.notifications.generationComplete : copy.notifications.generationFailed}
                  </span>
                </p>
                {notif.type === 'error' && notif.message && (
                  <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-4 text-red-600" title={typeof notif.message === 'string' ? notif.message : String(notif.message?.message || notif.message)}>
                    {typeof notif.message === 'string' ? notif.message : String(notif.message?.message || notif.message)}
                  </p>
                )}
                {notif.type === 'success' && (
                  <p className="mt-0.5 text-[12px] leading-4 text-white/55">
                    {copy.notifications.resultReady}
                  </p>
                )}
                {notif.type === 'success' && (
                  <button
                    type="button"
                    onClick={() => handleOpenNotification(notif)}
                    className="mt-1.5 text-[11px] font-semibold text-white/70 transition-colors hover:text-white"
                    aria-label={copy.notifications.openResult.replace('{label}', notif.label)}
                  >
                    {copy.notifications.open}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissNotification(notif.id)}
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                aria-label={copy.notifications.dismissNotification}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Keyframe for toast slide-in & scrollbar suppression */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .global-notif-stack::-webkit-scrollbar {
          display: none;
        }
        .global-notif-stack {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in-up">
          <div className="bg-[#080808] border border-white/10 rounded-xl p-6 sm:p-8 w-full max-w-sm">
            <h2 className="text-white font-bold text-lg mb-2">{copy.settingsModal.title}</h2>
            <p className="text-white/55 text-[13px] mb-8">
              {copy.settingsModal.subtitle}
            </p>

            <div className="space-y-4 mb-8">
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-4">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55 mb-2">
                   {copy.settingsModal.accountEmail}
                </label>
                <div className="text-[13px] font-mono text-[#e6e6e6]">
                  {profile?.email || 'Articog account'}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSignOut}
                className="flex-1 h-10 rounded-full border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.05] hover:text-white text-xs font-medium transition-colors"
              >
                {copy.settingsModal.signOut}
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 h-10 rounded-full bg-white text-black hover:bg-white/90 text-xs font-medium transition-colors"
              >
                {copy.settingsModal.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
