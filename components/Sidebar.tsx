'use client';

import { useRef } from 'react';
import { CheckCircle2, FileText, Library, Trash2, Upload, X } from 'lucide-react';
import type { DocRecord } from '@/lib/types';

const API = 'http://localhost:8001';
const SUPPORTED = new Set(['pdf', 'docx', 'md', 'csv', 'txt']);
const getExt = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? '';

interface Props {
  docs: DocRecord[];
  onUploaded: () => void;
  onDelete: (docId: string, fileName: string) => void;
  onToast: (message: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function FileBadge({ fileName }: { fileName: string }) {
  const ext = getExt(fileName).slice(0, 4).toUpperCase() || 'FILE';
  return (
    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-accent-dim text-[10px] font-bold tracking-wide text-accent">
      {ext}
    </div>
  );
}

export function Sidebar({ docs, onUploaded, onDelete, onToast, mobileOpen = false, onMobileClose }: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: File[]) {
    const valid = files.filter(file => SUPPORTED.has(getExt(file.name)));
    const invalid = files.length - valid.length;
    if (invalid) onToast(`Skipped ${invalid} unsupported file${invalid === 1 ? '' : 's'}`);
    if (!valid.length) return;

    zoneRef.current?.classList.add('drop-uploading');
    onToast(`Indexing ${valid.length} file${valid.length === 1 ? '' : 's'}…`);

    const formData = new FormData();
    valid.forEach(file => formData.append('files', file));

    try {
      const response = await fetch(`${API}/upload`, { method: 'POST', body: formData });
      const data = await response.json();
      onToast(data.failed > 0 ? `${data.successful} indexed · ${data.failed} failed` : `${data.successful} file${data.successful === 1 ? '' : 's'} ready`);
      onUploaded();
    } catch (error: unknown) {
      onToast(`Upload error: ${error instanceof Error ? error.message : 'unknown'}`);
    } finally {
      zoneRef.current?.classList.remove('drop-uploading');
    }
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    zoneRef.current?.classList.remove('drop-active');
    upload(Array.from(event.dataTransfer.files));
  }

  return (
    <aside className={`app-sidebar fixed bottom-0 left-0 top-16 z-40 flex w-[min(88vw,320px)] flex-none flex-col overflow-hidden border-r border-border bg-bg-surface transition-transform duration-300 md:static md:z-auto md:w-72 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-dim text-accent">
          <Library className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">Library</p>
          <p className="text-[11px] text-text-faint">{docs.length} indexed {docs.length === 1 ? 'document' : 'documents'}</p>
        </div>
        <button
          type="button"
          onClick={onMobileClose}
          className="ml-auto rounded-lg p-2 text-text-faint hover:bg-bg-elevated hover:text-text-primary md:hidden"
          aria-label="Close library"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-3">
        <div
          ref={zoneRef}
          onClick={() => inputRef.current?.click()}
          onDragOver={event => {
            event.preventDefault();
            zoneRef.current?.classList.add('drop-active');
          }}
          onDragLeave={event => {
            if (!zoneRef.current?.contains(event.relatedTarget as Node)) {
              zoneRef.current?.classList.remove('drop-active');
            }
          }}
          onDrop={onDrop}
          className="group cursor-pointer rounded-2xl border border-dashed border-border bg-bg-elevated/55 p-4 text-center transition hover:border-border-accent hover:bg-accent-dim"
        >
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-bg-surface text-accent shadow-sm">
            <Upload className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-text-primary">Add documents</p>
          <p className="mt-1 text-xs text-text-faint">Drop files or browse</p>
          <p className="mt-2 text-[10px] font-medium tracking-wide text-text-faint">PDF · DOCX · MD · CSV · TXT</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.md,.csv,.txt"
          multiple
          onChange={event => {
            if (event.target.files?.length) upload(Array.from(event.target.files));
            event.target.value = '';
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {docs.length === 0 ? (
          <div className="mt-2 flex flex-col items-center justify-center rounded-2xl border border-border bg-bg-elevated/35 px-5 py-8 text-center">
            <FileText className="mb-2 h-5 w-5 text-text-faint" />
            <p className="text-sm font-medium text-text-muted">No documents yet</p>
          </div>
        ) : (
          docs.map(doc => (
            <div key={doc.doc_id} className="doc-row group mb-1 flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 transition hover:bg-bg-elevated">
              <FileBadge fileName={doc.file_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary" title={doc.file_name}>{doc.file_name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-faint">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  {doc.total_pages > 0 ? `${doc.total_pages} pages` : 'Ready'}
                  {doc.total_chunks > 0 && ` · ${doc.total_chunks} chunks`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(doc.doc_id, doc.file_name)}
                className="del-btn rounded-lg p-1.5 text-text-faint hover:bg-danger-dim hover:text-danger"
                aria-label={`Delete ${doc.file_name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
