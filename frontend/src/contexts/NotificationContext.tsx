import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
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

interface ExecutionEventData {
  workflow_name: string;
  workflow_id: string;
  execution_id: string;
  error?: string;
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

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
      const id = `notification-${notification.type}-${Date.now()}`;
      const newNotification: Notification = {
        ...notification,
        id,
        timestamp: new Date(),
        read: false,
      };

      setNotifications((prev) => [newNotification, ...prev]);

      if (notification.type === 'info') {
        setTimeout(() => {
          clearNotification(id);
        }, 5000);
      }
    },
    [clearNotification]
  );

  useEffect(() => {
    const handleExecutionStarted = (data: ExecutionEventData) => {
      addNotification({
        type: 'info',
        title: 'Workflow Started',
        message: `Workflow "${data.workflow_name}" execution has begun`,
        workflowId: data.workflow_id,
        executionId: data.execution_id,
      });
    };

    const handleExecutionCompleted = (data: ExecutionEventData) => {
      addNotification({
        type: 'success',
        title: 'Workflow Completed',
        message: `Workflow "${data.workflow_name}" completed successfully`,
        workflowId: data.workflow_id,
        executionId: data.execution_id,
      });
    };

    const handleExecutionFailed = (data: ExecutionEventData) => {
      addNotification({
        type: 'error',
        title: 'Workflow Failed',
        message: `Workflow "${data.workflow_name}" failed: ${data.error ?? 'Unknown error'}`,
        workflowId: data.workflow_id,
        executionId: data.execution_id,
      });
    };

    apiClient.on('execution_started', handleExecutionStarted);
    apiClient.on('execution_completed', handleExecutionCompleted);
    apiClient.on('execution_failed', handleExecutionFailed);

    return () => {
      apiClient.off('execution_started', handleExecutionStarted);
      apiClient.off('execution_completed', handleExecutionCompleted);
      apiClient.off('execution_failed', handleExecutionFailed);
    };
  }, [addNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

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
