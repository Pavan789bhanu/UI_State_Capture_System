import { Home, Workflow, Activity, TrendingUp, Settings, ChevronRight, LogOut, User, FlaskConical } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRipple } from '../../hooks/useRipple';
import { useState, useEffect, useRef } from 'react';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const createRipple = useRipple();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfileMenu]);

  const navItems = [
    { icon: Home, label: 'Overview', path: '/' },
    { icon: Workflow, label: 'Workflows', path: '/workflows' },
    { icon: Activity, label: 'Executions', path: '/executions' },
    { icon: FlaskConical, label: 'Playground', path: '/playground' },
    { icon: TrendingUp, label: 'Analytics', path: '/analytics' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div 
      style={{ 
        backgroundColor: 'rgb(var(--bg-secondary))', 
        borderColor: 'rgb(var(--border-color))',
        backdropFilter: 'blur(20px)'
      }} 
      className="w-72 border-r flex flex-col h-screen animate-slide-in-left shadow-xl" 
      role="navigation" 
      aria-label="Main navigation"
    >
      {/* Enhanced Logo */}
      <div style={{ borderColor: 'rgb(var(--border-color))' }} className="h-20 flex items-center px-6 border-b relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(139 92 246) 100%)' }} />
        <div 
          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg relative z-10 animate-float" 
          style={{ background: 'linear-gradient(135deg, rgb(var(--brand)), rgb(139 92 246))' }} 
          role="img" 
          aria-label="WorkflowPro logo"
        >
          <Workflow className="text-white" size={24} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div className="ml-3 relative z-10">
          <span className="gradient-text text-xl block leading-none mb-1">WorkflowPro</span>
          <span style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs block font-medium">Automation Platform</span>
        </div>
      </div>

      {/* Enhanced Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2" aria-label="Main menu">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={createRipple}
              className="group flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 ripple-container animate-fade-in-up relative overflow-hidden"
              style={{
                backgroundColor: isActive ? 'rgba(var(--brand), 0.1)' : 'transparent',
                color: isActive ? 'rgb(var(--brand))' : 'rgb(var(--text-secondary))',
                animationDelay: `${index * 0.1}s`,
                border: isActive ? '2px solid rgba(var(--brand), 0.3)' : '2px solid transparent',
                boxShadow: isActive ? '0 4px 12px rgba(var(--brand), 0.15)' : 'none'
              }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              {isActive && (
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(139 92 246) 100%)' }}
                />
              )}
              <div className="flex items-center gap-3.5">
                <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-white/10' : ''}`}>
                  <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold">{item.label}</span>
              </div>
              {isActive && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'rgb(var(--brand))' }} />
                  <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Enhanced User Profile */}
      <div style={{ borderColor: 'rgb(var(--border-color))' }} className="p-4 border-t backdrop-blur-sm" ref={profileRef}>
        <div className="relative">
          <div 
            onClick={(e) => {
              createRipple(e);
              setShowProfileMenu(!showProfileMenu);
            }}
            className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-300 ripple-container hover-glow group"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--brand), 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
              border: '2px solid rgba(var(--border-color), 0.5)'
            }}
          >
            <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgb(var(--brand)), rgb(139 92 246))' }}>
              <span className="text-white font-bold text-base">P</span>
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-bold truncate">Pavan Kumar</p>
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs truncate">pavan@workflowpro.com</p>
            </div>
            <ChevronRight 
              size={16} 
              strokeWidth={2.5}
              className="transition-transform group-hover:translate-x-1"
              style={{ color: 'rgb(var(--text-secondary))' }}
            />
          </div>

          {showProfileMenu && (
            <div 
              style={{ backgroundColor: 'rgb(var(--bg-tertiary))', borderColor: 'rgb(var(--border-color))' }}
              className="absolute bottom-full left-2 right-2 mb-2 rounded-lg border shadow-lg py-1 animate-scale-in"
            >
              <button
                onClick={(e) => {
                  createRipple(e);
                  navigate('/profile');
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ripple-container"
                style={{ color: 'rgb(var(--text-secondary))' }}
              >
                <User size={16} strokeWidth={2} />
                <span>Profile</span>
              </button>
              <button
                onClick={(e) => {
                  createRipple(e);
                  navigate('/settings');
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ripple-container"
                style={{ color: 'rgb(var(--text-secondary))' }}
              >
                <Settings size={16} strokeWidth={2} />
                <span>Settings</span>
              </button>
              <div style={{ borderColor: 'rgb(var(--border-color))' }} className="border-t my-1" />
              <button
                onClick={(e) => {
                  createRipple(e);
                  // Add logout logic here
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ripple-container text-red-500"
              >
                <LogOut size={16} strokeWidth={2} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
