// The printed version of one vault document — a title/notes page, then every photo
// full-bleed on its own page. Styled for paper, matching prep-plan-html.ts.

import type { DocumentRow } from '@/db/documents';

// Anything typed by the user reaches the page as text, so < and & can't break the markup.
function escape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(createdAt: string) {
  return new Date(createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function documentPdfHtml(doc: DocumentRow, photoDataUris: string[]): string {
  const notesSection =
    doc.notes.trim() === ''
      ? ''
      : `<div class="notes"><h2>Notes</h2><p>${escape(doc.notes)}</p></div>`;

  // Every photo starts a fresh page — including the first — so the title/notes page
  // never has to share space with a cramped photo underneath it.
  const pages = photoDataUris
    .map((uri) => `<div class="page"><img src="${uri}" /></div>`)
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 52px 50px 64px; }

      body {
        font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
        color: #16262e;
        font-size: 14px;
        line-height: 1.5;
      }

      h1 {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 30px;
        margin: 0 0 6px;
      }
      h2 {
        font-size: 15px;
        color: #047857;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        margin: 26px 0 8px;
        border-bottom: 2px solid #047857;
        padding-bottom: 4px;
      }

      .meta { color: #4b5563; font-size: 13px; margin: 0; }
      .notes p { white-space: pre-wrap; }

      /* Each photo gets its own page, sized to its own aspect ratio rather than being
         forced into a square. */
      .page { page-break-before: always; text-align: center; }
      .page img { max-width: 100%; max-height: 900px; }
    </style>
  </head>
  <body>
    <h1>${escape(doc.title)}</h1>
    <p class="meta">${escape(doc.category)} &middot; Added ${escape(formatDate(doc.created_at))}</p>

    ${notesSection}
    ${pages}
  </body>
</html>`;
}
