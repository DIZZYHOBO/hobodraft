import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { IonApp, IonRouterOutlet, IonSpinner } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Admin from './pages/Admin';

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, setUser: () => {}, loading: true });

export const useAuth = () => useContext(AuthContext);

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch('/api' + path, { ...opts, headers });
  return res.json();
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User | null }>('/auth/me').then(res => {
      setUser(res.user);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function PrivateRoute({ children, path, exact }: { children: ReactNode; path: string; exact?: boolean }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <IonSpinner name="crescent" />
      </div>
    );
  }
  
  return (
    <Route path={path} exact={exact}>
      {user ? children : <Redirect to="/auth" />}
    </Route>
  );
}

export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route path="/auth" exact component={Auth} />
            <PrivateRoute path="/dashboard" exact><Dashboard /></PrivateRoute>
            <PrivateRoute path="/editor/:id"><Editor /></PrivateRoute>
            <PrivateRoute path="/admin" exact><Admin /></PrivateRoute>
            <Route exact path="/">
              <Redirect to="/dashboard" />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
}
