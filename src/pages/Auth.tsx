import { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent,
  IonItem, IonInput, IonButton, IonSegment, IonSegmentButton, IonLabel, IonIcon,
  IonCheckbox
} from '@ionic/react';
import { api, useAuth } from '../App';
import { timeOutline } from 'ionicons/icons';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const { setUser } = useAuth();

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    if (mode === 'register' && !disclaimerAccepted) {
      setError('You must accept the disclaimer to create an account');
      return;
    }
    
    setLoading(true);
    setError('');

    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    const res = await api<{ success?: boolean; user?: any; error?: string; pending?: boolean; message?: string }>(endpoint, {
      method: 'POST',
      body: { username, password } as any
    });

    setLoading(false);
    
    if (res.success && res.pending) {
      setPendingApproval(true);
      return;
    }
    
    if (res.success && res.user) {
      setUser(res.user);
      window.location.href = '/dashboard';
    } else {
      setError(res.error || 'Something went wrong');
    }
  };

  const resetForm = () => {
    setPendingApproval(false);
    setUsername('');
    setPassword('');
    setMode('login');
    setDisclaimerAccepted(false);
  };

  const canSubmit = mode === 'login' || (mode === 'register' && disclaimerAccepted);

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
            <img src="/logo.png" alt="HoboDraft" style={{ maxWidth: 280, height: 'auto' }} />
          </div>

          {pendingApproval ? (
            <IonCard style={{ marginTop: 24 }}>
              <IonCardContent style={{ textAlign: 'center', padding: 32 }}>
                <IonIcon icon={timeOutline} style={{ fontSize: 64, color: '#f59e0b', marginBottom: 16 }} />
                <h2 style={{ margin: '0 0 16px', color: '#f5f5f7' }}>Pending Approval</h2>
                <p style={{ color: '#a1a1a6', marginBottom: 24 }}>
                  Your account has been created and is awaiting admin approval. 
                  You'll be able to sign in once approved.
                </p>
                <IonButton expand="block" fill="outline" onClick={resetForm}>
                  Back to Sign In
                </IonButton>
              </IonCardContent>
            </IonCard>
          ) : (
            <>
              <div style={{ marginTop: 16 }}>
                <IonSegment value={mode} onIonChange={e => { setMode(e.detail.value as 'login' | 'register'); setError(''); }}>
                  <IonSegmentButton value="login"><IonLabel>Sign In</IonLabel></IonSegmentButton>
                  <IonSegmentButton value="register"><IonLabel>Sign Up</IonLabel></IonSegmentButton>
                </IonSegment>
              </div>

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

                  {mode === 'register' && (
                    <div className="disclaimer-box">
                      <label className="disclaimer-label">
                        <input
                          type="checkbox"
                          checked={disclaimerAccepted}
                          onChange={e => setDisclaimerAccepted(e.target.checked)}
                          className="disclaimer-checkbox"
                        />
                        <span className="disclaimer-text">
                          I understand that this web app is <strong>fully AI vibe coded</strong> and 
                          any loss of data is my own responsibility for entrusting said fully AI vibe coded web app.
                        </span>
                      </label>
                    </div>
                  )}

                  {error && <p style={{ color: 'var(--ion-color-danger)', padding: '16px 0 0', margin: 0 }}>{error}</p>}

                  <IonButton 
                    expand="block" 
                    onClick={handleSubmit} 
                    disabled={loading || !canSubmit} 
                    style={{ marginTop: 24 }}
                  >
                    {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                  </IonButton>
                  
                  {mode === 'register' && (
                    <p style={{ color: '#6a6a6e', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
                      New accounts require admin approval before you can sign in.
                    </p>
                  )}
                </IonCardContent>
              </IonCard>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
