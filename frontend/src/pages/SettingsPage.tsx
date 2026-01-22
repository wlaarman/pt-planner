import { useState } from 'react';
import {
  Calendar,
  FileText,
  Palette,
  CheckCircle,
  Clock,
  Link as LinkIcon,
} from 'lucide-react';
import clsx from 'clsx';

export default function SettingsPage() {
  const [googleConnected, setGoogleConnected] = useState(true);
  const [showExternal, setShowExternal] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [defaultView, setDefaultView] = useState('week');
  const [firstDay, setFirstDay] = useState('monday');
  const [workStart, setWorkStart] = useState('06:00');
  const [workEnd, setWorkEnd] = useState('21:00');

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
            Agenda Koppelingen
          </h2>

          <div className="space-y-4">
            {/* Google Calendar */}
            <div
              className={clsx(
                'flex items-center gap-4 p-4 border rounded-lg',
                googleConnected
                  ? 'border-green-200 bg-gradient-to-r from-green-50 to-transparent'
                  : 'border-gray-200'
              )}
            >
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Google Calendar</h3>
                <p className="text-sm text-gray-500">
                  {googleConnected
                    ? 'jan.trainer@gmail.com'
                    : 'Niet verbonden'}
                </p>
                {googleConnected && (
                  <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                    <CheckCircle className="w-3 h-3" />
                    Verbonden
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {googleConnected && (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                )}
                <button
                  onClick={() => setGoogleConnected(!googleConnected)}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-lg transition-colors',
                    googleConnected
                      ? 'border border-gray-300 hover:bg-gray-50'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  )}
                >
                  {googleConnected ? 'Ontkoppelen' : 'Verbinden'}
                </button>
              </div>
            </div>

            {/* Outlook (coming soon) */}
            <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg opacity-60">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#0078D4"
                    d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.152-.353.228-.584.228h-8.234v-6.182l1.602 1.18c.086.063.18.095.283.095.104 0 .198-.032.283-.095L24 7.387zm-9.056 4.793V5.33h8.234c.231 0 .426.076.584.228.159.152.238.346.238.576v.654l-7.454 5.392h-1.602zM13.944 5.33v15.008H2.665c-.345 0-.64-.12-.884-.358-.245-.238-.367-.527-.367-.866V6.554c0-.34.122-.628.367-.866.244-.238.539-.358.884-.358h11.279z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Outlook Calendar</h3>
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
          </div>

          {/* Sync Settings */}
          {googleConnected && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4">
                Synchronisatie Instellingen
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      Automatisch synchroniseren
                    </p>
                    <p className="text-sm text-gray-500">
                      Afspraken worden automatisch gesynchroniseerd met Google
                      Calendar
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      Toon externe afspraken
                    </p>
                    <p className="text-sm text-gray-500">
                      Toon afspraken uit Google Calendar die niet in PT Planner
                      zijn gemaakt
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showExternal}
                      onChange={(e) => setShowExternal(e.target.checked)}
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

          <div className="flex items-center gap-4 p-4 border border-green-200 rounded-lg bg-gradient-to-r from-green-50 to-transparent">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
              <LinkIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Moneybird</h3>
              <p className="text-sm text-gray-500">PT Planner Administratie</p>
              <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <CheckCircle className="w-3 h-3" />
                Verbonden
              </span>
            </div>
            <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Ontkoppelen
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
