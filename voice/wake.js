// Is the assistant being called? Finds his name among the first words of a transcribed phrase (Cyrillic or Latin,
// tolerant of small transcription slips) and returns what was said after it, or null if he wasn't addressed.
// Spellings in different scripts usually keep the consonants ("Shpitaen" / "Шпитон" -> shptn), so those must match too.

const RU = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const latin = (s) => s.toLowerCase().replace(/[а-яё]/g, (c) => RU[c]).replace(/[^a-z]/g, '');
const consonants = (s) => s.replace(/[aeiouy]/g, '');

function distance(a, b) { // Levenshtein
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

function afterName(text, name) {
  const target = latin(name);
  if (!target) return null;
  const slack = target.length <= 4 ? 0 : Math.floor(target.length / 4); // short names must match exactly
  const skeleton = consonants(target);
  const words = text.trim().split(/\s+/);
  for (let i = 0; i < Math.min(3, words.length); i++) { // "Shpiton, ...", "Hey Shpiton ...", "Слушай, Шпитон ..."
    const w = latin(words[i]);
    if (w && (distance(w, target) <= slack || (skeleton.length >= 3 && consonants(w) === skeleton))) return words.slice(i + 1).join(' ').replace(/^[\s,.!?:;-]+/, '');
  }
  return null;
}

module.exports = { afterName };

if (require.main === module) { // node voice/wake.js
  const assert = require('assert');
  assert.strictEqual(afterName('Шпитон, какая погода?', 'Shpiton'), 'какая погода?');
  assert.strictEqual(afterName('Hey Shpiton, open the browser.', 'Shpiton'), 'open the browser.');
  assert.strictEqual(afterName('Шпиттон!', 'Shpiton'), ''); // transcription slip, name only
  assert.strictEqual(afterName('Спитон, привет', 'Shpiton'), 'привет');
  assert.strictEqual(afterName('какая сегодня погода', 'Shpiton'), null);
  assert.strictEqual(afterName('я сказал ему, Шпитон пришёл', 'Shpiton'), null); // name not near the start
  assert.strictEqual(afterName('Шпитон, какая погода?', 'Shpitaen'), 'какая погода?'); // other script, other vowels
  assert.strictEqual(afterName('Шпитайн!', 'Shpitaen'), '');
  assert.strictEqual(afterName('Shpitaen, open my mail', 'Shpitaen'), 'open my mail');
  assert.strictEqual(afterName('шпатель нужен', 'Shpitaen'), null);
  assert.strictEqual(afterName('Max, hi', 'Max'), 'hi');
  assert.strictEqual(afterName('mix it well', 'Max'), null);
  console.log('wake ok');
}
