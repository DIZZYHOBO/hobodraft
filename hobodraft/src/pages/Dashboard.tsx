import { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonIcon, IonFab, IonFabButton
} from '@ionic/react';
import { 
  add, logOut, trash, settings, filterOutline, pencil, folder, 
  folderOpen, search, statsChart, flame, documents, colorPalette, close
} from 'ionicons/icons';
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
  const [modal, setModal] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('feature');
  const [newFolderId, setNewFolderId] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState('');
  const [category, setCategory] = useState<'screenplay' | 'poetry' | 'fiction'>('screenplay');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const { user } = useAuth();

  useEffect(() => { loadData(); }, []);

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
      body: { title: newTitle, type: newType, folderId: newFolderId || null } as any
    });
    if (res.script) {
      setScripts(prev => [res.script, ...prev]);
      setModal(null);
      setNewTitle('');
      setNewFolderId('');
      window.location.href = '/editor/' + res.script.id;
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
      setModal(null);
      setNewFolderName('');
    }
  };

  const deleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this folder?')) return;
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
    setModal('edit');
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    setScripts(prev => prev.map(s => s.id === editingId ? { ...s, title: editTitle.trim() } : s));
    await api('/scripts/' + editingId, { method: 'PUT', body: { title: editTitle.trim() } as any });
    setModal(null);
    setEditingId(null);
  };

  const doSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const res = await api<{ results: SearchResult[] }>('/scripts/search?q=' + encodeURIComponent(q));
    setSearchResults(res.results || []);
  };

  const changeTheme = async (themeId: string) => {
    document.body.setAttribute('data-theme', themeId);
    await api('/preferences', { method: 'PUT', body: { theme: themeId } as any });
    setModal(null);
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = '/auth';
  };

  const goToEditor = (id: string) => { window.location.href = '/editor/' + id; };

  const formatDate = (d: string) => {
    if (!d) return 'Just now';
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'Just now';
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const today = new Date().toISOString().split('T')[0];
  const todayWords = stats?.dailyWords?.[today] || 0;

  let filteredScripts = scripts;
  if (selectedFolder !== null) filteredScripts = filteredScripts.filter(s => s.folderId === selectedFolder);
  if (filterType !== 'all') filteredScripts = filteredScripts.filter(s => s.type === filterType);

  const totalWords = scripts.reduce((sum, s) => sum + (s.wordCount || 0), 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle><img src="/logo.png" alt="HoboDraft" style={{ height: 32, verticalAlign: 'middle' }} /></IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setModal('search')}><IonIcon icon={search} /></IonButton>
            <IonButton onClick={() => setModal('stats')}><IonIcon icon={statsChart} /></IonButton>
            <IonButton onClick={() => setModal('themes')}><IonIcon icon={colorPalette} /></IonButton>
            {user?.role === 'admin' && <IonButton onClick={() => window.location.href = '/admin'}><IonIcon icon={settings} /></IonButton>}
            <IonButton onClick={logout}><IonIcon icon={logOut} /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {stats && (
          <div className="stats-banner">
            <div className="stat-item"><IonIcon icon={documents} /><span>{scripts.length} scripts</span></div>
            <div className="stat-item"><span className="stat-number">{totalWords.toLocaleString()}</span><span>total words</span></div>
            {stats.streak > 0 && <div className="stat-item streak"><IonIcon icon={flame} /><span>{stats.streak} day streak</span></div>}
            {todayWords > 0 && <div className="stat-item today"><span>{todayWords.toLocaleString()} words today</span></div>}
          </div>
        )}

        <div className="folders-bar">
          <button className={`folder-chip ${selectedFolder === null ? 'active' : ''}`} onClick={() => setSelectedFolder(null)}>
            <IonIcon icon={documents} /> All
          </button>
          {folders.map(f => (
            <button key={f.id} className={`folder-chip ${selectedFolder === f.id ? 'active' : ''}`} onClick={() => setSelectedFolder(f.id)}>
              <IonIcon icon={selectedFolder === f.id ? folderOpen : folder} />{f.name}
              <span className="folder-count">{scripts.filter(s => s.folderId === f.id).length}</span>
              <span className="folder-delete" onClick={(e) => deleteFolder(f.id, e)}>&times;</span>
            </button>
          ))}
          <button className="folder-chip add-folder" onClick={() => setModal('newFolder')}><IonIcon icon={add} /> New Folder</button>
        </div>

        <div className="dashboard-filter-bar">
          <div className="filter-select-wrapper">
            <IonIcon icon={filterOutline} className="filter-icon" />
            <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <optgroup label="Screenplay">{CATEGORIES.screenplay.types.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</optgroup>
              <optgroup label="Poetry">{CATEGORIES.poetry.types.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</optgroup>
              <optgroup label="Fiction">{CATEGORIES.fiction.types.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</optgroup>
            </select>
          </div>
          <span className="script-count">{filteredScripts.length} {filteredScripts.length === 1 ? 'script' : 'scripts'}</span>
        </div>

        {filteredScripts.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <PenNibIcon size={48} color="#6366f1" />
            <h2>{filterType === 'all' ? 'No scripts yet' : `No ${TYPE_LABELS[filterType]} scripts`}</h2>
            <p style={{ color: '#888' }}>Tap + to create your first script</p>
          </div>
        ) : (
          <div className="scripts-grid">
            {filteredScripts.map(s => (
              <div key={s.id} className="script-card" onClick={() => goToEditor(s.id)}>
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
          <IonFabButton onClick={() => setModal('new')}><IonIcon icon={add} /></IonFabButton>
        </IonFab>

        {modal && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{modal === 'new' ? 'New Script' : modal === 'edit' ? 'Rename Script' : modal === 'newFolder' ? 'New Folder' : modal === 'search' ? 'Search Scripts' : modal === 'stats' ? 'Writing Stats' : 'Choose Theme'}</h2>
                <button className="modal-close" onClick={() => setModal(null)}><IonIcon icon={close} /></button>
              </div>
              <div className="modal-body">
                {modal === 'new' && (
                  <>
                    <div className="category-buttons">
                      <button className={category === 'screenplay' ? 'active' : ''} onClick={() => setCategory('screenplay')}><ClapperboardIcon size={20} /> Screenplay</button>
                      <button className={category === 'poetry' ? 'active' : ''} onClick={() => setCategory('poetry')}><QuillIcon size={20} /> Poetry</button>
                      <button className={category === 'fiction' ? 'active' : ''} onClick={() => setCategory('fiction')}><BookOpenIcon size={20} /> Fiction</button>
                    </div>
                    <div className="form-group">
                      <label>Title</label>
                      <input type="text" className="form-input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="My Awesome Script" autoFocus />
                    </div>
                    <div className="form-group">
                      <label>Format</label>
                      <select className="form-select" value={newType} onChange={e => setNewType(e.target.value)}>
                        {CATEGORIES[category].types.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    {folders.length > 0 && (
                      <div className="form-group">
                        <label>Folder (optional)</label>
                        <select className="form-select" value={newFolderId} onChange={e => setNewFolderId(e.target.value)}>
                          <option value="">No folder</option>
                          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                    )}
                    <button className="btn-primary" onClick={createScript}>Create</button>
                  </>
                )}
                {modal === 'edit' && (
                  <>
                    <div className="form-group">
                      <label>Title</label>
                      <input type="text" className="form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} autoFocus />
                    </div>
                    <button className="btn-primary" onClick={saveEdit}>Save</button>
                  </>
                )}
                {modal === 'newFolder' && (
                  <>
                    <div className="form-group">
                      <label>Folder Name</label>
                      <input type="text" className="form-input" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createFolder()} autoFocus />
                    </div>
                    <button className="btn-primary" onClick={createFolder}>Create Folder</button>
                  </>
                )}
                {modal === 'search' && (
                  <>
                    <div className="form-group">
                      <label>Search</label>
                      <input type="text" className="form-input" value={searchQuery} onChange={e => doSearch(e.target.value)} placeholder="Type to search..." autoFocus />
                    </div>
                    <div className="search-results">
                      {searchResults.map(r => (
                        <div key={r.id} className="search-result" onClick={() => { setModal(null); goToEditor(r.id); }}>
                          <div className="search-result-header">{getTypeIcon(r.type, 20, '#6366f1')}<strong>{r.title}</strong></div>
                          {r.matches.slice(0, 3).map((m, i) => <p key={i} className="search-match">...{m.text.slice(0, 100)}...</p>)}
                        </div>
                      ))}
                      {searchQuery.length >= 2 && searchResults.length === 0 && <p style={{ textAlign: 'center', color: '#888' }}>No results found</p>}
                    </div>
                  </>
                )}
                {modal === 'stats' && (
                  <>
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
                        return (<div key={d} className="activity-bar-container"><div className="activity-bar" style={{ height: `${height}%` }} /><span className="activity-day">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d).getDay()]}</span></div>);
                      })}
                    </div>
                  </>
                )}
                {modal === 'themes' && (
                  <div className="themes-grid">
                    {THEMES.map(t => <button key={t.id} className="theme-card" onClick={() => changeTheme(t.id)} style={{ background: t.bg, color: t.text }}><span className="theme-name">{t.name}</span><span className="theme-preview">Aa</span></button>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
