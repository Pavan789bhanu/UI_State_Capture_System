import { X, Check, AlertCircle, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNotifications, type Notification } from '../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotifications();
  const navigate = useNavigate();

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={20} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-yellow-500" />;
      case 'info':
      default:
        return <Info size={20} className="text-blue-500" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.executionId) {
      navigate(`/executions?id=${notification.executionId}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          backgroundColor: 'rgb(var(--bg-secondary))',
          borderColor: 'rgb(var(--border-color))',
        }}
        className="relative w-full max-w-md h-[600px] rounded-lg border shadow-2xl flex flex-col animate-slide-in-right overflow-hidden"
      >
        {/* Header */}
        <div
          style={{
            borderColor: 'rgb(var(--border-color))',
            background: 'linear-gradient(135deg, rgb(var(--brand) / 0.05) 0%, transparent 100%)',
          }}
          className="px-4 py-3 border-b flex items-center justify-between"
        >
          <div>
            <h2 style={{ color: 'rgb(var(--text-primary))' }} className="text-lg font-semibold">
              Notifications
            </h2>
            {unreadCount > 0 && (
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-xs mt-0.5">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{ color: 'rgb(var(--brand))' }}
                    className="text-xs font-medium hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={clearAll}
                  style={{ color: 'rgb(var(--text-secondary))' }}
                  className="text-xs font-medium hover:underline"
                >
                  Clear all
                </button>
              </>
            )}
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'rgb(var(--bg-tertiary))',
                color: 'rgb(var(--text-secondary))',
              }}
              className="p-1.5 rounded-lg hover:scale-105 transition-transform"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-2">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div
                style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}
                className="p-4 rounded-full mb-3"
              >
                <Check size={32} style={{ color: 'rgb(var(--text-secondary))' }} />
              </div>
              <p style={{ color: 'rgb(var(--text-primary))' }} className="font-medium">
                All caught up!
              </p>
              <p style={{ color: 'rgb(var(--text-secondary))' }} className="text-sm mt-1">
                No new notifications
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    backgroundColor: notification.read
                      ? 'rgb(var(--bg-tertiary) / 0.5)'
                      : 'rgb(var(--bg-tertiary))',
                    borderColor: notification.read
                      ? 'transparent'
                      : 'rgb(var(--brand) / 0.2)',
                  }}
                  className={`p-3 rounded-lg border transition-all cursor-pointer hover:scale-[1.02] ${
                    !notification.read ? 'shadow-sm' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3
                          style={{ color: 'rgb(var(--text-primary))' }}
                          className="text-sm font-semibold"
                        >
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <div
                            style={{ backgroundColor: 'rgb(var(--brand))' }}
                            className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                          />
                        )}
                      </div>
                      <p
                        style={{ color: 'rgb(var(--text-secondary))' }}
                        className="text-xs mb-2 line-clamp-2"
                      >
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <span
                          style={{ color: 'rgb(var(--text-secondary))' }}
                          className="text-[10px]"
                        >
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearNotification(notification.id);
                          }}
                          style={{ color: 'rgb(var(--text-secondary))' }}
                          className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
