import { User, Bell, Lock, Palette, Zap } from 'lucide-react';
import { useRipple } from '../hooks/useRipple';
import { useTheme } from '../contexts/ThemeContext';

export default function SettingsPage() {
  const createRipple = useRipple();
  const { theme, setTheme, effectsEnabled, setEffectsEnabled } = useTheme();

  const themeOptions = [
    { value: 'light', label: 'Light', description: 'Clean and bright interface' },
    { value: 'dark', label: 'Dark', description: 'Easy on the eyes' },
    { value: 'midnight', label: 'Midnight', description: 'Deep blue darkness' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 animate-fade-in-up">
        <h1 style={{ color: 'rgb(var(--text-primary))' }} className="text-2xl font-semibold">Settings</h1>
        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-1">Manage your account and application preferences</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Profile Settings */}
        <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="rounded-lg border p-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }} className="p-2 rounded-lg">
              <User style={{ color: 'rgb(var(--brand))' }} size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold">Profile</h2>
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">Manage your personal information</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">Full Name</label>
              <input
                type="text"
                defaultValue="Pavan Kumar"
                style={{ backgroundColor: 'rgb(var(--bg-tertiary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                defaultValue="pavan@workflowpro.com"
                style={{ backgroundColor: 'rgb(var(--bg-tertiary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button className="btn-primary ripple-container" onClick={createRipple}>
              Save Changes
            </button>
          </div>
        </div>

        {/* Appearance Settings */}
        <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="rounded-lg border p-6 animate-fade-in-up" data-delay="1">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }} className="p-2 rounded-lg">
              <Palette style={{ color: 'rgb(var(--brand))' }} size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold">Appearance</h2>
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">Customize the look and feel</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-2">Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={(e) => {
                      createRipple(e);
                      setTheme(option.value as 'light' | 'dark' | 'midnight');
                    }}
                    className={`p-4 rounded-lg border text-left transition-all ripple-container ${
                      theme === option.value ? 'ring-2' : ''
                    }`}
                    style={{
                      backgroundColor: theme === option.value ? 'rgb(var(--brand) / 0.1)' : 'rgb(var(--bg-tertiary))',
                      borderColor: theme === option.value ? 'rgb(var(--brand))' : 'rgb(var(--border-color))',
                    }}
                  >
                    <div style={{ color: theme === option.value ? 'rgb(var(--brand))' : 'rgb(var(--text-primary))' }} className="font-medium text-sm mb-1">
                      {option.label}
                    </div>
                    <div style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div>
                <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium">Animations & Effects</label>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">Enable smooth transitions and animations</p>
              </div>
              <button
                onClick={(e) => {
                  createRipple(e);
                  setEffectsEnabled(!effectsEnabled);
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ripple-container`}
                style={{ backgroundColor: effectsEnabled ? 'rgb(var(--brand))' : 'rgb(var(--border-color))' }}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    effectsEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="rounded-lg border p-6 animate-fade-in-up" data-delay="2">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }} className="p-2 rounded-lg">
              <Bell style={{ color: 'rgb(var(--brand))' }} size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold">Notifications</h2>
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">Configure notification preferences</p>
            </div>
          </div>
          <div className="space-y-3">
            <NotificationToggle label="Execution completed" description="Get notified when workflows finish" />
            <NotificationToggle label="Execution failed" description="Alert when workflows fail" />
            <NotificationToggle label="Weekly summary" description="Receive weekly performance reports" />
          </div>
        </div>

        {/* Advanced Settings */}
        <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="rounded-lg border p-6 animate-fade-in-up" data-delay="3">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }} className="p-2 rounded-lg">
              <Zap style={{ color: 'rgb(var(--brand))' }} size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold">Advanced</h2>
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">Advanced configuration options</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium">Debug Mode</label>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">Show detailed execution logs</p>
              </div>
              <button
                onClick={createRipple}
                className="relative w-11 h-6 rounded-full transition-colors ripple-container"
                style={{ backgroundColor: 'rgb(var(--border-color))' }}
              >
                <span className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform" />
              </button>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div>
                <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium">Auto-retry failed executions</label>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">Automatically retry up to 3 times</p>
              </div>
              <button
                onClick={createRipple}
                className="relative w-11 h-6 rounded-full transition-colors ripple-container"
                style={{ backgroundColor: 'rgb(var(--border-color))' }}
              >
                <span className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: '#ef4444' }} className="rounded-lg border p-6 animate-fade-in-up" data-delay="4">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }} className="p-2 rounded-lg">
              <Lock style={{ color: '#ef4444' }} size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ color: '#ef4444' }} className="text-base font-semibold">Danger Zone</h2>
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs">Irreversible and destructive actions</p>
            </div>
          </div>
          <div className="space-y-3">
            <button 
              onClick={createRipple}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all ripple-container"
              style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
              Clear All Execution History
            </button>
            <button 
              onClick={createRipple}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all ripple-container ml-3"
              style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
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
}

function NotificationToggle({ label, description }: NotificationToggleProps) {
  const createRipple = useRipple();
  
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium">{label}</label>
        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">{description}</p>
      </div>
      <button
        onClick={createRipple}
        className="relative w-11 h-6 rounded-full transition-colors ripple-container"
        style={{ backgroundColor: 'rgb(var(--brand))' }}
      >
        <span className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform translate-x-5" />
      </button>
    </div>
  );
}
