import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiClient } from '../services/api';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  workflowId?: string;
  executionId?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Listen to websocket events for workflow executions
  useEffect(() => {
    const handleExecutionStarted = (data: any) => {
      addNotification({
        type: 'info',
        title: 'Workflow Started',
        message: `Workflow "${data.workflow_name}" execution has begun`,
        workflowId: data.workflow_id,
        executionId: data.execution_id,
      });
    };

    const handleExecutionCompleted = (data: any) => {
      addNotification({
        type: 'success',
        title: 'Workflow Completed',
        message: `Workflow "${data.workflow_name}" completed successfully`,
        workflowId: data.workflow_id,
        executionId: data.execution_id,
      });
    };

    const handleExecutionFailed = (data: any) => {
      addNotification({
        type: 'error',
        title: 'Workflow Failed',
        message: `Workflow "${data.workflow_name}" failed: ${data.error || 'Unknown error'}`,
        workflowId: data.workflow_id,
        executionId: data.execution_id,
      });
    };

    // Register websocket event listeners
    apiClient.on('execution_started', handleExecutionStarted);
    apiClient.on('execution_completed', handleExecutionCompleted);
    apiClient.on('execution_failed', handleExecutionFailed);

    return () => {
      apiClient.off('execution_started', handleExecutionStarted);
      apiClient.off('execution_completed', handleExecutionCompleted);
      apiClient.off('execution_failed', handleExecutionFailed);
    };
  }, []);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false,
    };

    setNotifications((prev) => [newNotification, ...prev]);

    // Auto-dismiss info notifications after 5 seconds
    if (notification.type === 'info') {
      setTimeout(() => {
        clearNotification(newNotification.id);
      }, 5000);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
