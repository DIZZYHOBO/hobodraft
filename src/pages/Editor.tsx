import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonBackButton, IonIcon, IonFooter, IonModal, IonList, IonItem, IonLabel,
  IonInput, IonNote, IonActionSheet
} from '@ionic/react';
import { statsChart, download } from 'ionicons/icons';
import { useParams, useHistory } from 'react-router-dom';
import { api } from '../App';

interface Element {
  id: string;
  type: string;
  content: string;
}

interface Script {
  id: string;
  title: string;
  content: { elements: Element[]; titlePage?: any };
}

const TYPES = ['scene-heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'];
const TYPE_LABELS: Record<string, string> = {
  'scene-heading': 'Scene',
  'action': 'Action',
  'character': 'Char',
  'dialogue': 'Dialog',
  'parenthetical': 'Paren',
  'transition': 'Trans'
};

const NEXT_TYPE: Record<string, string> = {
  'scene-heading': 'action',
  'action': 'action',
  'character': 'dialogue',
  'dialogue': 'action',
  'parenthetical': 'dialogue',
  'transition': 'scene-heading'
};

function genId() {
  return Math.random().toString(36).substr(2, 16);
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [script, setScript] = useState<Script | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [activeType, setActiveType] = useState('action');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const saveTimer = useRef<any>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // Load script
  useEffect(() => {
    api<{ script: Script; content: any }>('/scripts/' + id).then(res => {
      if (res.script) {
        setScript(res.script);
        setElements(res.content?.elements || []);
      }
    });
  }, [id]);

  // Autosave on page unload/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!saved) {
        saveNow();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saved]);

  // Autosave every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!saved && script) {
        saveNow();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [saved, script]);

  const saveNow = async () => {
    if (!script || !paperRef.current) return;
    setSaving(true);
    const els = Array.from(paperRef.current.querySelectorAll('.el')).map(el => ({
      id: el.getAttribute('data-id') || '',
      type: el.className.replace('el ', ''),
      content: el.textContent || ''
    }));
    await api('/scripts/' + script.id + '/content', {
      method: 'PUT',
      body: { content: { elements: els } } as any
    });
    setElements(els);
    setSaving(false);
    setSaved(true);
  };

  const markDirty = useCallback(() => {
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(), 2000);
  }, [script]);

  const updateTitle = async (title: string) => {
    if (!script) return;
    setScript({ ...script, title });
    await api('/scripts/' + script.id, { method: 'PUT', body: { title } as any });
  };

  const handleFocus = (el: Element) => {
    setActiveId(el.id);
    setActiveType(el.type);
  };

  const handleKeyDown = (e: React.KeyboardEvent, el: Element, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newEl: Element = { id: genId(), type: NEXT_TYPE[el.type] || 'action', content: '' };
      const newEls = [...elements];
      newEls.splice(index + 1, 0, newEl);
      setElements(newEls);
      setActiveId(newEl.id);
      setActiveType(newEl.type);
      markDirty();
      setTimeout(() => {
        const newDiv = paperRef.current?.querySelector(`[data-id="${newEl.id}"]`) as HTMLElement;
        newDiv?.focus();
      }, 10);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const curIdx = TYPES.indexOf(el.type);
      const newIdx = e.shiftKey ? (curIdx - 1 + TYPES.length) % TYPES.length : (curIdx + 1) % TYPES.length;
      changeType(el.id, TYPES[newIdx]);
    }
  };

  const changeType = (elId: string, newType: string) => {
    const div = paperRef.current?.querySelector(`[data-id="${elId}"]`);
    if (div) {
      div.className = 'el ' + newType;
      setActiveType(newType);
      markDirty();
    }
  };

  const handleToolbarTap = (type: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeId) {
      changeType(activeId, type);
    }
  };

  const getStats = () => {
    let words = 0, scenes = 0;
    const chars = new Set<string>();
    elements.forEach(el => {
      words += (el.content || '').split(/\s+/).filter(Boolean).length;
      if (el.type === 'scene-heading') scenes++;
      if (el.type === 'character' && el.content) chars.add(el.content.toUpperCase());
    });
    return { pages: Math.max(1, Math.ceil(elements.length / 55)), scenes, words, characters: chars.size };
  };

  const exportPdf = () => { setShowExport(false); window.print(); };

  const exportFountain = () => {
    setShowExport(false);
    let text = 'Title: ' + (script?.title || 'Untitled') + '\n\n';
    elements.forEach(el => {
      if (el.type === 'scene-heading') text += '\n.' + el.content + '\n\n';
      else if (el.type === 'action') text += el.content + '\n\n';
      else if (el.type === 'character') text += '\n@' + el.content + '\n';
      else if (el.type === 'dialogue') text += el.content + '\n';
      else if (el.type === 'parenthetical') text += '(' + el.content + ')\n';
      else if (el.type === 'transition') text += '> ' + el.content + '\n\n';
    });
    downloadFile((script?.title || 'script') + '.fountain', text);
  };

  const exportTxt = () => {
    setShowExport(false);
    let text = (script?.title || 'Untitled').toUpperCase() + '\n\n';
    text += '='.repeat(40) + '\n\n';
    elements.forEach(el => {
      if (el.type === 'scene-heading') {
        text += '\n' + el.content + '\n\n';
      } else if (el.type === 'action') {
        text += el.content + '\n\n';
      } else if (el.type === 'character') {
        text += '\n' + ' '.repeat(20) + el.content + '\n';
      } else if (el.type === 'dialogue') {
        text += ' '.repeat(10) + el.content + '\n';
      } else if (el.type === 'parenthetical') {
        text += ' '.repeat(15) + '(' + el.content + ')\n';
      } else if (el.type === 'transition') {
        text += ' '.repeat(30) + el.content + '\n\n';
      }
    });
    downloadFile((script?.title || 'script') + '.txt', text);
  };

  const downloadFile = (name: string, content: string) => {
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
    a.download = name;
    a.click();
  };

  if (!script) return null;

  const stats = getStats();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" onClick={e => { e.preventDefault(); saveNow().then(() => history.push('/dashboard')); }} />
          </IonButtons>
          <IonTitle>
            <IonInput
              value={script.title}
              onIonChange={e => updateTitle(e.detail.value || '')}
              style={{ textAlign: 'center' }}
            />
          </IonTitle>
          <IonButtons slot="end">
            <IonNote style={{ marginRight: 8, fontSize: 12 }}>
              {saving ? 'Saving...' : saved ? 'Saved' : 'Unsaved'}
            </IonNote>
            <IonButton onClick={() => setShowStats(true)}>
              <IonIcon icon={statsChart} />
            </IonButton>
            <IonButton onClick={() => setShowExport(true)}>
              <IonIcon icon={download} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="editor-wrapper">
          <div className="paper" ref={paperRef}>
            {elements.map((el, i) => (
              <div
                key={el.id}
                data-id={el.id}
                className={'el ' + el.type}
                contentEditable
                suppressContentEditableWarning
                onFocus={() => handleFocus(el)}
                onBlur={() => setActiveId(el.id)}
                onInput={markDirty}
                onKeyDown={e => handleKeyDown(e, el, i)}
              >
                {el.content}
              </div>
            ))}
          </div>
        </div>
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <div className="toolbar-buttons">
            {TYPES.map(type => (
              <button
                key={type}
                className={'toolbar-btn' + (activeType === type ? ' active' : '')}
                onTouchEnd={e => handleToolbarTap(type, e)}
                onClick={e => handleToolbarTap(type, e)}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </IonToolbar>
      </IonFooter>

      <IonModal isOpen={showStats} onDidDismiss={() => setShowStats(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Stats</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowStats(false)}>Close</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonList>
            <IonItem><IonLabel>Pages</IonLabel><IonNote slot="end">~{stats.pages}</IonNote></IonItem>
            <IonItem><IonLabel>Scenes</IonLabel><IonNote slot="end">{stats.scenes}</IonNote></IonItem>
            <IonItem><IonLabel>Words</IonLabel><IonNote slot="end">{stats.words}</IonNote></IonItem>
            <IonItem><IonLabel>Characters</IonLabel><IonNote slot="end">{stats.characters}</IonNote></IonItem>
          </IonList>
        </IonContent>
      </IonModal>

      <IonActionSheet
        isOpen={showExport}
        onDidDismiss={() => setShowExport(false)}
        header="Export"
        buttons={[
          { text: 'PDF (Print)', handler: exportPdf },
          { text: 'Fountain (.fountain)', handler: exportFountain },
          { text: 'Plain Text (.txt)', handler: exportTxt },
          { text: 'Cancel', role: 'cancel' }
        ]}
      />
    </IonPage>
  );
}
