import React, { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonFab, IonFabButton, IonIcon, IonModal, IonItem, IonInput, IonSelect,
  IonSelectOption, IonList, IonAlert, IonRefresher, IonRefresherContent,
  IonPopover, IonSegment, IonSegmentButton, IonLabel
} from '@ionic/react';
import { add, person, shield, trash, document, create, book } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useAuth, api } from '../App';

interface Script {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t === 'poetry' || t === 'poem') return '📝';
  if (t === 'fiction' || t === 'novel' || t === 'short-story') return '📖';
  return '🎬';
}

function getTypeLabel(type: string) {
  const t = type.toLowerCase();
  if (t === 'poetry' || t === 'poem') return 'Poetry';
  if (t === 'fiction' || t === 'novel' || t === 'short-story') return 'Fiction';
  if (t === 'feature') return 'Feature Film';
  if (t === 'tv') return 'TV Episode';
  if (t === 'short') return 'Short Film';
  return type;
}

export default function Dashboard() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'screenplay' | 'poetry' | 'fiction'>('screenplay');
  const [newType, setNewType] = useState('feature');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { user, setUser } = useAuth();
  const history = useHistory();

  const loadScripts = async () => {
    const res = await api<{ scripts: Script[] }>('/scripts');
    setScripts(res.scripts || []);
  };

  useEffect(() => { loadScripts(); }, []);

  // Update type when category changes
  useEffect(() => {
    if (newCategory === 'screenplay') setNewType('feature');
    else if (newCategory === 'poetry') setNewType('poetry');
    else if (newCategory === 'fiction') setNewType('fiction');
  }, [newCategory]);

  const createScript = async () => {
    const res = await api<{ script: Script }>('/scripts', {
      method: 'POST',
      body: { title: newTitle || 'Untitled', type: newType } as any
    });
    if (res.script) {
      setShowNew(false);
      setNewTitle('');
      history.push('/editor/' + res.script.id);
    }
  };

  const deleteScript = async () => {
    if (!deleteId) return;
    await api('/scripts/' + deleteId, { method: 'DELETE' });
    setDeleteId(null);
    loadScripts();
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    history.replace('/auth');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>HoboDraft</IonTitle>
          <IonButtons slot="end">
            {user?.role === 'admin' && (
              <IonButton onClick={() => history.push('/admin')}>
                <IonIcon icon={shield} />
              </IonButton>
            )}
            <IonButton id="user-menu">
              <IonIcon icon={person} />
            </IonButton>
            <IonPopover trigger="user-menu" dismissOnSelect>
              <IonContent>
                <IonList>
                  <IonItem lines="none">
                    <strong>{user?.username}</strong>
                  </IonItem>
                  <IonItem button onClick={logout}>Sign Out</IonItem>
                </IonList>
              </IonContent>
            </IonPopover>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={e => { loadScripts().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="ion-padding">
          <h2>Welcome, {user?.username}</h2>
          
          {scripts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>
              <p>No projects yet</p>
              <IonButton onClick={() => setShowNew(true)}>Create Your First Project</IonButton>
            </div>
          ) : (
            <div className="scripts-grid">
              {scripts.map(script => (
                <div key={script.id} className="script-card" onClick={() => history.push('/editor/' + script.id)}>
                  <div className="script-card-top">
                    <span className="script-type-icon">{getTypeIcon(script.type)}</span>
                    <h3>{script.title}</h3>
                  </div>
                  <div className="script-card-bottom">
                    <div className="script-meta">
                      <span className="script-type-label">{getTypeLabel(script.type)}</span>
                      <div className="script-dates">
                        <span>Created: {formatDate(script.createdAt)}</span>
                        <span>Edited: {formatDate(script.updatedAt)}</span>
                      </div>
                    </div>
                    <button 
                      className="delete-btn"
                      onClick={e => { e.stopPropagation(); setDeleteId(script.id); }}
                    >
                      <IonIcon icon={trash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowNew(true)}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <IonModal isOpen={showNew} onDidDismiss={() => setShowNew(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>New Project</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowNew(false)}>Cancel</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonInput
                label="Title"
                labelPlacement="floating"
                value={newTitle}
                onIonInput={e => setNewTitle(e.detail.value || '')}
                placeholder="Untitled"
              />
            </IonItem>

            <div className="category-selector">
              <h3>What are you writing?</h3>
              <IonSegment value={newCategory} onIonChange={e => setNewCategory(e.detail.value as any)}>
                <IonSegmentButton value="screenplay">
                  <IonLabel>
                    <div className="segment-icon">🎬</div>
                    Screenplay
                  </IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="poetry">
                  <IonLabel>
                    <div className="segment-icon">📝</div>
                    Poetry
                  </IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="fiction">
                  <IonLabel>
                    <div className="segment-icon">📖</div>
                    Fiction
                  </IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </div>

            {newCategory === 'screenplay' && (
              <IonItem>
                <IonSelect
                  label="Format"
                  labelPlacement="floating"
                  value={newType}
                  onIonChange={e => setNewType(e.detail.value)}
                >
                  <IonSelectOption value="feature">Feature Film</IonSelectOption>
                  <IonSelectOption value="tv">TV Episode</IonSelectOption>
                  <IonSelectOption value="short">Short Film</IonSelectOption>
                </IonSelect>
              </IonItem>
            )}

            {newCategory === 'fiction' && (
              <IonItem>
                <IonSelect
                  label="Format"
                  labelPlacement="floating"
                  value={newType}
                  onIonChange={e => setNewType(e.detail.value)}
                >
                  <IonSelectOption value="fiction">Novel</IonSelectOption>
                  <IonSelectOption value="short-story">Short Story</IonSelectOption>
                </IonSelect>
              </IonItem>
            )}

            <IonButton expand="block" style={{ marginTop: 24 }} onClick={createScript}>
              Create Project
            </IonButton>
          </IonContent>
        </IonModal>

        <IonAlert
          isOpen={!!deleteId}
          header="Delete Project?"
          message="This cannot be undone."
          buttons={[
            { text: 'Cancel', role: 'cancel', handler: () => setDeleteId(null) },
            { text: 'Delete', role: 'destructive', handler: deleteScript }
          ]}
        />
      </IonContent>
    </IonPage>
  );
}
