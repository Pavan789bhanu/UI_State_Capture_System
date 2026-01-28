import { 
  Home, Workflow, Activity, FlaskConical, TrendingUp, 
  Settings, User, LogOut, Menu, X, Bell, Sparkles
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationPanel from '../NotificationPanel';

// Navigation item component with hover effect
function NavItem({ 
  to, 
  icon: Icon, 
  label, 
  isActive 
}: { 
  to: string; 
  icon: React.ElementType; 
  label: string; 
  isActive: boolean;
}) {
  return (
    <Link
      to={to}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 group
        ${isActive 
          ? 'text-white bg-white/10' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
    >
      <Icon size={18} className={`transition-transform duration-300 group-hover:scale-110 
        ${isActive ? 'text-indigo-400' : ''}`} />
      <span>{label}</span>
      {/* Animated underline */}
      <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 
        transition-all duration-300 ${isActive ? 'w-8' : 'w-0 group-hover:w-8'}`} />
    </Link>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/workflows', icon: Workflow, label: 'Workflows' },
    { to: '/executions', icon: Activity, label: 'Executions' },
    { to: '/playground', icon: FlaskConical, label: 'Playground' },
    { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
  ];

  const isActiveRoute = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <nav className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
              flex items-center justify-center shadow-lg shadow-indigo-500/25
              group-hover:shadow-indigo-500/40 group-hover:scale-105 transition-all duration-300">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent hidden sm:block">
              UI Capture
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map(item => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                isActive={isActiveRoute(item.to)}
              />
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Settings */}
            <Link
              to="/settings"
              className={`p-2 rounded-lg transition-all duration-300 
                ${isActiveRoute('/settings') 
                  ? 'text-white bg-white/10' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Settings size={20} />
            </Link>

            {/* Notifications */}
            <button 
              className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-300"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center 
                  text-[10px] font-bold text-white rounded-full px-1 bg-gradient-to-r from-red-500 to-pink-500">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-all duration-300"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 
                  flex items-center justify-center text-white font-semibold text-sm">
                  P
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-white/10 
                  bg-[#12121a]/95 backdrop-blur-xl shadow-2xl p-2 animate-scale-in">
                  <div className="px-3 py-2 mb-2">
                    <p className="text-sm font-medium text-white">Pavan Kumar</p>
                    <p className="text-xs text-gray-400">pavan@uicapture.ai</p>
                  </div>
                  <div className="border-t border-white/10 pt-2">
                    <Link
                      to="/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 
                        hover:text-white hover:bg-white/5 transition-all"
                    >
                      <User size={16} />
                      Profile
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 
                        hover:text-white hover:bg-white/5 transition-all"
                    >
                      <Settings size={16} />
                      Settings
                    </Link>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <button
                      onClick={() => {
                        logout();
                        navigate('/');
                        setShowProfileMenu(false);
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-red-400 
                        hover:text-red-300 hover:bg-red-500/10 transition-all"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-white/10 animate-fade-in">
            <div className="flex flex-col gap-1">
              {navItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                    ${isActiveRoute(item.to)
                      ? 'text-white bg-white/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  <item.icon size={18} className={isActiveRoute(item.to) ? 'text-indigo-400' : ''} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notification Panel */}
      {showNotifications && (
        <NotificationPanel onClose={() => setShowNotifications(false)} />
      )}
    </header>
  );
}
