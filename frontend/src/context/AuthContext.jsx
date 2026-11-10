import { createContext, useContext, useState } from 'react';
import { api, loadAuth, saveAuth } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadAuth);

  const store = (next) => {
    saveAuth(next);
    setAuth(next);
    return next?.user ?? null;
  };

  const value = {
    user: auth?.user ?? null,
    login: async (credentials) => store(await api('/auth/login', { method: 'POST', body: credentials })),
    register: async (details) => store(await api('/auth/register', { method: 'POST', body: details })),
    logout: () => store(null),
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export const useAuth = () => useContext(AuthContext);
