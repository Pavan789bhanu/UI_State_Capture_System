# Web UI Quick Start Guide

## 🎨 Build Your First Web Interface

This guide will help you build a modern web UI for the UI Capture System in just a few hours.

---

## 🛠️ Tech Stack

```
Frontend: React 18 + TypeScript + Vite
Styling: TailwindCSS + shadcn/ui
State: Zustand (lightweight state management)
API: Axios + React Query
Real-time: Socket.io-client
Charts: Recharts
```

---

## 📦 Setup (5 minutes)

### 1. Create React App with Vite

```bash
cd /Users/pavankumarmalasani/Downloads/ui_capture_system

# Create frontend directory
npm create vite@latest frontend -- --template react-ts

cd frontend

# Install dependencies
npm install

# Install additional packages
npm install -D tailwindcss postcss autoprefixer
npm install axios react-query socket.io-client zustand
npm install lucide-react clsx tailwind-merge
npm install recharts date-fns
```

### 2. Initialize Tailwind CSS

```bash
npx tailwindcss init -p
```

Update `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
    },
  },
  plugins: [],
}
```

### 3. Update `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900;
  }
}
```

---

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Layout.tsx
│   │   ├── workflow/
│   │   │   ├── WorkflowCard.tsx
│   │   │   ├── WorkflowList.tsx
│   │   │   └── WorkflowBuilder.tsx
│   │   ├── execution/
│   │   │   ├── ExecutionMonitor.tsx
│   │   │   ├── LiveView.tsx
│   │   │   └── StepList.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       └── Modal.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── WorkflowsPage.tsx
│   │   ├── ExecutionsPage.tsx
│   │   └── AnalyticsPage.tsx
│   ├── hooks/
│   │   ├── useWorkflows.ts
│   │   ├── useExecutions.ts
│   │   └── useWebSocket.ts
│   ├── store/
│   │   └── store.ts
│   ├── api/
│   │   └── client.ts
│   ├── types/
│   │   └── index.ts
│   └── App.tsx
├── package.json
└── vite.config.ts
```

---

## 💻 Core Components

### 1. Layout Component (`src/components/layout/Layout.tsx`)

```typescript
import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 2. Sidebar (`src/components/layout/Sidebar.tsx`)

```typescript
import React from 'react';
import { Home, PlayCircle, BarChart3, Settings, Zap } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: Zap, label: 'Workflows', path: '/workflows' },
    { icon: PlayCircle, label: 'Executions', path: '/executions' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <Zap className="w-8 h-8 text-primary-500" />
        <span className="ml-2 text-xl font-bold text-gray-900">
          UI Capture
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center px-4 py-3 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <Icon className="w-5 h-5 mr-3" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 font-semibold">PK</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">Pavan Kumar</p>
            <p className="text-xs text-gray-500">pavan@example.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3. Dashboard Page (`src/pages/Dashboard.tsx`)

```typescript
import React from 'react';
import { Zap, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { useQuery } from 'react-query';

export default function Dashboard() {
  const { data: stats } = useQuery('dashboard-stats', async () => {
    // TODO: Replace with actual API call
    return {
      totalWorkflows: 47,
      executions: 230,
      successRate: 95,
      avgDuration: 42,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Zap}
          label="Total Workflows"
          value={stats?.totalWorkflows || 0}
          change="+12%"
          positive
        />
        <StatCard
          icon={TrendingUp}
          label="Executions"
          value={stats?.executions || 0}
          change="+23%"
          positive
        />
        <StatCard
          icon={CheckCircle}
          label="Success Rate"
          value={`${stats?.successRate || 0}%`}
          change="+5%"
          positive
        />
        <StatCard
          icon={Clock}
          label="Avg Duration"
          value={`${stats?.avgDuration || 0}s`}
          change="-8%"
          positive
        />
      </div>

      {/* Recent Workflows */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Recent Workflows
        </h2>
        <div className="space-y-3">
          {/* TODO: Map actual workflows */}
          <WorkflowItem
            name="Create Jira Ticket"
            time="2 mins ago"
            status="success"
          />
          <WorkflowItem
            name="Update Notion Page"
            time="15 mins ago"
            status="success"
          />
          <WorkflowItem
            name="Send Slack Message"
            time="1 hour ago"
            status="warning"
          />
        </div>
      </div>
    </div>
  );
}

// Helper Components
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  change: string;
  positive: boolean;
}

function StatCard({ icon: Icon, label, value, change, positive }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-primary-50 rounded-lg">
          <Icon className="w-6 h-6 text-primary-600" />
        </div>
        <span className={`text-sm font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
          {change}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

interface WorkflowItemProps {
  name: string;
  time: string;
  status: 'success' | 'warning' | 'error';
}

function WorkflowItem({ name, time, status }: WorkflowItemProps) {
  const statusColors = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
          <Zap className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{name}</p>
          <p className="text-sm text-gray-500">{time}</p>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
        {status}
      </span>
    </div>
  );
}
```

### 4. Workflow Builder Page (`src/pages/WorkflowsPage.tsx`)

```typescript
import React, { useState } from 'react';
import { Plus, Play, Edit, Trash2, MoreVertical } from 'lucide-react';

export default function WorkflowsPage() {
  const [workflows] = useState([
    {
      id: '1',
      name: 'Create Jira Ticket',
      description: 'Automated ticket creation workflow',
      lastRun: '2 hours ago',
      status: 'active',
      executions: 145,
    },
    {
      id: '2',
      name: 'Update Notion Database',
      description: 'Sync data to Notion',
      lastRun: 'Yesterday',
      status: 'active',
      executions: 89,
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
        <button className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <Plus className="w-5 h-5 mr-2" />
          New Workflow
        </button>
      </div>

      {/* Workflows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {workflow.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {workflow.description}
                </p>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Last run:</span>
                <span className="text-gray-900">{workflow.lastRun}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Executions:</span>
                <span className="text-gray-900">{workflow.executions}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex-1 flex items-center justify-center px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors">
                <Play className="w-4 h-4 mr-2" />
                Run
              </button>
              <button className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <Edit className="w-4 h-4" />
              </button>
              <button className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5. Live Execution Monitor (`src/components/execution/ExecutionMonitor.tsx`)

```typescript
import React, { useEffect, useState } from 'react';
import { Pause, Square, Download } from 'lucide-react';
import { io } from 'socket.io-client';

interface ExecutionMonitorProps {
  executionId: string;
}

export default function ExecutionMonitor({ executionId }: ExecutionMonitorProps) {
  const [status, setStatus] = useState('running');
  const [screenshot, setScreenshot] = useState('');
  const [steps, setSteps] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const socket = io('http://localhost:8000');

    socket.on('execution.step', (data) => {
      setScreenshot(data.screenshot);
      setSteps((prev) => [...prev, data.step]);
      setLogs((prev) => [...prev, ...data.logs]);
    });

    socket.on('execution.completed', (data) => {
      setStatus(data.status);
    });

    return () => {
      socket.disconnect();
    };
  }, [executionId]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Live Execution</h2>
          <p className="text-sm text-gray-500 mt-1">
            Duration: 00:01:23 | Status: {status}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200">
            <Pause className="w-4 h-4" />
          </button>
          <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
            <Square className="w-4 h-4" />
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Screenshot */}
        <div className="bg-gray-100 rounded-lg p-4 aspect-video flex items-center justify-center">
          {screenshot ? (
            <img src={screenshot} alt="Live screenshot" className="max-w-full max-h-full" />
          ) : (
            <p className="text-gray-500">Waiting for screenshot...</p>
          )}
        </div>

        {/* Steps & Logs */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Steps</h3>
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center mb-2">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-sm text-gray-700">{step}</span>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs">
            <h3 className="font-semibold text-gray-900 mb-3">Logs</h3>
            {logs.map((log, idx) => (
              <div key={idx} className="text-gray-600 mb-1">{log}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔌 API Integration (`src/api/client.ts`)

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API methods
export const workflowsApi = {
  getAll: () => api.get('/workflows'),
  getById: (id: string) => api.get(`/workflows/${id}`),
  create: (data: any) => api.post('/workflows', data),
  update: (id: string, data: any) => api.put(`/workflows/${id}`, data),
  delete: (id: string) => api.delete(`/workflows/${id}`),
  execute: (id: string, params?: any) => api.post(`/workflows/${id}/execute`, params),
};

export const executionsApi = {
  getAll: () => api.get('/executions'),
  getById: (id: string) => api.get(`/executions/${id}`),
  getLogs: (id: string) => api.get(`/executions/${id}/logs`),
  stop: (id: string) => api.post(`/executions/${id}/stop`),
};

export const analyticsApi = {
  getOverview: () => api.get('/analytics/overview'),
  getWorkflowStats: (id: string) => api.get(`/analytics/workflows/${id}`),
};
```

---

## 🚀 Running the App

```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🎨 Next Steps

1. **Add React Router** for navigation
2. **Implement React Query** for data fetching
3. **Add Socket.io** for real-time updates
4. **Create forms** with React Hook Form
5. **Add animations** with Framer Motion
6. **Implement dark mode**
7. **Add unit tests** with Vitest
8. **Set up CI/CD** with GitHub Actions

---

## 📱 Mobile App (Future)

Consider building a mobile app with:
- **React Native** (share code with web)
- **Flutter** (native performance)

Features:
- View workflow executions
- Trigger workflows
- Receive push notifications
- View reports

---

## 💡 Pro Tips

1. **Use TypeScript** for type safety
2. **Component-first** approach
3. **Responsive by default**
4. **Accessibility** (ARIA labels, keyboard nav)
5. **Performance** (lazy loading, code splitting)
6. **Error boundaries** for graceful failures
7. **Loading states** for better UX
8. **Optimistic updates** for instant feedback

Ready to build! 🚀
