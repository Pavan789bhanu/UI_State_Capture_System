import { Bell, Search, Sun, Moon, Monitor, Settings } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useRipple } from '../../hooks/useRipple';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationPanel from '../NotificationPanel';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, effectsEnabled, setEffectsEnabled } = useTheme();
  const { unreadCount } = useNotifications();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const createRipple = useRipple();
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    }

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings]);

  const themeIcons = {
    light: Sun,
    dark: Moon,
    midnight: Monitor,
  };

  return (
    <header 
      style={{ 
        backgroundColor: 'rgb(var(--bg-secondary))', 
        borderColor: 'rgb(var(--border-color))',
        backdropFilter: 'blur(20px)'
      }} 
      className="h-16 border-b flex items-center justify-between px-6 sticky top-0 z-50 animate-slide-in-right"
      role="banner"
    >
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
          style={{ 
            background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(139 92 246) 100%)',
            transform: 'rotate(-5deg)'
          }}
        >
          <span className="text-white font-bold text-lg" style={{ transform: 'rotate(5deg)' }}>W</span>
        </div>
        <div>
          <h1 className="text-lg font-bold gradient-text">WorkflowPro</h1>
          <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>Automation Platform</p>
        </div>
      </div>

      {/* Enhanced Search */}
      <div className="flex items-center flex-1 max-w-xl mx-8">
        <div className="relative w-full group">
          <Search 
            style={{ color: 'rgb(var(--text-secondary))' }} 
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-brand" 
            strokeWidth={2.5} 
            aria-hidden="true" 
          />
          <input
            type="search"
            placeholder="Search workflows, executions..."
            aria-label="Search workflows and executions"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                const params = new URLSearchParams({ q: searchQuery });
                if (location.pathname.includes('workflows')) {
                  navigate(`/workflows?${params}`);
                } else if (location.pathname.includes('executions')) {
                  navigate(`/executions?${params}`);
                } else {
                  navigate(`/workflows?${params}`);
                }
              }
            }}
            style={{ 
              backgroundColor: 'rgb(var(--bg-tertiary))', 
              borderColor: 'rgb(var(--border-color))', 
              color: 'rgb(var(--text-primary))'
            }}
            className="w-full pl-12 pr-4 py-3 text-sm border-2 rounded-xl focus:outline-none transition-all placeholder:text-gray-400 hover:border-brand/30"
            onFocus={(e) => {
              e.target.style.borderColor = 'rgb(var(--brand))';
              e.target.style.boxShadow = '0 0 0 4px rgba(var(--brand), 0.1), 0 8px 16px rgba(var(--brand), 0.1)';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgb(var(--border-color))';
              e.target.style.boxShadow = 'none';
              e.target.style.transform = 'translateY(0)';
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={settingsRef}>
          <button 
            className="p-2 rounded-lg transition-all ripple-container hover-glow"
            style={{ color: 'rgb(var(--text-secondary))' }}
            onClick={(e) => {
              createRipple(e);
              setShowSettings(!showSettings);
            }}
            aria-label="Open settings menu"
            aria-expanded={showSettings}
            aria-haspopup="true"
          >
            <Settings size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          
          {showSettings && (
            <div 
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }}
              className="absolute right-0 mt-2 w-64 rounded-lg border shadow-lg p-4 animate-scale-in"
            >
              <div className="mb-4">
                <label style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium block mb-2">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['light', 'dark', 'midnight'] as const).map((t) => {
                    const Icon = themeIcons[t];
                    return (
                      <button
                        key={t}
                        onClick={(e) => {
                          createRipple(e);
                          setTheme(t);
                        }}
                        className={`p-2 rounded-lg border transition-all ripple-container ${
                          theme === t ? 'ring-2' : ''
                        }`}
                        style={{
                          backgroundColor: theme === t ? 'rgb(var(--brand) / 0.1)' : 'rgb(var(--bg-tertiary))',
                          borderColor: theme === t ? 'rgb(var(--brand))' : 'rgb(var(--border-color))',
                          color: theme === t ? 'rgb(var(--brand))' : 'rgb(var(--text-secondary))',
                        }}
                      >
                        <Icon size={16} className="mx-auto" strokeWidth={2} />
                        <span className="text-xs mt-1 block capitalize">{t}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="pt-4 border-t" style={{ borderColor: 'rgb(var(--border-color))' }}>
                <label className="flex items-center justify-between cursor-pointer">
                  <span style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">Animations</span>
                  <button
                    onClick={(e) => {
                      createRipple(e);
                      setEffectsEnabled(!effectsEnabled);
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors ripple-container ${
                      effectsEnabled ? 'bg-brand-600' : ''
                    }`}
                    style={{ backgroundColor: effectsEnabled ? 'rgb(var(--brand))' : 'rgb(var(--border-color))' }}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        effectsEnabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </label>
              </div>

              <div className="pt-4 border-t mt-4" style={{ borderColor: 'rgb(var(--border-color))' }}>
                <button
                  onClick={(e) => {
                    createRipple(e);
                    navigate('/settings');
                    setShowSettings(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ripple-container text-sm font-medium hover:bg-opacity-80"
                  style={{
                    color: 'rgb(var(--text-primary))',
                    backgroundColor: 'rgb(var(--bg-tertiary))',
                  }}
                >
                  <Settings size={16} strokeWidth={2} />
                  <span>All Settings</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <button 
          className="relative p-2 rounded-lg transition-all ripple-container hover-glow"
          style={{ color: 'rgb(var(--text-secondary))' }}
          onClick={(e) => {
            createRipple(e);
            setShowNotifications(!showNotifications);
          }}
          aria-label="View notifications"
        >
          <Bell size={18} strokeWidth={2} aria-hidden="true" />
          {unreadCount > 0 && (
            <>
              <span 
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" 
                style={{ 
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 0 2px rgb(var(--bg-secondary))'
                }}
              />
              <span 
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-semibold text-white rounded-full px-1" 
                style={{ backgroundColor: '#ef4444' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          )}
        </button>
      </div>

      {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
    </header>
  );
}
