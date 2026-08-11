import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase";

type Role = "requester" | "it_admin" | null;

interface AuthValue {
  user: User | null;
  role: Role;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

async function bootstrapAndFetchRole(): Promise<Role> {
  const bootstrap = httpsCallable(functions, "bootstrapUser");
  const result = (await bootstrap({})) as { data: { role: Role } };
  return result.data.role;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const r = await bootstrapAndFetchRole();
        setRole(r);
      } else {
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  const value: AuthValue = {
    user,
    role,
    loading,
    signInEmail: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUpEmail: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    signInGoogle: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signOut: async () => {
      await fbSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
