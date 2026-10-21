import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { UserProfile, AppRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (data: {
    username: string;
    email: string;
    password: string;
    role: AppRole;
    fullName: string;
  }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error.message);
        setProfile(null);
      } else {
        setProfile(data as UserProfile);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    // Synchronous initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => {
          if (isMounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (identifier: string, password: string) => {
    try {
      const trimmedId = identifier.trim();
      let emailToUse = trimmedId;

      // If user typed a username (does not contain @), resolve it via secure RPC
      if (!trimmedId.includes('@')) {
        const { data: resolvedEmail, error: rpcError } = await supabase.rpc('resolve_login_identifier', {
          p_identifier: trimmedId
        });

        if (rpcError || !resolvedEmail) {
          return { error: new Error('Invalid username or password.') };
        }
        emailToUse = resolvedEmail;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      if (data.user) {
        await fetchProfile(data.user.id);
      }

      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return { error: new Error(message) };
    }
  };

  const signUp = async ({
    username,
    email,
    password,
    role,
    fullName
  }: {
    username: string;
    email: string;
    password: string;
    role: AppRole;
    fullName: string;
  }) => {
    try {
      // 1. Check username availability pre-flight
      const { data: isAvailable, error: checkError } = await supabase.rpc('username_available', {
        p_username: username.trim()
      });

      if (checkError) {
        console.warn('Username check warning:', checkError.message);
      } else if (isAvailable === false) {
        return { error: new Error('Username is already taken or contains reserved words.') };
      }

      // 2. Register with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            username: username.trim(),
            role: role,
            full_name: fullName.trim()
          }
        }
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      if (data.user) {
        await fetchProfile(data.user.id);
      }

      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      return { error: new Error(message) };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
