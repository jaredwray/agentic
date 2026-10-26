// Minimal YAML-frontmatter parser shared by the skill validator and the MCP catalog.
// Top-level `key: value` pairs, folded multi-line scalars (indented continuation lines
// joined with spaces), flow arrays `[a, b]`, block sequences (`- x`), and booleans.

function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { error: 'missing YAML frontmatter (no leading `---`)' };
  const close = content.indexOf('\n---', 3);
  if (close === -1) return { error: 'unterminated YAML frontmatter (no closing `---`)' };
  const block = content.slice(content.indexOf('\n') + 1, close);
  const data = {};
  let key = null;
  for (const line of block.split('\n')) {
    if (!line.trim()) continue;
    const indented = /^\s/.test(line);
    const match = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (match && !indented) {
      key = match[1];
      data[key] = match[2];
    } else if (key && indented) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        if (!Array.isArray(data[key])) {
          const seed = String(data[key] ?? '').trim();
          data[key] = seed ? [seed] : [];
        }
        data[key].push(stripQuotes(trimmed.slice(2)));
      } else {
        data[key] = `${String(data[key] ?? '').trim()} ${trimmed}`.trim();
      }
    }
  }
  for (const field of Object.keys(data)) {
    if (Array.isArray(data[field])) continue;
    const value = String(data[field]).trim();
    if (value === 'true') data[field] = true;
    else if (value === 'false') data[field] = false;
    else if (value.startsWith('[') && value.endsWith(']')) {
      data[field] = value
        .slice(1, -1)
        .split(',')
        .map((part) => stripQuotes(part))
        .filter(Boolean);
    } else data[field] = stripQuotes(value);
  }
  return { data };
}

export function stripFrontmatter(content) {
  if (!content.startsWith('---')) return content;
  const close = content.indexOf('\n---', 3);
  if (close === -1) return content;
  const newline = content.indexOf('\n', close + 1);
  return newline === -1 ? '' : content.slice(newline + 1);
}
