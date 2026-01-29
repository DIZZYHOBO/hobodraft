import React, { useState } from 'react';
import {
  IonPage, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonInput, IonButton, IonSegment, IonSegmentButton, IonLabel,
  IonText, IonNote
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAuth, api } from '../App';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const history = useHistory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const res = await api<{ error?: string; user?: any }>(endpoint, {
        method: 'POST',
        body: { username, password } as any
      });

      if (res.error) {
        setError(res.error);
      } else if (res.user) {
        setUser(res.user);
        history.replace('/dashboard');
      }
    } catch {
      setError('Connection failed');
    }
    setLoading(false);
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 400, margin: '60px auto' }}>
          <h1 style={{ textAlign: 'center', marginBottom: 24 }}>HoboDraft</h1>
          
          <IonSegment value={mode} onIonChange={e => setMode(e.detail.value as any)}>
            <IonSegmentButton value="login">
              <IonLabel>Sign In</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="register">
              <IonLabel>Register</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          <IonCard style={{ marginTop: 16 }}>
            <IonCardContent>
              <form onSubmit={handleSubmit}>
                <IonItem>
                  <IonInput
                    label="Username"
                    labelPlacement="floating"
                    value={username}
                    onIonInput={e => setUsername(e.detail.value || '')}
                    required
                    minlength={3}
                  />
                </IonItem>
                
                <IonItem>
                  <IonInput
                    label="Password"
                    labelPlacement="floating"
                    type="password"
                    value={password}
                    onIonInput={e => setPassword(e.detail.value || '')}
                    required
                    minlength={6}
                  />
                </IonItem>

                {error && (
                  <IonText color="danger" style={{ display: 'block', padding: '8px 16px' }}>
                    {error}
                  </IonText>
                )}

                <IonButton
                  expand="block"
                  type="submit"
                  style={{ marginTop: 16 }}
                  disabled={loading}
                >
                  {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Register'}
                </IonButton>

                {mode === 'register' && (
                  <IonNote style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>
                    First user becomes admin
                  </IonNote>
                )}
              </form>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}
