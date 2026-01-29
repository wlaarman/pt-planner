import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  FileText,
  Palette,
  CheckCircle,
  Link as LinkIcon,
  AlertCircle,
  ExternalLink,
  Loader2,
  Key,
  Download,
  Smartphone,
} from 'lucide-react';
import clsx from 'clsx';
import { calendarApi, eboekhoudenApi } from '../lib/api';

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // iCal settings
  const [icalUrl, setIcalUrl] = useState('');
  const [showIcalEvents, setShowIcalEvents] = useState(true);
  const [urlError, setUrlError] = useState('');

  // Display settings (stored in localStorage)
  const [showSunday, setShowSunday] = useState(() => {
    const stored = localStorage.getItem('pt-planner-show-sunday');
    return stored === null ? false : stored === 'true';
  });

  // e-Boekhouden token settings
  const [eboekhoudenToken, setEboekhoudenToken] = useState('');
  const [tokenError, setTokenError] = useState('');

  // PWA install
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Fetch iCal settings
  const { data: icalSettings } = useQuery({
    queryKey: ['ical-settings'],
    queryFn: calendarApi.getSettings,
  });

  // Update local state when settings are fetched
  useEffect(() => {
    if (icalSettings) {
      setIcalUrl(icalSettings.icalUrl || '');
      setShowIcalEvents(icalSettings.showIcalEvents ?? true);
    }
  }, [icalSettings]);

  // PWA install prompt
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Mutation for saving iCal settings
  const saveSettingsMutation = useMutation({
    mutationFn: calendarApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ical-settings'] });
      queryClient.invalidateQueries({ queryKey: ['ical-events'] });
    },
  });

  // Mutation for disconnecting
  const disconnectMutation = useMutation({
    mutationFn: calendarApi.disconnect,
    onSuccess: () => {
      setIcalUrl('');
      queryClient.invalidateQueries({ queryKey: ['ical-settings'] });
      queryClient.invalidateQueries({ queryKey: ['ical-events'] });
    },
  });

  // Fetch e-Boekhouden status
  const { data: eboekhoudenStatus, isLoading: isLoadingEboekhoudenStatus } = useQuery({
    queryKey: ['eboekhouden-status'],
    queryFn: () => eboekhoudenApi.getStatus(),
  });

  // Mutation for saving e-Boekhouden token
  const saveTokenMutation = useMutation({
    mutationFn: (token: string) => eboekhoudenApi.saveToken(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eboekhouden-status'] });
      setEboekhoudenToken('');
      setTokenError('');
    },
    onError: (error: any) => {
      setTokenError(error?.response?.data?.error || 'Ongeldige token');
    },
  });

  // Mutation for deleting e-Boekhouden token
  const deleteTokenMutation = useMutation({
    mutationFn: () => eboekhoudenApi.deleteToken(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eboekhouden-status'] });
    },
  });

  const handleSaveToken = () => {
    if (!eboekhoudenToken.trim()) {
      setTokenError('Voer een token in');
      return;
    }
    setTokenError('');
    saveTokenMutation.mutate(eboekhoudenToken.trim());
  };

  const handleDeleteToken = () => {
    if (confirm('Weet je zeker dat je de e-Boekhouden koppeling wilt verwijderen?')) {
      deleteTokenMutation.mutate();
    }
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error('PWA install error:', error);
    }
  };

  const isConnected = !!icalSettings?.icalUrl;

  const handleConnect = () => {
    // Validate URL
    if (!icalUrl.trim()) {
      setUrlError('Voer een iCal URL in');
      return;
    }

    try {
      new URL(icalUrl);
    } catch {
      setUrlError('Ongeldige URL. Zorg dat het begint met http:// of https://');
      return;
    }

    if (!icalUrl.includes('.ics') && !icalUrl.includes('ical') && !icalUrl.includes('calendar')) {
      setUrlError('Dit lijkt geen geldige kalender URL te zijn');
      return;
    }

    setUrlError('');
    saveSettingsMutation.mutate({ icalUrl, showIcalEvents });
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  const handleToggleShowEvents = (checked: boolean) => {
    setShowIcalEvents(checked);
    if (isConnected) {
      saveSettingsMutation.mutate({ icalUrl: icalSettings?.icalUrl, showIcalEvents: checked });
    }
  };

  const handleToggleShowSunday = (checked: boolean) => {
    setShowSunday(checked);
    localStorage.setItem('pt-planner-show-sunday', String(checked));
    // Dispatch event so CalendarPage can react to the change
    window.dispatchEvent(new CustomEvent('pt-planner-settings-changed'));
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl overflow-x-hidden">
      <header className="mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">Instellingen</h1>
      </header>

      <div className="space-y-4 lg:space-y-6">
        {/* PWA Install */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-primary-500" />
            App Installeren
          </h2>

          <div
            className={clsx(
              'p-4 border rounded-lg',
              isInstalled
                ? 'border-green-200 bg-gradient-to-r from-green-50 to-transparent'
                : 'border-gray-200'
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 flex-shrink-0">
                <Download className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900">PT Planner App</h3>
                {isInstalled ? (
                  <div className="mt-1">
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      App is geinstalleerd
                    </span>
                  </div>
                ) : deferredPrompt ? (
                  <p className="text-sm text-gray-500 mt-1">
                    Installeer de app op je apparaat voor snelle toegang
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    Gebruik je browser menu om de app te installeren, of open deze pagina in Chrome/Safari
                  </p>
                )}
              </div>
              {!isInstalled && deferredPrompt && (
                <button
                  onClick={handleInstallPWA}
                  className="w-full sm:w-auto px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Installeren
                </button>
              )}
            </div>

            {!isInstalled && !deferredPrompt && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Handmatig installeren:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-gray-500 w-16 flex-shrink-0">iPhone:</span>
                    <span>Tik op <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-xs">Deel</span> → "Zet op beginscherm"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-gray-500 w-16 flex-shrink-0">Android:</span>
                    <span>Tik op <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-xs">⋮</span> → "Toevoegen aan startscherm"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-gray-500 w-16 flex-shrink-0">Desktop:</span>
                    <span>Klik op het installatie-icoon in de adresbalk</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Calendar Display Settings */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary-500" />
            Kalender Weergave
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-medium text-gray-900">Toon zondag</p>
                <p className="text-sm text-gray-500">
                  Toon zondag in de weekweergave
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={showSunday}
                  onChange={(e) => handleToggleShowSunday(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Calendar Connections */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary-500" />
            Externe Kalender
          </h2>

          <div className="space-y-4">
            {/* iCal Connection */}
            <div
              className={clsx(
                'p-4 border rounded-lg',
                isConnected
                  ? 'border-green-200 bg-gradient-to-r from-green-50 to-transparent'
                  : 'border-gray-200'
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900">iCal Kalender Feed</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Koppel een externe kalender via iCal URL
                  </p>

                  {isConnected ? (
                    <div className="mt-3 overflow-hidden">
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Verbonden
                      </span>
                      <p className="text-xs text-gray-400 mt-1 truncate max-w-[200px] sm:max-w-xs" title={icalSettings?.icalUrl}>
                        {icalSettings?.icalUrl}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <input
                        type="url"
                        value={icalUrl}
                        onChange={(e) => {
                          setIcalUrl(e.target.value);
                          setUrlError('');
                        }}
                        placeholder="https://calendar.google.com/..."
                        className={clsx(
                          'w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none',
                          urlError ? 'border-red-300' : 'border-gray-300'
                        )}
                      />
                      {urlError && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {urlError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {isConnected ? (
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnectMutation.isPending}
                      className="w-full sm:w-auto px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {disconnectMutation.isPending ? 'Bezig...' : 'Ontkoppelen'}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnect}
                      disabled={saveSettingsMutation.isPending || !icalUrl.trim()}
                      className="w-full sm:w-auto px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                    >
                      {saveSettingsMutation.isPending ? 'Bezig...' : 'Verbinden'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Help text - collapsible on mobile */}
            <details className="bg-gray-50 rounded-lg">
              <summary className="p-4 text-sm font-medium text-gray-700 cursor-pointer">
                Hoe vind ik mijn iCal URL?
              </summary>
              <div className="px-4 pb-4 text-sm text-gray-600">
                <ul className="space-y-2">
                  <li className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="font-medium text-gray-500">Google:</span>
                    <span>
                      Settings &gt; Agenda &gt; "Secret address in iCal format"
                      <a
                        href="https://support.google.com/calendar/answer/37648"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-primary-500 hover:underline inline-flex items-center gap-0.5"
                      >
                        Meer info <ExternalLink className="w-3 h-3" />
                      </a>
                    </span>
                  </li>
                  <li className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="font-medium text-gray-500">Outlook:</span>
                    <span>Settings &gt; Shared calendars &gt; Publish</span>
                  </li>
                  <li className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="font-medium text-gray-500">Apple:</span>
                    <span>Calendar app &gt; Deel &gt; Openbare kalender</span>
                  </li>
                </ul>
              </div>
            </details>
          </div>

          {/* Sync Settings */}
          {isConnected && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="font-medium text-gray-900">
                    Toon externe afspraken
                  </p>
                  <p className="text-sm text-gray-500">
                    Toon afspraken uit je externe kalender
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={showIcalEvents}
                    onChange={(e) => handleToggleShowEvents(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Accounting Connection */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-primary-500" />
            Boekhoudkoppeling
          </h2>

          <div
            className={clsx(
              'p-4 border rounded-lg',
              eboekhoudenStatus?.connected
                ? 'border-green-200 bg-gradient-to-r from-green-50 to-transparent'
                : 'border-gray-200'
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 flex-shrink-0">
                <LinkIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900">e-Boekhouden</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Koppel je e-Boekhouden account om facturen te versturen
                </p>

                {isLoadingEboekhoudenStatus ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Status laden...
                  </div>
                ) : eboekhoudenStatus?.connected ? (
                  <div className="mt-3">
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Verbonden
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      Token bron: {eboekhoudenStatus?.debug?.tokenSource === 'settings' ? 'Instellingen' : 'Omgevingsvariabele'}
                    </p>
                  </div>
                ) : eboekhoudenStatus?.tokenConfigured ? (
                  <div className="mt-3">
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Token geconfigureerd maar verbinding mislukt
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-gray-400" />
                      <input
                        type="password"
                        value={eboekhoudenToken}
                        onChange={(e) => {
                          setEboekhoudenToken(e.target.value);
                          setTokenError('');
                        }}
                        placeholder="e-Boekhouden Access Token"
                        className={clsx(
                          'flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none',
                          tokenError ? 'border-red-300' : 'border-gray-300'
                        )}
                      />
                    </div>
                    {tokenError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {tokenError}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Vind je token in e-Boekhouden: Beheer &gt; Koppelingen &gt; API
                    </p>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                {eboekhoudenStatus?.connected || eboekhoudenStatus?.tokenConfigured ? (
                  <button
                    onClick={handleDeleteToken}
                    disabled={deleteTokenMutation.isPending}
                    className="w-full sm:w-auto px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {deleteTokenMutation.isPending ? 'Bezig...' : 'Ontkoppelen'}
                  </button>
                ) : (
                  <button
                    onClick={handleSaveToken}
                    disabled={saveTokenMutation.isPending || !eboekhoudenToken.trim()}
                    className="w-full sm:w-auto px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    {saveTokenMutation.isPending ? 'Bezig...' : 'Verbinden'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
