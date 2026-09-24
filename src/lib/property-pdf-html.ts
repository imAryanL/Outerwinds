// The printed Storm Property Record — each area's Before and After side by side, with
// dates and notes. Styled for paper, matching document-pdf-html.ts.

import type { AreaRow } from '@/db/property';

// One area's photos as base64 data URIs, null where there's no photo.
export type AreaPhotos = { before: string | null; after: string | null };

// Anything typed by the user reaches the page as text, so < and & can't break the markup.
function escape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 'September 23, 2026 at 4:32 PM'
function formatTaken(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function photoCell(label: string, dataUri: string | null, takenAt: string | null) {
  if (dataUri === null) {
    return `<div class="cell"><div class="label">${label}</div><div class="photo empty">No ${label.toLowerCase()} photo</div></div>`;
  }

  let caption = '';
  if (takenAt !== null) {
    caption = `<div class="caption">Taken ${escape(formatTaken(takenAt))}</div>`;
  }
  return `<div class="cell"><div class="label">${label}</div><div class="photo"><img src="${dataUri}" /></div>${caption}</div>`;
}

export function propertyPdfHtml(areas: AreaRow[], photos: AreaPhotos[], exportedAt: Date): string {
  let sections = '';
  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];

    let notes = '';
    if (area.notes.trim() !== '') {
      notes = `<p class="notes"><strong>Notes:</strong> ${escape(area.notes)}</p>`;
    }

    sections += `
      <div class="area">
        <h2>${escape(area.name)}</h2>
        <div class="pair">
          ${photoCell('Before', photos[i].before, area.before_taken_at)}
          ${photoCell('After', photos[i].after, area.after_taken_at)}
        </div>
        ${notes}
      </div>`;
  }

  let areaCount = `${areas.length} areas`;
  if (areas.length === 1) {
    areaCount = '1 area';
  }

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
        margin: 26px 0 10px;
        border-bottom: 2px solid #047857;
        padding-bottom: 4px;
      }

      .meta { color: #4b5563; font-size: 13px; margin: 0; }

      /* An area never splits across pages, so a Before is never separated from its After. */
      .area { page-break-inside: avoid; }

      .pair { display: flex; gap: 16px; }
      .cell { flex: 1; }
      .label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: #4b5563;
        margin-bottom: 6px;
      }

      /* contain, not cover — cropping could hide the damage the photo is there to show. */
      .photo { height: 230px; background: #f3f4f6; }
      .photo img { width: 100%; height: 100%; object-fit: contain; }
      .photo.empty {
        background: none;
        border: 1.5px dashed #9ca3af;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        font-size: 12px;
      }
      .caption { font-size: 12px; margin-top: 6px; }
      .notes { font-size: 13px; margin: 12px 0 0; white-space: pre-wrap; }

      /* No position: fixed running footer — in this print path it drew once, over this one. */
      .footer {
        margin-top: 30px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <h1>Storm property record</h1>
    <p class="meta">Exported ${escape(formatDate(exportedAt))} &middot; ${areaCount}</p>

    ${sections}

    <div class="footer">
      Photos and dates recorded by the household in Outerwinds, as supporting documentation.
      This record doesn't guarantee insurance coverage.
    </div>
  </body>
</html>`;
}
