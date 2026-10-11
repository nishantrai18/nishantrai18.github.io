(() => {
  'use strict';

  // Work and publication filters share URL state without resetting each other.
  // The unenhanced page shows every item; controls appear only after validation.
  function initCollectionFilters({ controls, items, attribute, parameter, defaultValue, matches, describe, status, onChange }) {
    const filters = document.querySelector(controls);
    if (!filters || !items.length) return;
    const buttons = [...filters.querySelectorAll(`button[${attribute}]`)]
      .filter(button => matches.has(button.getAttribute(attribute)));
    const defaultButton = buttons.find(button => button.getAttribute(attribute) === defaultValue);
    if (!defaultButton) return;
    const announcement = document.querySelector(status);
    const buttonFor = value => buttons.find(button => button.getAttribute(attribute) === value);

    buttons.forEach(button => {
      const count = items.filter(matches.get(button.getAttribute(attribute))).length;
      const label = button.querySelector('[data-filter-count]');
      if (label) label.textContent = count;
    });

    const applyFilter = button => {
      const filter = button.getAttribute(attribute);
      let count = 0;
      let hidesFocus = false;
      const activeElement = document.activeElement;
      items.forEach(item => {
        const visible = matches.get(filter)(item);
        if (!visible && item.contains(activeElement)) hidesFocus = true;
        item.hidden = !visible;
        if (visible) count++;
      });
      buttons.forEach(candidate => {
        candidate.setAttribute('aria-pressed', String(candidate === button));
      });
      if (announcement) announcement.textContent = describe(filter, count);
      onChange?.(count);
      if (hidesFocus) button.focus({ preventScroll: true });
    };

    const restore = () => {
      const value = new URL(window.location.href).searchParams.get(parameter);
      applyFilter(buttonFor(value) || defaultButton);
    };
    filters.hidden = false;
    restore();
    filters.addEventListener('click', event => {
      const button = event.target.closest?.(`button[${attribute}]`);
      if (!buttons.includes(button) || button.disabled) return;
      const value = button.getAttribute(attribute);
      const url = new URL(window.location.href);
      if (value === defaultValue) url.searchParams.delete(parameter);
      else url.searchParams.set(parameter, value);
      if (url.href !== window.location.href) window.history.pushState(window.history.state, '', url);
      applyFilter(button);
    });
    window.addEventListener('popstate', restore);
  }

  function balancedRows(count, maximum) {
    if (!count) return [];
    const rows = Math.ceil(count / maximum);
    const smaller = Math.floor(count / rows);
    const largerRows = count % rows;
    // Less crowded rows come first, giving earlier projects a little more width.
    return Array.from({ length: rows }, (_, row) => smaller + (row >= rows - largerRows ? 1 : 0));
  }

  function initWorkFilters() {
    const grid = document.querySelector('#work-items');
    if (!grid) return;
    const items = [...grid.querySelectorAll('.work-card')];
    const limits = { wide: 6, medium: 4, tablet: 3, mobile: 2 };
    const updateRows = () => {
      const visibleItems = items.filter(item => !item.hidden);
      Object.entries(limits).forEach(([size, maximum]) => {
        let index = 0;
        balancedRows(visibleItems.length, maximum).forEach(rowSize => {
          for (let column = 0; column < rowSize; column++) {
            visibleItems[index++].style.setProperty(`--work-row-${size}`, rowSize);
          }
        });
      });
    };
    updateRows();
    const labels = new Map(
      [...document.querySelectorAll('.work-filters button[data-work-filter][data-work-label]')]
        .map(button => [button.dataset.workFilter, button.dataset.workLabel])
        .filter(([category, label]) => category && category !== 'all' && label)
    );
    const matches = new Map([['all', () => true]]);
    labels.forEach((_, category) => matches.set(category, item => item.dataset.category === category));
    initCollectionFilters({
      controls: '.work-filters', items, attribute: 'data-work-filter', parameter: 'work', defaultValue: 'all', matches,
      status: '#work-status',
      onChange: updateRows,
      describe: (filter, count) => `Showing ${count}${labels.has(filter) ? ` ${labels.get(filter)}` : ''} ${count === 1 ? 'project' : 'projects'}.`
    });
  }

  function initPublicationFilters() {
    const items = [...document.querySelectorAll('#publications .publication')];
    const selected = paper => paper.dataset.selected === 'true';
    initCollectionFilters({
      controls: '.paper-filters', items, attribute: 'data-filter', parameter: 'papers',
      defaultValue: items.some(selected) ? 'selected' : 'all',
      matches: new Map([['selected', selected], ['all', () => true]]),
      status: '#paper-status',
      describe: (filter, count) => `Showing ${count} ${filter === 'selected' ? 'selected ' : ''}${count === 1 ? 'paper' : 'papers'}.`
    });
  }

  function initCitations() {
    const dialog = document.querySelector('#citation-dialog');
    const citationText = document.querySelector('#citation-text');
    const citationTitle = document.querySelector('#citation-title');
    if (!dialog || !citationText || !citationTitle ||
      typeof dialog.showModal !== 'function' || typeof dialog.close !== 'function') return;
    const copyButton = document.querySelector('#copy-citation');
    const copyStatus = document.querySelector('#copy-status');
    let opener = null;
    let copyRequest = 0;
    let copying = false;

    const setStatus = text => { if (copyStatus) copyStatus.textContent = text; };
    const resetCopy = () => {
      copyRequest++;
      copying = false;
      if (copyButton) {
        copyButton.disabled = false;
        copyButton.removeAttribute('aria-busy');
      }
    };
    const readCitation = button => {
      const template = document.getElementById(`bibtex-${button.dataset.citation}`);
      const text = template?.content?.textContent?.trim();
      if (!text) return null;
      return {
        text,
        title: button.closest('.publication')?.querySelector('h3')?.textContent || ''
      };
    };

    document.querySelectorAll('[data-citation]').forEach(button => {
      if (!readCitation(button)) return;
      button.hidden = false;
      button.addEventListener('click', () => {
        const citation = readCitation(button);
        if (!citation || dialog.open) return;
        opener = button;
        resetCopy();
        citationText.textContent = citation.text;
        citationTitle.textContent = citation.title;
        setStatus('');
        dialog.showModal();
      });
    });
    dialog.querySelector('.close-dialog')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      // A queued close event from an earlier opening must not reset a new one.
      if (dialog.open) return;
      resetCopy();
      if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus({ preventScroll: true });
      opener = null;
    });
    dialog.addEventListener('click', event => {
      const bounds = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
    });

    copyButton?.addEventListener('click', async () => {
      if (!dialog.open || copying) return;
      copying = true;
      copyButton.disabled = true;
      copyButton.setAttribute('aria-busy', 'true');
      setStatus('');
      const request = ++copyRequest;
      const isCurrent = () => dialog.open && request === copyRequest;
      try {
        await navigator.clipboard.writeText(citationText.textContent);
        if (isCurrent()) setStatus('Copied to clipboard.');
      } catch {
        if (!isCurrent()) return;
        citationText.focus({ preventScroll: true });
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(citationText);
          selection.removeAllRanges();
          selection.addRange(range);
          setStatus('Select and copy the highlighted citation.');
        } else {
          setStatus('Copy the citation above.');
        }
      } finally {
        if (isCurrent()) resetCopy();
      }
    });
  }

  initWorkFilters();
  initPublicationFilters();
  initCitations();
})();
