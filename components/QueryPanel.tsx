'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  FileSearch,
  List,
  Rows3,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Text,
} from 'lucide-react';
import type { Citation } from '@/lib/types';
import { CitationCard } from '@/components/CitationCard';

export type OutputMode = 'auto' | 'concise' | 'bullets' | 'table' | 'steps';

const OUTPUT_OPTIONS: Array<{
  value: OutputMode;
  label: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  { value: 'auto', label: 'Auto', description: 'Best format for the question', icon: Sparkles },
  { value: 'concise', label: 'Concise', description: 'Short paragraph', icon: Text },
  { value: 'bullets', label: 'Bullets', description: 'Scannable key points', icon: List },
  { value: 'table', label: 'Table', description: 'Compare structured facts', icon: Table2 },
  { value: 'steps', label: 'Steps', description: 'Ordered action sequence', icon: Rows3 },
];

interface Props {
  answer: string;
  streaming: boolean;
  streamPhase: 'idle' | 'searching' | 'generating';
  citations: Citation[];
  hasDocuments: boolean;
  onQuery: (question: string, topK: number, outputMode: OutputMode) => void;
  onOpenSource: (docId: string, citation: Citation) => void;
  onOpenLibrary: () => void;
}

export function QueryPanel({
  answer,
  streaming,
  streamPhase,
  citations,
  hasDocuments,
  onQuery,
  onOpenSource,
  onOpenLibrary,
}: Props) {
  const [question, setQuestion] = useState('');
  const [topK, setTopK] = useState(5);
  const [outputMode, setOutputMode] = useState<OutputMode>('auto');
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (answer && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [answer]);

  function submit() {
    if (!hasDocuments || !question.trim() || streaming) return;
    onQuery(question.trim(), topK, outputMode);
  }

  const hasContent = Boolean(answer || citations.length || streaming);
  const selectedOutput = OUTPUT_OPTIONS.find(option => option.value === outputMode) ?? OUTPUT_OPTIONS[0];

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-bg-base">
      <div className="relative flex-1 overflow-y-auto">
        {!hasContent ? (
          <section className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center px-5 py-10 text-center sm:px-8">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-dim text-accent ring-1 ring-inset ring-accent/15">
              <Sparkles className="h-6 w-6" strokeWidth={1.8} />
            </div>

            <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] text-text-primary sm:text-4xl">
              Ask. Verify. Move on.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-text-muted">
              Grounded answers with source-level evidence when you need it.
            </p>

            {!hasDocuments && (
              <button
                type="button"
                onClick={onOpenLibrary}
                className="mt-6 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"
              >
                Upload your first document
              </button>
            )}
          </section>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
            {streaming && streamPhase === 'searching' && (
              <div className="slide-up flex items-center gap-3 rounded-2xl border border-border bg-bg-surface px-4 py-3 shadow-sm">
                <div className="flex gap-1"><span className="dot" /><span className="dot" /><span className="dot" /></div>
                <span className="text-sm font-medium text-text-muted">Searching your documents…</span>
              </div>
            )}

            {(answer || (streaming && streamPhase === 'generating')) && (
              <article className="answer-panel slide-up rounded-3xl border border-border bg-bg-surface shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 sm:px-6">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-dim text-accent">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Answer</p>
                      <p className="text-[11px] text-text-faint">{selectedOutput.label} format · grounded in retrieved context</p>
                    </div>
                  </div>
                </div>
                <div className="answer-body whitespace-pre-wrap px-5 py-5 text-[15px] leading-7 text-text-primary sm:px-6">
                  {answer}
                  {streaming && <span className="cursor" />}
                </div>
              </article>
            )}

            {citations.length > 0 && (
              <section className="slide-up relative z-[110]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileSearch className="h-4 w-4 text-accent" />
                    <h2 className="text-sm font-semibold text-text-primary">Sources</h2>
                  </div>
                  <span className="text-xs text-text-faint">Hover to preview · click to inspect</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {citations.map((citation, index) => (
                    <CitationCard
                      key={`${citation.doc_id}-${citation.chunk_index}`}
                      citation={citation}
                      index={index}
                      onOpenSource={onOpenSource}
                    />
                  ))}
                </div>
              </section>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="query-composer-shell relative z-30 flex-none border-t border-border bg-bg-surface/95 p-3 sm:p-4">
        <div className="mx-auto max-w-3xl">
          <div className={`query-composer rounded-2xl border bg-bg-surface p-2 shadow-lg transition ${hasDocuments ? 'border-border focus-within:border-border-accent' : 'border-border opacity-70'}`}>
            <textarea
              value={question}
              onChange={event => setQuestion(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              rows={2}
              disabled={!hasDocuments}
              placeholder={hasDocuments ? 'Ask about your documents…' : 'Upload a document to start asking questions'}
              aria-label="Ask a question about your documents"
              className="w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-6 text-text-primary placeholder:text-text-faint focus:outline-none disabled:cursor-not-allowed"
            />

            <div className="flex flex-wrap items-end justify-between gap-2 px-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSettings(value => !value)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${showSettings ? 'border-border-accent bg-accent-dim text-accent' : 'border-border bg-bg-elevated text-text-muted hover:text-text-primary'}`}
                    aria-expanded={showSettings}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" /> k={topK}
                  </button>
                  {showSettings && (
                    <div className="absolute bottom-10 left-0 z-40 w-60 rounded-2xl border border-border bg-bg-surface p-4 shadow-xl">
                      <label htmlFor="top-k" className="text-xs font-semibold text-text-primary">Retrieved chunks</label>
                      <p className="mt-1 text-[11px] leading-5 text-text-faint">Use a higher value for broad questions; lower it for precise lookups.</p>
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          id="top-k"
                          type="range"
                          min={1}
                          max={12}
                          value={topK}
                          onChange={event => setTopK(Number(event.target.value))}
                          className="min-w-0 flex-1 accent-[#6366F1]"
                        />
                        <span className="w-8 rounded-lg bg-bg-elevated py-1 text-center text-xs font-semibold text-accent">{topK}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center rounded-lg border border-border bg-bg-elevated p-1">
                  {OUTPUT_OPTIONS.map(option => {
                    const Icon = option.icon;
                    const active = outputMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setOutputMode(option.value)}
                        title={`${option.label}: ${option.description}`}
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors ${active ? 'bg-bg-surface text-accent shadow-sm' : 'text-text-faint hover:text-text-primary'}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden lg:inline">{option.label}</span>
                        {active && <Check className="hidden h-3 w-3 xl:block" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={!hasDocuments || streaming || !question.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send question"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
