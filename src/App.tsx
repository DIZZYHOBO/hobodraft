import React, { createContext, useContext, useState, useEffect } from 'react';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect } from 'react-router-dom';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';

import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Admin from './pages/Admin';
import SharedView from './pages/SharedView';

// Fix animation issues - set up Ionic with specific config
setupIonicReact({
  mode: 'ios',
  animated: true,
  swipeBackEnabled: false
});

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

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'include'
  });
  return res.json();
}

function PrivateRoute({ children, ...rest }: { children: React.ReactNode; path: string; exact?: boolean }) {
  const { user, loading } = useAuth();
  
  return (
    <Route
      {...rest}
      render={({ location }) => {
        if (loading) return null;
        if (!user) return <Redirect to={{ pathname: '/auth', state: { from: location } }} />;
        return children;
      }}
    />
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api<{ user: User | null }>('/auth/me').then(res => {
      if (mounted) {
        setUser(res.user);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <IonApp>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          Loading...
        </div>
      </IonApp>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      <IonApp>
        <IonReactRouter>
          <IonRouterOutlet animated={true}>
            <Route exact path="/auth" component={Auth} />
            <Route exact path="/shared/:token" component={SharedView} />
            <PrivateRoute exact path="/dashboard">
              <Dashboard />
            </PrivateRoute>
            <PrivateRoute exact path="/editor/:id">
              <Editor />
            </PrivateRoute>
            <PrivateRoute exact path="/admin">
              <Admin />
            </PrivateRoute>
            <Route exact path="/">
              <Redirect to="/dashboard" />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      </IonApp>
    </AuthContext.Provider>
  );
}
