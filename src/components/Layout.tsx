import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  Calendar,
  Users,
  UserCog,
  List,
  BarChart3,
  Settings,
  LogOut,
  Dumbbell,
  Menu,
  X,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/calendar', label: 'Agenda', icon: Calendar },
  { to: '/trainers', label: 'Trainers', icon: UserCog },
  { to: '/participants', label: 'Deelnemers', icon: Users },
  { to: '/training-types', label: 'Types', icon: List },
  { to: '/overzicht', label: 'Overzicht', icon: BarChart3 },
  { to: '/settings', label: 'Instellingen', icon: Settings },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Get current page title for mobile header
  const currentPage = navItems.find((item) => item.to === location.pathname);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col fixed h-full z-40">
        {/* Logo */}
        <div className="p-5 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary-500 flex items-center gap-2">
            <Dumbbell className="w-6 h-6" />
            PT Planner
          </h1>
        </div>

        {/* Navigation */}
        <ul className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* User info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: user?.color || '#4F46E5' }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Uitloggen
          </button>
        </div>
      </nav>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="font-semibold text-gray-900">
          {currentPage?.label || 'PT Planner'}
        </h1>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
          style={{ backgroundColor: user?.color || '#4F46E5' }}
        >
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Slide-out Menu */}
      <nav
        className={clsx(
          'lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary-500 flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            PT Planner
          </h1>
          <button
            onClick={closeMobileMenu}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info at top on mobile */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-medium"
              style={{ backgroundColor: user?.color || '#4F46E5' }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-sm text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ul className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-3.5 rounded-lg font-medium transition-colors',
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600 active:bg-primary-100'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => {
              closeMobileMenu();
              handleLogout();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Uitloggen
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Navigation (Quick Access) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-center justify-around z-40 safe-area-bottom">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center w-16 h-full text-xs transition-colors',
                isActive ? 'text-primary-500' : 'text-gray-400'
              )
            }
          >
            <item.icon className="w-5 h-5 mb-1" />
            <span className="truncate">{item.label.slice(0, 7)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-h-screen pt-14 pb-16 lg:pt-0 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
