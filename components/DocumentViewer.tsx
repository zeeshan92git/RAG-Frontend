'use client';

import { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { FileSearch2, X } from 'lucide-react';
import type { Citation, ViewerTab } from '@/lib/types';

marked.setOptions({ breaks: true, gfm: true });

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, '$1')
    .replace(/_{1,2}([^_\n]+)_{1,2}/g, '$1')
    .replace(/`{1,3}([^`\n]+)`{1,3}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+>]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|[-:\s|]+\|/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface NodeEntry {
  node: Text;
  start: number;
  end: number;
}

function collectTextNodes(container: HTMLElement): { entries: NodeEntry[]; full: string } {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const entries: NodeEntry[] = [];
  let cursor = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = (node as Text).textContent ?? '';
    entries.push({ node: node as Text, start: cursor, end: cursor + text.length });
    cursor += text.length;
  }

  return { entries, full: entries.map(entry => entry.node.textContent ?? '').join('') };
}

function findInFull(fullText: string, needle: string): [number, number] | null {
  const words = needle.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const pattern = words.map(escapeRegex).join('[\\s\\S]{0,10}');
  const match = fullText.match(new RegExp(pattern, 'i'));
  if (!match || match.index === undefined) return null;
  return [match.index, match.index + match[0].length];
}

function markRange(entries: NodeEntry[], absoluteStart: number, absoluteEnd: number): HTMLElement | null {
  let firstMark: HTMLElement | null = null;

  for (const entry of entries) {
    if (entry.end <= absoluteStart || entry.start >= absoluteEnd) continue;

    const localStart = Math.max(0, absoluteStart - entry.start);
    const localEnd = Math.min(entry.node.textContent!.length, absoluteEnd - entry.start);
    const text = entry.node.textContent!;
    const fragment = document.createDocumentFragment();

    if (localStart > 0) fragment.appendChild(document.createTextNode(text.slice(0, localStart)));
    const mark = document.createElement('mark');
    mark.className = 'hl';
    mark.textContent = text.slice(localStart, localEnd);
    fragment.appendChild(mark);
    if (localEnd < text.length) fragment.appendChild(document.createTextNode(text.slice(localEnd)));
    entry.node.parentNode?.replaceChild(fragment, entry.node);
    if (!firstMark) firstMark = mark;
  }

  return firstMark;
}

function highlightChunk(container: HTMLElement, chunkText: string, isTable: boolean): boolean {
  container.querySelectorAll('mark.hl').forEach(mark => {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
  });

  const plain = isTable
    ? (() => {
        for (const line of chunkText.split('\n')) {
          if (line.includes('|') && !/^[\s|:–\-]+$/.test(line)) {
            const cells = line.split('|').map(cell => cell.trim()).filter(Boolean);
            if (cells.length) return cells[0];
          }
        }
        return stripMarkdown(chunkText);
      })()
    : stripMarkdown(chunkText);

  if (plain.length < 10) return false;

  const { entries, full } = collectTextNodes(container);
  const attempts = [plain, plain.slice(0, 120), plain.slice(0, 60)]
    .map(value => value.trim())
    .filter((value, index, array) => value.length >= 12 && array.indexOf(value) === index);

  for (const attempt of attempts) {
    const range = findInFull(full, attempt);
    if (!range) continue;
    const firstMark = markRange(entries, range[0], range[1]);
    if (firstMark) {
      setTimeout(() => firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
      return true;
    }
  }

  return false;
}

function parseMarkdown(content: string): string {
  const withPages = content.replace(/<!--\s*page:(\d+)\s*-->/g, '\n\n---\n*Page $1*\n\n');
  return marked.parse(withPages) as string;
}

interface Props {
  tabs: ViewerTab[];
  activeDocId: string | null;
  pendingHL: Citation | null;
  onActivate: (docId: string) => void;
  onClose: (docId: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function DocumentViewer({
  tabs,
  activeDocId,
  pendingHL,
  onActivate,
  onClose,
  mobileOpen = false,
  onMobileClose,
}: Props) {
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!pendingHL || !activeDocId) return;

    const run = () => {
      const element = contentRefs.current.get(activeDocId);
      if (!element) return;
      element.querySelectorAll('[data-hl-banner]').forEach(banner => banner.remove());

      const found = highlightChunk(element, pendingHL.chunk_text, pendingHL.is_table);
      if (!found) {
        const note = document.createElement('div');
        note.setAttribute('data-hl-banner', '1');
        note.className = 'hl-banner';
        note.textContent = `Cited passage (p.${pendingHL.page_number}): “${pendingHL.chunk_text.slice(0, 150)}…”`;
        element.prepend(note);
      }
    };

    const frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [pendingHL, activeDocId]);

  useEffect(() => {
    const ids = new Set(tabs.map(tab => tab.docId));
    for (const key of contentRefs.current.keys()) {
      if (!ids.has(key)) contentRefs.current.delete(key);
    }
  }, [tabs]);

  const noTabs = tabs.length === 0;

  return (
    <section className={`document-viewer fixed bottom-0 right-0 top-16 z-50 flex w-[min(96vw,560px)] flex-col overflow-hidden border-l border-border bg-bg-surface shadow-2xl transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex min-h-12 flex-none items-center gap-2 border-b border-border bg-bg-surface px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {noTabs ? (
            <div className="flex items-center gap-2 px-1 text-sm font-medium text-text-muted">
              <FileSearch2 className="h-4 w-4 text-accent" /> Source inspector
            </div>
          ) : (
            tabs.map(tab => (
              <button
                type="button"
                key={tab.docId}
                onClick={() => onActivate(tab.docId)}
                className={`viewer-tab ${tab.docId === activeDocId ? 'tab-active' : ''}`}
              >
                <span className="tab-name" title={tab.fileName}>{tab.fileName}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="tab-close"
                  onClick={event => {
                    event.stopPropagation();
                    onClose(tab.docId);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.stopPropagation();
                      onClose(tab.docId);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onMobileClose}
          className="rounded-lg p-2 text-text-faint hover:bg-bg-elevated hover:text-text-primary"
          aria-label="Close source viewer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto bg-bg-base">
        {noTabs && (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-dim text-accent">
              <FileSearch2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-text-primary">Select a citation</p>
            <p className="mt-1 max-w-[260px] text-xs leading-5 text-text-faint">The source opens here and jumps directly to the highlighted passage.</p>
          </div>
        )}

        {tabs.map(tab => (
          <div key={tab.docId} className={tab.docId === activeDocId ? 'block' : 'hidden'}>
            {tab.loading ? (
              <div className="flex flex-col items-center justify-center gap-3 p-10 text-sm text-text-faint">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
                Loading source…
              </div>
            ) : (
              <div
                ref={element => {
                  if (element) contentRefs.current.set(tab.docId, element);
                  else contentRefs.current.delete(tab.docId);
                }}
                className="md-body"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(tab.content) }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
