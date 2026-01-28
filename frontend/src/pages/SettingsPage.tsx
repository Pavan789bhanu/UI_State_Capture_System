import { useState } from 'react';
import { User, Bell, Lock, Palette, Zap, Sun, Moon, Sparkles, Check } from 'lucide-react';
import { useRipple } from '../hooks/useRipple';
import { useTheme } from '../contexts/ThemeContext';

export default function SettingsPage() {
  const createRipple = useRipple();
  const { 
    theme, setTheme, 
    effectsEnabled, setEffectsEnabled,
    accentColor, setAccentColor,
    fontSize, setFontSize,
    reducedMotion, setReducedMotion,
    compactMode, setCompactMode
  } = useTheme();

  const themeOptions = [
    { 
      value: 'light', 
      label: 'Light', 
      description: 'Clean and bright interface',
      icon: Sun,
      preview: 'bg-white border-gray-200'
    },
    { 
      value: 'dark', 
      label: 'Dark', 
      description: 'Easy on the eyes',
      icon: Moon,
      preview: 'bg-gray-900 border-gray-700'
    },
    { 
      value: 'midnight', 
      label: 'Midnight', 
      description: 'Deep blue darkness',
      icon: Sparkles,
      preview: 'bg-[#0a0a0f] border-indigo-900'
    },
  ];

  const accentColors = [
    { value: 'indigo', label: 'Indigo', color: 'bg-indigo-500', ring: 'ring-indigo-500' },
    { value: 'purple', label: 'Purple', color: 'bg-purple-500', ring: 'ring-purple-500' },
    { value: 'blue', label: 'Blue', color: 'bg-blue-500', ring: 'ring-blue-500' },
    { value: 'emerald', label: 'Emerald', color: 'bg-emerald-500', ring: 'ring-emerald-500' },
    { value: 'rose', label: 'Rose', color: 'bg-rose-500', ring: 'ring-rose-500' },
    { value: 'amber', label: 'Amber', color: 'bg-amber-500', ring: 'ring-amber-500' },
  ];

  const fontSizes = [
    { value: 'small', label: 'Small', size: 'text-sm' },
    { value: 'medium', label: 'Medium', size: 'text-base' },
    { value: 'large', label: 'Large', size: 'text-lg' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/30" 
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
            <Palette className="text-white" size={22} />
          </div>
          <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Settings
          </span>
        </h1>
        <p className="text-gray-400 text-base mt-2 ml-16">Manage your account and application preferences</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Theme Settings - Enhanced */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
              <Palette className="text-white" size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Appearance</h2>
              <p className="text-sm text-gray-400">Customize the look and feel of your workspace</p>
            </div>
          </div>
          
          {/* Theme Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium mb-3 text-white">Theme</label>
            <div className="grid grid-cols-3 gap-4">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = theme === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={(e) => {
                      createRipple(e);
                      setTheme(option.value as 'light' | 'dark' | 'midnight');
                    }}
                    className={`relative p-5 rounded-xl border-2 text-left transition-all duration-300 ripple-container group hover:scale-[1.02] ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20' 
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                    
                    {/* Theme preview */}
                    <div className={`w-full h-16 rounded-lg mb-4 border ${option.preview} flex items-center justify-center`}>
                      <Icon size={24} className={isSelected ? 'text-indigo-400' : 'text-gray-400'} />
                    </div>
                    
                    <div className={`font-semibold text-base mb-1 ${isSelected ? 'text-indigo-400' : 'text-white'}`}>
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color */}
          <div className="mb-8">
            <label className="block text-sm font-medium mb-3 text-white">Accent Color</label>
            <div className="flex gap-3">
              {accentColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setAccentColor(color.value as 'indigo' | 'purple' | 'blue' | 'emerald' | 'rose' | 'amber')}
                  className={`w-10 h-10 rounded-xl ${color.color} transition-all duration-200 hover:scale-110 ${
                    accentColor === color.value ? `ring-2 ring-offset-2 ring-offset-[#0a0a0f] ${color.ring}` : ''
                  }`}
                  title={color.label}
                >
                  {accentColor === color.value && (
                    <Check size={16} className="text-white mx-auto" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="mb-8">
            <label className="block text-sm font-medium mb-3 text-white">Font Size</label>
            <div className="flex gap-3">
              {fontSizes.map((size) => (
                <button
                  key={size.value}
                  onClick={() => setFontSize(size.value as 'small' | 'medium' | 'large')}
                  className={`px-4 py-2 rounded-xl border transition-all duration-200 ${
                    fontSize === size.value 
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' 
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                  } ${size.size}`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div>
                <label className="block text-sm font-medium text-white">Animations & Effects</label>
                <p className="text-xs text-gray-500 mt-0.5">Enable smooth transitions and hover effects</p>
              </div>
              <button
                onClick={(e) => {
                  createRipple(e);
                  setEffectsEnabled(!effectsEnabled);
                }}
                className={`relative w-12 h-7 rounded-full transition-all duration-300 ripple-container ${
                  effectsEnabled ? 'bg-indigo-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                    effectsEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div>
                <label className="block text-sm font-medium text-white">Reduced Motion</label>
                <p className="text-xs text-gray-500 mt-0.5">Minimize animations for accessibility</p>
              </div>
              <button
                onClick={() => setReducedMotion(!reducedMotion)}
                className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
                  reducedMotion ? 'bg-indigo-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                    reducedMotion ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div>
                <label className="block text-sm font-medium text-white">Compact Mode</label>
                <p className="text-xs text-gray-500 mt-0.5">Reduce spacing for more content on screen</p>
              </div>
              <button
                onClick={() => setCompactMode(!compactMode)}
                className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
                  compactMode ? 'bg-indigo-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                    compactMode ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/25">
              <User className="text-white" size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Profile</h2>
              <p className="text-sm text-gray-400">Manage your personal information</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white">Full Name</label>
              <input
                type="text"
                defaultValue="Pavan Kumar"
                className="w-full px-4 py-3 text-sm border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-white">Email</label>
              <input
                type="email"
                defaultValue="pavan@workflowpro.com"
                className="w-full px-4 py-3 text-sm border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <button className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25 hover:scale-105 active:scale-95">
              Save Changes
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
              <Bell className="text-white" size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Notifications</h2>
              <p className="text-sm text-gray-400">Configure notification preferences</p>
            </div>
          </div>
          <div className="space-y-3">
            <NotificationToggle label="Execution completed" description="Get notified when workflows finish" defaultOn />
            <NotificationToggle label="Execution failed" description="Alert when workflows fail" defaultOn />
            <NotificationToggle label="Weekly summary" description="Receive weekly performance reports" defaultOn={false} />
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
              <Zap className="text-white" size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Advanced</h2>
              <p className="text-sm text-gray-400">Advanced configuration options</p>
            </div>
          </div>
          <div className="space-y-3">
            <ToggleSetting label="Debug Mode" description="Show detailed execution logs" />
            <ToggleSetting label="Auto-retry failed executions" description="Automatically retry up to 3 times" />
            <ToggleSetting label="Browser headless mode" description="Run browser in background (faster)" defaultOn />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 backdrop-blur-sm p-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/25">
              <Lock className="text-white" size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
              <p className="text-sm text-gray-400">Irreversible and destructive actions</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:scale-105 active:scale-95">
              Clear All Execution History
            </button>
            <button className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:scale-105 active:scale-95">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface NotificationToggleProps {
  label: string;
  description: string;
  defaultOn?: boolean;
}

function NotificationToggle({ label, description, defaultOn = true }: NotificationToggleProps) {
  const [enabled, setEnabled] = useState(defaultOn);
  
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
      <div>
        <label className="block text-sm font-medium text-white">{label}</label>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
          enabled ? 'bg-indigo-500' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
            enabled ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  defaultOn?: boolean;
}

function ToggleSetting({ label, description, defaultOn = false }: ToggleSettingProps) {
  const [enabled, setEnabled] = useState(defaultOn);
  
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
      <div>
        <label className="block text-sm font-medium text-white">{label}</label>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
          enabled ? 'bg-indigo-500' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
            enabled ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
