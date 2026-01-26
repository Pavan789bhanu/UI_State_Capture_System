import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isPlayground = location.pathname === '/playground';
  
  return (
    <div style={{ backgroundColor: 'rgb(var(--bg-primary))' }} className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className={`flex-1 flex flex-col ${isPlayground ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className={`flex-1 ${isPlayground ? 'flex flex-col overflow-hidden' : ''}`}>
            {children}
          </div>
          {!isPlayground && <Footer />}
        </main>
      </div>
    </div>
  );
}
