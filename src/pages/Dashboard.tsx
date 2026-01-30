import { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonIcon, IonFab, IonFabButton, IonModal, IonItem, IonInput, IonLabel,
  IonSelect, IonSelectOption, IonSegment, IonSegmentButton
} from '@ionic/react';
import { add, logOut, trash, settings, filterOutline, pencil } from 'ionicons/icons';
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
  createdAt: string;
  updatedAt: string;
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
  const [filterType, setFilterType] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
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
      setScripts(prev => [res.script, ...prev]);
      setShowNew(false);
      setNewTitle('');
      history.push('/editor/' + res.script.id);
    }
  };

  const deleteScript = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this script?')) return;
    setScripts(prev => prev.filter(s => s.id !== id));
    await api('/scripts/' + id, { method: 'DELETE' });
  };

  const startEdit = (script: Script, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(script.id);
    setEditTitle(script.title);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    setScripts(prev => prev.map(s => s.id === editingId ? { ...s, title: editTitle.trim() } : s));
    await api('/scripts/' + editingId, {
      method: 'PUT',
      body: { title: editTitle.trim() } as any
    });
    setEditingId(null);
    setEditTitle('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    // Use window.location to avoid React Router state update conflicts
    window.location.href = '/auth';
  };

  const formatDate = (d: string) => {
    if (!d) return 'Just now';
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'Just now';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const filteredScripts = filterType === 'all' 
    ? scripts 
    : scripts.filter(s => s.type === filterType);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <img src="/logo.png" alt="HoboDraft" style={{ height: 32, verticalAlign: 'middle' }} />
          </IonTitle>
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
        <div className="dashboard-filter-bar">
          <div className="filter-select-wrapper">
            <IonIcon icon={filterOutline} className="filter-icon" />
            <select 
              className="filter-select"
              value={filterType} 
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="all">All Scripts</option>
              <optgroup label="Screenplay">
                {CATEGORIES.screenplay.types.map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </optgroup>
              <optgroup label="Poetry">
                {CATEGORIES.poetry.types.map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </optgroup>
              <optgroup label="Fiction">
                {CATEGORIES.fiction.types.map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <span className="script-count">
            {filteredScripts.length} {filteredScripts.length === 1 ? 'script' : 'scripts'}
          </span>
        </div>

        {filteredScripts.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <PenNibIcon size={48} color="#6366f1" />
            </div>
            <h2>{filterType === 'all' ? 'No scripts yet' : `No ${TYPE_LABELS[filterType] || filterType} scripts`}</h2>
            <p style={{ color: '#888' }}>Tap + to create your first script</p>
          </div>
        ) : (
          <div className="scripts-grid">
            {filteredScripts.map(s => (
              <div key={s.id} className="script-card" onClick={() => history.push('/editor/' + s.id)}>
                <div className="script-card-top">
                  <span className="script-type-icon">{getTypeIcon(s.type, 32, '#1a1a1e')}</span>
                  <h3>{s.title}</h3>
                </div>
                <div className="script-card-bottom">
                  <div className="script-meta">
                    <span className="script-type-label">{TYPE_LABELS[s.type] || s.type}</span>
                    <div className="script-dates">
                      <span>Edited {formatDate(s.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button className="edit-btn" onClick={(e) => startEdit(s, e)}>
                      <IonIcon icon={pencil} />
                    </button>
                    <button className="delete-btn" onClick={(e) => deleteScript(s.id, e)}>
                      <IonIcon icon={trash} />
                    </button>
                  </div>
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

        {/* Edit Title Modal */}
        <IonModal isOpen={!!editingId} onDidDismiss={cancelEdit}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Rename Script</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={cancelEdit}>Cancel</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonInput
                label="Title"
                labelPlacement="stacked"
                placeholder="Enter new title"
                value={editTitle}
                onIonInput={e => setEditTitle(e.detail.value || '')}
                onKeyDown={e => e.key === 'Enter' && saveEdit()}
              />
            </IonItem>
            <IonButton expand="block" onClick={saveEdit} style={{ marginTop: 24 }}>
              Save
            </IonButton>
          </IonContent>
        </IonModal>

        {/* New Script Modal */}
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
            <div className="category-selector dark-segment">
              <h3>Category</h3>
              <div className="dark-segment-container">
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
