import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ role: string }>;
  logout: () => void;
}

const TOKEN_KEY = "dxn_token";
const USER_KEY = "dxn_user";

const applyToken = (token: string | null) => {
  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common["Authorization"];
  }
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isAuthenticated: false,
  login: async () => ({ role: "" }),
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    applyToken(token);
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await axios.post("/api/users/login", { email, password });
    const data = response.data?.data;
    const newToken = data?.token;
    const newUser = data?.user;
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
      if (newUser) localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser || null);
    }
    return { role: newUser?.role || "" };
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ token, user, isAuthenticated: !!token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;