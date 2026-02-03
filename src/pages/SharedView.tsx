import { useState, useEffect, useRef } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon } from '@ionic/react';
import { home, download, statsChart } from 'ionicons/icons';
import { useParams } from 'react-router-dom';

interface ScriptElement { id: string; type: string; content: string; }

const TYPE_CLASSES: Record<string, string> = {
  'scene-heading': 'scene-heading', 'action': 'action', 'character': 'character',
  'dialogue': 'dialogue', 'parenthetical': 'parenthetical', 'transition': 'transition',
  'poem-title': 'poem-title', 'stanza': 'stanza', 'line': 'line', 'couplet': 'couplet',
  'chapter-heading': 'chapter-heading', 'paragraph': 'paragraph', 'dialogue-fiction': 'dialogue-fiction'
};

export default function SharedView() {
  const { token } = useParams<{ token: string }>();
  const [script, setScript] = useState<any>(null);
  const [elements, setElements] = useState<ScriptElement[]>([]);
  const [mode, setMode] = useState<string>('read');
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadShared();
  }, [token]);

  const loadShared = async () => {
    try {
      const res = await fetch('/api/shared/' + token);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setScript(data.script);
      setElements(data.content?.elements || []);
      setMode(data.mode);
      setAnalysis(data.analysis);
    } catch {
      setError('Failed to load shared script');
    }
  };

  const handleInput = async (elId: string, val: string) => {
    if (mode !== 'edit') return;
    const newElements = elements.map(el => el.id === elId ? { ...el, content: val } : el);
    setElements(newElements);
    
    // Debounced save
    setSaving(true);
    await fetch('/api/shared/' + token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { elements: newElements } })
    });
    setSaving(false);
  };

  const exportPlainText = () => {
    let out = `${script?.title || 'Untitled'}\n${'='.repeat(40)}\n\n`;
    for (const el of elements) {
      if (el.type === 'scene-heading') out += `\n${'—'.repeat(20)}\n${el.content.toUpperCase()}\n${'—'.repeat(20)}\n\n`;
      else if (el.type === 'character') out += `\n        ${el.content.toUpperCase()}\n`;
      else if (el.type === 'dialogue') out += `    ${el.content}\n`;
      else out += `${el.content}\n\n`;
    }
    const blob = new Blob([out], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script?.title || 'script'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div style={{ textAlign: 'center', paddingTop: 100 }}>
            <h2>Oops!</h2>
            <p style={{ color: '#888' }}>{error}</p>
            <IonButton onClick={() => window.location.href = '/'}>Go Home</IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!script) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Loading...</div>
        </IonContent>
      </IonPage>
    );
  }

  const wordCount = elements.reduce((sum, el) => sum + (el.content?.split(/\s+/).filter(w => w).length || 0), 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{script.title}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={() => window.location.href = '/'}><IonIcon icon={home} /></IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={exportPlainText}><IonIcon icon={download} /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="shared-banner">
          <span className={`share-mode-badge ${mode}`}>{mode === 'edit' ? 'Editing Allowed' : 'View Only'}</span>
          <span>{wordCount.toLocaleString()} words</span>
          {saving && <span className="saving-indicator">Saving...</span>}
        </div>

        <div className="editor-wrapper">
          <div className="paper screenplay" ref={paperRef}>
            {elements.map(el => (
              <div
                key={el.id}
                className={`element ${TYPE_CLASSES[el.type] || 'action'}`}
                contentEditable={mode === 'edit'}
                suppressContentEditableWarning
                onInput={e => handleInput(el.id, (e.target as HTMLElement).textContent || '')}
                dangerouslySetInnerHTML={{ __html: el.content }}
              />
            ))}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
