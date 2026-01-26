import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Workflow, Zap, Shield, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
      {/* Left Side - Branding */}
      <div 
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden"
        style={{ 
          background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--accent)) 100%)'
        }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute w-[600px] h-[600px] rounded-full opacity-20 animate-pulse-slow"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
              top: '-10%',
              right: '-5%',
            }}
          />
          <div 
            className="absolute w-[400px] h-[400px] rounded-full opacity-20 animate-pulse-slow"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
              bottom: '10%',
              left: '-5%',
              animationDelay: '2s'
            }}
          />
          {/* Noise texture overlay for depth */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{ 
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")'
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-elevated">
              <Workflow className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">WorkflowPro</h1>
              <p className="text-white/70 text-sm">Automation Platform</p>
            </div>
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
            Automate Your<br />
            <span className="text-white/80">Browser Workflows</span><br />
            with AI
          </h2>

          <p className="text-lg text-white/70 mb-12 max-w-md leading-relaxed">
            Build, test, and deploy browser automations using natural language. 
            See workflows execute in real-time with visual debugging.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <span className="text-white/90">AI-powered workflow generation</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-white/90">Secure credential management</span>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-32"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 100%)'
          }}
        />
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--accent)) 100%)'
              }}
            >
              <Workflow className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 
                className="text-xl font-bold"
                style={{ color: 'rgb(var(--text-primary))' }}
              >
                WorkflowPro
              </h1>
              <p 
                className="text-xs"
                style={{ color: 'rgb(var(--text-secondary))' }}
              >
                Automation Platform
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h2 
              className="text-2xl font-bold mb-2"
              style={{ color: 'rgb(var(--text-primary))' }}
            >
              Welcome back
            </h2>
            <p 
              className="text-sm"
              style={{ color: 'rgb(var(--text-secondary))' }}
            >
              Sign in to continue to your workspace
            </p>
          </div>
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div 
                className="rounded-xl p-4 border-2 animate-shake"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.3)'
                }}
              >
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label 
                htmlFor="username" 
                className="block text-sm font-semibold mb-2"
                style={{ color: 'rgb(var(--text-primary))' }}
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-0"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgb(var(--brand))';
                  e.target.style.boxShadow = '0 0 0 4px rgba(var(--brand), 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgb(var(--border-color))';
                  e.target.style.boxShadow = 'none';
                }}
                placeholder="Enter your username"
              />
            </div>
            
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-semibold mb-2"
                style={{ color: 'rgb(var(--text-primary))' }}
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-0"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgb(var(--brand))';
                  e.target.style.boxShadow = '0 0 0 4px rgba(var(--brand), 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgb(var(--border-color))';
                  e.target.style.boxShadow = 'none';
                }}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--accent)) 100%)',
                boxShadow: '0 4px 14px 0 rgba(var(--brand), 0.35)'
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>

            <div 
              className="text-center pt-4 border-t"
              style={{ borderColor: 'rgb(var(--border-color))' }}
            >
              <p 
                className="text-sm"
                style={{ color: 'rgb(var(--text-secondary))' }}
              >
                Demo credentials: <span className="font-mono font-semibold" style={{ color: 'rgb(var(--brand))' }}>admin / admin123</span>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
