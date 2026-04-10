/**
 * This file powers the standalone spell data validation page.
 *
 * The page reuses the same spell inventory APIs that already feed the Dev Hub
 * panel, but it lives on its own so the user can inspect spell structure
 * without the rest of the tooling dashboard competing for attention.
 *
 * Called by: misc/spell_data_validation.html
 * Depends on: the spell field inventory API routes exposed from vite.config.ts
 */

// ============================================================================
// Shared Helpers
// ============================================================================
// These small helpers keep the rendering code safe and predictable. The page
// prints live field/value data from JSON files, so every visible string gets
// escaped before it enters the DOM.
// ============================================================================
function escapeHtml(str) {
    const s = String(str ?? '');
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function spellInvEscape(text) {
    return escapeHtml(String(text ?? ''));
}

// ============================================================================
// Spell Inventory State
// ============================================================================
// The page is intentionally field-first. We keep one summary object, one filtered
// list of fields, and the currently selected field path so the user can move
// between broad browsing and narrow reverse lookup without losing context.
// ============================================================================
let spellInventorySummary = null;
let spellInventoryFilteredFields = [];
let selectedSpellFieldPath = '';
let spellFieldDropdownOpen = false;

function getSpellFieldCategory(fieldPath) {
    const normalized = String(fieldPath || '').trim();
    if (!normalized) return 'other';

    const rootSegment = normalized.split('.')[0].replace(/\[\]/g, '');
    return rootSegment || 'other';
}

function formatSpellFieldCategoryLabel(category) {
    const label = String(category || 'other')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[-_]/g, ' ')
        .trim();

    if (!label) return 'Other';
    return label.charAt(0).toUpperCase() + label.slice(1);
}

// ============================================================================
// Status And Summary Rendering
// ============================================================================
// This status box is the user's quick checkpoint. It shows when the inventory
// was generated and how large the current structural dataset is, so the page
// immediately communicates whether it is looking at live data or stale data.
// ============================================================================
function renderSpellInventoryStatus(extraLine = '') {
    const statusEl = document.getElementById('spellInventoryStatus');
    if (!statusEl) return;

    if (!spellInventorySummary) {
        statusEl.textContent = extraLine || 'Spell field inventory not loaded yet.';
        return;
    }

    const lines = [
        `Generated: ${new Date(spellInventorySummary.generatedAt).toLocaleString()}`,
        `Spells: ${spellInventorySummary.spellCount}`,
        `Field Paths: ${spellInventorySummary.fieldCount}`,
        `Value Occurrences: ${spellInventorySummary.occurrenceCount}`,
    ];

    if (extraLine) lines.push(extraLine);
    statusEl.textContent = lines.join('\n');
}

function renderSpellFieldSuggestions() {
    const dropdownEl = document.getElementById('spellFieldDropdown');
    if (!dropdownEl || !spellInventorySummary) return;

    const inputNeedle = String(document.getElementById('spellFieldFilterInput')?.value || '').trim().toLowerCase();
    const visibleFields = (spellInventorySummary.fields || [])
        .filter((field) => {
            if (!inputNeedle) return true;
            return field.fieldPath.toLowerCase().includes(inputNeedle);
        })
        .slice(0, 300);

    if (!visibleFields.length) {
        dropdownEl.innerHTML = '<div class="spellval-dropdown-empty">No field paths match the current filter.</div>';
        return;
    }

    // The accordion groups subfields under the root field family so the user can
    // reason about one structural lane at a time instead of scanning a flat list
    // of hundreds of paths. Sample values stay attached to each subfield row so
    // repeated values remain visible without flattening them into the root label.
    const groupedFields = new Map();
    for (const field of visibleFields) {
        const root = getSpellFieldCategory(field.fieldPath);
        if (!groupedFields.has(root)) groupedFields.set(root, []);
        groupedFields.get(root).push(field);
    }

    dropdownEl.innerHTML = Array.from(groupedFields.entries()).map(([root, fields]) => {
        const rootLabel = spellInvEscape(formatSpellFieldCategoryLabel(root));
        const shouldOpen = !inputNeedle || root.toLowerCase().includes(inputNeedle) || fields.some((field) => field.fieldPath === selectedSpellFieldPath);
        const rows = fields.map((field) => {
            const relativePath = field.fieldPath === root ? '(root field)' : field.fieldPath.replace(new RegExp(`^${root}\\.?`), '') || '(root field)';
            const repeatedSampleValues = (field.sampleValues || [])
                .filter((value) => Number(value?.occurrenceCount || 0) > 1)
                .slice(0, 5)
                .map((value) => `<span class="spellinv-chip">${spellInvEscape(value.value)} <strong>${value.occurrenceCount}</strong></span>`)
                .join('');

            return `
                <button type="button" class="spellval-dropdown-field${field.fieldPath === selectedSpellFieldPath ? ' is-selected' : ''}" data-field-path="${spellInvEscape(field.fieldPath)}">
                    <div class="spellval-dropdown-field-label">${spellInvEscape(relativePath)}</div>
                    <div class="spellval-dropdown-field-meta">
                        full path: ${spellInvEscape(field.fieldPath)} |
                        spells: ${field.spellCount} |
                        distinct values: ${field.distinctValueCount}
                    </div>
                    <div class="spellval-dropdown-field-values">${repeatedSampleValues || '<span class="spellval-dropdown-muted">No repeated sample values for this field.</span>'}</div>
                </button>
            `;
        }).join('');

        return `
            <details class="spellval-dropdown-group" ${shouldOpen ? 'open' : ''}>
                <summary>
                    <span>${rootLabel}</span>
                    <span class="spellval-dropdown-group-meta">${fields.length} subfield(s)</span>
                </summary>
                <div class="spellval-dropdown-group-body">${rows}</div>
            </details>
        `;
    }).join('');

    dropdownEl.querySelectorAll('button[data-field-path]').forEach((button) => {
        button.addEventListener('click', () => {
            selectSpellFieldPath(button.getAttribute('data-field-path') || '');
            closeSpellFieldDropdown();
        });
    });
}

function renderSpellValueSuggestions(values = []) {
    const listEl = document.getElementById('spellValueSearchOptions');
    if (!listEl) return;

    // The value search intentionally excludes values that occur only once, because
    // those one-off values are usually too noisy for a dropdown and the user asked
    // for the repeat-pattern values that help reveal shared structure first.
    const repeatedValues = values
        .filter((value) => Number(value?.occurrenceCount || 0) > 1)
        .slice(0, 250);

    listEl.innerHTML = repeatedValues
        .map((value) => `<option value="${spellInvEscape(value.value)}"></option>`)
        .join('');
}

// ============================================================================
// Field Browser Rendering
// ============================================================================
// The field browser is grouped by top-level field family so the user can reason
// about shape families such as targeting, duration, and effects instead of
// scanning one giant flat list of paths.
// ============================================================================
function renderSpellFieldList() {
    const listEl = document.getElementById('spellFieldList');
    if (!listEl) return;

    if (!spellInventoryFilteredFields.length) {
        listEl.innerHTML = '<div class="spellinv-empty">No field paths match the current filter.</div>';
        return;
    }

    const groupedFields = new Map();
    for (const field of spellInventoryFilteredFields.slice(0, 250)) {
        const category = getSpellFieldCategory(field.fieldPath);
        if (!groupedFields.has(category)) groupedFields.set(category, []);
        groupedFields.get(category).push(field);
    }

    listEl.innerHTML = Array.from(groupedFields.entries()).map(([category, fields]) => {
        const categoryFieldCount = new Set(fields.map((field) => field.fieldPath)).size;
        const rows = fields.map((field) => {
            const selectedClass = field.fieldPath === selectedSpellFieldPath ? ' is-selected' : '';
            const sampleChips = (field.sampleValues || []).slice(0, 4).map((value) =>
                `<span class="spellinv-chip">${spellInvEscape(value.value)} <strong>${value.occurrenceCount}</strong></span>`
            ).join('');

            return `
                <div class="spellinv-row${selectedClass}">
                    <button type="button" data-field-path="${spellInvEscape(field.fieldPath)}">
                        <div class="path">${spellInvEscape(field.fieldPath)}</div>
                        <div class="meta">
                            kind: ${spellInvEscape(field.containerKind)} |
                            spells: ${field.spellCount} |
                            distinct values: ${field.distinctValueCount}
                        </div>
                        <div class="chips">${sampleChips}</div>
                    </button>
                </div>
            `;
        }).join('');

        return `
            <section class="spellinv-group">
                <div class="spellinv-group-header">
                    <div class="spellinv-group-title">${spellInvEscape(formatSpellFieldCategoryLabel(category))}</div>
                    <div class="spellinv-group-meta">${categoryFieldCount} field path(s)</div>
                </div>
                <div class="spellinv-group-body">${rows}</div>
            </section>
        `;
    }).join('');

    // This delegated click handling keeps the page self-contained instead of
    // relying on inline globals sprinkled through the HTML body.
    listEl.querySelectorAll('button[data-field-path]').forEach((button) => {
        button.addEventListener('click', () => {
            selectSpellFieldPath(button.getAttribute('data-field-path') || '');
        });
    });
}

// ============================================================================
// Value And Result Rendering
// ============================================================================
// These lists answer the two main questions behind this page:
// 1. "What values show up in this field?"
// 2. "Which spells use this field/value combination?"
// ============================================================================
function renderSpellValueList(values = []) {
    const listEl = document.getElementById('spellValueList');
    if (!listEl) return;

    if (!values.length) {
        listEl.innerHTML = '<div class="spellinv-empty">No distinct values for the current field/query.</div>';
        return;
    }

    listEl.innerHTML = values.map((value) => `
        <div class="spellinv-row">
            <div class="path">${spellInvEscape(value.value)}</div>
            <div class="meta">
                kind: ${spellInvEscape(value.valueKind)} |
                occurrences: ${value.occurrenceCount} |
                spells: ${value.spellCount}
            </div>
        </div>
    `).join('');
}

function renderSpellQueryResults(occurrences = [], totalMatches = 0) {
    const listEl = document.getElementById('spellQueryResults');
    if (!listEl) return;

    if (!occurrences.length) {
        listEl.innerHTML = '<div class="spellinv-empty">No spells match the current field/value filters.</div>';
        return;
    }

    const formatHitLine = (occurrence) => {
        const lineNumber = Number(occurrence?.lineNumber || 0);
        return lineNumber > 0 ? `Hit line: ${lineNumber}` : 'Hit line: unavailable';
    };

    const buildSpellViewHref = (occurrence) => {
        const browserPath = String(occurrence?.browserPath || '').trim();
        if (!browserPath) return '#';

        // The standalone validation page opens the runtime JSON directly in a new
        // tab instead of inventing a second viewer surface. The search result row
        // still shows the hit line locally so the user can cross-reference the raw
        // file even though the browser JSON view itself cannot scroll to a line.
        return browserPath;
    };

    const formatSemanticField = (occurrence) => {
        const semanticFieldPath = String(occurrence?.semanticFieldPath || '').trim();
        const structuralFieldPath = String(occurrence?.fieldPath || '').trim();
        if (!semanticFieldPath || semanticFieldPath === structuralFieldPath) return '';
        return semanticFieldPath;
    };

    listEl.innerHTML = `
        <div class="spellinv-empty">Showing ${occurrences.length} of ${totalMatches} matches.</div>
        ${occurrences.map((occurrence) => `
            <div class="spellinv-row">
                <div class="path">
                    <a class="spellval-result-link" href="${spellInvEscape(buildSpellViewHref(occurrence))}" target="_blank" rel="noopener noreferrer">
                        ${spellInvEscape(occurrence.spellName)} (Level ${occurrence.level})
                    </a>
                </div>
                <div class="meta">${spellInvEscape(occurrence.fieldPath)} = ${spellInvEscape(occurrence.value)}</div>
                ${formatSemanticField(occurrence) ? `<div class="meta spellval-semantic-field">Semantic field: ${spellInvEscape(formatSemanticField(occurrence))} = ${spellInvEscape(occurrence.value)}</div>` : ''}
                <div class="meta">${spellInvEscape(formatHitLine(occurrence))} | ${spellInvEscape(occurrence.browserPath || occurrence.filePath)}</div>
                <div class="meta">${spellInvEscape(occurrence.filePath)}</div>
            </div>
        `).join('')}
    `;
}

// ============================================================================
// User Interaction And API Calls
// ============================================================================
// The page uses the existing Vite middleware endpoints so the standalone page
// always reflects the same live dataset as the Dev Hub panel. Refresh pulls a
// fresh summary; search runs a narrower query against the selected field/value.
// ============================================================================
function filterSpellFieldList() {
    if (!spellInventorySummary) return;

    const needle = String(document.getElementById('spellFieldFilterInput')?.value || '').trim().toLowerCase();
    spellInventoryFilteredFields = (spellInventorySummary.fields || []).filter((field) => {
        if (!needle) return true;
        return field.fieldPath.toLowerCase().includes(needle);
    });

    renderSpellFieldSuggestions();
    renderSpellFieldList();
}

function openSpellFieldDropdown() {
    const dropdownEl = document.getElementById('spellFieldDropdown');
    if (!dropdownEl) return;
    spellFieldDropdownOpen = true;
    dropdownEl.classList.add('is-open');
    renderSpellFieldSuggestions();
}

function closeSpellFieldDropdown() {
    const dropdownEl = document.getElementById('spellFieldDropdown');
    if (!dropdownEl) return;
    spellFieldDropdownOpen = false;
    dropdownEl.classList.remove('is-open');
}

function selectSpellFieldPath(fieldPath) {
    selectedSpellFieldPath = String(fieldPath || '');
    const input = document.getElementById('spellFieldFilterInput');
    if (input) input.value = selectedSpellFieldPath;
    filterSpellFieldList();
    runSpellInventoryQuery();
}

async function refreshSpellInventory(forceRefresh = false) {
    const refreshBtn = document.getElementById('spellInventoryRefreshBtn');
    if (refreshBtn) refreshBtn.disabled = true;

    renderSpellInventoryStatus('Refreshing spell field inventory...');

    try {
        const suffix = forceRefresh ? '?refresh=1' : '';
        const res = await fetch(`/api/spells/field-inventory/summary${suffix}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        spellInventorySummary = await res.json();
        spellInventoryFilteredFields = spellInventorySummary.fields || [];

        renderSpellInventoryStatus();
        renderSpellFieldSuggestions();
        filterSpellFieldList();
        await runSpellInventoryQuery();
    } catch (error) {
        renderSpellInventoryStatus(`Spell inventory load failed: ${String(error)}`);
        renderSpellValueList([]);
        renderSpellQueryResults([], 0);
    } finally {
        if (refreshBtn) refreshBtn.disabled = false;
    }
}

async function runSpellInventoryQuery() {
    const searchBtn = document.getElementById('spellInventorySearchBtn');
    if (searchBtn) searchBtn.disabled = true;

    const fieldPath = String(document.getElementById('spellFieldFilterInput')?.value || '').trim();
    const value = String(document.getElementById('spellValueSearchInput')?.value || '').trim();
    const level = String(document.getElementById('spellLevelFilterSelect')?.value || '').trim();
    const includeFreeText = Boolean(document.getElementById('spellIncludeFreeTextToggle')?.checked);

    try {
        const params = new URLSearchParams();
        if (fieldPath) params.set('fieldPath', fieldPath);
        if (value) params.set('value', value);
        if (level) params.set('level', level);
        if (includeFreeText) params.set('includeFreeText', '1');
        params.set('limit', '200');

        const res = await fetch(`/api/spells/field-inventory/query?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        selectedSpellFieldPath = fieldPath;
        renderSpellValueList(data.distinctValues || []);
        renderSpellValueSuggestions(data.distinctValues || []);
        renderSpellQueryResults(data.occurrences || [], data.totalMatches || 0);
        renderSpellInventoryStatus(`Current field filter: ${fieldPath || 'all fields'}`);
        filterSpellFieldList();
    } catch (error) {
        renderSpellValueList([]);
        renderSpellValueSuggestions([]);
        renderSpellQueryResults([], 0);
        renderSpellInventoryStatus(`Spell query failed: ${String(error)}`);
    } finally {
        if (searchBtn) searchBtn.disabled = false;
    }
}

// ============================================================================
// Page Boot
// ============================================================================
// The standalone page should come up already useful, so it loads the current
// summary immediately and then populates the detail columns from that state.
// ============================================================================
document.addEventListener('click', (event) => {
    if (!spellFieldDropdownOpen) return;

    const target = event.target;
    const fieldControl = document.querySelector('#spellFieldFilterInput')?.closest('.spellinv-control');
    if (fieldControl && target instanceof Node && fieldControl.contains(target)) return;

    closeSpellFieldDropdown();
});

refreshSpellInventory(false);
