// Turns a PrepPlan into the printable page. Styled for paper, not for the app — black
// on white with green headings, because a lot of people print in black and white and
// the app's grey cards come out muddy.

import { countLabel } from '@/lib/format';
import { expiryLabel } from '@/lib/expiry';
import type { PrepPlan } from '@/lib/prep-plan';

const HOME_TYPE_LABELS: Record<string, string> = {
  house: 'House or townhouse',
  apartment: 'Apartment or condo',
  mobile: 'Mobile or manufactured home',
};

// Anything typed by the user reaches the page as text, so < and & can't break the markup.
function escape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// "25 gallons" — the unit is optional, since a tick-box item has none.
function amount(value: number, unit: string | null) {
  if (unit === null) {
    return String(value);
  }

  return value + ' ' + unit;
}

export function prepPlanHtml(plan: PrepPlan): string {
  const household = plan.household;

  const counts: string[] = [];
  if (household !== null) {
    counts.push(countLabel(household.adults, 'adult'));
    if (household.kids > 0) {
      counts.push(countLabel(household.kids, 'kid'));
    }
    if (household.pets > 0) {
      counts.push(countLabel(household.pets, 'pet'));
    }
  }

  // Falls back to the bare ZIP, the same way Settings does, so an offline setup still
  // prints something true. ⛔ household.county and nws_office are deliberately NOT
  // printed — they hold UGC codes like 'FLC011' and 'MFL', not words anyone reads.
  let place = '';
  if (household !== null) {
    place = household.place ?? household.zip_code ?? '';
    const home = HOME_TYPE_LABELS[household.home_type ?? ''] ?? '';
    if (home !== '') {
      place = place === '' ? home : place + ' · ' + home;
    }
  }

  // Repeated at the foot of every page, so a stray second page still says whose it is.
  const footLine = [
    household?.name ? household.name : 'Outerwinds storm plan',
    formatDate(plan.generatedAt),
  ].join(' · ');

  const categories = plan.categories
    .map((category) => {
      const rows = category.items
        .map((item) => {
          const mark = item.done === 1 ? '&#10003;' : '&#9744;';
          const target =
            item.target_qty === null ? '' : amount(item.target_qty, item.unit);
          return `<tr class="${item.done === 1 ? 'done' : ''}">
              <td class="mark">${mark}</td>
              <td>${escape(item.name)}</td>
              <td class="target">${escape(target)}</td>
            </tr>`;
        })
        .join('');

      return `<div class="group"><h3>${escape(category.name)}</h3><table>${rows}</table></div>`;
    })
    .join('');

  // Two separate sections on purpose: short of target and due for replacing are
  // different problems. An item can honestly appear in both.
  const shopping = plan.stillToBuy
    .map(
      (row) => `<tr>
        <td class="mark">&#9744;</td>
        <td>${escape(row.name)}</td>
        <td class="target">${escape(amount(row.short, row.unit))} more</td>
      </tr>`
    )
    .join('');

  const replacing = plan.dueForReplacing
    .map(
      (row) => `<tr>
        <td class="mark">&#9744;</td>
        <td>${escape(row.name)}</td>
        <td class="target">${escape(expiryLabel(row.daysLeft))}</td>
      </tr>`
    )
    .join('');

  const shoppingSection =
    shopping === ''
      ? ''
      : `<div class="action"><h2>What you still need</h2><table>${shopping}</table></div>`;

  const replacingSection =
    replacing === ''
      ? ''
      : `<div class="action"><h2>Due for replacing</h2><table>${replacing}</table></div>`;

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
        padding-bottom: 26px;
      }

      /* Serif, like every heading in the app — it's what stops the page reading
         like a spreadsheet export. */
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
      h3 {
        font-size: 13px;
        margin: 14px 0 4px;
        color: #4b5563;
      }

      .meta { color: #4b5563; font-size: 13px; margin: 0; }

      /* The two sections you act on, tinted apart from the record below. */
      .action {
        background: #f2f8f5;
        border-radius: 8px;
        padding: 2px 14px 8px;
        margin-top: 8px;
      }
      .action h2 { margin-top: 14px; }
      .action td { border-bottom-color: #dcebe3; }

      table { width: 100%; border-collapse: collapse; }
      td {
        padding: 8px 0;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: top;
      }

      /* A fixed, roomy first column keeps every name starting at the same x. */
      /* Big enough to actually tick with a pen — this page lives on a fridge. */
      .mark { width: 30px; font-size: 19px; }
      .target { text-align: right; color: #4b5563; white-space: nowrap; }

      /* Ticked items stay readable — greyed, not struck through, so the page still
         works as a record of what you have. */
      .done td { color: #9ca3af; }

      /* Keeps a category heading with at least some of its rows instead of stranding
         it at the foot of a page. */
      .group { page-break-inside: avoid; }

      /* Repeats on every printed page: a fixed element is drawn once per page by both
         WebKit and Chrome. Without it, page two is anonymous if the pages get separated. */
      .running-foot {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        color: #9ca3af;
        font-size: 10px;
        border-top: 1px solid #e5e7eb;
        padding-top: 5px;
      }

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
    <h1>${escape(household?.name ? household.name : 'Your storm plan')}</h1>
    <p class="meta">${escape(counts.join(', '))}${counts.length > 0 && place !== '' ? ' &middot; ' : ''}${escape(place)}</p>
    <p class="meta">${plan.done} of ${plan.total} prep items done &middot; ${escape(formatDate(plan.generatedAt))}</p>

    ${shoppingSection}
    ${replacingSection}

    <h2>Your checklist</h2>
    ${categories}

    <div class="running-foot">${escape(footLine)}</div>

    <div class="footer">
      Always follow official guidance from the National Weather Service, FEMA, and your
      local emergency management. Outerwinds is a preparedness organizer, not an
      emergency service.
    </div>
  </body>
</html>`;
}
