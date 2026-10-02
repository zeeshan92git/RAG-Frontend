'use client';

import { useCallback, useEffect, useState } from 'react';
import { Library, Moon, PanelRightOpen, SearchCheck, Sun } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { QueryPanel, type OutputMode } from '@/components/QueryPanel';
import { DocumentViewer } from '@/components/DocumentViewer';
import type { Citation, DocRecord, ViewerTab } from '@/lib/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://rag-backend.fastapicloud.dev';

const OUTPUT_INSTRUCTIONS: Record<OutputMode, string> = {
  auto: '',
  concise: '\n\nResponse format: Answer in one concise paragraph. Keep only information supported by the provided context.',
  bullets: '\n\nResponse format: Use short bullet points. Keep each bullet factual and grounded in the provided context.',
  table: '\n\nResponse format: Use a compact Markdown table when the information can be compared or categorized. Do not invent missing values.',
  steps: '\n\nResponse format: Present the answer as a short numbered sequence of steps or ordered points.',
};

type Theme = 'light' | 'dark';

export default function Home() {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [answer, setAnswer] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamPhase, setStreamPhase] = useState<'idle' | 'searching' | 'generating'>('idle');
  const [tabs, setTabs] = useState<ViewerTab[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [pendingHL, setPendingHL] = useState<Citation | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('citelens-theme') as Theme | null;
    const preferred: Theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const next = saved ?? preferred;
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('citelens-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(''), 3500);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  useEffect(() => {
    fetch(`${API}/health`)
      .then(response => setBackendOk(response.ok))
      .catch(() => setBackendOk(false));
  }, []);

  const loadDocs = useCallback(async () => {
    try {
      const response = await fetch(`${API}/documents`);
      const data = await response.json();
      setDocs(data.documents ?? []);
    } catch {
      // Keep the current library if the refresh fails.
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleQuery = useCallback(async (question: string, topK: number, outputMode: OutputMode) => {
    setAnswer('');
    setCitations([]);
    setStreaming(true);
    setStreamPhase('searching');

    const queryForBackend = `${question}${OUTPUT_INSTRUCTIONS[outputMode]}`;

    try {
      const response = await fetch(`${API}/query/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: queryForBackend, top_k: topK }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'citations') {
              setCitations(event.data);
              setStreamPhase('generating');
            } else if (event.type === 'token') {
              setAnswer(previous => previous + event.content);
            } else if (event.type === 'error') {
              setToastMsg(event.message ?? 'Unable to answer the question.');
            }
          } catch {
            // Ignore malformed SSE events and continue the stream.
          }
        }
      }
    } catch (error: unknown) {
      setToastMsg(`Query error: ${error instanceof Error ? error.message : 'unknown'}`);
    } finally {
      setStreaming(false);
      setStreamPhase('idle');
    }
  }, []);

  const handleOpenSource = useCallback(async (docId: string, citation: Citation) => {
    setViewerOpen(true);
    const existing = tabs.find(tab => tab.docId === docId);

    if (existing && !existing.loading) {
      setActiveDocId(docId);
      setPendingHL(citation);
      return;
    }

    if (!existing) {
      setTabs(previous => [
        ...previous,
        {
          docId,
          fileName: citation.file_name,
          fileType: '',
          content: '',
          loading: true,
        },
      ]);
    }

    setActiveDocId(docId);

    try {
      const response = await fetch(`${API}/files/${docId}/markdown`);
      if (!response.ok) throw new Error('Unable to load source');
      const data = await response.json();
      setTabs(previous => previous.map(tab => (
        tab.docId === docId
          ? { ...tab, content: data.content, fileType: data.file_type, loading: false }
          : tab
      )));
      setPendingHL(citation);
    } catch {
      setTabs(previous => previous.filter(tab => tab.docId !== docId));
      setToastMsg('Could not load document.');
    }
  }, [tabs]);

  const handleCloseTab = useCallback((docId: string) => {
    setTabs(previous => {
      const next = previous.filter(tab => tab.docId !== docId);
      if (activeDocId === docId) setActiveDocId(next.at(-1)?.docId ?? null);
      return next;
    });

    if (pendingHL && citations.some(citation => citation.doc_id === docId)) {
      setPendingHL(null);
    }
  }, [activeDocId, pendingHL, citations]);

  const handleDeleteDoc = useCallback(async (docId: string, fileName: string) => {
    if (!confirm(`Delete “${fileName}” and its indexed data?`)) return;
    await fetch(`${API}/documents/${docId}`, { method: 'DELETE' });
    handleCloseTab(docId);
    await loadDocs();
    setToastMsg(`Deleted “${fileName}”`);
  }, [handleCloseTab, loadDocs]);

  return (
    <div className="app-shell relative flex h-full flex-col overflow-hidden bg-bg-base text-text-primary">
      <header className="relative z-40 flex h-16 flex-none items-center gap-3 border-b border-border bg-bg-surface/95 px-3 sm:px-5">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg-elevated text-text-muted hover:border-border-accent hover:text-accent md:hidden"
          aria-label="Open document library"
        >
          <Library className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 items-center gap-2.5">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-page" />
            <span className="brand-lens" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold tracking-[-0.02em] text-text-primary">CiteLens</span>
              <span className="hidden rounded-full bg-accent-dim px-2 py-0.5 text-[10px] font-semibold text-accent sm:inline">RAG</span>
            </div>
            <p className="hidden text-[11px] text-text-faint sm:block">Grounded answers, inspectable evidence</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-bg-elevated px-2.5 py-1.5 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${backendOk === null ? 'bg-text-faint' : backendOk ? 'bg-success' : 'bg-danger'}`} />
            <span className="text-[11px] font-medium text-text-muted">
              {backendOk === null ? 'Connecting' : backendOk ? 'Ready' : 'Offline'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg-elevated text-text-muted transition hover:border-border-accent hover:text-accent"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="flex h-9 items-center gap-2 rounded-xl border border-border bg-bg-elevated px-2.5 text-xs font-medium text-text-muted transition hover:border-border-accent hover:text-accent"
            aria-label="Open source inspector"
          >
            <PanelRightOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Sources</span>
            {tabs.length > 0 && (
              <span className="rounded-full bg-accent-dim px-1.5 py-0.5 text-[10px] font-semibold text-accent">{tabs.length}</span>
            )}
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {libraryOpen && (
          <button
            type="button"
            className="drawer-backdrop fixed inset-0 top-16 z-30 bg-black/30 md:hidden"
            aria-label="Close document library"
            onClick={() => setLibraryOpen(false)}
          />
        )}

        {viewerOpen && (
          <button
            type="button"
            className="drawer-backdrop fixed inset-0 top-16 z-40 bg-black/30"
            aria-label="Close source inspector"
            onClick={() => setViewerOpen(false)}
          />
        )}

        <Sidebar
          docs={docs}
          onUploaded={loadDocs}
          onDelete={handleDeleteDoc}
          onToast={setToastMsg}
          mobileOpen={libraryOpen}
          onMobileClose={() => setLibraryOpen(false)}
        />

        <QueryPanel
          answer={answer}
          streaming={streaming}
          streamPhase={streamPhase}
          citations={citations}
          hasDocuments={docs.length > 0}
          onQuery={handleQuery}
          onOpenSource={handleOpenSource}
          onOpenLibrary={() => setLibraryOpen(true)}
        />

        <DocumentViewer
          tabs={tabs}
          activeDocId={activeDocId}
          pendingHL={pendingHL}
          onActivate={setActiveDocId}
          onClose={handleCloseTab}
          mobileOpen={viewerOpen}
          onMobileClose={() => setViewerOpen(false)}
        />
      </div>

      {toastMsg && (
        <div className="fade-in pointer-events-none fixed bottom-5 left-1/2 z-[70] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-bg-surface px-4 py-2.5 text-xs font-medium text-text-primary shadow-xl">
          <SearchCheck className="h-4 w-4 text-accent" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
