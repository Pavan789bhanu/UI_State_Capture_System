import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    console.log('[AuthContext] Initializing - checking localStorage...');
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      console.log('[AuthContext] ✓ Token found, restoring...', storedToken.substring(0, 20) + '...');
      setToken(storedToken);
      api.setToken(storedToken);
      console.log('[AuthContext] ✓ Token restored and set in API client');
    } else {
      console.log('[AuthContext] ✗ No token found in localStorage');
    }
    setIsLoading(false);
    console.log('[AuthContext] ✓ Initialization complete, isLoading set to false');
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);
      const newToken = response.access_token;
      setToken(newToken);
      localStorage.setItem('auth_token', newToken);
      api.setToken(newToken);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
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
