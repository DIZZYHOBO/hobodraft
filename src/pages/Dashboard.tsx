import { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonIcon, IonFab, IonFabButton, IonModal, IonItem, IonInput, IonLabel,
  IonSelect, IonSelectOption, IonSegment, IonSegmentButton
} from '@ionic/react';
import { add, logOut, trash, settings } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { api, useAuth } from '../App';
import { 
  getTypeIcon, 
  ClapperboardIcon, 
  QuillIcon, 
  BookOpenIcon, 
  PenNibIcon 
} from '../components/Icons';

interface Script {
  id: string;
  title: string;
  type: string;
  created_at: string;
  updated_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  'feature': 'Feature Film', 'short': 'Short Film', 'tv-pilot': 'TV Pilot', 'tv-episode': 'TV Episode',
  'poetry': 'Poetry', 'poem': 'Poetry', 'fiction': 'Fiction', 'novel': 'Novel', 'short-story': 'Short Story'
};

const CATEGORIES = {
  screenplay: { label: 'Screenplay', types: ['feature', 'short', 'tv-pilot', 'tv-episode'] },
  poetry: { label: 'Poetry', types: ['poetry'] },
  fiction: { label: 'Fiction', types: ['fiction', 'novel', 'short-story'] }
};

export default function Dashboard() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('feature');
  const [category, setCategory] = useState<'screenplay' | 'poetry' | 'fiction'>('screenplay');
  const history = useHistory();
  const { user, setUser } = useAuth();

  useEffect(() => {
    loadScripts();
  }, []);

  useEffect(() => {
    const catTypes = CATEGORIES[category].types;
    if (!catTypes.includes(newType)) {
      setNewType(catTypes[0]);
    }
  }, [category]);

  const loadScripts = async () => {
    const res = await api<{ scripts: Script[] }>('/scripts');
    if (res.scripts) setScripts(res.scripts);
  };

  const createScript = async () => {
    if (!newTitle.trim()) return;
    const res = await api<{ script: Script }>('/scripts', {
      method: 'POST',
      body: { title: newTitle, type: newType } as any
    });
    if (res.script) {
      setShowNew(false);
      setNewTitle('');
      history.push('/editor/' + res.script.id);
    }
  };

  const deleteScript = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this script?')) return;
    await api('/scripts/' + id, { method: 'DELETE' });
    loadScripts();
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    history.push('/auth');
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>My Scripts</IonTitle>
          <IonButtons slot="end">
            {user?.role === 'admin' && (
              <IonButton onClick={() => history.push('/admin')}>
                <IonIcon icon={settings} />
              </IonButton>
            )}
            <IonButton onClick={logout}>
              <IonIcon icon={logOut} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {scripts.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <PenNibIcon size={48} color="#6366f1" />
            </div>
            <h2>No scripts yet</h2>
            <p style={{ color: '#888' }}>Tap + to create your first script</p>
          </div>
        ) : (
          <div className="scripts-grid">
            {scripts.map(s => (
              <div key={s.id} className="script-card" onClick={() => history.push('/editor/' + s.id)}>
                <div className="script-card-top">
                  <span className="script-type-icon">{getTypeIcon(s.type, 32, '#1a1a1e')}</span>
                  <h3>{s.title}</h3>
                </div>
                <div className="script-card-bottom">
                  <div className="script-meta">
                    <span className="script-type-label">{TYPE_LABELS[s.type] || s.type}</span>
                    <div className="script-dates">
                      <span>Edited {formatDate(s.updated_at)}</span>
                    </div>
                  </div>
                  <button className="delete-btn" onClick={(e) => deleteScript(s.id, e)}>
                    <IonIcon icon={trash} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowNew(true)}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <IonModal isOpen={showNew} onDidDismiss={() => setShowNew(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>New Script</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowNew(false)}>Cancel</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <div className="category-selector">
              <h3>Category</h3>
              <IonSegment value={category} onIonChange={e => setCategory(e.detail.value as any)}>
                <IonSegmentButton value="screenplay">
                  <div className="segment-icon"><ClapperboardIcon size={24} /></div>
                  <IonLabel>Screenplay</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="poetry">
                  <div className="segment-icon"><QuillIcon size={24} /></div>
                  <IonLabel>Poetry</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="fiction">
                  <div className="segment-icon"><BookOpenIcon size={24} /></div>
                  <IonLabel>Fiction</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </div>

            <IonItem>
              <IonInput
                label="Title"
                labelPlacement="stacked"
                placeholder="My Awesome Script"
                value={newTitle}
                onIonInput={e => setNewTitle(e.detail.value || '')}
              />
            </IonItem>

            <IonItem>
              <IonSelect
                label="Format"
                labelPlacement="stacked"
                value={newType}
                onIonChange={e => setNewType(e.detail.value)}
              >
                {CATEGORIES[category].types.map(t => (
                  <IonSelectOption key={t} value={t}>{TYPE_LABELS[t]}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonButton expand="block" onClick={createScript} style={{ marginTop: 24 }}>
              Create
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
