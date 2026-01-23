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

  // Display settings (local state for now)
  const [defaultView, setDefaultView] = useState('week');
  const [firstDay, setFirstDay] = useState('monday');
  const [workStart, setWorkStart] = useState('06:00');
  const [workEnd, setWorkEnd] = useState('21:00');

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

  return (
    <div className="p-6 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Instellingen</h1>
      </header>

      <div className="space-y-6">
        {/* Calendar Connections */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900">iCal Kalender Feed</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Koppel een externe kalender via iCal URL (Google Calendar, Outlook, Apple Calendar, etc.)
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
                        placeholder="https://calendar.google.com/calendar/ical/..."
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
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {disconnectMutation.isPending ? 'Bezig...' : 'Ontkoppelen'}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnect}
                      disabled={saveSettingsMutation.isPending || !icalUrl.trim()}
                      className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                    >
                      {saveSettingsMutation.isPending ? 'Bezig...' : 'Verbinden'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Help text */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-700 mb-2">Hoe vind ik mijn iCal URL?</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-gray-500">Google:</span>
                  <span>
                    Calendar Settings &gt; Agenda &gt; "Secret address in iCal format"
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
                <li className="flex items-start gap-2">
                  <span className="font-medium text-gray-500">Outlook:</span>
                  <span>Calendar Settings &gt; Shared calendars &gt; Publish a calendar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-gray-500">Apple:</span>
                  <span>Calendar app &gt; Deel kalender &gt; Openbare kalender</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Sync Settings */}
          {isConnected && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4">
                Weergave Instellingen
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      Toon externe afspraken
                    </p>
                    <p className="text-sm text-gray-500">
                      Toon afspraken uit je externe kalender in de PT Planner agenda
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
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
            </div>
          )}
        </section>

        {/* Accounting Connection */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-primary-500" />
            Boekhoudkoppeling
          </h2>

          <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg opacity-60">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
              <LinkIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Moneybird</h3>
              <p className="text-sm text-gray-500">Niet verbonden</p>
              <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                Binnenkort beschikbaar
              </span>
            </div>
            <button
              disabled
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
            >
              Verbinden
            </button>
          </div>
        </section>

        {/* Display Settings */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary-500" />
            Weergave
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">
                Standaard kalenderweergave
              </p>
              <select
                value={defaultView}
                onChange={(e) => setDefaultView(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                <option value="day">Dag</option>
                <option value="week">Week</option>
                <option value="month">Maand</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">
                Eerste dag van de week
              </p>
              <select
                value={firstDay}
                onChange={(e) => setFirstDay(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                <option value="monday">Maandag</option>
                <option value="sunday">Zondag</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">Werkuren tonen</p>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
                <span className="text-gray-500">tot</span>
                <input
                  type="time"
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
