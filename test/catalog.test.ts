import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalog, loadCatalog } from '../src/catalog.js';
import { ROOT, SKILLS_DIR, skillFiles, skillRoots } from '../scripts/lib/skill-files.mjs';

describe('catalog', () => {
  it('serves every skill folder on disk and no others', () => {
    const onDisk = skillRoots().map((root) => relative(SKILLS_DIR, root).split('\\').join('/')).sort();
    const served = catalog.skills.map((skill) => skill.folder).sort();
    expect(served).toEqual(onDisk);
    expect(served.length).toBeGreaterThan(0);
  });

  it('keeps every skill file, with hidden paths on agentic://', () => {
    const served = new Map(catalog.skills.flatMap((skill) => skill.files.map((file) => [file.rel, file])));
    const onDisk = skillFiles();
    expect(new Set(served.keys())).toEqual(new Set(onDisk.map((file) => file.rel)));
    for (const file of onDisk) {
      const record = served.get(file.rel);
      expect(record, file.rel).toBeDefined();
      if (!record) continue;
      const bytes = readFileSync(file.abs);
      expect(record.size).toBe(bytes.byteLength);
      expect(record.text).toBe(new TextDecoder().decode(bytes));
      expect(record.hidden).toBe(file.hidden);
      expect(record.uri).toBe(file.hidden ? `agentic://skills/${file.rel}` : `skill://${file.rel}`);
    }
  });

  it('marks manual skills from disable-model-invocation', () => {
    const manual = catalog.byName.get('defense-in-depth-nodejs');
    const model = catalog.byName.get('code-review');
    expect(manual?.invocation).toBe('manual');
    expect(model?.invocation).toBe('model-invoked');
    expect(manual?.category).toBe('security');
    expect(catalog.byName.get('dependency-management-node')?.category).toBeNull();
  });

  it('rejects a skill whose name does not match its folder', () => {
    expect(() =>
      loadCatalog({
        'bad/SKILL.md': '---\nname: other\ndescription: x\n---\n',
      }),
    ).toThrow(/does not match folder/);
  });

  it('does not include files outside a skill folder', () => {
    const loose = relative(ROOT, `${SKILLS_DIR}/engineering/newrelic-to-signoz.md`);
    expect(catalog.skills.some((skill) => skill.files.some((file) => file.rel.endsWith('newrelic-to-signoz.md')))).toBe(
      false,
    );
    expect(loose.endsWith('newrelic-to-signoz.md')).toBe(true);
  });
});
