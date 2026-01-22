import { User, Mail, Calendar, Shield } from 'lucide-react';
import { useRipple } from '../hooks/useRipple';

export default function ProfilePage() {
  const createRipple = useRipple();

  return (
    <div className="p-6">
      <div className="mb-6 animate-fade-in-up">
        <h1 style={{ color: 'rgb(var(--text-primary))' }} className="text-2xl font-semibold">Profile</h1>
        <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-1">Manage your profile information and preferences</p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Profile Header */}
        <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="rounded-lg border p-6 animate-fade-in-up">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center animate-gradient" style={{ background: 'linear-gradient(135deg, rgb(var(--brand)), rgb(var(--brand-hover)))' }}>
              <span className="text-white font-bold text-3xl">P</span>
            </div>
            <div className="flex-1">
              <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-xl font-semibold">Pavan Kumar</h2>
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-1">pavan@workflowpro.com</p>
              <div className="flex gap-2 mt-3">
                <button className="btn-primary ripple-container text-sm" onClick={createRipple}>
                  Change Photo
                </button>
                <button 
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all ripple-container"
                  style={{ 
                    backgroundColor: 'rgb(var(--bg-tertiary))', 
                    borderColor: 'rgb(var(--border-color))',
                    color: 'rgb(var(--text-primary))',
                    border: '1px solid'
                  }}
                  onClick={createRipple}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="rounded-lg border p-6 animate-fade-in-up" data-delay="1">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }} className="p-2 rounded-lg">
              <User style={{ color: 'rgb(var(--brand))' }} size={20} strokeWidth={2} />
            </div>
            <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold">Personal Information</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">First Name</label>
                <input
                  type="text"
                  defaultValue="Pavan"
                  style={{ backgroundColor: 'rgb(var(--bg-tertiary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">Last Name</label>
                <input
                  type="text"
                  defaultValue="Kumar"
                  style={{ backgroundColor: 'rgb(var(--bg-tertiary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div>
              <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">
                <Mail size={14} className="inline mr-1" />
                Email Address
              </label>
              <input
                type="email"
                defaultValue="pavan@workflowpro.com"
                style={{ backgroundColor: 'rgb(var(--bg-tertiary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">Job Title</label>
              <input
                type="text"
                defaultValue="Workflow Automation Engineer"
                style={{ backgroundColor: 'rgb(var(--bg-tertiary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label style={{ color: 'rgb(var(--text-primary))' }} className="block text-sm font-medium mb-1">Bio</label>
              <textarea
                rows={3}
                defaultValue="Passionate about automation and workflow optimization. Building efficient systems for modern teams."
                style={{ backgroundColor: 'rgb(var(--bg-tertiary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="rounded-lg border p-6 animate-fade-in-up" data-delay="2">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }} className="p-2 rounded-lg">
              <Calendar style={{ color: 'rgb(var(--brand))' }} size={20} strokeWidth={2} />
            </div>
            <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold">Account Details</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <div>
                <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">Member Since</p>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">December 1, 2025</p>
              </div>
            </div>
            <div className="flex justify-between items-center py-2 border-t" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">Account Type</p>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">Premium Account</p>
              </div>
              <span 
                className="px-2 py-1 text-xs font-medium rounded"
                style={{ backgroundColor: 'rgb(var(--brand) / 0.1)', color: 'rgb(var(--brand))' }}
              >
                Pro
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-t" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">Last Login</p>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">December 23, 2025 at 11:45 AM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} className="rounded-lg border p-6 animate-fade-in-up" data-delay="3">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }} className="p-2 rounded-lg">
              <Shield style={{ color: 'rgb(var(--brand))' }} size={20} strokeWidth={2} />
            </div>
            <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-base font-semibold">Security</h2>
          </div>
          <div className="space-y-3">
            <button 
              className="w-full flex justify-between items-center py-3 text-left"
              onClick={createRipple}
            >
              <div>
                <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">Change Password</p>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">Update your password regularly</p>
              </div>
              <span style={{ color: 'rgb(var(--brand))' }} className="text-sm font-medium">Update</span>
            </button>
            <div className="border-t" style={{ borderColor: 'rgb(var(--border-color))' }} />
            <button 
              className="w-full flex justify-between items-center py-3 text-left"
              onClick={createRipple}
            >
              <div>
                <p style={{ color: 'rgb(var(--text-primary))' }} className="text-sm font-medium">Two-Factor Authentication</p>
                <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">Add an extra layer of security</p>
              </div>
              <span style={{ color: 'rgb(var(--brand))' }} className="text-sm font-medium">Enable</span>
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 animate-fade-in-up" data-delay="4">
          <button className="btn-primary ripple-container" onClick={createRipple}>
            Save Changes
          </button>
          <button 
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all ripple-container"
            style={{ 
              backgroundColor: 'rgb(var(--bg-tertiary))', 
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))',
              border: '1px solid'
            }}
            onClick={createRipple}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
