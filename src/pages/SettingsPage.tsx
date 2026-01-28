import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  FileText,
  Palette,
  CheckCircle,
  Clock,
  Link as LinkIcon,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import { calendarApi } from '../lib/api';

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
    <div className="p-4 lg:p-6 max-w-4xl">
      <header className="mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">Instellingen</h1>
      </header>

      <div className="space-y-4 lg:space-y-6">
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
                    <div className="mt-3">
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Verbonden
                      </span>
                      <p className="text-xs text-gray-400 mt-1 truncate" title={icalSettings?.icalUrl}>
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

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-gray-200 rounded-lg opacity-60">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 flex-shrink-0">
              <LinkIcon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900">e-Boekhouden</h3>
              <p className="text-sm text-gray-500">Geconfigureerd via omgevingsvariabelen</p>
              <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                Zie Overzicht pagina voor status
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
