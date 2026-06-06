import React, { createContext, useContext, useState } from 'react';
import { api } from '../services/api';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Restore the auth token from localStorage at initialisation time.
 * Using a lazy initialiser avoids calling setState inside a useEffect,
 * which React's new linter rules flag as a potential cascading-render issue.
 */
function getInitialToken(): string | null {
  const stored = localStorage.getItem('auth_token');
  if (stored) {
    api.setToken(stored);
  }
  return stored;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(getInitialToken);
  const isLoading = false; // synchronous initialisation — never in a loading state

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    const newToken = response.access_token;
    setToken(newToken);
    localStorage.setItem('auth_token', newToken);
    api.setToken(newToken);
  };

  const register = async (email: string, password: string) => {
    await api.register(email, password);
    await login(email, password);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('auth_token');
    api.setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        login,
        register,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
