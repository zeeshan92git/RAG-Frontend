'use client';

import { ExternalLink, FileText, Table2 } from 'lucide-react';
import type { Citation } from '@/lib/types';

const EXT_LABEL: Record<string, string> = {
  pdf: 'PDF',
  docx: 'DOC',
  md: 'MD',
  csv: 'CSV',
  txt: 'TXT',
};

const getExt = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? '';

interface Props {
  citation: Citation;
  index: number;
  onOpenSource: (docId: string, citation: Citation) => void;
}

export function CitationCard({ citation, index, onOpenSource }: Props) {
  const score = Math.round(citation.relevance_score * 100);
  const preview = citation.chunk_text.trim().replace(/\s+/g, ' ');

  return (
    <button
      type="button"
      onClick={() => onOpenSource(citation.doc_id, citation)}
      className="group relative z-0 w-full rounded-2xl border border-border bg-bg-surface p-3.5 text-left shadow-sm transition-all duration-200 hover:z-[120] hover:-translate-y-0.5 hover:border-border-accent hover:shadow-md focus-visible:z-[120] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
      style={{ animationDelay: `${index * 35}ms` }}
      aria-label={`Open citation from ${citation.file_name}, page ${citation.page_number}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-accent-dim text-accent">
          {citation.is_table ? <Table2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-text-muted">
              {EXT_LABEL[getExt(citation.file_name)] ?? 'FILE'}
            </span>
            <span className="truncate text-sm font-semibold text-text-primary" title={citation.file_name}>
              {citation.file_name}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-text-faint">
            <span>Page {citation.page_number}</span>
            <span aria-hidden="true">•</span>
            <span>{score}% match</span>
          </div>
        </div>

        <ExternalLink className="mt-1 h-4 w-4 flex-none text-text-faint transition-colors group-hover:text-accent" />
      </div>

      {/* Hover / keyboard preview. Hidden on touch-first layouts by default. */}
      <div className="citation-hover-preview pointer-events-none absolute left-3 right-3 top-[calc(100%+8px)] z-[140] hidden rounded-2xl border border-border bg-bg-surface p-3.5 shadow-2xl ring-1 ring-black/5 sm:block sm:translate-y-1 sm:opacity-0 sm:transition-all sm:duration-150 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-visible:translate-y-0 sm:group-focus-visible:opacity-100">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-text-primary">Citation preview</span>
          <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[10px] font-semibold text-accent">p.{citation.page_number}</span>
        </div>
        <p className="line-clamp-5 text-xs leading-5 text-text-muted">
          {preview || 'No preview available.'}
        </p>
        <p className="mt-2 text-[10px] font-medium text-accent">Click to inspect highlighted source</p>
      </div>
    </button>
  );
}