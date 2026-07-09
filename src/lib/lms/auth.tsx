import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentRoles } from "./api";
import type { Role } from "./types";

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  isAdmin: false,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setUser(null);
      setLoading(false);
      return;
    }
    let roles: Role[] = [];
    try {
      roles = await getCurrentRoles(data.user.id);
    } catch {
      roles = [];
    }
    setUser({
      id: data.user.id,
      email: data.user.email ?? "",
      fullName: (data.user.user_metadata?.full_name as string) ?? data.user.email ?? "",
      roles,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        isAdmin: user?.roles.includes("admin") ?? false,
        refresh: load,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
