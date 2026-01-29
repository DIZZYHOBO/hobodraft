import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonBackButton, IonIcon, IonFooter, IonModal, IonList, IonItem, IonLabel,
  IonInput, IonNote, IonActionSheet, IonBadge, IonChip
} from '@ionic/react';
import { statsChart, download, helpCircle, checkmarkCircle, warning, construct, locate, sparkles } from 'ionicons/icons';
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
  type: string;
  content: { elements: Element[]; titlePage?: any };
}

interface Issue {
  id: string;
  elementId: string;
  elementIndex: number;
  severity: 'warning' | 'suggestion';
  title: string;
  detail: string;
  canAutoFix: boolean;
  fixLabel?: string;
  fixAction?: () => void;
}

const ELEMENT_TYPES: Record<string, string[]> = {
  screenplay: ['scene-heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'],
  poetry: ['poem-title', 'dedication', 'verse', 'verse-indent', 'stanza-break', 'refrain', 'attribution'],
  fiction: ['chapter-heading', 'chapter-subtitle', 'body', 'dialogue', 'thought', 'scene-break', 'letter', 'section-header']
};

const TYPE_LABELS: Record<string, string> = {
  'scene-heading': 'Scene', 'action': 'Action', 'character': 'Char', 'dialogue': 'Dialog',
  'parenthetical': 'Paren', 'transition': 'Trans', 'poem-title': 'Title', 'dedication': 'Dedic',
  'verse': 'Verse', 'verse-indent': 'Indent', 'stanza-break': 'Break', 'refrain': 'Refrain',
  'attribution': 'Attrib', 'chapter-heading': 'Chapter', 'chapter-subtitle': 'Subtitle',
  'body': 'Body', 'thought': 'Thought', 'letter': 'Letter', 'section-header': 'Section'
};

const NEXT_TYPE: Record<string, string> = {
  'scene-heading': 'action', 'action': 'action', 'character': 'dialogue', 'dialogue': 'action',
  'parenthetical': 'dialogue', 'transition': 'scene-heading', 'poem-title': 'verse',
  'dedication': 'verse', 'verse': 'verse', 'verse-indent': 'verse', 'stanza-break': 'verse',
  'refrain': 'verse', 'attribution': 'verse', 'chapter-heading': 'body', 'chapter-subtitle': 'body',
  'body': 'body', 'thought': 'body', 'scene-break': 'body', 'letter': 'body', 'section-header': 'body'
};

const HELP_CONTENT: Record<string, { title: string; intro: string; elements: { name: string; label: string; description: string; example: string }[] }> = {
  screenplay: {
    title: '🎬 Screenplay Guide',
    intro: 'Screenplays follow a specific format. Each page roughly equals one minute of screen time.',
    elements: [
      { name: 'scene-heading', label: 'Scene Heading', description: 'WHERE and WHEN. Starts with INT./EXT., location, and time.', example: 'INT. COFFEE SHOP - DAY' },
      { name: 'action', label: 'Action', description: 'What we SEE and HEAR. Present tense, visual.', example: 'Sarah pushes through the crowd.' },
      { name: 'character', label: 'Character', description: 'Who speaks next. ALL CAPS above dialogue.', example: 'SARAH' },
      { name: 'dialogue', label: 'Dialogue', description: 'What they say.', example: 'Is this seat taken?' },
      { name: 'parenthetical', label: 'Parenthetical', description: 'HOW they say it. Use sparingly.', example: 'sarcastically' },
      { name: 'transition', label: 'Transition', description: 'Scene changes. Rarely needed.', example: 'FADE TO BLACK.' }
    ]
  },
  poetry: {
    title: '📝 Poetry Guide',
    intro: 'Poetry expresses emotions through carefully chosen words and rhythm.',
    elements: [
      { name: 'poem-title', label: 'Title', description: 'Name of your poem. Centered at top.', example: 'The Road Not Taken' },
      { name: 'dedication', label: 'Dedication', description: 'Who it\'s for. Italicized.', example: 'For my grandmother' },
      { name: 'verse', label: 'Verse', description: 'A single line of poetry.', example: 'Two roads diverged in a yellow wood' },
      { name: 'verse-indent', label: 'Indent', description: 'Indented continuation line.', example: '     And sorry I could not travel both' },
      { name: 'stanza-break', label: 'Break', description: 'Visual pause between stanzas.', example: '(blank space)' },
      { name: 'refrain', label: 'Refrain', description: 'Repeated line. Italicized.', example: 'And miles to go before I sleep' },
      { name: 'attribution', label: 'Attribution', description: 'Poet\'s name at end.', example: '— Robert Frost' }
    ]
  },
  fiction: {
    title: '📖 Fiction Guide',
    intro: 'Fiction tells stories through prose, balancing action, dialogue, and internal experience.',
    elements: [
      { name: 'chapter-heading', label: 'Chapter', description: 'New chapter start.', example: 'CHAPTER ONE' },
      { name: 'chapter-subtitle', label: 'Subtitle', description: 'Optional context below heading.', example: 'In which our hero decides' },
      { name: 'body', label: 'Body', description: 'Main narrative prose.', example: 'The letter arrived on Tuesday.' },
      { name: 'dialogue', label: 'Dialogue', description: 'Character speech in quotes.', example: 'I don\'t believe you' },
      { name: 'thought', label: 'Thought', description: 'Inner monologue. Italicized.', example: 'This can\'t be happening.' },
      { name: 'scene-break', label: 'Break', description: 'Time/location jump.', example: '#' },
      { name: 'letter', label: 'Letter', description: 'In-story documents.', example: 'Dear Sarah...' },
      { name: 'section-header', label: 'Section', description: 'Major divisions.', example: 'PART TWO' }
    ]
  }
};

function genId() { return Math.random().toString(36).substr(2, 16); }

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
  const [showHelp, setShowHelp] = useState(false);
  const [showChecker, setShowChecker] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [checkerRan, setCheckerRan] = useState(false);
  const saveTimer = useRef<any>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const getMode = (): string => {
    if (!script) return 'screenplay';
    const t = script.type.toLowerCase();
    if (t === 'poetry' || t === 'poem') return 'poetry';
    if (t === 'fiction' || t === 'novel' || t === 'short-story') return 'fiction';
    return 'screenplay';
  };

  const mode = getMode();
  const TYPES = ELEMENT_TYPES[mode] || ELEMENT_TYPES.screenplay;
  const helpContent = HELP_CONTENT[mode];

  useEffect(() => {
    api<{ script: Script; content: any }>('/scripts/' + id).then(res => {
      if (res.script) {
        setScript(res.script);
        const els = res.content?.elements || [];
        setElements(els);
        if (els.length > 0) setActiveType(els[0].type);
      }
    });
  }, [id]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!saved) { saveNow(); e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saved]);

  useEffect(() => {
    const interval = setInterval(() => { if (!saved && script) saveNow(); }, 30000);
    return () => clearInterval(interval);
  }, [saved, script]);

  const saveNow = async () => {
    if (!script || !paperRef.current) return;
    setSaving(true);
    const els = Array.from(paperRef.current.querySelectorAll('.el')).map(el => ({
      id: el.getAttribute('data-id') || '',
      type: el.className.replace('el ', '').split(' ')[0],
      content: el.textContent || ''
    }));
    await api('/scripts/' + script.id + '/content', { method: 'PUT', body: { content: { elements: els } } as any });
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

  const handleFocus = (el: Element) => { setActiveId(el.id); setActiveType(el.type); };

  const handleKeyDown = (e: React.KeyboardEvent, el: Element, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newEl: Element = { id: genId(), type: NEXT_TYPE[el.type] || TYPES[0], content: '' };
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

  const updateElementContent = (elId: string, newContent: string) => {
    setElements(prev => prev.map(el => el.id === elId ? { ...el, content: newContent } : el));
    const div = paperRef.current?.querySelector(`[data-id="${elId}"]`) as HTMLElement;
    if (div) div.textContent = newContent;
    markDirty();
  };

  const removeElement = (elId: string) => {
    setElements(prev => prev.filter(el => el.id !== elId));
    markDirty();
  };

  const handleToolbarTap = (type: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeId) changeType(activeId, type);
  };

  const jumpToElement = (elId: string) => {
    setShowChecker(false);
    setTimeout(() => {
      const div = paperRef.current?.querySelector(`[data-id="${elId}"]`) as HTMLElement;
      if (div) {
        div.scrollIntoView({ behavior: 'smooth', block: 'center' });
        div.focus();
        div.classList.add('highlight-issue');
        setTimeout(() => div.classList.remove('highlight-issue'), 2000);
      }
    }, 300);
  };

  // ============================================
  // DOCUMENT CHECKER
  // ============================================
  
  const runChecker = () => {
    const foundIssues: Issue[] = [];
    const els = [...elements];
    
    const addIssue = (
      elementId: string, index: number, severity: 'warning' | 'suggestion',
      title: string, detail: string, canAutoFix = false, fixLabel?: string, fixAction?: () => void
    ) => {
      foundIssues.push({ id: genId(), elementId, elementIndex: index, severity, title, detail, canAutoFix, fixLabel, fixAction });
    };

    // ========== SCREENPLAY CHECKS ==========
    if (mode === 'screenplay') {
      els.forEach((el, i) => {
        const content = el.content.trim();
        const upper = content.toUpperCase();
        
        // Empty element
        if (!content) {
          addIssue(el.id, i, 'suggestion', 'Empty element', `This ${TYPE_LABELS[el.type]} line is empty. Consider removing it.`, 
            true, 'Remove', () => removeElement(el.id));
        }

        // Scene heading checks
        if (el.type === 'scene-heading' && content) {
          if (!upper.startsWith('INT.') && !upper.startsWith('EXT.') && !upper.startsWith('INT/EXT') && !upper.startsWith('I/E')) {
            addIssue(el.id, i, 'warning', 'Scene heading format', 'Should start with INT. (interior) or EXT. (exterior).', 
              true, 'Add INT.', () => updateElementContent(el.id, 'INT. ' + content));
          }
          if (!content.includes(' - ')) {
            addIssue(el.id, i, 'suggestion', 'Missing time of day', 'Consider adding time of day (- DAY, - NIGHT, etc.)', 
              true, 'Add "- DAY"', () => updateElementContent(el.id, content + ' - DAY'));
          }
        }

        // Dialogue without character
        if (el.type === 'dialogue' && i > 0 && content) {
          const prev = els[i - 1];
          if (prev.type !== 'character' && prev.type !== 'parenthetical' && prev.type !== 'dialogue') {
            addIssue(el.id, i, 'warning', 'Orphan dialogue', 'Dialogue should follow a Character name or another dialogue line.', false);
          }
        }

        // Parenthetical without dialogue
        if (el.type === 'parenthetical' && content) {
          const next = els[i + 1];
          if (!next || next.type !== 'dialogue') {
            addIssue(el.id, i, 'warning', 'Orphan parenthetical', 'Parenthetical should be followed by dialogue.', false);
          }
        }

        // Long action
        if (el.type === 'action' && content.length > 350) {
          addIssue(el.id, i, 'suggestion', 'Long action block', 'Consider breaking this into shorter paragraphs (3-4 lines max) for easier reading.', false);
        }

        // Same character twice in a row
        if (el.type === 'character' && content) {
          for (let j = i - 1; j >= 0; j--) {
            if (els[j].type === 'character') {
              if (els[j].content.trim().toUpperCase() === upper) {
                addIssue(el.id, i, 'suggestion', 'Same character speaks again', 'Consider adding action between speeches to show reactions or time passing.', false);
              }
              break;
            }
            if (els[j].type === 'action' || els[j].type === 'scene-heading') break;
          }
        }

        // All caps dialogue (shouting?)
        if (el.type === 'dialogue' && content.length > 15 && content === upper) {
          addIssue(el.id, i, 'suggestion', 'All caps dialogue', 'ALL CAPS implies shouting. If intentional, great! Otherwise, use normal case.', false);
        }
      });

      // Check starts with scene heading
      if (els.length > 0 && els[0].type !== 'scene-heading') {
        addIssue(els[0].id, 0, 'suggestion', 'Missing opening scene', 'Screenplays typically start with a Scene Heading (INT./EXT.)', false);
      }
    }

    // ========== POETRY CHECKS ==========
    if (mode === 'poetry') {
      let hasTitle = false;
      let hasAttribution = false;
      let consecutiveBreaks = 0;

      els.forEach((el, i) => {
        const content = el.content.trim();

        if (el.type === 'poem-title') hasTitle = true;
        if (el.type === 'attribution') hasAttribution = true;

        // Empty verse
        if ((el.type === 'verse' || el.type === 'verse-indent' || el.type === 'refrain') && !content) {
          addIssue(el.id, i, 'suggestion', 'Empty line', 'This line is empty. Use a Stanza Break for intentional spacing.', 
            true, 'Make Break', () => {
              setElements(prev => prev.map(e => e.id === el.id ? { ...e, type: 'stanza-break', content: '' } : e));
              markDirty();
            });
        }

        // Very long line
        if ((el.type === 'verse' || el.type === 'verse-indent') && content.length > 80) {
          addIssue(el.id, i, 'suggestion', 'Long line', 'This line is quite long. Consider breaking it or using indented continuation.', false);
        }

        // Consecutive stanza breaks
        if (el.type === 'stanza-break') {
          consecutiveBreaks++;
          if (consecutiveBreaks > 1) {
            addIssue(el.id, i, 'suggestion', 'Multiple breaks', 'Multiple stanza breaks in a row. One is usually enough.', 
              true, 'Remove', () => removeElement(el.id));
          }
        } else {
          consecutiveBreaks = 0;
        }

        // Attribution not at end
        if (el.type === 'attribution' && i < els.length - 1) {
          const remaining = els.slice(i + 1).filter(e => e.content.trim());
          if (remaining.length > 0) {
            addIssue(el.id, i, 'suggestion', 'Attribution placement', 'Attribution usually appears at the very end of the poem.', false);
          }
        }
      });

      // Missing title
      if (!hasTitle && els.length > 0) {
        addIssue(els[0].id, 0, 'suggestion', 'No title', 'Consider adding a Title at the beginning of your poem.', false);
      }
    }

    // ========== FICTION CHECKS ==========
    if (mode === 'fiction') {
      let hasChapter = false;
      let consecutiveBreaks = 0;

      els.forEach((el, i) => {
        const content = el.content.trim();

        if (el.type === 'chapter-heading') hasChapter = true;

        // Empty body
        if (el.type === 'body' && !content) {
          addIssue(el.id, i, 'suggestion', 'Empty paragraph', 'This paragraph is empty.', 
            true, 'Remove', () => removeElement(el.id));
        }

        // Very long paragraph
        if (el.type === 'body' && content.split(/\s+/).length > 200) {
          addIssue(el.id, i, 'suggestion', 'Long paragraph', 'This paragraph is quite long. Consider breaking it up for readability.', false);
        }

        // Dialogue formatting
        if (el.type === 'dialogue' && content && !content.includes('"') && !content.includes("'")) {
          // Content doesn't have quotes - that's fine, we add them, but check if it looks like narration
          if (content.split(' ').length > 30) {
            addIssue(el.id, i, 'suggestion', 'Long dialogue', 'This is quite a long speech. Consider breaking it up with action beats.', false);
          }
        }

        // Thought that might be dialogue
        if (el.type === 'thought' && content.startsWith('"')) {
          addIssue(el.id, i, 'suggestion', 'Quoted thought?', 'This thought starts with a quote mark. Should it be Dialogue instead?', 
            true, 'Make Dialogue', () => {
              setElements(prev => prev.map(e => e.id === el.id ? { ...e, type: 'dialogue' } : e));
              markDirty();
            });
        }

        // Consecutive scene breaks
        if (el.type === 'scene-break') {
          consecutiveBreaks++;
          if (consecutiveBreaks > 1) {
            addIssue(el.id, i, 'suggestion', 'Multiple breaks', 'Multiple scene breaks in a row. One is usually enough.', 
              true, 'Remove', () => removeElement(el.id));
          }
        } else {
          consecutiveBreaks = 0;
        }

        // Chapter with no content after
        if (el.type === 'chapter-heading') {
          const next = els[i + 1];
          if (!next || next.type === 'chapter-heading' || next.type === 'section-header') {
            addIssue(el.id, i, 'warning', 'Empty chapter', 'This chapter has no content after it.', false);
          }
        }
      });

      // No chapter heading
      if (!hasChapter && els.length > 3) {
        addIssue(els[0].id, 0, 'suggestion', 'No chapter heading', 'Consider starting with a Chapter Heading to organize your story.', false);
      }
    }

    setIssues(foundIssues);
    setCheckerRan(true);
    setShowChecker(true);
  };

  const getStats = () => {
    let words = 0, scenes = 0, stanzas = 0, chapters = 0;
    const chars = new Set<string>();
    elements.forEach(el => {
      words += (el.content || '').split(/\s+/).filter(Boolean).length;
      if (el.type === 'scene-heading') scenes++;
      if (el.type === 'character' && el.content) chars.add(el.content.toUpperCase());
      if (el.type === 'stanza-break' || el.type === 'poem-title') stanzas++;
      if (el.type === 'chapter-heading') chapters++;
    });
    return { pages: Math.max(1, Math.ceil(elements.length / 55)), scenes, words, characters: chars.size, stanzas, chapters,
      lines: elements.filter(e => e.type === 'verse' || e.type === 'verse-indent' || e.type === 'refrain').length };
  };

  const exportPdf = () => { setShowExport(false); window.print(); };

  const exportFile = (format: 'fountain' | 'txt' | 'md') => {
    setShowExport(false);
    let text = '';
    const title = script?.title || 'Untitled';

    if (mode === 'screenplay') {
      if (format === 'fountain') {
        text = `Title: ${title}\n\n`;
        elements.forEach(el => {
          if (el.type === 'scene-heading') text += `\n.${el.content}\n\n`;
          else if (el.type === 'action') text += `${el.content}\n\n`;
          else if (el.type === 'character') text += `\n@${el.content}\n`;
          else if (el.type === 'dialogue') text += `${el.content}\n`;
          else if (el.type === 'parenthetical') text += `(${el.content})\n`;
          else if (el.type === 'transition') text += `> ${el.content}\n\n`;
        });
      } else {
        text = `${title.toUpperCase()}\n${'='.repeat(40)}\n\n`;
        elements.forEach(el => {
          if (el.type === 'scene-heading') text += `\n${el.content}\n\n`;
          else if (el.type === 'action') text += `${el.content}\n\n`;
          else if (el.type === 'character') text += `\n${' '.repeat(20)}${el.content}\n`;
          else if (el.type === 'dialogue') text += `${' '.repeat(10)}${el.content}\n`;
          else if (el.type === 'parenthetical') text += `${' '.repeat(15)}(${el.content})\n`;
          else if (el.type === 'transition') text += `${' '.repeat(30)}${el.content}\n\n`;
        });
      }
    } else if (mode === 'poetry') {
      elements.forEach(el => {
        if (el.type === 'poem-title') text += format === 'md' ? `# ${el.content}\n\n` : `${el.content}\n\n`;
        else if (el.type === 'dedication') text += format === 'md' ? `*${el.content}*\n\n` : `For ${el.content}\n\n`;
        else if (el.type === 'verse') text += `${el.content}\n`;
        else if (el.type === 'verse-indent') text += `    ${el.content}\n`;
        else if (el.type === 'stanza-break') text += `\n`;
        else if (el.type === 'refrain') text += format === 'md' ? `*${el.content}*\n` : `${el.content}\n`;
        else if (el.type === 'attribution') text += `\n— ${el.content}\n`;
      });
    } else if (mode === 'fiction') {
      if (format !== 'md') text = `${title.toUpperCase()}\n${'='.repeat(40)}\n\n`;
      elements.forEach(el => {
        if (el.type === 'chapter-heading') text += format === 'md' ? `\n# ${el.content}\n\n` : `\n\n${el.content.toUpperCase()}\n\n`;
        else if (el.type === 'chapter-subtitle') text += format === 'md' ? `## ${el.content}\n\n` : `${el.content}\n\n`;
        else if (el.type === 'section-header') text += format === 'md' ? `\n---\n\n# ${el.content}\n\n` : `\n\n${'*'.repeat(20)}\n\n${el.content.toUpperCase()}\n\n`;
        else if (el.type === 'body') text += format === 'md' ? `${el.content}\n\n` : `    ${el.content}\n\n`;
        else if (el.type === 'dialogue') text += format === 'md' ? `"${el.content}"\n\n` : `    "${el.content}"\n\n`;
        else if (el.type === 'thought') text += format === 'md' ? `*${el.content}*\n\n` : `    ${el.content}\n\n`;
        else if (el.type === 'scene-break') text += format === 'md' ? `\n* * *\n\n` : `\n        #\n\n`;
        else if (el.type === 'letter') text += format === 'md' ? `> ${el.content}\n\n` : `        ${el.content}\n`;
      });
    }

    const ext = format === 'fountain' ? 'fountain' : format === 'md' ? 'md' : 'txt';
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    a.download = `${title}.${ext}`;
    a.click();
  };

  if (!script) return null;

  const stats = getStats();
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const suggestionCount = issues.filter(i => i.severity === 'suggestion').length;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" onClick={e => { e.preventDefault(); saveNow().then(() => history.push('/dashboard')); }} />
          </IonButtons>
          <IonTitle>
            <IonInput value={script.title} onIonChange={e => updateTitle(e.detail.value || '')} style={{ textAlign: 'center' }} />
          </IonTitle>
          <IonButtons slot="end">
            <IonNote style={{ marginRight: 8, fontSize: 12 }}>{saving ? 'Saving...' : saved ? 'Saved' : 'Unsaved'}</IonNote>
            <IonButton onClick={() => setShowHelp(true)} title="Help"><IonIcon icon={helpCircle} /></IonButton>
            <IonButton onClick={runChecker} title="Check Document"><IonIcon icon={construct} /></IonButton>
            <IonButton onClick={() => setShowStats(true)} title="Stats"><IonIcon icon={statsChart} /></IonButton>
            <IonButton onClick={() => setShowExport(true)} title="Export"><IonIcon icon={download} /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="editor-wrapper">
          <div className={`paper paper-${mode}`} ref={paperRef}>
            {elements.map((el, i) => (
              <div key={el.id} data-id={el.id} className={'el ' + el.type} contentEditable suppressContentEditableWarning
                onFocus={() => handleFocus(el)} onBlur={() => setActiveId(el.id)} onInput={markDirty} onKeyDown={e => handleKeyDown(e, el, i)}>
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
              <button key={type} className={'toolbar-btn' + (activeType === type ? ' active' : '')}
                onTouchEnd={e => handleToolbarTap(type, e)} onClick={e => handleToolbarTap(type, e)}>
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </IonToolbar>
      </IonFooter>

      {/* Document Checker Modal */}
      <IonModal isOpen={showChecker} onDidDismiss={() => setShowChecker(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Document Check</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowChecker(false)}>Close</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {issues.length === 0 ? (
            <div className="checker-success">
              <IonIcon icon={checkmarkCircle} />
              <h2>Looking Good!</h2>
              <p>No issues found. Your {mode === 'screenplay' ? 'screenplay' : mode === 'poetry' ? 'poem' : 'story'} follows proper formatting.</p>
            </div>
          ) : (
            <div className="checker-results">
              <div className="checker-summary">
                {warningCount > 0 && <IonChip color="warning"><IonIcon icon={warning} /><IonLabel>{warningCount} warning{warningCount > 1 ? 's' : ''}</IonLabel></IonChip>}
                {suggestionCount > 0 && <IonChip color="medium"><IonIcon icon={sparkles} /><IonLabel>{suggestionCount} suggestion{suggestionCount > 1 ? 's' : ''}</IonLabel></IonChip>}
              </div>
              <p className="checker-note">These are suggestions to help guide you. Feel free to ignore any that don't fit your creative vision!</p>
              <div className="checker-issues">
                {issues.map(issue => (
                  <div key={issue.id} className={`checker-issue checker-issue-${issue.severity}`}>
                    <div className="issue-header">
                      <IonIcon icon={issue.severity === 'warning' ? warning : sparkles} />
                      <span className="issue-title">{issue.title}</span>
                      <IonBadge color={issue.severity === 'warning' ? 'warning' : 'medium'}>{TYPE_LABELS[elements[issue.elementIndex]?.type] || 'Element'}</IonBadge>
                    </div>
                    <p className="issue-detail">{issue.detail}</p>
                    <div className="issue-actions">
                      <IonButton size="small" fill="outline" onClick={() => jumpToElement(issue.elementId)}>
                        <IonIcon icon={locate} slot="start" /> Go to
                      </IonButton>
                      {issue.canAutoFix && issue.fixAction && (
                        <IonButton size="small" fill="solid" color="primary" onClick={() => { issue.fixAction!(); setIssues(prev => prev.filter(i => i.id !== issue.id)); }}>
                          {issue.fixLabel || 'Fix'}
                        </IonButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </IonContent>
      </IonModal>

      {/* Help Modal */}
      <IonModal isOpen={showHelp} onDidDismiss={() => setShowHelp(false)}>
        <IonHeader><IonToolbar><IonTitle>{helpContent.title}</IonTitle><IonButtons slot="end"><IonButton onClick={() => setShowHelp(false)}>Close</IonButton></IonButtons></IonToolbar></IonHeader>
        <IonContent className="ion-padding">
          <div className="help-content">
            <p className="help-intro">{helpContent.intro}</p>
            <div className="help-elements">
              {helpContent.elements.map((item, index) => (
                <div key={index} className="help-element">
                  <div className="help-element-header"><span className="help-element-badge">{TYPE_LABELS[item.name]}</span><h3>{item.label}</h3></div>
                  <p className="help-element-desc">{item.description}</p>
                  <div className="help-element-example"><span className="example-label">Example:</span><code>{item.example}</code></div>
                </div>
              ))}
            </div>
            <div className="help-tips">
              <h3>💡 Quick Tips</h3>
              <ul>
                <li><strong>Enter</strong> — Create new line (auto-selects next logical type)</li>
                <li><strong>Tab</strong> — Cycle through element types</li>
                <li><strong>Shift+Tab</strong> — Cycle backward</li>
                <li><strong>Toolbar</strong> — Tap to change line type</li>
              </ul>
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* Stats Modal */}
      <IonModal isOpen={showStats} onDidDismiss={() => setShowStats(false)}>
        <IonHeader><IonToolbar><IonTitle>Stats</IonTitle><IonButtons slot="end"><IonButton onClick={() => setShowStats(false)}>Close</IonButton></IonButtons></IonToolbar></IonHeader>
        <IonContent className="ion-padding">
          <IonList>
            <IonItem><IonLabel>Words</IonLabel><IonNote slot="end">{stats.words}</IonNote></IonItem>
            {mode === 'screenplay' && (<><IonItem><IonLabel>Pages</IonLabel><IonNote slot="end">~{stats.pages}</IonNote></IonItem><IonItem><IonLabel>Scenes</IonLabel><IonNote slot="end">{stats.scenes}</IonNote></IonItem><IonItem><IonLabel>Characters</IonLabel><IonNote slot="end">{stats.characters}</IonNote></IonItem></>)}
            {mode === 'poetry' && (<><IonItem><IonLabel>Lines</IonLabel><IonNote slot="end">{stats.lines}</IonNote></IonItem><IonItem><IonLabel>Stanzas</IonLabel><IonNote slot="end">{stats.stanzas}</IonNote></IonItem></>)}
            {mode === 'fiction' && (<><IonItem><IonLabel>Pages</IonLabel><IonNote slot="end">~{Math.ceil(stats.words / 250)}</IonNote></IonItem><IonItem><IonLabel>Chapters</IonLabel><IonNote slot="end">{stats.chapters}</IonNote></IonItem></>)}
          </IonList>
        </IonContent>
      </IonModal>

      <IonActionSheet isOpen={showExport} onDidDismiss={() => setShowExport(false)} header="Export" buttons={[
        { text: 'PDF (Print)', handler: exportPdf },
        ...(mode === 'screenplay' ? [{ text: 'Fountain (.fountain)', handler: () => exportFile('fountain') }] : []),
        { text: 'Markdown (.md)', handler: () => exportFile('md') },
        { text: 'Plain Text (.txt)', handler: () => exportFile('txt') },
        { text: 'Cancel', role: 'cancel' }
      ]} />
    </IonPage>
  );
}
