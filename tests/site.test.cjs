const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'assets/js/site.js'), 'utf8');
const domModule = import('happy-dom');
const settle = () => new Promise(resolve => setImmediate(resolve));
const workRows = items => ['wide', 'medium', 'tablet', 'mobile'].map(size => {
  const rows = [];
  for (let index = 0; index < items.length;) {
    const property = `--work-row-${size}`;
    const count = Number(items[index].style.getPropertyValue(property));
    assert.ok(Number.isInteger(count) && count > 0, `${property} must have a valid row size`);
    const row = items.slice(index, index + count);
    assert.equal(row.length, count, 'Every row fills its assigned width');
    assert.ok(row.every(item => Number(item.style.getPropertyValue(property)) === count), 'Every item in a row has the same width');
    rows.push(count);
    index += count;
  }
  return rows;
});

// Controlled publications exercise optional fields and filter states regardless
// of which papers the author chooses to publish. Separate smoke tests below use
// the unmodified generated page to retain coverage of the Liquid templates.
const fixturePublications = [
  { id: 'fixture-alpha', title: 'Fixture Alpha', selected: true },
  { id: 'fixture-beta', title: 'Fixture Beta', selected: true },
  { id: 'fixture-gamma', title: 'Fixture Gamma', selected: false }
].map(paper => `
  <article class="publication" data-selected="${paper.selected}" aria-labelledby="title-${paper.id}">
    <h3 id="title-${paper.id}"><a href="https://example.org/${paper.id}">${paper.title}</a></h3>
    <div class="paper-links">
      <a href="https://example.org/${paper.id}">Paper</a>
      <button type="button" data-citation="${paper.id}" hidden>BibTeX</button>
      <template id="bibtex-${paper.id}">@inproceedings{${paper.id},
        title = {${paper.title}}, author = {Example, Author}, year = {2026}
      }</template>
    </div>
  </article>`).join('');

const fixtureWork = `
  <div class="work-filters" role="group" aria-label="Filter work" hidden>
    ${[['all', 'All'], ['openai', 'OpenAI'], ['waymo', 'Waymo'], ['research', 'Research']].map(([value, label]) => `
      <button type="button" data-work-filter="${value}" data-work-label="${label}" aria-controls="work-items" aria-pressed="${value === 'all'}">
        ${label} <span data-filter-count></span>
      </button>`).join('')}
  </div>
  <div id="work-items">
    ${['openai', 'openai', 'waymo', 'research'].map((category, index) => `
      <article class="work-card" data-category="${category}">
        <a href="https://example.org/project-${index}">Project ${index}</a>
      </article>`).join('')}
  </div>
  <p id="work-status" role="status"></p>`;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function page(t, { file = 'index.html', prepare, start = true, fixtures = true, url = 'http://localhost:8767/' } = {}) {
  const { Window } = await domModule;
  const window = new Window({
    url,
    settings: {
      enableJavaScriptEvaluation: true,
      // Only the checked-in site script is evaluated; remote loading is disabled.
      suppressInsecureJavaScriptEnvironmentWarning: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true
    }
  });
  const document = window.document;
  const errors = [];
  window.addEventListener('error', event => errors.push(event.error));
  document.write(fs.readFileSync(path.join(root, '_site', file), 'utf8'));
  if (fixtures && document.querySelector('#publications')) {
    document.querySelector('#publications').innerHTML = fixturePublications;
    document.querySelector('#work').innerHTML = fixtureWork;
  }
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const setClipboard = writeText => Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined
  });
  setClipboard(async () => {});
  const context = { window, document, $, $$, setClipboard };
  if (prepare) prepare(context);
  context.start = () => window.eval(script);
  if (start) context.start();
  t.after(async () => {
    await window.happyDOM.close();
    assert.deepEqual(errors, [], 'No uncaught errors from interaction handlers');
  });
  return context;
}

test('without JavaScript, every project and publication remains readable and inert controls stay hidden', async t => {
  const { $$, $ } = await page(t, { start: false, fixtures: false });
  assert.ok($$('.publication').length > 0);
  assert.ok($$('.publication').every(paper => !paper.hidden));
  assert.ok($('.paper-filters').hidden);
  assert.ok($$('[data-citation]').every(button => button.hidden));
  assert.ok($$('#work-items .work-card').length > 0);
  assert.ok($$('#work-items .work-card').every(item => !item.hidden));
  assert.ok($('.work-filters').hidden);
});

test('the generated work controls match published categories and display actual counts', async t => {
  const { $$, $ } = await page(t, { fixtures: false });
  const items = $$('#work-items .work-card');
  assert.ok(items.length > 0);
  assert.ok(items.every(item => !item.hidden));
  assert.equal($('.work-filters').hidden, false);
  const buttons = $$('.work-filters [data-work-filter]');
  assert.ok(buttons.some(button => button.dataset.workFilter === 'all'));
  for (const item of items) assert.ok(buttons.some(button => button.dataset.workFilter === item.dataset.category));
  for (const button of buttons) {
    const category = button.dataset.workFilter;
    if (category !== 'all') assert.ok(button.dataset.workLabel);
    const count = items.filter(item => category === 'all' || item.dataset.category === category).length;
    assert.equal(button.getAttribute('aria-controls'), 'work-items');
    assert.equal(Number(button.querySelector('[data-filter-count]').textContent), count);
    button.click();
    assert.equal(items.filter(item => !item.hidden).length, count);
  }
});

test('work rows balance sparse and full collections, with less crowded rows first', async t => {
  const cases = [
    [0, [[], [], [], []]],
    [1, [[1], [1], [1], [1]]],
    [2, [[2], [2], [2], [2]]],
    [3, [[3], [3], [3], [1, 2]]],
    [4, [[4], [4], [2, 2], [2, 2]]],
    [7, [[3, 4], [3, 4], [2, 2, 3], [1, 2, 2, 2]]],
    [8, [[4, 4], [4, 4], [2, 3, 3], [2, 2, 2, 2]]],
    [9, [[4, 5], [3, 3, 3], [3, 3, 3], [1, 2, 2, 2, 2]]],
    [12, [[6, 6], [4, 4, 4], [3, 3, 3, 3], [2, 2, 2, 2, 2, 2]]],
    [13, [[4, 4, 5], [3, 3, 3, 4], [2, 2, 3, 3, 3], [1, 2, 2, 2, 2, 2, 2]]],
    [14, [[4, 5, 5], [3, 3, 4, 4], [2, 3, 3, 3, 3], [2, 2, 2, 2, 2, 2, 2]]]
  ];
  for (const [count, expected] of cases) {
    const { $, $$ } = await page(t, { prepare: ({ $ }) => {
      $('#work-items').innerHTML = Array.from({ length: count }, (_, index) => `
        <article class="work-card" data-category="openai">
          <a href="https://example.org/project-${index}">Project ${index}</a>
        </article>`).join('');
    } });
    const items = $$('#work-items .work-card');
    assert.deepEqual(workRows(items), expected, `${count} projects`);
    if (count) {
      $('[data-work-filter="waymo"]').click();
      assert.deepEqual(workRows(items.filter(item => !item.hidden)), [[], [], [], []], 'An empty category is safe');
      $('[data-work-filter="all"]').click();
      assert.deepEqual(workRows(items), expected, 'Restoring all projects also restores their layout');
      assert.deepEqual($$('#work-items .work-card'), items, 'Layout updates preserve the original elements');
    }
  }
});

test('the generated work rows are already balanced before JavaScript runs', async t => {
  const { $, $$, start } = await page(t, { fixtures: false, start: false });
  const items = $$('#work-items .work-card');
  const initialRows = workRows(items);
  assert.equal($('#work-items').style.getPropertyValue('--work-columns-wide'), '', 'Obsolete grid column styles are absent');
  start();
  assert.deepEqual(workRows(items), initialRows, 'Liquid and JavaScript produce the same initial layout');
});

test('the generated work rows balance initial deep links, filter changes and history restoration', async t => {
  const { $, $$, window } = await page(t, {
    fixtures: false,
    url: 'http://localhost:8767/?papers=all&work=openai#work'
  });
  const expectations = new Map([
    [2, [[2], [2], [2], [2]]],
    [3, [[3], [3], [3], [1, 2]]],
    [8, [[4, 4], [4, 4], [2, 3, 3], [2, 2, 2, 2]]],
    [13, [[4, 4, 5], [3, 3, 3, 4], [2, 2, 3, 3, 3], [1, 2, 2, 2, 2, 2, 2]]]
  ]);
  const assertLayout = () => {
    const items = $$('#work-items .work-card').filter(item => !item.hidden);
    const expected = expectations.get(items.length);
    assert.ok(expected, `Add a layout expectation when the published collection changes (${items.length} visible projects)`);
    assert.deepEqual(workRows(items), expected);
    assert.ok($$('.publication').every(paper => !paper.hidden), 'Work layout changes preserve the paper filter');
  };
  assertLayout();
  for (const filter of ['waymo', 'research', 'all', 'openai']) {
    $(`[data-work-filter="${filter}"]`).click();
    assertLayout();
  }
  window.history.replaceState(null, '', '?papers=all');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  assertLayout();
  window.history.replaceState(null, '', '?papers=all&work=waymo');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  assertLayout();
});

test('work filtering preserves elements, counts and accessible state; hiding focused work restores focus', async t => {
  const { $$, $, document } = await page(t);
  const items = $$('#work-items .work-card');
  const all = $('[data-work-filter="all"]');
  const waymo = $('[data-work-filter="waymo"]');
  assert.equal(all.querySelector('[data-filter-count]').textContent, '4');
  assert.equal($('[data-work-filter="openai"] [data-filter-count]').textContent, '2');
  items[0].querySelector('a').focus();
  waymo.querySelector('[data-filter-count]').click();
  assert.equal(document.activeElement, waymo);
  assert.equal(waymo.getAttribute('aria-pressed'), 'true');
  assert.equal(all.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(items.filter(item => !item.hidden).map(item => item.dataset.category), ['waymo']);
  assert.equal($('#work-status').textContent, 'Showing 1 Waymo project.');
  const visibleLink = items[2].querySelector('a');
  visibleLink.focus();
  all.click();
  assert.equal(document.activeElement, visibleLink, 'A still-visible link does not lose focus');
  assert.ok(items.every(item => !item.hidden));
  assert.equal($('#work-status').textContent, 'Showing 4 projects.');
  assert.deepEqual($$('#work-items .work-card'), items, 'Filtering does not rerender existing links');
});

test('a custom rendered category supports counts, announcements and URL state without a JavaScript registry', async t => {
  const { $, $$, window } = await page(t, {
    url: 'http://localhost:8767/?work=robotics-lab&papers=all#work',
    prepare: ({ $ }) => {
      $('.work-filters').insertAdjacentHTML('beforeend', `
        <button type="button" data-work-filter="robotics-lab" data-work-label="Robotics Lab" aria-controls="work-items" aria-pressed="false">
          Robotics Lab <span data-filter-count></span>
        </button>`);
      $('#work-items').insertAdjacentHTML('beforeend', `
        <article class="work-card" data-category="robotics-lab">
          <a href="https://example.org/robotics-project">Robotics project</a>
        </article>`);
    }
  });
  const custom = $('[data-work-filter="robotics-lab"]');
  assert.equal(custom.getAttribute('aria-pressed'), 'true');
  assert.equal(custom.querySelector('[data-filter-count]').textContent, '1');
  assert.equal($('[data-work-filter="all"] [data-filter-count]').textContent, '5');
  assert.deepEqual($$('#work-items .work-card').filter(item => !item.hidden).map(item => item.dataset.category), ['robotics-lab']);
  assert.equal($('#work-status').textContent, 'Showing 1 Robotics Lab project.');
  $('[data-work-filter="all"]').click();
  assert.ok($$('#work-items .work-card').every(item => !item.hidden));
  custom.click();
  assert.equal(window.location.href, 'http://localhost:8767/?papers=all&work=robotics-lab#work');
  assert.equal(custom.getAttribute('aria-pressed'), 'true');
});

test('work and paper filters restore deep links and preserve each other, unrelated parameters and anchors', async t => {
  const { $, $$, window } = await page(t, { url: 'http://localhost:8767/?source=profile&work=waymo&papers=all#work' });
  assert.equal($('[data-work-filter="waymo"]').getAttribute('aria-pressed'), 'true');
  assert.ok($$('.publication').every(paper => !paper.hidden));
  $('[data-work-filter="research"]').click();
  let url = new URL(window.location.href);
  assert.equal(url.searchParams.get('work'), 'research');
  assert.equal(url.searchParams.get('papers'), 'all');
  assert.equal(url.searchParams.get('source'), 'profile');
  assert.equal(url.hash, '#work');
  $('[data-filter="selected"]').click();
  url = new URL(window.location.href);
  assert.equal(url.searchParams.has('papers'), false, 'Default filters have a concise URL');
  assert.equal(url.searchParams.get('work'), 'research');
  $('[data-work-filter="all"]').click();
  assert.equal(window.location.href, 'http://localhost:8767/?source=profile#work');
  const entries = window.history.length;
  $('[data-work-filter="all"]').click();
  assert.equal(window.history.length, entries, 'Repeated selections do not add duplicate history');
});

test('popstate restores both filters and only moves focus when the focused item is hidden', async t => {
  const { $, $$, window, document } = await page(t);
  $('[data-filter="all"]').click();
  $$('.publication').find(paper => paper.dataset.selected === 'false').querySelector('a').focus();
  window.history.replaceState({ marker: 'retained' }, '', '?work=waymo#research');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  assert.equal($('[data-work-filter="waymo"]').getAttribute('aria-pressed'), 'true');
  assert.equal($('[data-filter="selected"]').getAttribute('aria-pressed'), 'true');
  assert.equal(document.activeElement, $('[data-filter="selected"]'));
  $('[data-work-filter="research"]').click();
  assert.equal(window.history.state.marker, 'retained');
  window.history.replaceState(null, '', '?work=all&papers=all');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  assert.ok($$('#work-items .work-card, .publication').every(item => !item.hidden));
});

test('invalid query values and unregistered controls are ignored without losing readable defaults', async t => {
  const { $, $$, document, window } = await page(t, { url: 'http://localhost:8767/?work=unknown&papers=none' });
  assert.equal($('[data-work-filter="all"]').getAttribute('aria-pressed'), 'true');
  assert.equal($('[data-filter="selected"]').getAttribute('aria-pressed'), 'true');
  assert.ok($$('#work-items .work-card').every(item => !item.hidden));
  const unknown = document.createElement('button');
  unknown.dataset.workFilter = 'unknown';
  $('.work-filters').append(unknown);
  unknown.click();
  assert.equal(window.location.search, '?work=unknown&papers=none');
  $('[data-work-filter="openai"]').disabled = true;
  $('[data-work-filter="openai"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal($('[data-work-filter="all"]').getAttribute('aria-pressed'), 'true');
});

test('empty or incomplete work controls stay hidden, and missing optional UI stays safe', async t => {
  const empty = await page(t, { prepare: ({ $ }) => $('#work-items').replaceChildren() });
  assert.ok(empty.$('.work-filters').hidden);
  const incomplete = await page(t, { prepare: ({ $ }) => $('[data-work-filter="all"]').remove() });
  assert.ok(incomplete.$('.work-filters').hidden);
  assert.ok(incomplete.$$('#work-items .work-card').every(item => !item.hidden));
  const optional = await page(t, { prepare: ({ $, $$ }) => {
    $('#work-status').remove();
    $$('.work-filters [data-filter-count]').forEach(count => count.remove());
  } });
  optional.$('[data-work-filter="waymo"]').click();
  assert.equal(optional.$$('#work-items .work-card').filter(item => !item.hidden).length, 1);
});

test('the generated page wires the current selected papers and optional citations correctly', async t => {
  const { $$, $ } = await page(t, { fixtures: false });
  const papers = $$('.publication');
  const selected = papers.filter(paper => paper.dataset.selected === 'true');
  assert.equal(papers.filter(paper => !paper.hidden).length, selected.length || papers.length);
  const buttons = $$('[data-citation]');
  for (const button of buttons) {
    const template = $(`#bibtex-${button.dataset.citation}`);
    const expected = template?.content?.textContent.trim();
    assert.equal(button.hidden, !expected);
  }
  const button = buttons.find(candidate => !candidate.hidden && !candidate.closest('.publication').hidden);
  if (button) {
    const expected = $(`#bibtex-${button.dataset.citation}`).content.textContent.trim();
    button.click();
    assert.equal($('#citation-text').textContent, expected);
    assert.ok($('#citation-dialog').open);
    $('.close-dialog').click();
  }
});

test('publication filters update visible work, pressed state and the announcement', async t => {
  const { $$, $, document } = await page(t);
  const papers = $$('.publication');
  const selectedCount = papers.filter(paper => paper.dataset.selected === 'true').length;
  const selected = $('[data-filter="selected"]');
  const all = $('[data-filter="all"]');
  assert.equal(papers.filter(paper => !paper.hidden).length, selectedCount);
  const label = document.createElement('span');
  label.textContent = all.textContent;
  all.replaceChildren(label);
  label.click();
  assert.ok(papers.every(paper => !paper.hidden));
  assert.equal(all.getAttribute('aria-pressed'), 'true');
  assert.equal(selected.getAttribute('aria-pressed'), 'false');
  assert.equal($('#paper-status').textContent, `Showing ${papers.length} papers.`);

  // A programmatic filter change must not leave keyboard focus in hidden work.
  papers.find(paper => paper.dataset.selected === 'false').querySelector('a').focus();
  selected.click();
  assert.equal(document.activeElement, selected);
  assert.equal(papers.filter(paper => !paper.hidden).length, selectedCount);
  assert.equal($('#paper-status').textContent, `Showing ${selectedCount} selected papers.`);
  assert.equal($('.publication'), papers[0], 'Filtering preserves existing elements');

  const unknown = document.createElement('button');
  unknown.dataset.filter = 'unrecognized';
  $('.paper-filters').append(unknown);
  unknown.click();
  assert.equal(selected.getAttribute('aria-pressed'), 'true');
  assert.equal(papers.filter(paper => !paper.hidden).length, selectedCount);
});

test('missing optional status and missing selected flags leave a usable paper list', async t => {
  const { $$, $ } = await page(t, { prepare: ({ $$, $ }) => {
    $('#paper-status').remove();
    $$('.publication').forEach(paper => delete paper.dataset.selected);
  } });
  assert.ok($$('.publication').every(paper => !paper.hidden));
  assert.equal($('[data-filter="all"]').getAttribute('aria-pressed'), 'true');
});

test('only valid citation controls are enabled; missing optional controls do not break opening', async t => {
  const { $, $$ } = await page(t, { prepare: ({ $ }) => {
    $('#bibtex-fixture-alpha').remove();
    $('#copy-status').remove();
    $('#copy-citation').remove();
  } });
  assert.ok($('[data-citation="fixture-alpha"]').hidden);
  const valid = $$('[data-citation]').find(button => !button.hidden);
  valid.click();
  assert.ok($('#citation-dialog').open);
  assert.match($('#citation-text').textContent, /@inproceedings/);
  assert.equal($('#citation-title').textContent, valid.closest('.publication').querySelector('h3').textContent);
  $('.close-dialog').click();
  assert.equal($('#citation-dialog').open, false);
});

test('copying writes exactly the displayed citation and ignores repeated clicks while pending', async t => {
  const result = deferred();
  const calls = [];
  const { $, window } = await page(t, { prepare: ({ setClipboard }) => {
    setClipboard(text => { calls.push(text); return result.promise; });
  } });
  $('[data-citation="fixture-alpha"]').click();
  const copy = $('#copy-citation');
  copy.click();
  copy.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(calls, [$('#citation-text').textContent]);
  assert.equal(copy.disabled, true);
  result.resolve();
  await settle();
  assert.equal($('#copy-status').textContent, 'Copied to clipboard.');
  assert.equal(copy.disabled, false);
  assert.equal(copy.hasAttribute('aria-busy'), false);
});

for (const outcome of ['resolve', 'reject']) {
  test(`a previous dialog's ${outcome} cannot change a new citation or its pending copy`, async t => {
    const oldCopy = deferred();
    const newCopy = deferred();
    let count = 0;
    const { $, document } = await page(t, { prepare: ({ setClipboard }) => {
      setClipboard(() => (++count === 1 ? oldCopy : newCopy).promise);
    } });
    const first = $('[data-citation="fixture-alpha"]');
    first.click();
    $('#copy-citation').click();
    $('.close-dialog').click();
    assert.equal(document.activeElement, first, 'Closing returns focus to the citation opener');
    const second = $('[data-citation="fixture-beta"]');
    second.click();
    $('#copy-citation').click();
    const secondText = $('#citation-text').textContent;
    oldCopy[outcome](new Error('Late clipboard result'));
    await settle();
    assert.equal($('#citation-text').textContent, secondText);
    assert.equal($('#copy-status').textContent, '');
    assert.equal($('#copy-citation').disabled, true);
    newCopy.resolve();
    await settle();
    assert.equal($('#copy-status').textContent, 'Copied to clipboard.');
    assert.equal($('#copy-citation').disabled, false);
    $('.close-dialog').click();
    assert.equal(document.activeElement, second);
  });
}

test('clipboard denial selects the current citation for manual copying', async t => {
  const { $, window, document } = await page(t, { prepare: ({ setClipboard }) => {
    setClipboard(async () => { throw new Error('Clipboard access denied'); });
  } });
  $('[data-citation="fixture-alpha"]').click();
  $('#copy-citation').click();
  await settle();
  assert.equal(window.getSelection().toString(), $('#citation-text').textContent);
  assert.equal(document.activeElement, $('#citation-text'));
  assert.equal($('#copy-status').textContent, 'Select and copy the highlighted citation.');
  assert.equal($('#copy-citation').disabled, false);
});

test('a delayed close event from a previous opening does not disrupt a reopened dialog', async t => {
  const { $, window, document } = await page(t);
  $('[data-citation="fixture-alpha"]').click();
  const dialog = $('#citation-dialog');
  dialog.open = false; // Native close events are queued, unlike this DOM runner's close().
  const second = $('[data-citation="fixture-beta"]');
  second.click();
  dialog.dispatchEvent(new window.Event('close'));
  assert.ok(dialog.open);
  assert.equal($('#citation-title').textContent, 'Fixture Beta');
  $('.close-dialog').click();
  assert.equal(document.activeElement, second);
});

test('missing dialog support and the 404 page initialize without broken controls or errors', async t => {
  const unsupported = await page(t, { prepare: ({ $ }) => { $('#citation-dialog').showModal = undefined; } });
  assert.ok(unsupported.$$('[data-citation]').every(button => button.hidden));
  const notFound = await page(t, { file: '404.html' });
  assert.equal(notFound.$('.work-filters, .paper-filters, #citation-dialog'), null);
});
