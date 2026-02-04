import { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonItem, IonInput, IonTextarea
} from '@ionic/react';
import {
  arrowBack, download, help, list, eye, eyeOff, chatbubble, share, time,
  search, checkmark, close, copy, trash, pencil
} from 'ionicons/icons';
import { useParams } from 'react-router-dom';
import { api } from '../App';

interface ScriptElement { id: string; type: string; content: string; }
interface Comment { id: string; elementId: string; text: string; color: string; resolved: boolean; }
interface Version { id: string; name: string; createdAt: string; wordCount: number; }

const SCREENPLAY_TYPES = ['scene-heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'];
const SCREENPLAY_LABELS: Record<string, string> = { 'scene-heading': 'Scene', 'action': 'Action', 'character': 'Char', 'dialogue': 'Dialog', 'parenthetical': 'Paren', 'transition': 'Trans' };
const SCREENPLAY_NEXT: Record<string, string> = { 'scene-heading': 'action', 'action': 'character', 'character': 'dialogue', 'dialogue': 'character', 'parenthetical': 'dialogue', 'transition': 'scene-heading' };

const POETRY_TYPES = ['poem-title', 'stanza', 'line', 'couplet', 'attribution'];
const POETRY_LABELS: Record<string, string> = { 'poem-title': 'Title', 'stanza': 'Stanza', 'line': 'Line', 'couplet': 'Couplet', 'attribution': 'Attrib' };
const POETRY_NEXT: Record<string, string> = { 'poem-title': 'line', 'stanza': 'line', 'line': 'line', 'couplet': 'couplet', 'attribution': 'line' };

const FICTION_TYPES = ['chapter-heading', 'paragraph', 'dialogue-fiction', 'break', 'epigraph'];
const FICTION_LABELS: Record<string, string> = { 'chapter-heading': 'Chapter', 'paragraph': 'Para', 'dialogue-fiction': 'Dialog', 'break': 'Break', 'epigraph': 'Epigraph' };
const FICTION_NEXT: Record<string, string> = { 'chapter-heading': 'paragraph', 'paragraph': 'paragraph', 'dialogue-fiction': 'paragraph', 'break': 'paragraph', 'epigraph': 'paragraph' };

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function countLineSyllables(line: string): number {
  return line.split(/\s+/).filter(w => w.length > 0).reduce((sum, w) => sum + countSyllables(w), 0);
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [script, setScript] = useState<any>(null);
  const [elements, setElements] = useState<ScriptElement[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [characters, setCharacters] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [titlePage, setTitlePage] = useState<any>({});
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; index: number }[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [commentColor, setCommentColor] = useState('yellow');
  const [versionName, setVersionName] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const paperRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);

  const getCategory = () => {
    if (!script?.type) return 'screenplay';
    const t = script.type.toLowerCase();
    if (t === 'poetry' || t === 'poem') return 'poetry';
    if (['fiction', 'novel', 'short-story'].includes(t)) return 'fiction';
    return 'screenplay';
  };

  const category = getCategory();
  const TYPES = category === 'poetry' ? POETRY_TYPES : category === 'fiction' ? FICTION_TYPES : SCREENPLAY_TYPES;
  const TYPE_LABELS = category === 'poetry' ? POETRY_LABELS : category === 'fiction' ? FICTION_LABELS : SCREENPLAY_LABELS;
  const NEXT_TYPE = category === 'poetry' ? POETRY_NEXT : category === 'fiction' ? FICTION_NEXT : SCREENPLAY_NEXT;

  useEffect(() => {
    loadScript();
    const handleResize = () => {
      if (window.visualViewport) {
        const diff = window.innerHeight - window.visualViewport.height;
        setKeyboardHeight(diff > 50 ? diff : 0);
      }
    };
    window.visualViewport?.addEventListener('resize', handleResize);
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveNow(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setModal('search'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); setFocusMode(f => !f); }
      if (e.key === 'Escape') { setShowAutocomplete(false); setFocusMode(false); setModal(null); }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyboard);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const loadScript = async () => {
    const res = await api<any>('/scripts/' + id);
    if (res.script) {
      setScript(res.script);
      setElements(res.content?.elements || []);
      setTitlePage(res.content?.titlePage || {});
      setCharacters(res.characters || []);
      setLocations(res.locations || []);
      setComments(res.comments || []);
      setVersions(res.versions || []);
      setAnalysis(res.analysis || {});
      setShareToken(res.script.shareToken);
      setShareMode(res.script.shareMode);
      if (res.content?.elements?.length > 0) {
        setActiveId(res.content.elements[0].id);
        setActiveType(res.content.elements[0].type);
      }
    }
  };

  const genId = () => crypto.randomUUID();

  const markDirty = useCallback(() => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveContent(), 2000);
  }, []);

  const saveContent = async () => {
    if (!dirty) return;
    setSaving(true);
    const content = { elements, titlePage };
    const res = await api<{ characters: string[]; locations: string[] }>('/scripts/' + id + '/content', {
      method: 'PUT', body: { content } as any
    });
    if (res.characters) setCharacters(res.characters);
    if (res.locations) setLocations(res.locations);
    setSaving(false);
    setDirty(false);
    setLastSaved(new Date());
    const words = elements.reduce((sum, el) => sum + (el.content?.split(/\s+/).filter(w => w).length || 0), 0);
    await api('/stats', { method: 'POST', body: { wordsToday: words } as any });
  };

  const saveNow = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setDirty(true);
    await saveContent();
  };

  const changeType = (elId: string, newType: string) => {
    setElements(prev => prev.map(el => el.id === elId ? { ...el, type: newType } : el));
    setActiveType(newType);
    markDirty();
  };

  const handleInput = (elId: string, val: string) => {
    setElements(prev => prev.map(el => el.id === elId ? { ...el, content: val } : el));
    markDirty();
    const el = elements.find(e => e.id === elId);
    if (el?.type === 'character' && val.length > 0) {
      const matches = characters.filter(c => c.toLowerCase().startsWith(val.toLowerCase()) && c.toLowerCase() !== val.toLowerCase());
      setAutocompleteItems(matches);
      setShowAutocomplete(matches.length > 0);
      setAutocompleteIndex(0);
    } else if (el?.type === 'scene-heading' && val.length > 4) {
      const matches = locations.filter(l => val.toUpperCase().includes(l.slice(0, 3)));
      setAutocompleteItems(matches.map(l => `INT. ${l} - DAY`));
      setShowAutocomplete(matches.length > 0);
      setAutocompleteIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  };

  const acceptAutocomplete = (item: string) => {
    if (!activeId) return;
    setElements(prev => prev.map(el => el.id === activeId ? { ...el, content: item } : el));
    setShowAutocomplete(false);
    markDirty();
  };

  const isMobile = () => window.innerWidth <= 768 || ('ontouchstart' in window);

  const handleKeyDown = (e: React.KeyboardEvent, el: ScriptElement, index: number) => {
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAutocompleteIndex(i => Math.min(i + 1, autocompleteItems.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAutocompleteIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); acceptAutocomplete(autocompleteItems[autocompleteIndex]); return; }
      if (e.key === 'Escape') { setShowAutocomplete(false); return; }
    }
    if (e.key === 'Enter') {
      const shouldCreateNew = isMobile() ? e.shiftKey : !e.shiftKey;
      if (shouldCreateNew) {
        e.preventDefault();
        const newEl: ScriptElement = { id: genId(), type: NEXT_TYPE[el.type] || TYPES[0], content: '' };
        const newEls = [...elements];
        newEls.splice(index + 1, 0, newEl);
        setElements(newEls);
        setActiveId(newEl.id);
        setActiveType(newEl.type);
        markDirty();
        setTimeout(() => {
          const div = paperRef.current?.querySelector(`[data-id="${newEl.id}"]`) as HTMLElement;
          div?.focus();
        }, 10);
      }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const curIdx = TYPES.indexOf(el.type);
      const newIdx = e.shiftKey ? (curIdx - 1 + TYPES.length) % TYPES.length : (curIdx + 1) % TYPES.length;
      changeType(el.id, TYPES[newIdx]);
    }
    if (e.key === 'Backspace' && el.content === '' && elements.length > 1) {
      e.preventDefault();
      const newEls = elements.filter(x => x.id !== el.id);
      setElements(newEls);
      const prevIdx = Math.max(0, index - 1);
      setActiveId(newEls[prevIdx].id);
      setActiveType(newEls[prevIdx].type);
      markDirty();
      setTimeout(() => {
        const div = paperRef.current?.querySelector(`[data-id="${newEls[prevIdx].id}"]`) as HTMLElement;
        div?.focus();
      }, 10);
    }
  };

  const handleFocus = (el: ScriptElement) => { setActiveId(el.id); setActiveType(el.type); };

  const handleToolbarTap = (type: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (activeId) changeType(activeId, type);
  };

  const addNewElement = () => {
    if (!activeId) return;
    const idx = elements.findIndex(el => el.id === activeId);
    if (idx === -1) return;
    const newEl: ScriptElement = { id: genId(), type: NEXT_TYPE[elements[idx].type] || TYPES[0], content: '' };
    const newEls = [...elements];
    newEls.splice(idx + 1, 0, newEl);
    setElements(newEls);
    setActiveId(newEl.id);
    setActiveType(newEl.type);
    markDirty();
    setTimeout(() => {
      const div = paperRef.current?.querySelector(`[data-id="${newEl.id}"]`) as HTMLElement;
      div?.focus();
    }, 10);
  };

  const doSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    const results: { id: string; index: number }[] = [];
    elements.forEach((el, i) => {
      if (el.content.toLowerCase().includes(query.toLowerCase())) results.push({ id: el.id, index: i });
    });
    setSearchResults(results);
    setSearchIndex(0);
    if (results.length > 0) jumpToSearchResult(0, results);
  };

  const jumpToSearchResult = (idx: number, results = searchResults) => {
    if (results.length === 0) return;
    const r = results[idx];
    setSearchIndex(idx);
    setActiveId(r.id);
    const div = paperRef.current?.querySelector(`[data-id="${r.id}"]`) as HTMLElement;
    div?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    div?.focus();
  };

  const addComment = async () => {
    if (!activeId || !commentText.trim()) return;
    const res = await api<{ comment: Comment }>('/scripts/' + id + '/comments', {
      method: 'POST', body: { elementId: activeId, text: commentText, color: commentColor } as any
    });
    if (res.comment) setComments(prev => [...prev, res.comment]);
    setCommentText('');
  };

  const deleteComment = async (cid: string) => {
    setComments(prev => prev.filter(c => c.id !== cid));
    await api('/scripts/' + id + '/comments/' + cid, { method: 'DELETE' });
  };

  const resolveComment = async (cid: string, resolved: boolean) => {
    setComments(prev => prev.map(c => c.id === cid ? { ...c, resolved } : c));
    await api('/scripts/' + id + '/comments/' + cid, { method: 'PUT', body: { resolved } as any });
  };

  const createVersion = async () => {
    const name = versionName.trim() || `Version ${versions.length + 1}`;
    const res = await api<{ version: Version }>('/scripts/' + id + '/versions', { method: 'POST', body: { name } as any });
    if (res.version) setVersions(prev => [...prev, res.version]);
    setVersionName('');
  };

  const restoreVersion = async (vid: string) => {
    if (!confirm('Restore this version?')) return;
    await createVersion();
    const res = await api<{ content: any }>('/scripts/' + id + '/versions/' + vid, { method: 'POST' });
    if (res.content) { setElements(res.content.elements || []); setTitlePage(res.content.titlePage || {}); setDirty(false); }
  };

  const deleteVersion = async (vid: string) => {
    if (!confirm('Delete this version?')) return;
    setVersions(prev => prev.filter(v => v.id !== vid));
    await api('/scripts/' + id + '/versions/' + vid, { method: 'DELETE' });
  };

  const enableSharing = async (mode: string) => {
    const res = await api<{ shareToken: string; shareMode: string }>('/scripts/' + id + '/share', { method: 'POST', body: { mode } as any });
    if (res.shareToken) { setShareToken(res.shareToken); setShareMode(res.shareMode); }
  };

  const disableSharing = async () => {
    await api('/scripts/' + id + '/share', { method: 'DELETE' });
    setShareToken(null);
    setShareMode(null);
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/shared/${shareToken}`;
    navigator.clipboard.writeText(link);
    alert('Share link copied!');
  };

  const updateTitlePage = (field: string, value: string) => {
    setTitlePage((prev: any) => ({ ...prev, [field]: value }));
    markDirty();
  };

  const exportFountain = () => {
    let out = '';
    if (titlePage.title) out += `Title: ${titlePage.title}\n`;
    if (titlePage.writtenBy) out += `Credit: Written by\nAuthor: ${titlePage.writtenBy}\n`;
    out += '\n';
    for (const el of elements) {
      switch (el.type) {
        case 'scene-heading': out += `\n${el.content.toUpperCase()}\n\n`; break;
        case 'action': out += `${el.content}\n\n`; break;
        case 'character': out += `\n${el.content.toUpperCase()}\n`; break;
        case 'dialogue': out += `${el.content}\n\n`; break;
        case 'parenthetical': out += `(${el.content})\n`; break;
        case 'transition': out += `\n> ${el.content.toUpperCase()}\n\n`; break;
        default: out += `${el.content}\n\n`;
      }
    }
    downloadFile(out, `${script?.title || 'script'}.fountain`, 'text/plain');
  };

  const exportMarkdown = () => {
    let out = `# ${titlePage.title || script?.title || 'Untitled'}\n\n`;
    if (titlePage.writtenBy) out += `*by ${titlePage.writtenBy}*\n\n---\n\n`;
    for (const el of elements) {
      switch (el.type) {
        case 'scene-heading': out += `## ${el.content}\n\n`; break;
        case 'character': out += `**${el.content.toUpperCase()}**\n\n`; break;
        case 'dialogue': out += `> ${el.content}\n\n`; break;
        case 'chapter-heading': out += `# ${el.content}\n\n`; break;
        case 'poem-title': out += `## ${el.content}\n\n`; break;
        default: out += `${el.content}\n\n`;
      }
    }
    downloadFile(out, `${script?.title || 'script'}.md`, 'text/markdown');
  };

  const exportPlainText = () => {
    let out = `${titlePage.title || script?.title || 'Untitled'}\n${'='.repeat(40)}\n\n`;
    for (const el of elements) {
      if (el.type === 'scene-heading') out += `\n${'—'.repeat(20)}\n${el.content.toUpperCase()}\n${'—'.repeat(20)}\n\n`;
      else if (el.type === 'character') out += `\n        ${el.content.toUpperCase()}\n`;
      else if (el.type === 'dialogue') out += `    ${el.content}\n`;
      else out += `${el.content}\n\n`;
    }
    downloadFile(out, `${script?.title || 'script'}.txt`, 'text/plain');
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getOutlineItems = () => {
    const headingType = category === 'fiction' ? 'chapter-heading' : category === 'poetry' ? 'poem-title' : 'scene-heading';
    return elements.map((el, i) => ({ el, index: i })).filter(x => x.el.type === headingType);
  };

  const jumpToElement = (elId: string) => {
    setActiveId(elId);
    const div = paperRef.current?.querySelector(`[data-id="${elId}"]`) as HTMLElement;
    div?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    div?.focus();
    setModal(null);
  };

  const wordCount = elements.reduce((sum, el) => sum + (el.content?.split(/\s+/).filter(w => w).length || 0), 0);
  const pageCount = Math.ceil(wordCount / 250);

  if (!script) {
    return <IonPage><IonContent className="ion-padding"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Loading...</div></IonContent></IonPage>;
  }

  const outlineItems = getOutlineItems();

  return (
    <IonPage className={focusMode ? 'focus-mode' : ''}>
      <IonHeader className={focusMode ? 'ion-hide' : ''}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => { saveNow(); window.location.href = '/dashboard'; }}><IonIcon icon={arrowBack} /></IonButton>
          </IonButtons>
          <div className="editor-title-container">
            <input className="editor-title-input" value={script.title} onChange={async e => { setScript({ ...script, title: e.target.value }); await api('/scripts/' + id, { method: 'PUT', body: { title: e.target.value } as any }); }} placeholder="Untitled" />
            <span className="editor-save-status">{saving ? 'Saving...' : dirty ? 'Unsaved' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Saved'}</span>
          </div>
          <IonButtons slot="end">
            <IonButton onClick={() => setModal('outline')}><IonIcon icon={list} /></IonButton>
            <IonButton onClick={() => setModal('search')}><IonIcon icon={search} /></IonButton>
            <IonButton onClick={() => setFocusMode(f => !f)}><IonIcon icon={focusMode ? eyeOff : eye} /></IonButton>
            <IonButton onClick={() => setModal('comments')}><IonIcon icon={chatbubble} />{comments.filter(c => !c.resolved).length > 0 && <span className="badge">{comments.filter(c => !c.resolved).length}</span>}</IonButton>
            <IonButton onClick={() => setModal('versions')}><IonIcon icon={time} /></IonButton>
            <IonButton onClick={() => setModal('share')}><IonIcon icon={share} /></IonButton>
            <IonButton onClick={() => setModal('export')}><IonIcon icon={download} /></IonButton>
            <IonButton onClick={() => setModal('help')}><IonIcon icon={help} /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent scrollEvents={true}>
        <div className={`editor-stats-bar ${focusMode ? 'focus-mode-stats' : ''}`}>
          <span>{wordCount.toLocaleString()} words</span>
          <span>~{pageCount} pages</span>
          {category === 'screenplay' && analysis?.sceneCount > 0 && <span>{analysis.sceneCount} scenes</span>}
        </div>

        <div className="editor-wrapper" style={{ paddingBottom: keyboardHeight > 0 ? 140 : 80 }}>
          <div className={`paper ${category}`} ref={paperRef}>
            {elements.map((el, i) => (
              <div key={el.id} className={`element-wrapper ${comments.some(c => c.elementId === el.id && !c.resolved) ? 'has-comment' : ''}`}>
                <div
                  className={`element ${el.type} ${el.id === activeId ? 'active' : ''}`}
                  contentEditable
                  suppressContentEditableWarning
                  data-id={el.id}
                  data-placeholder={TYPE_LABELS[el.type]}
                  onFocus={() => handleFocus(el)}
                  onInput={e => handleInput(el.id, (e.target as HTMLElement).textContent || '')}
                  onKeyDown={e => handleKeyDown(e, el, i)}
                  dangerouslySetInnerHTML={{ __html: el.content }}
                />
                {category === 'poetry' && (el.type === 'line' || el.type === 'couplet') && <span className="syllable-count">{countLineSyllables(el.content)} syl</span>}
                {comments.some(c => c.elementId === el.id && !c.resolved) && <span className="comment-indicator" style={{ background: comments.find(c => c.elementId === el.id)?.color || 'yellow' }} />}
              </div>
            ))}
          </div>
          {showAutocomplete && autocompleteItems.length > 0 && (
            <div className="autocomplete-dropdown">
              {autocompleteItems.slice(0, 5).map((item, i) => (
                <div key={item} className={`autocomplete-item ${i === autocompleteIndex ? 'active' : ''}`} onMouseDown={() => acceptAutocomplete(item)}>{item}</div>
              ))}
            </div>
          )}
        </div>

        <div ref={useRef<HTMLDivElement>(null)} className="editor-toolbar-container" style={{ bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0' }}>
          <div className="toolbar-buttons">
            {TYPES.map(type => (
              <button key={type} className={'toolbar-btn' + (activeType === type ? ' active' : '')} onTouchEnd={e => handleToolbarTap(type, e)} onClick={e => handleToolbarTap(type, e)}>{TYPE_LABELS[type]}</button>
            ))}
            <button className="toolbar-btn toolbar-btn-new" onTouchEnd={e => { e.preventDefault(); addNewElement(); }} onClick={addNewElement}>+</button>
          </div>
        </div>
      </IonContent>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'help' ? 'Help' : modal === 'export' ? 'Export' : modal === 'outline' ? 'Outline' : modal === 'search' ? 'Find in Script' : modal === 'comments' ? 'Comments' : modal === 'versions' ? 'Versions' : modal === 'share' ? 'Share Script' : modal === 'titlepage' ? 'Title Page' : 'Modal'}</h2>
              <button className="modal-close" onClick={() => setModal(null)}><IonIcon icon={close} /></button>
            </div>
            <div className="modal-body">
              {modal === 'help' && (
                <div className="help-section">
                  <h3>Quick Tips</h3>
                  <ul>
                    <li><strong>Mobile:</strong> Enter = new line, tap + = new element</li>
                    <li><strong>Desktop:</strong> Enter = new element, Shift+Enter = new line</li>
                    <li><strong>Tab</strong> — Cycle through element types</li>
                    <li><strong>Ctrl/Cmd+S</strong> — Save immediately</li>
                    <li><strong>Ctrl/Cmd+F</strong> — Search in script</li>
                    <li><strong>Ctrl/Cmd+E</strong> — Toggle focus mode</li>
                    <li><strong>Backspace</strong> on empty line — Delete element</li>
                  </ul>
                  <IonButton expand="block" fill="outline" onClick={() => setModal('titlepage')}>Edit Title Page</IonButton>
                </div>
              )}
              {modal === 'titlepage' && (
                <>
                  <IonItem><IonInput label="Title" labelPlacement="stacked" value={titlePage.title || ''} onIonInput={e => updateTitlePage('title', e.detail.value || '')} /></IonItem>
                  <IonItem><IonInput label="Written By" labelPlacement="stacked" value={titlePage.writtenBy || ''} onIonInput={e => updateTitlePage('writtenBy', e.detail.value || '')} /></IonItem>
                  <IonItem><IonTextarea label="Contact" labelPlacement="stacked" value={titlePage.contact || ''} onIonInput={e => updateTitlePage('contact', e.detail.value || '')} rows={3} /></IonItem>
                  <IonItem><IonInput label="Draft" labelPlacement="stacked" value={titlePage.draft || ''} onIonInput={e => updateTitlePage('draft', e.detail.value || '')} /></IonItem>
                </>
              )}
              {modal === 'export' && (
                <div className="export-options">
                  {category === 'screenplay' && <button className="export-btn" onClick={() => { exportFountain(); setModal(null); }}><span className="export-icon">⛲</span><div><strong>Fountain</strong><p>Industry standard format</p></div></button>}
                  <button className="export-btn" onClick={() => { exportMarkdown(); setModal(null); }}><span className="export-icon">📝</span><div><strong>Markdown</strong><p>For blogs, GitHub</p></div></button>
                  <button className="export-btn" onClick={() => { exportPlainText(); setModal(null); }}><span className="export-icon">📃</span><div><strong>Plain Text</strong><p>Simple text file</p></div></button>
                </div>
              )}
              {modal === 'outline' && (
                outlineItems.length === 0 ? <p style={{ textAlign: 'center', color: '#888' }}>No scenes yet</p> : (
                  <div className="outline-list">
                    {outlineItems.map((item, i) => (
                      <button key={item.el.id} className="outline-item" onClick={() => jumpToElement(item.el.id)}>
                        <span className="outline-number">{i + 1}</span>
                        <span className="outline-text">{item.el.content || '(empty)'}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
              {modal === 'search' && (
                <>
                  <IonItem><IonInput label="Search" labelPlacement="stacked" value={searchQuery} onIonInput={e => doSearch(e.detail.value || '')} placeholder="Type to search..." /></IonItem>
                  {searchResults.length > 0 && (
                    <div className="search-nav">
                      <span>{searchIndex + 1} of {searchResults.length}</span>
                      <IonButton fill="clear" size="small" onClick={() => jumpToSearchResult((searchIndex - 1 + searchResults.length) % searchResults.length)}>Prev</IonButton>
                      <IonButton fill="clear" size="small" onClick={() => jumpToSearchResult((searchIndex + 1) % searchResults.length)}>Next</IonButton>
                    </div>
                  )}
                  {searchQuery.length >= 2 && searchResults.length === 0 && <p style={{ textAlign: 'center', color: '#888' }}>No matches</p>}
                </>
              )}
              {modal === 'comments' && (
                <>
                  <div className="comment-add">
                    <h4>Add comment to current element</h4>
                    <IonTextarea value={commentText} onIonInput={e => setCommentText(e.detail.value || '')} placeholder="Type your note..." rows={2} />
                    <div className="comment-colors">
                      {['yellow', 'red', 'green', 'blue', 'purple'].map(c => (
                        <button key={c} className={`color-btn ${commentColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setCommentColor(c)} />
                      ))}
                    </div>
                    <IonButton expand="block" onClick={addComment} disabled={!commentText.trim()}>Add Comment</IonButton>
                  </div>
                  <h4 style={{ marginTop: 24 }}>All Comments ({comments.length})</h4>
                  {comments.length === 0 ? <p style={{ color: '#888' }}>No comments yet</p> : (
                    <div className="comments-list">
                      {comments.map(c => {
                        const el = elements.find(e => e.id === c.elementId);
                        return (
                          <div key={c.id} className={`comment-card ${c.resolved ? 'resolved' : ''}`} style={{ borderLeftColor: c.color }}>
                            <p className="comment-context">{el?.content?.slice(0, 50) || '(deleted)'}...</p>
                            <p className="comment-text">{c.text}</p>
                            <div className="comment-actions">
                              <button onClick={() => resolveComment(c.id, !c.resolved)}>{c.resolved ? 'Unresolve' : 'Resolve'}</button>
                              <button onClick={() => { jumpToElement(c.elementId); setModal(null); }}>Go to</button>
                              <button onClick={() => deleteComment(c.id)}>Delete</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              {modal === 'versions' && (
                <>
                  <div className="version-create">
                    <IonItem><IonInput label="Version name" labelPlacement="stacked" value={versionName} onIonInput={e => setVersionName(e.detail.value || '')} placeholder={`Version ${versions.length + 1}`} /></IonItem>
                    <IonButton expand="block" onClick={createVersion} style={{ marginTop: 12 }}>Save Current as Version</IonButton>
                  </div>
                  <h4 style={{ marginTop: 24 }}>Saved Versions ({versions.length})</h4>
                  {versions.length === 0 ? <p style={{ color: '#888' }}>No versions saved</p> : (
                    <div className="versions-list">
                      {versions.slice().reverse().map(v => (
                        <div key={v.id} className="version-card">
                          <div className="version-info"><strong>{v.name}</strong><span>{new Date(v.createdAt).toLocaleString()}</span><span>{v.wordCount.toLocaleString()} words</span></div>
                          <div className="version-actions"><button onClick={() => restoreVersion(v.id)}>Restore</button><button onClick={() => deleteVersion(v.id)}>Delete</button></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {modal === 'share' && (
                shareToken ? (
                  <div className="share-active">
                    <div className="share-status"><IonIcon icon={checkmark} style={{ color: '#22c55e', fontSize: 32 }} /><h3>Sharing is ON</h3><p>Mode: {shareMode === 'edit' ? 'Can Edit' : 'View Only'}</p></div>
                    <div className="share-link-box"><code>{window.location.origin}/shared/{shareToken}</code><IonButton fill="clear" onClick={copyShareLink}><IonIcon icon={copy} /></IonButton></div>
                    <IonButton expand="block" color="danger" onClick={disableSharing}>Stop Sharing</IonButton>
                  </div>
                ) : (
                  <div className="share-options">
                    <h3>Enable Sharing</h3>
                    <p>Create a link anyone can use to view or edit this script.</p>
                    <button className="share-option-btn" onClick={() => enableSharing('read')}><IonIcon icon={eye} /><div><strong>View Only</strong><p>Others can read but not edit</p></div></button>
                    <button className="share-option-btn" onClick={() => enableSharing('edit')}><IonIcon icon={pencil} /><div><strong>Can Edit</strong><p>Others can make changes</p></div></button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </IonPage>
  );
}
