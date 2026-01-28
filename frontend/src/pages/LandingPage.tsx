import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Sparkles, Zap, Shield, ArrowRight, Play, Check, 
  Code2, Workflow, Eye, Brain, Rocket, Clock,
  Menu, X, Github, Twitter, Linkedin,
  Star, Users, TrendingUp, MousePointer2, User
} from 'lucide-react';

// Smooth scroll hook
const useSmoothScroll = () => {
  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  return scrollTo;
};

// Intersection Observer hook for animations
const useInView = (threshold = 0.1) => {
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold }
    );
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return { ref: setRef, isInView };
};

// Animated counter component
function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isInView } = useInView();

  useEffect(() => {
    if (isInView && count < value) {
      const step = Math.ceil(value / 50);
      const timer = setInterval(() => {
        setCount(prev => Math.min(prev + step, value));
      }, 30);
      return () => clearInterval(timer);
    }
  }, [isInView, value, count]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// Feature card with hover effects
function FeatureCard({ icon: Icon, title, description, delay = 0 }: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay?: number;
}) {
  const { ref, isInView } = useInView();
  
  return (
    <div 
      ref={ref}
      className={`group relative p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 
        transition-all duration-500 hover:bg-white/10 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10
        hover:-translate-y-2 cursor-pointer
        ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Gradient glow on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/0 to-purple-500/0 
        group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-all duration-500" />
      
      <div className="relative z-10">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
          flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/25
          group-hover:scale-110 group-hover:shadow-indigo-500/40 transition-all duration-300">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-indigo-300 transition-colors">
          {title}
        </h3>
        <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
          {description}
        </p>
      </div>
    </div>
  );
}

// Pricing card
function PricingCard({ 
  name, price, description, features, highlighted = false, cta = 'Get Started' 
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta?: string;
}) {
  return (
    <div className={`relative p-8 rounded-2xl border transition-all duration-300 hover:-translate-y-2
      ${highlighted 
        ? 'bg-gradient-to-br from-indigo-600 to-purple-700 border-indigo-400 shadow-2xl shadow-indigo-500/25' 
        : 'bg-white/5 border-white/10 hover:border-indigo-500/50'}`}>
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full 
          bg-gradient-to-r from-amber-400 to-orange-500 text-black text-sm font-semibold">
          Most Popular
        </div>
      )}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">{name}</h3>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
      <div className="mb-6">
        <span className="text-4xl font-bold text-white">{price}</span>
        {price !== 'Custom' && <span className="text-gray-400 ml-2">/month</span>}
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${highlighted ? 'text-indigo-200' : 'text-indigo-400'}`} />
            <span className={highlighted ? 'text-indigo-100' : 'text-gray-300'}>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/login"
        className={`block w-full py-3 px-6 rounded-xl font-semibold text-center transition-all duration-300
          ${highlighted 
            ? 'bg-white text-indigo-600 hover:bg-indigo-50 hover:shadow-lg' 
            : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25'}`}
      >
        {cta}
      </Link>
    </div>
  );
}

// Navigation Link with hover effect
function NavLink({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative px-4 py-2 text-gray-300 font-medium transition-colors hover:text-white group"
    >
      {children}
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 
        group-hover:w-full transition-all duration-300 ease-out" />
    </button>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollTo = useSmoothScroll();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Eye,
      title: 'AI-Powered Vision',
      description: 'Advanced computer vision algorithms that understand UI elements with human-like accuracy.'
    },
    {
      icon: Workflow,
      title: 'Smart Workflows',
      description: 'Create, manage, and execute complex automation workflows with an intuitive visual builder.'
    },
    {
      icon: Brain,
      title: 'Intelligent Agents',
      description: 'Deploy AI agents that learn and adapt to your specific testing requirements over time.'
    },
    {
      icon: Code2,
      title: 'Developer First',
      description: 'RESTful APIs, SDKs, and integrations designed for seamless developer experience.'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'SOC 2 compliant, end-to-end encryption, and role-based access control built-in.'
    },
    {
      icon: Rocket,
      title: 'Scale Infinitely',
      description: 'From prototype to production, scale your automation without infrastructure headaches.'
    }
  ];

  const stats = [
    { value: 99.9, suffix: '%', label: 'Uptime SLA' },
    { value: 50, suffix: 'M+', label: 'Tests Run' },
    { value: 500, suffix: '+', label: 'Enterprise Clients' },
    { value: 10, suffix: 'x', label: 'Faster Testing' }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Animated background with mesh gradient */}
      <div className="fixed inset-0 z-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-purple-950/30 to-[#0a0a0f]" />
        
        {/* Mesh gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
        
        {/* Animated orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[120px] animate-pulse" 
          style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-[350px] h-[350px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" 
          style={{ animationDelay: '2s' }} />
        
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTEgMGExIDEgMCAxIDAgMiAwIDEgMSAwIDEgMCAtMiAwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIi8+PC9nPjwvc3ZnPg==')] opacity-40" />
      </div>

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${scrolled ? 'bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/10' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <nav className="flex items-center justify-between">
            {/* Logo - non-clickable on landing page */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
                flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                UI Capture
              </span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-2">
              <NavLink onClick={() => scrollTo('about')}>About</NavLink>
              <NavLink onClick={() => scrollTo('features')}>Features</NavLink>
              <NavLink onClick={() => scrollTo('pricing')}>Pricing</NavLink>
              <NavLink onClick={() => scrollTo('docs')}>Documentation</NavLink>
              <NavLink onClick={() => scrollTo('contact')}>Contact</NavLink>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className="px-4 py-2 text-gray-300 font-medium hover:text-white transition-colors">
                    Dashboard
                  </Link>
                  <Link to="/profile" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 
                    text-white font-semibold hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105 
                    transition-all duration-300">
                    <User size={18} />
                    Profile
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="px-4 py-2 text-gray-300 font-medium hover:text-white transition-colors">
                    Log In
                  </Link>
                  <Link to="/login" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 
                    text-white font-semibold hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105 
                    transition-all duration-300">
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </nav>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 p-4 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10">
              <div className="flex flex-col gap-2">
                <button onClick={() => { scrollTo('about'); setMobileMenuOpen(false); }} 
                  className="px-4 py-3 text-left rounded-lg hover:bg-white/10 transition-colors">About</button>
                <button onClick={() => { scrollTo('features'); setMobileMenuOpen(false); }} 
                  className="px-4 py-3 text-left rounded-lg hover:bg-white/10 transition-colors">Features</button>
                <button onClick={() => { scrollTo('pricing'); setMobileMenuOpen(false); }} 
                  className="px-4 py-3 text-left rounded-lg hover:bg-white/10 transition-colors">Pricing</button>
                <button onClick={() => { scrollTo('docs'); setMobileMenuOpen(false); }} 
                  className="px-4 py-3 text-left rounded-lg hover:bg-white/10 transition-colors">Documentation</button>
                <button onClick={() => { scrollTo('contact'); setMobileMenuOpen(false); }} 
                  className="px-4 py-3 text-left rounded-lg hover:bg-white/10 transition-colors">Contact</button>
                <hr className="border-white/10 my-2" />
                {isAuthenticated ? (
                  <>
                    <Link to="/dashboard" className="px-4 py-3 text-center rounded-lg bg-white/10 font-semibold">
                      Dashboard
                    </Link>
                    <Link to="/profile" className="px-4 py-3 text-center rounded-lg bg-indigo-600 font-semibold flex items-center justify-center gap-2">
                      <User size={18} />
                      Profile
                    </Link>
                  </>
                ) : (
                  <Link to="/login" className="px-4 py-3 text-center rounded-lg bg-indigo-600 font-semibold">
                    Get Started
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8
            hover:bg-indigo-500/20 transition-colors cursor-pointer group">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-300">Now with GPT-4 Vision Integration</span>
            <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
          </div>

          {/* Main headline */}
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Automate UI Testing
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              with AI Vision
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Capture, analyze, and automate browser workflows using advanced computer vision 
            and intelligent agents. Ship faster, break less.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/login" className="group flex items-center gap-3 px-8 py-4 rounded-xl 
              bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-lg
              hover:shadow-2xl hover:shadow-indigo-500/30 hover:scale-105 transition-all duration-300">
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button onClick={() => scrollTo('demo')} className="group flex items-center gap-3 px-8 py-4 rounded-xl 
              border border-white/20 text-white font-semibold text-lg
              hover:bg-white/5 hover:border-white/40 transition-all duration-300">
              <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Watch Demo
            </button>
          </div>

          {/* Hero Image/Demo */}
          <div id="demo" className="relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-2
              shadow-2xl shadow-indigo-500/10">
              <div className="rounded-xl bg-[#12121a] overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="max-w-md mx-auto px-4 py-1.5 rounded-lg bg-white/5 text-sm text-gray-400 text-center">
                      app.uicapture.ai/playground
                    </div>
                  </div>
                </div>
                {/* Content */}
                <div className="p-8 min-h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 
                      flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <MousePointer2 className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-gray-400 text-lg">AI Workflow Builder</p>
                    <p className="text-gray-500 text-sm mt-2">Create automations with natural language</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 border-y border-white/10 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center group cursor-default">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 
                  bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-gray-400 mt-2 group-hover:text-gray-300 transition-colors">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Built for Modern
                </span>
                <br />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Development Teams
                </span>
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                UI Capture combines cutting-edge AI vision technology with intuitive workflow automation 
                to revolutionize how teams approach UI testing. No more brittle selectors, 
                no more flaky tests—just intelligent automation that works.
              </p>
              <div className="space-y-4">
                {[
                  'Visual AI that understands your UI like a human',
                  'Self-healing tests that adapt to UI changes',
                  'Cross-browser testing with zero configuration',
                  'Seamless CI/CD integration'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 group">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 
                      flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-300 group-hover:text-white transition-colors">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl blur-3xl" />
              <div className="relative rounded-2xl border border-white/10 bg-white/5 p-8">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Clock, label: 'Save 80% time', color: 'from-blue-500 to-cyan-500' },
                    { icon: TrendingUp, label: '10x faster CI', color: 'from-green-500 to-emerald-500' },
                    { icon: Users, label: 'Team collaboration', color: 'from-orange-500 to-amber-500' },
                    { icon: Star, label: '99.9% accuracy', color: 'from-pink-500 to-rose-500' }
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 
                      hover:bg-white/10 hover:border-white/20 transition-all cursor-default group">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} 
                        flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <item.icon className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-gray-300 font-medium group-hover:text-white transition-colors">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Everything You Need
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Powerful features designed for teams who ship fast and break nothing
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <FeatureCard key={i} {...feature} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <section id="docs" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Developer Documentation
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Get started in minutes with comprehensive guides and API references
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Quick Start', description: 'Get up and running in under 5 minutes', icon: Rocket },
              { title: 'API Reference', description: 'Complete REST API documentation', icon: Code2 },
              { title: 'SDK Guides', description: 'Python, JavaScript, and more', icon: Workflow }
            ].map((doc, i) => (
              <div key={i} className="group p-6 rounded-2xl border border-white/10 bg-white/5 
                hover:bg-white/10 hover:border-indigo-500/50 transition-all cursor-pointer">
                <doc.icon className="w-10 h-10 text-indigo-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                  {doc.title}
                </h3>
                <p className="text-gray-400 group-hover:text-gray-300 transition-colors">{doc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Simple, Transparent Pricing
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Start free, scale as you grow. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard
              name="Starter"
              price="$0"
              description="Perfect for side projects"
              features={[
                '1,000 test runs/month',
                '1 project',
                'Community support',
                'Basic analytics',
                '7-day history'
              ]}
              cta="Start Free"
            />
            <PricingCard
              name="Pro"
              price="$9.99"
              description="For growing teams"
              features={[
                '50,000 test runs/month',
                'Unlimited projects',
                'Priority support',
                'Advanced analytics',
                '90-day history',
                'Team collaboration',
                'CI/CD integrations'
              ]}
              highlighted
            />
            <PricingCard
              name="Enterprise"
              price="Custom"
              description="For large organizations"
              features={[
                'Unlimited test runs',
                'Unlimited projects',
                'Dedicated support',
                'Custom integrations',
                'Unlimited history',
                'SSO & SAML',
                'SLA guarantee',
                'On-premise option'
              ]}
              cta="Contact Sales"
            />
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Ready to Get Started?
            </span>
          </h2>
          <p className="text-xl text-gray-400 mb-10">
            Join thousands of developers automating their UI testing with AI
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="group flex items-center gap-3 px-8 py-4 rounded-xl 
              bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-lg
              hover:shadow-2xl hover:shadow-indigo-500/30 hover:scale-105 transition-all duration-300">
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="mailto:hello@uicapture.ai" className="px-8 py-4 rounded-xl border border-white/20 
              text-white font-semibold text-lg hover:bg-white/5 hover:border-white/40 transition-all">
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-20 px-6 border-t border-white/10 bg-gradient-to-b from-transparent to-[#050508]">
        {/* Footer background enhancement */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTEgMGExIDEgMCAxIDAgMiAwIDEgMSAwIDEgMCAtMiAwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIi8+PC9nPjwvc3ZnPg==')] opacity-50" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
                  flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">UI Capture</span>
              </div>
              <p className="text-gray-300 mb-6 max-w-sm leading-relaxed text-base">
                AI-powered UI testing automation for modern development teams. Ship faster, test smarter.
              </p>
              <div className="flex gap-3">
                <a href="#" className="p-3 rounded-xl bg-white/10 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300">
                  <Twitter className="w-5 h-5 text-gray-300" />
                </a>
                <a href="#" className="p-3 rounded-xl bg-white/10 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300">
                  <Github className="w-5 h-5 text-gray-300" />
                </a>
                <a href="#" className="p-3 rounded-xl bg-white/10 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300">
                  <Linkedin className="w-5 h-5 text-gray-300" />
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-semibold mb-5 text-lg">Product</h4>
              <ul className="space-y-4">
                <li><button onClick={() => scrollTo('features')} className="text-gray-300 hover:text-indigo-400 transition-colors text-base">Features</button></li>
                <li><button onClick={() => scrollTo('pricing')} className="text-gray-300 hover:text-indigo-400 transition-colors text-base">Pricing</button></li>
                <li><a href="#" className="text-gray-300 hover:text-indigo-400 transition-colors text-base">Changelog</a></li>
                <li><a href="#" className="text-gray-300 hover:text-indigo-400 transition-colors text-base">Roadmap</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-5 text-lg">Resources</h4>
              <ul className="space-y-4">
                <li><button onClick={() => scrollTo('docs')} className="text-gray-300 hover:text-indigo-400 transition-colors text-base">Documentation</button></li>
                <li><a href="#" className="text-gray-300 hover:text-indigo-400 transition-colors text-base">API Reference</a></li>
                <li><a href="#" className="text-gray-300 hover:text-indigo-400 transition-colors text-base">Blog</a></li>
                <li><a href="#" className="text-gray-300 hover:text-indigo-400 transition-colors text-base">Community</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-5 text-lg">Company</h4>
              <ul className="space-y-4">
                <li><button onClick={() => scrollTo('about')} className="text-gray-300 hover:text-indigo-400 transition-colors text-base">About</button></li>
                <li><a href="#" className="text-gray-300 hover:text-indigo-400 transition-colors text-base">Careers</a></li>
                <li><button onClick={() => scrollTo('contact')} className="text-gray-300 hover:text-indigo-400 transition-colors text-base">Contact</button></li>
                <li><a href="#" className="text-gray-300 hover:text-indigo-400 transition-colors text-base">Legal</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-10 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">
              © 2026 UI Capture. All rights reserved.
            </p>
            <div className="flex gap-8 text-sm">
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">Terms of Service</a>
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-indigo-400 transition-colors">Cookie Settings</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
