// Tidies issues that Zapier opens from the public Google Form.

const MARKER = '_Submitted via the public form';

const TYPE_LABELS = {
  bug: 'bug',
  question: 'question',
  'feature idea': 'Feature idea',
  'drill source': 'Drill source',
};

const isField = (line) => line.startsWith('**') || line.startsWith(MARKER);

/** Returns the labels and cleaned body for a form issue, or null for any other issue. */
export function triageFormIssue({ title, body }) {
  if (!body.includes(MARKER)) return null;

  const type = /^\[([^\]]+)\]/.exec(title)?.[1].trim().toLowerCase();
  const labels = [...(TYPE_LABELS[type] ? [TYPE_LABELS[type]] : []), 'from-form'];

  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // A label with no answer after it on its line, or on the lines below before the next field
    if (/^\*\*[^*]+\*\*\s*$/.test(line)) {
      let end = i + 1;
      while (end < lines.length && !isField(lines[end])) end++;
      if (lines.slice(i + 1, end).every((l) => !l.trim())) {
        i = end - 1;
        continue;
      }
    }
    kept.push(line.startsWith(MARKER) && /\bby _\s*$/.test(line) ? `${MARKER}._` : line);
  }

  const cleaned = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { labels, body: cleaned };
}
