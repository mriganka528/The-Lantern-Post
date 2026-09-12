import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LetterPreset } from '@lantern-post/shared-types';
import { characterCount, decodeDraft, DraftController, LETTER_LIMIT, letterProblem } from '../src/letters/draft';
import type { DraftStorage } from '../src/letters/draft';

const preset: LetterPreset = {
  id: 'preset_lantern', key: 'lantern-parchment', displayName: 'Lantern parchment', description: 'A warm page.',
  config: { paperColor: '#F8EED6', inkColor: '#443C2F', sealColor: '#946347', ribbonColor: '#849079', texture: 'parchment', motif: 'postmark', font: 'book' },
};
function fixture() {
  const values = new Map<string, string>();
  let fail = false;
  const storage: DraftStorage = {
    read: key => values.get(key) ?? null,
    write: (key, value) => { if (fail) throw new Error('private storage failure'); values.set(key, value); },
  };
  const controller = new DraftController('owner-a', storage);
  controller.load();
  controller.choosePreset(preset);
  return { controller, storage, values, setFailure: (value: boolean) => { fail = value; } };
}

test('letter length counts Unicode code points and rejects empty or overlong sealing', () => {
  assert.equal(characterCount('A💛B'), 3);
  assert.equal(letterProblem('💛'.repeat(LETTER_LIMIT)), null);
  assert.match(letterProblem('a'.repeat(LETTER_LIMIT + 1))!, /1 character/);
  assert.ok(letterProblem(' \n\t '));
  const { controller } = fixture();
  assert.equal(controller.seal(), false);
  controller.edit('a'.repeat(LETTER_LIMIT + 1));
  assert.equal(controller.seal(), false);
  assert.equal(controller.getSnapshot().draft!.text.length, LETTER_LIMIT + 1, 'Overlong text remains editable rather than being lost');
});

test('text and stationery survive a new controller and a sealed envelope can be reopened', () => {
  const { controller, storage } = fixture();
  controller.edit('A thought I want to keep.\nEven the quiet parts.');
  assert.equal(controller.seal(), true);
  const restored = new DraftController('owner-a', storage);
  restored.load();
  assert.equal(restored.getSnapshot().draft!.stage, 'sealed');
  assert.equal(restored.getSnapshot().draft!.preset!.id, preset.id);
  assert.equal(restored.getSnapshot().draft!.text, 'A thought I want to keep.\nEven the quiet parts.');
  restored.edit('Cannot silently edit a sealed letter');
  assert.equal(restored.getSnapshot().draft!.text, controller.getSnapshot().draft!.text);
  restored.unseal();
  restored.edit('An extra thought.');
  assert.equal(restored.getSnapshot().draft!.stage, 'writing');
  assert.equal(restored.getSnapshot().draft!.sealedAt, null);
});

test('account switching reads and writes separate draft keys', () => {
  const { controller, storage } = fixture();
  controller.edit('Only owner A should see this.');
  const other = new DraftController('owner-b', storage);
  other.load();
  assert.equal(other.getSnapshot().draft!.text, '');
  other.edit('Owner B has a different story.');
  controller.load();
  assert.equal(controller.getSnapshot().draft!.text, 'Only owner A should see this.');
  assert.notEqual(controller.key, other.key);
});

test('failed autosave keeps the current text, and failed sealing never reports a sealed envelope', () => {
  const { controller, setFailure, values } = fixture();
  controller.edit('The last saved words.');
  const lastSaved = values.get(controller.key);
  setFailure(true);
  controller.edit('These newer words are still in the editor.');
  assert.equal(controller.getSnapshot().save, 'error');
  assert.equal(controller.getSnapshot().draft!.text, 'These newer words are still in the editor.');
  assert.equal(controller.seal(), false);
  assert.equal(controller.getSnapshot().draft!.stage, 'writing');
  assert.equal(values.get(controller.key), lastSaved);
  setFailure(false);
  assert.equal(controller.retrySave(), true);
  assert.equal(controller.seal(), true);
  assert.equal(controller.getSnapshot().save, 'saved');
});

test('an unreadable or foreign draft is preserved until the user explicitly replaces it', () => {
  const { controller, values, storage } = fixture();
  const raw = values.get(controller.key)!;
  values.set(controller.key, raw.replace('owner-a', 'owner-b'));
  controller.load();
  assert.equal(controller.getSnapshot().phase, 'load-error');
  assert.equal(values.get(controller.key), raw.replace('owner-a', 'owner-b'));
  controller.edit('This must not overwrite an unreadable draft');
  assert.equal(values.get(controller.key), raw.replace('owner-a', 'owner-b'));
  assert.equal(controller.reset(), true);
  assert.equal(decodeDraft(storage.read(controller.key), 'owner-a').text, '');
});

test('corrupt drafts and unavailable storage do not become empty successful drafts', () => {
  for (const raw of ['{bad json', 'null', '{"version":2}', 'x'.repeat(100_001)]) assert.throws(() => decodeDraft(raw, 'owner-a'));
  const controller = new DraftController('owner-a', { read: () => { throw new Error('Unavailable'); }, write: () => { throw new Error('Must not overwrite'); } });
  controller.load();
  assert.equal(controller.getSnapshot().phase, 'load-error');
  assert.equal(controller.reset(), false);
  assert.equal(controller.getSnapshot().phase, 'load-error');
});

test('draft restoration removes unexpected metadata and rejects executable stationery values', () => {
  const { controller, values } = fixture();
  controller.edit('Some words.');
  const raw = JSON.parse(values.get(controller.key)!);
  raw.privateToken = 'must-not-survive';
  raw.preset.privateField = 'must-not-survive';
  assert.ok(!JSON.stringify(decodeDraft(JSON.stringify(raw), 'owner-a')).includes('must-not-survive'));
  raw.preset.config.paperColor = 'url(https://untrusted.invalid/collect)';
  assert.throws(() => decodeDraft(JSON.stringify(raw), 'owner-a'));
});

test('failed replacement preserves a previously sealed draft', () => {
  const { controller, setFailure } = fixture();
  controller.edit('Keep this letter.'); controller.seal();
  setFailure(true);
  assert.equal(controller.reset(), false);
  assert.equal(controller.getSnapshot().draft!.text, 'Keep this letter.');
  assert.equal(controller.getSnapshot().draft!.stage, 'sealed');
});
