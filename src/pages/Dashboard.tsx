import { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonIcon, IonFab, IonFabButton, IonModal, IonItem, IonInput, IonLabel,
  IonSelect, IonSelectOption, IonSegment, IonSegmentButton, IonSearchbar
} from '@ionic/react';
import { 
  add, logOut, trash, settings, filterOutline, pencil, folder, 
  folderOpen, search, statsChart, flame, documents, colorPalette
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { api, useAuth } from '../App';
import { 
  getTypeIcon, ClapperboardIcon, QuillIcon, BookOpenIcon, PenNibIcon 
} from '../components/Icons';

interface Script {
  id: string;
  title: string;
  type: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  shareToken?: string;
}

interface Folder {
  id: string;
  name: string;
}

interface WritingStats {
  dailyWords: Record<string, number>;
  streak: number;
  totalWords: number;
}

interface SearchResult {
  id: string;
  title: string;
  type: string;
  matches: { type: string; text: string }[];
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

const THEMES = [
  { id: 'dark', name: 'Dark', bg: '#0d0d0f', text: '#f5f5f7' },
  { id: 'light', name: 'Light', bg: '#ffffff', text: '#1a1a1e' },
  { id: 'sepia', name: 'Sepia', bg: '#f4ecd8', text: '#5c4b37' },
  { id: 'midnight', name: 'Midnight', bg: '#1a1a2e', text: '#eaeaea' }
];

export default function Dashboard() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [stats, setStats] = useState<WritingStats | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('feature');
  const [newFolderId, setNewFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [category, setCategory] = useState<'screenplay' | 'poetry' | 'fiction'>('screenplay');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const history = useHistory();
  const { user, setUser } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const catTypes = CATEGORIES[category].types;
    if (!catTypes.includes(newType)) setNewType(catTypes[0]);
  }, [category]);

  const loadData = async () => {
    const [scriptsRes, foldersRes, statsRes] = await Promise.all([
      api<{ scripts: Script[] }>('/scripts'),
      api<{ folders: Folder[] }>('/folders'),
      api<{ stats: WritingStats }>('/stats')
    ]);
    if (scriptsRes.scripts) setScripts(scriptsRes.scripts);
    if (foldersRes.folders) setFolders(foldersRes.folders);
    if (statsRes.stats) setStats(statsRes.stats);
  };

  const createScript = async () => {
    if (!newTitle.trim()) return;
    const res = await api<{ script: Script }>('/scripts', {
      method: 'POST',
      body: { title: newTitle, type: newType, folderId: newFolderId } as any
    });
    if (res.script) {
      setScripts(prev => [res.script, ...prev]);
      setShowNew(false);
      setNewTitle('');
      setNewFolderId(null);
      history.push('/editor/' + res.script.id);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const res = await api<{ folder: Folder }>('/folders', {
      method: 'POST',
      body: { name: newFolderName } as any
    });
    if (res.folder) {
      setFolders(prev => [...prev, res.folder].sort((a, b) => a.name.localeCompare(b.name)));
      setShowNewFolder(false);
      setNewFolderName('');
    }
  };

  const deleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this folder? Scripts inside will be moved out.')) return;
    setFolders(prev => prev.filter(f => f.id !== id));
    setScripts(prev => prev.map(s => s.folderId === id ? { ...s, folderId: null } : s));
    if (selectedFolder === id) setSelectedFolder(null);
    await api('/folders/' + id, { method: 'DELETE' });
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
    await api('/scripts/' + editingId, { method: 'PUT', body: { title: editTitle.trim() } as any });
    setEditingId(null);
    setEditTitle('');
  };

  const doSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const res = await api<{ results: SearchResult[] }>('/scripts/search?q=' + encodeURIComponent(q));
    setSearchResults(res.results || []);
    setSearching(false);
  };

  const changeTheme = async (themeId: string) => {
    document.body.setAttribute('data-theme', themeId);
    await api('/preferences', { method: 'PUT', body: { theme: themeId } as any });
    setShowThemes(false);
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
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

  const today = new Date().toISOString().split('T')[0];
  const todayWords = stats?.dailyWords?.[today] || 0;

  let filteredScripts = scripts;
  if (selectedFolder !== null) {
    filteredScripts = filteredScripts.filter(s => s.folderId === selectedFolder);
  }
  if (filterType !== 'all') {
    filteredScripts = filteredScripts.filter(s => s.type === filterType);
  }

  const totalWords = scripts.reduce((sum, s) => sum + (s.wordCount || 0), 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <img src="/logo.png" alt="HoboDraft" style={{ height: 32, verticalAlign: 'middle' }} />
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowSearch(true)}><IonIcon icon={search} /></IonButton>
            <IonButton onClick={() => setShowStats(true)}><IonIcon icon={statsChart} /></IonButton>
            <IonButton onClick={() => setShowThemes(true)}><IonIcon icon={colorPalette} /></IonButton>
            {user?.role === 'admin' && <IonButton onClick={() => history.push('/admin')}><IonIcon icon={settings} /></IonButton>}
            <IonButton onClick={logout}><IonIcon icon={logOut} /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Stats Banner */}
        {stats && (
          <div className="stats-banner">
            <div className="stat-item">
              <IonIcon icon={documents} />
              <span>{scripts.length} scripts</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{totalWords.toLocaleString()}</span>
              <span>total words</span>
            </div>
            {stats.streak > 0 && (
              <div className="stat-item streak">
                <IonIcon icon={flame} />
                <span>{stats.streak} day streak</span>
              </div>
            )}
            {todayWords > 0 && (
              <div className="stat-item today">
                <span>{todayWords.toLocaleString()} words today</span>
              </div>
            )}
          </div>
        )}

        {/* Folders */}
        <div className="folders-bar">
          <button className={`folder-chip ${selectedFolder === null ? 'active' : ''}`} onClick={() => setSelectedFolder(null)}>
            <IonIcon icon={documents} /> All
          </button>
          {folders.map(f => (
            <button key={f.id} className={`folder-chip ${selectedFolder === f.id ? 'active' : ''}`} onClick={() => setSelectedFolder(f.id)}>
              <IonIcon icon={selectedFolder === f.id ? folderOpen : folder} />
              {f.name}
              <span className="folder-count">{scripts.filter(s => s.folderId === f.id).length}</span>
              <span className="folder-delete" onClick={(e) => deleteFolder(f.id, e)}>&times;</span>
            </button>
          ))}
          <button className="folder-chip add-folder" onClick={() => setShowNewFolder(true)}>
            <IonIcon icon={add} /> New Folder
          </button>
        </div>

        {/* Filter */}
        <div className="dashboard-filter-bar">
          <div className="filter-select-wrapper">
            <IonIcon icon={filterOutline} className="filter-icon" />
            <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <optgroup label="Screenplay">
                {CATEGORIES.screenplay.types.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </optgroup>
              <optgroup label="Poetry">
                {CATEGORIES.poetry.types.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </optgroup>
              <optgroup label="Fiction">
                {CATEGORIES.fiction.types.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </optgroup>
            </select>
          </div>
          <span className="script-count">{filteredScripts.length} {filteredScripts.length === 1 ? 'script' : 'scripts'}</span>
        </div>

        {/* Scripts Grid */}
        {filteredScripts.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <PenNibIcon size={48} color="#6366f1" />
            <h2>{filterType === 'all' ? 'No scripts yet' : `No ${TYPE_LABELS[filterType]} scripts`}</h2>
            <p style={{ color: '#888' }}>Tap + to create your first script</p>
          </div>
        ) : (
          <div className="scripts-grid">
            {filteredScripts.map(s => (
              <div key={s.id} className="script-card" onClick={() => history.push('/editor/' + s.id)}>
                <div className="script-card-top">
                  <span className="script-type-icon">{getTypeIcon(s.type, 32, '#1a1a1e')}</span>
                  <h3>{s.title}</h3>
                  {s.wordCount > 0 && <span className="word-count-badge">{s.wordCount.toLocaleString()} words</span>}
                </div>
                <div className="script-card-bottom">
                  <div className="script-meta">
                    <span className="script-type-label">{TYPE_LABELS[s.type] || s.type}</span>
                    <div className="script-dates"><span>Edited {formatDate(s.updatedAt)}</span></div>
                  </div>
                  <div className="card-actions">
                    <button className="edit-btn" onClick={(e) => startEdit(s, e)}><IonIcon icon={pencil} /></button>
                    <button className="delete-btn" onClick={(e) => deleteScript(s.id, e)}><IonIcon icon={trash} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowNew(true)}><IonIcon icon={add} /></IonFabButton>
        </IonFab>

        {/* Search Modal */}
        <IonModal isOpen={showSearch} onDidDismiss={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
          <IonHeader><IonToolbar><IonTitle>Search Scripts</IonTitle><IonButtons slot="end"><IonButton onClick={() => setShowSearch(false)}>Close</IonButton></IonButtons></IonToolbar></IonHeader>
          <IonContent className="ion-padding">
            <IonSearchbar value={searchQuery} onIonInput={e => doSearch(e.detail.value || '')} placeholder="Search all scripts..." debounce={300} />
            {searching && <p style={{ textAlign: 'center', color: '#888' }}>Searching...</p>}
            <div className="search-results">
              {searchResults.map(r => (
                <div key={r.id} className="search-result" onClick={() => { setShowSearch(false); history.push('/editor/' + r.id); }}>
                  <div className="search-result-header">
                    {getTypeIcon(r.type, 20, '#6366f1')}
                    <strong>{r.title}</strong>
                  </div>
                  {r.matches.slice(0, 3).map((m, i) => (
                    <p key={i} className="search-match">...{m.text.slice(0, 100)}...</p>
                  ))}
                </div>
              ))}
              {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                <p style={{ textAlign: 'center', color: '#888' }}>No results found</p>
              )}
            </div>
          </IonContent>
        </IonModal>

        {/* Stats Modal */}
        <IonModal isOpen={showStats} onDidDismiss={() => setShowStats(false)}>
          <IonHeader><IonToolbar><IonTitle>Writing Stats</IonTitle><IonButtons slot="end"><IonButton onClick={() => setShowStats(false)}>Close</IonButton></IonButtons></IonToolbar></IonHeader>
          <IonContent className="ion-padding">
            <div className="stats-grid">
              <div className="stats-card"><h2>{scripts.length}</h2><p>Total Scripts</p></div>
              <div className="stats-card"><h2>{totalWords.toLocaleString()}</h2><p>Total Words</p></div>
              <div className="stats-card"><h2>{stats?.streak || 0}</h2><p>Day Streak</p></div>
              <div className="stats-card"><h2>{todayWords.toLocaleString()}</h2><p>Words Today</p></div>
            </div>
            <h3 style={{ marginTop: 24 }}>Recent Activity</h3>
            <div className="activity-chart">
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0];
                const words = stats?.dailyWords?.[d] || 0;
                const maxWords = Math.max(...Object.values(stats?.dailyWords || { x: 100 }), 100);
                const height = Math.max(4, (words / maxWords) * 100);
                return (
                  <div key={d} className="activity-bar-container">
                    <div className="activity-bar" style={{ height: `${height}%` }} title={`${words} words`} />
                    <span className="activity-day">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d).getDay()]}</span>
                  </div>
                );
              })}
            </div>
          </IonContent>
        </IonModal>

        {/* Themes Modal */}
        <IonModal isOpen={showThemes} onDidDismiss={() => setShowThemes(false)}>
          <IonHeader><IonToolbar><IonTitle>Choose Theme</IonTitle><IonButtons slot="end"><IonButton onClick={() => setShowThemes(false)}>Close</IonButton></IonButtons></IonToolbar></IonHeader>
          <IonContent className="ion-padding">
            <div className="themes-grid">
              {THEMES.map(t => (
                <button key={t.id} className="theme-card" onClick={() => changeTheme(t.id)} style={{ background: t.bg, color: t.text }}>
                  <span className="theme-name">{t.name}</span>
                  <span className="theme-preview">Aa</span>
                </button>
              ))}
            </div>
          </IonContent>
        </IonModal>

        {/* Edit Title Modal */}
        <IonModal isOpen={!!editingId} onDidDismiss={() => setEditingId(null)}>
          <IonHeader><IonToolbar><IonTitle>Rename Script</IonTitle><IonButtons slot="end"><IonButton onClick={() => setEditingId(null)}>Cancel</IonButton></IonButtons></IonToolbar></IonHeader>
          <IonContent className="ion-padding">
            <IonItem><IonInput label="Title" labelPlacement="stacked" value={editTitle} onIonInput={e => setEditTitle(e.detail.value || '')} onKeyDown={e => e.key === 'Enter' && saveEdit()} /></IonItem>
            <IonButton expand="block" onClick={saveEdit} style={{ marginTop: 24 }}>Save</IonButton>
          </IonContent>
        </IonModal>

        {/* New Folder Modal */}
        <IonModal isOpen={showNewFolder} onDidDismiss={() => setShowNewFolder(false)}>
          <IonHeader><IonToolbar><IonTitle>New Folder</IonTitle><IonButtons slot="end"><IonButton onClick={() => setShowNewFolder(false)}>Cancel</IonButton></IonButtons></IonToolbar></IonHeader>
          <IonContent className="ion-padding">
            <IonItem><IonInput label="Folder Name" labelPlacement="stacked" value={newFolderName} onIonInput={e => setNewFolderName(e.detail.value || '')} onKeyDown={e => e.key === 'Enter' && createFolder()} /></IonItem>
            <IonButton expand="block" onClick={createFolder} style={{ marginTop: 24 }}>Create Folder</IonButton>
          </IonContent>
        </IonModal>

        {/* New Script Modal */}
        <IonModal isOpen={showNew} onDidDismiss={() => setShowNew(false)}>
          <IonHeader><IonToolbar><IonTitle>New Script</IonTitle><IonButtons slot="end"><IonButton onClick={() => setShowNew(false)}>Cancel</IonButton></IonButtons></IonToolbar></IonHeader>
          <IonContent className="ion-padding">
            <div className="category-selector dark-segment">
              <h3>Category</h3>
              <div className="dark-segment-container">
                <IonSegment value={category} onIonChange={e => setCategory(e.detail.value as any)}>
                  <IonSegmentButton value="screenplay"><div className="segment-icon"><ClapperboardIcon size={24} /></div><IonLabel>Screenplay</IonLabel></IonSegmentButton>
                  <IonSegmentButton value="poetry"><div className="segment-icon"><QuillIcon size={24} /></div><IonLabel>Poetry</IonLabel></IonSegmentButton>
                  <IonSegmentButton value="fiction"><div className="segment-icon"><BookOpenIcon size={24} /></div><IonLabel>Fiction</IonLabel></IonSegmentButton>
                </IonSegment>
              </div>
            </div>
            <IonItem><IonInput label="Title" labelPlacement="stacked" placeholder="My Awesome Script" value={newTitle} onIonInput={e => setNewTitle(e.detail.value || '')} /></IonItem>
            <IonItem>
              <IonSelect label="Format" labelPlacement="stacked" value={newType} onIonChange={e => setNewType(e.detail.value)}>
                {CATEGORIES[category].types.map(t => <IonSelectOption key={t} value={t}>{TYPE_LABELS[t]}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
            {folders.length > 0 && (
              <IonItem>
                <IonSelect label="Folder (optional)" labelPlacement="stacked" value={newFolderId} onIonChange={e => setNewFolderId(e.detail.value)} placeholder="No folder">
                  <IonSelectOption value={null}>No folder</IonSelectOption>
                  {folders.map(f => <IonSelectOption key={f.id} value={f.id}>{f.name}</IonSelectOption>)}
                </IonSelect>
              </IonItem>
            )}
            <IonButton expand="block" onClick={createScript} style={{ marginTop: 24 }}>Create</IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
