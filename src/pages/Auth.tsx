import { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent,
  IonItem, IonInput, IonButton, IonSegment, IonSegmentButton, IonLabel
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { api, useAuth } from '../App';
import { LogoIcon } from '../components/Icons';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const { setUser } = useAuth();

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');

    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    const res = await api<{ success?: boolean; user?: any; error?: string }>(endpoint, {
      method: 'POST',
      body: { username, password } as any
    });

    setLoading(false);
    if (res.success && res.user) {
      setUser(res.user);
      history.push('/dashboard');
    } else {
      setError(res.error || 'Something went wrong');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>HoboDraft</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 400, margin: '0 auto', paddingTop: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
            <LogoIcon size={64} />
            <h1 style={{ textAlign: 'center', marginTop: 16, marginBottom: 0 }}>HoboDraft</h1>
          </div>
          <p style={{ textAlign: 'center', color: '#888', marginBottom: 32 }}>
            Professional screenwriting for everyone
          </p>

          <IonSegment value={mode} onIonChange={e => setMode(e.detail.value as 'login' | 'register')}>
            <IonSegmentButton value="login"><IonLabel>Sign In</IonLabel></IonSegmentButton>
            <IonSegmentButton value="register"><IonLabel>Sign Up</IonLabel></IonSegmentButton>
          </IonSegment>

          <IonCard style={{ marginTop: 24 }}>
            <IonCardContent>
              <IonItem>
                <IonInput
                  label="Username"
                  labelPlacement="stacked"
                  value={username}
                  onIonInput={e => setUsername(e.detail.value || '')}
                  autocapitalize="off"
                />
              </IonItem>
              <IonItem>
                <IonInput
                  label="Password"
                  labelPlacement="stacked"
                  type="password"
                  value={password}
                  onIonInput={e => setPassword(e.detail.value || '')}
                />
              </IonItem>

              {error && <p style={{ color: 'var(--ion-color-danger)', padding: '16px 0 0', margin: 0 }}>{error}</p>}

              <IonButton expand="block" onClick={handleSubmit} disabled={loading} style={{ marginTop: 24 }}>
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </IonButton>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}
