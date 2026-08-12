import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { type RecordModel } from "pocketbase";
import { pb } from "../pocketbase";

type Role = "requester" | "it_admin";

interface AuthValue {
  user: RecordModel | null;
  role: Role;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

function roleOf(user: RecordModel | null): Role {
  return user?.role === "it_admin" ? "it_admin" : "requester";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(
    pb.authStore.record
  );

  useEffect(() => {
    return pb.authStore.onChange(() => {
      setUser(pb.authStore.record);
    });
  }, []);

  const value: AuthValue = {
    user,
    role: roleOf(user),
    loading: false,
    signInEmail: async (email, password) => {
      await pb.collection("users").authWithPassword(email, password);
    },
    signUpEmail: async (email, password) => {
      await pb.collection("users").create({
        email,
        password,
        passwordConfirm: password,
      });
      await pb.collection("users").authWithPassword(email, password);
    },
    signInGoogle: async () => {
      await pb.collection("users").authWithOAuth2({ provider: "google" });
    },
    signOut: async () => {
      pb.authStore.clear();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
