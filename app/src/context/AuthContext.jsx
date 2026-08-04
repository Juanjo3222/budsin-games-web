import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { onUserChange, signInWithGoogle, signOutUser, isAdminEmail } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onUserChange((u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        try {
          localStorage.setItem("budsin_pro_user", JSON.stringify({ uid: u.uid, email: u.email }));
        } catch (e) {}
      } else {
        try {
          localStorage.removeItem("budsin_pro_user");
        } catch (e) {}
      }
    });
    return unsub;
  }, []);

  const login = useCallback(async () => {
    const cred = await signInWithGoogle();
    setUser(cred.user);
    return cred.user;
  }, []);

  const logout = useCallback(async () => {
    await signOutUser();
    setUser(null);
  }, []);

  const isAdmin = useMemo(() => isAdminEmail(user?.email), [user]);

  const value = useMemo(
    () => ({ user, loading, login, logout, isAdmin }),
    [user, loading, login, logout, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
