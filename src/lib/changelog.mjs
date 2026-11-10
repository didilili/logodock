import { escapeHtml } from './catalog-display.mjs';

/**
 * @typedef {Object} ChangelogSection
 * @property {string} title
 * @property {string} html
 * @property {boolean} compatibility
 */

/**
 * @typedef {Object} ChangelogEntry
 * @property {string} id
 * @property {string | null} date
 * @property {string} title
 * @property {ChangelogSection[]} sections
 */

const repositoryRoot = 'https://github.com/didilili/logodock/blob/main/';
const listItem = /^\s*[-*+]\s+(.+)$/;

function safeHref(value, basePath) {
  if (/[\s\\]/.test(value)) return null;
  if (value.startsWith('#')) return value;
  if (/^https:\/\//i.test(value)) {
    try {
      return new URL(value).protocol === 'https:' ? value : null;
    } catch {
      return null;
    }
  }

  const path = value.replace(/^\.\//, '');
  if (/^logo\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:[?#].*)?$/.test(path)) {
    return `${basePath}/${path}`;
  }

  const markdown = /^([^?#]+\.md)([?#].*)?$/.exec(path);
  if (!markdown) return null;
  try {
    const segments = markdown[1].split('/').map(decodeURIComponent);
    if (
      segments.some(
        (segment) => !segment || ['.', '..'].includes(segment) || /[\\/:]/.test(segment),
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return `${repositoryRoot}${path}`;
}

function renderInline(text, basePath) {
  // The changelog uses this small inline subset. Raw HTML always stays escaped.
  const tokens = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]\n]+)\]\(([^()\s]+)\)/g;
  let html = '';
  let offset = 0;
  for (const match of text.matchAll(tokens)) {
    html += escapeHtml(text.slice(offset, match.index));
    const [, code, bold, label, destination] = match;
    if (code !== undefined) {
      html += `<code>${escapeHtml(code)}</code>`;
    } else if (bold !== undefined) {
      html += `<strong>${renderInline(bold, basePath)}</strong>`;
    } else {
      const href = safeHref(destination, basePath);
      const content = renderInline(label, basePath);
      html += href ? `<a href="${escapeHtml(href)}">${content}</a>` : content;
    }
    offset = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(offset));
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function startsTable(lines, index) {
  if (!lines[index]?.includes('|') || !lines[index + 1]?.includes('|')) return false;
  const header = tableCells(lines[index]);
  const separator = tableCells(lines[index + 1]);
  return header.length === separator.length && separator.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderBlocks(lines, basePath, foldTables = false) {
  let html = '';
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (startsTable(lines, index)) {
      const header = tableCells(line);
      if (foldTables) {
        html += '<details class="changelog-file-changes"><summary>查看受影响文件与替代</summary>';
        html += '<div class="changelog-table-scroll">';
      }
      html += '<table><thead><tr>';
      html += header.map((cell) => `<th scope="col">${renderInline(cell, basePath)}</th>`).join('');
      html += '</tr></thead><tbody>';
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const cells = tableCells(lines[index]);
        html += '<tr>';
        html += header
          .map((_, column) => `<td>${renderInline(cells[column] || '', basePath)}</td>`)
          .join('');
        html += '</tr>';
        index += 1;
      }
      html += '</tbody></table>';
      if (foldTables) html += '</div></details>';
      continue;
    }

    if (listItem.test(line)) {
      html += '<ul>';
      while (index < lines.length && listItem.test(lines[index])) {
        html += `<li>${renderInline(listItem.exec(lines[index])[1], basePath)}</li>`;
        index += 1;
      }
      html += '</ul>';
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !listItem.test(lines[index]) &&
      !startsTable(lines, index)
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html += `<p>${renderInline(paragraph.join(' '), basePath)}</p>`;
  }
  return html;
}

/**
 * @param {string} markdown
 * @param {{ basePath?: string }} [options]
 * @returns {{ published: ChangelogEntry[], unreleased: ChangelogEntry | null }}
 */
export function parseChangelog(markdown, { basePath = '' } = {}) {
  const root = basePath.replace(/\/+$/, '');
  if (root && (!root.startsWith('/') || root.startsWith('//') || /[\\\s?#]/.test(root))) {
    throw new Error('Invalid changelog base path');
  }

  /** @type {ChangelogEntry[]} */
  const published = [];
  const dateCounts = new Map();
  /** @type {ChangelogEntry | null} */
  let unreleased = null;
  /** @type {ChangelogEntry | null} */
  let entry = null;
  let sectionTitle = null;
  let content = [];

  function finishSection() {
    if (entry && (sectionTitle !== null || content.some((line) => line.trim()))) {
      const compatibility = sectionTitle === '引用变化';
      entry.sections.push({
        title: sectionTitle || '',
        html: renderBlocks(content, root, compatibility),
        compatibility,
      });
    }
    sectionTitle = null;
    content = [];
  }

  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      finishSection();
      const match = /^(未发布|\d{4}-\d{2}-\d{2})(?:\s*·\s*(.+))?$/.exec(heading[1]);
      if (!match) throw new Error(`Invalid changelog heading: ${heading[1]}`);
      const date = match[1] === '未发布' ? null : match[1];
      if (date) {
        const timestamp = Date.parse(`${date}T00:00:00Z`);
        if (
          !Number.isFinite(timestamp) ||
          new Date(timestamp).toISOString().slice(0, 10) !== date
        ) {
          throw new Error(`Invalid changelog date: ${date}`);
        }
      }
      const count = (dateCounts.get(date) || 0) + 1;
      dateCounts.set(date, count);
      const id = date ? `${date}${count > 1 ? `-${count}` : ''}` : 'unreleased';
      entry = { id, date, title: match[2]?.trim() || match[1], sections: [] };
      if (date) {
        published.push(entry);
      } else {
        if (unreleased) throw new Error('Only one unreleased entry is supported');
        unreleased = entry;
      }
      continue;
    }

    if (!entry) continue;
    const section = /^###\s+(.+?)\s*$/.exec(line);
    if (section) {
      finishSection();
      sectionTitle = section[1];
    } else {
      content.push(line);
    }
  }
  finishSection();

  published.sort((left, right) => right.date.localeCompare(left.date));
  return { published, unreleased };
}
