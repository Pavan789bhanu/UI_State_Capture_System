import { Github, Twitter, Linkedin, Mail } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }} 
      className="border-t mt-auto"
    >
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--brand))' }}
              >
                <span className="text-white font-bold text-sm">UC</span>
              </div>
              <span 
                style={{ color: 'rgb(var(--text-primary))' }} 
                className="text-lg font-semibold"
              >
                UI Capture System
              </span>
            </div>
            <p 
              style={{ color: 'rgb(var(--text-secondary))' }} 
              className="text-sm mb-4 max-w-md"
            >
              The AI automation platform built for everyone. Create powerful workflows with visual building blocks and AI-enhanced decision making.
            </p>
            <div className="flex gap-3">
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg transition-all hover-glow"
                style={{ 
                  color: 'rgb(var(--text-secondary))',
                  backgroundColor: 'rgb(var(--bg-tertiary))'
                }}
                aria-label="GitHub"
              >
                <Github size={18} strokeWidth={2} />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg transition-all hover-glow"
                style={{ 
                  color: 'rgb(var(--text-secondary))',
                  backgroundColor: 'rgb(var(--bg-tertiary))'
                }}
                aria-label="Twitter"
              >
                <Twitter size={18} strokeWidth={2} />
              </a>
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg transition-all hover-glow"
                style={{ 
                  color: 'rgb(var(--text-secondary))',
                  backgroundColor: 'rgb(var(--bg-tertiary))'
                }}
                aria-label="LinkedIn"
              >
                <Linkedin size={18} strokeWidth={2} />
              </a>
              <a 
                href="mailto:contact@uicapture.com" 
                className="p-2 rounded-lg transition-all hover-glow"
                style={{ 
                  color: 'rgb(var(--text-secondary))',
                  backgroundColor: 'rgb(var(--bg-tertiary))'
                }}
                aria-label="Email"
              >
                <Mail size={18} strokeWidth={2} />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 
              style={{ color: 'rgb(var(--text-primary))' }} 
              className="text-sm font-semibold mb-3"
            >
              Product
            </h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="/workflows" 
                  style={{ color: 'rgb(var(--text-secondary))' }}
                  className="text-sm hover:text-brand transition-colors"
                >
                  Workflows
                </a>
              </li>
              <li>
                <a 
                  href="/playground" 
                  style={{ color: 'rgb(var(--text-secondary))' }}
                  className="text-sm hover:text-brand transition-colors"
                >
                  Playground
                </a>
              </li>
              <li>
                <a 
                  href="/executions" 
                  style={{ color: 'rgb(var(--text-secondary))' }}
                  className="text-sm hover:text-brand transition-colors"
                >
                  Executions
                </a>
              </li>
              <li>
                <a 
                  href="/analytics" 
                  style={{ color: 'rgb(var(--text-secondary))' }}
                  className="text-sm hover:text-brand transition-colors"
                >
                  Analytics
                </a>
              </li>
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 
              style={{ color: 'rgb(var(--text-primary))' }} 
              className="text-sm font-semibold mb-3"
            >
              Resources
            </h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="#" 
                  style={{ color: 'rgb(var(--text-secondary))' }}
                  className="text-sm hover:text-brand transition-colors"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  style={{ color: 'rgb(var(--text-secondary))' }}
                  className="text-sm hover:text-brand transition-colors"
                >
                  API Reference
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  style={{ color: 'rgb(var(--text-secondary))' }}
                  className="text-sm hover:text-brand transition-colors"
                >
                  Community
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  style={{ color: 'rgb(var(--text-secondary))' }}
                  className="text-sm hover:text-brand transition-colors"
                >
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div 
          className="pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ borderColor: 'rgb(var(--border-color))' }}
        >
          <p 
            style={{ color: 'rgb(var(--text-secondary))' }} 
            className="text-xs flex items-center gap-1"
          >
            © {currentYear} UI Capture System. 
          </p>
          <div className="flex gap-6">
            <a 
              href="#" 
              style={{ color: 'rgb(var(--text-secondary))' }}
              className="text-xs hover:text-brand transition-colors"
            >
              Privacy Policy
            </a>
            <a 
              href="#" 
              style={{ color: 'rgb(var(--text-secondary))' }}
              className="text-xs hover:text-brand transition-colors"
            >
              Terms of Service
            </a>
            <a 
              href="#" 
              style={{ color: 'rgb(var(--text-secondary))' }}
              className="text-xs hover:text-brand transition-colors"
            >
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
