// Self-hosted font: bundled by Vite, so no request goes to Google Fonts.
import '@fontsource-variable/plus-jakarta-sans';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { state, DEFAULTS, STYLE_KEYS } from './state.js';
import { normalizeUrl } from './content.js';
import { renderPreview, renderSwatch } from './qr.js';
import { contrastProblem } from './color.js';
import { PRESETS } from './presets.js';
import { validateLogoFile, readAsDataURL, composeLogo } from './logo.js';
import { downloadQR } from './export.js';
import { debounce, initPanels, initThemeToggle, toast } from './ui.js';

const $ = (id) => document.getElementById(id);

// --- Elements ---
const urlForm = $('url-form');
const urlInput = $('url-input');
const urlError = $('url-error');
const stage = $('qr-stage');
const qrContainer = $('qr-container');
const qrEmpty = $('qr-empty');
const encodedWrap = $('encoded-wrap');
const encodedText = $('encoded-text');
const downloadButtons = [$('download-png'), $('download-svg'), $('mobile-download')];

const logoDropzone = $('logo-dropzone');
const logoInput = $('logo-input');
const logoOptions = $('logo-options');
const logoThumb = $('logo-thumb');
const logoName = $('logo-name');
const logoRemove = $('logo-remove');
const logoSize = $('logo-size');
const logoSizeValue = $('logo-size-value');
const logoPlate = $('logo-plate');
const logoEclNote = $('logo-ecl-note');
const logoEclWarning = $('logo-ecl-warning');

const eclRadios = document.querySelectorAll('input[name="ecl"]');
const dotRadios = document.querySelectorAll('input[name="dotType"]');
const cornerRadios = document.querySelectorAll('input[name="cornerType"]');
const gradientTypeRadios = document.querySelectorAll('input[name="gradientType"]');
const marginInput = $('margin');
const marginValue = $('margin-value');
const marginWarning = $('margin-warning');

const gradientToggle = $('gradient-toggle');
const gradientOptions = $('gradient-options');
const cornerToggle = $('corner-toggle');
const cornerOptions = $('corner-options');
const transparentToggle = $('transparent-toggle');
const bgField = $('bg-field');
const fgLabel = $('fg-label');
const contrastWarning = $('contrast-warning');
const contrastMessage = $('contrast-message');
const previewWarning = $('preview-warning');
const presetsEl = $('presets');

// Color pickers: input element + the state key it controls.
const colorInputs = [
  [$('fg-color'), 'fg'],
  [$('fg2-color'), 'fg2'],
  [$('bg-color'), 'bg'],
  [$('corner-color'), 'cornerColor'],
];

/* ================= Rendering ================= */

/** Show or hide the contrast and margin warnings for the current state. */
function updateWarnings() {
  const problem = contrastProblem(state);
  contrastWarning.hidden = !problem;
  contrastMessage.textContent = problem ?? '';
  previewWarning.hidden = !problem || !state.data;
  marginWarning.hidden = state.margin >= 4;
}

/** Redraw the preview (or the empty state) from the current state. */
function render({ animate = false } = {}) {
  const hasData = Boolean(state.data);
  qrEmpty.hidden = hasData;
  encodedWrap.hidden = !hasData;
  for (const button of downloadButtons) button.disabled = !hasData;
  stage.classList.toggle('is-transparent', state.transparent && hasData);
  updateWarnings();

  if (!hasData) {
    qrContainer.replaceChildren();
    return;
  }
  encodedText.textContent = state.data;
  renderPreview(qrContainer, state, { animate });
}

/* ================= Content (URL input) ================= */

function showError(message) {
  urlError.textContent = message;
  urlError.hidden = false;
  urlInput.setAttribute('aria-invalid', 'true');
}

function clearError() {
  urlError.hidden = true;
  urlInput.removeAttribute('aria-invalid');
}

/**
 * Read the input and update the QR. While typing we stay quiet about errors
 * (half-typed links are always "invalid") and just dim the old QR instead.
 * Errors are shown when the user presses Generate or leaves the field.
 */
function updateFromInput({ showErrors }) {
  const raw = urlInput.value;
  if (!raw.trim()) {
    clearError();
    stage.classList.remove('is-stale');
    if (showErrors) showError('Please paste a link first.');
    if (state.data) {
      state.data = '';
      render();
    }
    return null;
  }

  const { text, error } = normalizeUrl(raw);
  if (error) {
    stage.classList.toggle('is-stale', Boolean(state.data));
    if (showErrors) showError(error);
    return null;
  }

  clearError();
  stage.classList.remove('is-stale');
  if (text !== state.data) {
    state.data = text;
    render({ animate: true });
  }
  return text;
}

// Live preview: redraw ~300ms after the user stops typing.
const livePreview = debounce(() => updateFromInput({ showErrors: false }), 300);

urlInput.addEventListener('input', () => {
  if (!urlError.hidden) clearError();
  livePreview();
});

urlInput.addEventListener('blur', () => {
  if (urlInput.value.trim()) updateFromInput({ showErrors: true });
});

// The Generate button (and Enter key) update immediately and show errors.
urlForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = updateFromInput({ showErrors: true });
  if (text) urlInput.value = text; // show the https:// we added
});

/* ================= Error correction ================= */

// Remembers the user's level from before a logo forced it to H.
let eclBeforeLogo = null;

function setEcl(level) {
  state.ecl = level;
  for (const radio of eclRadios) radio.checked = radio.value === level;
  syncLogoNotes();
}

// With a logo, explain why we picked H, or warn if the user lowered it.
function syncLogoNotes() {
  const lowEcl = Boolean(state.logo) && state.ecl !== 'H';
  logoEclNote.hidden = lowEcl;
  logoEclWarning.hidden = !lowEcl;
}

for (const radio of eclRadios) {
  radio.addEventListener('change', () => {
    setEcl(radio.value);
    render();
  });
}

/* ================= Logo ================= */

async function handleLogoFile(file) {
  if (!file) return;
  const error = validateLogoFile(file);
  if (error) {
    toast(error, 'error');
    return;
  }

  try {
    state.logoSrc = await readAsDataURL(file);
    state.logo = await composeLogo(state.logoSrc, state.logoPlate);
  } catch {
    state.logoSrc = null;
    state.logo = null;
    toast('Couldn’t read that image. Try another file.', 'error');
    return;
  }

  state.logoName = file.name;
  logoThumb.src = state.logoSrc;
  logoName.textContent = file.name;
  logoOptions.hidden = false;

  // Switch to H the first time a logo is added, and remember the old level.
  if (eclBeforeLogo === null) eclBeforeLogo = state.ecl;
  setEcl('H');
  render({ animate: true });
}

function removeLogo() {
  state.logoSrc = null;
  state.logo = null;
  state.logoName = '';
  logoInput.value = '';
  logoOptions.hidden = true;
  setEcl(eclBeforeLogo ?? 'M');
  eclBeforeLogo = null;
  render({ animate: true });
  logoInput.focus();
}

logoInput.addEventListener('change', () => handleLogoFile(logoInput.files[0]));
logoRemove.addEventListener('click', removeLogo);

// Drag-and-drop: highlight the zone while a file hovers, read it on drop.
logoDropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  logoDropzone.classList.add('is-dragging');
});
logoDropzone.addEventListener('dragleave', () => logoDropzone.classList.remove('is-dragging'));
logoDropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  logoDropzone.classList.remove('is-dragging');
  handleLogoFile(event.dataTransfer.files[0]);
});

logoSize.addEventListener('input', () => {
  state.logoSize = Number(logoSize.value);
  logoSizeValue.textContent = `${state.logoSize}%`;
  render();
});

logoPlate.addEventListener('change', async () => {
  state.logoPlate = logoPlate.checked;
  if (!state.logoSrc) return;
  state.logo = await composeLogo(state.logoSrc, state.logoPlate);
  render();
});

/* ================= Style + colors: state → controls ================= */

function checkRadio(radios, value) {
  for (const radio of radios) radio.checked = radio.value === value;
}

/**
 * Make every style control show what's in `state`. Called after anything
 * that changes many settings at once (a preset or Reset), so the UI never
 * goes out of sync with the QR.
 */
function syncControls() {
  checkRadio(dotRadios, state.dotType);
  checkRadio(cornerRadios, state.cornerType);
  checkRadio(gradientTypeRadios, state.gradientType);

  marginInput.value = state.margin;
  marginValue.textContent = `${state.margin}%`;

  for (const [input, key] of colorInputs) {
    input.value = state[key];
    $(`${key}-value`).textContent = state[key];
  }

  gradientToggle.checked = state.gradient;
  gradientOptions.hidden = !state.gradient;
  fgLabel.textContent = state.gradient ? 'First color' : 'Foreground';

  cornerToggle.checked = state.cornerCustom;
  cornerOptions.hidden = !state.cornerCustom;

  transparentToggle.checked = state.transparent;
  bgField.classList.toggle('is-disabled', state.transparent);

  syncPresets();
}

/** Change one setting, update the controls, and redraw. */
function setStyle(key, value) {
  state[key] = value;
  syncControls();
  render();
}

/* ================= Shapes ================= */

// Draw each swatch picture once, using the real QR library.
for (const tile of document.querySelectorAll('[data-dot]')) {
  renderSwatch(tile, { dotType: tile.dataset.dot });
}
for (const tile of document.querySelectorAll('[data-corner]')) {
  renderSwatch(tile, { cornerType: tile.dataset.corner });
}

for (const radio of dotRadios) {
  radio.addEventListener('change', () => setStyle('dotType', radio.value));
}
for (const radio of cornerRadios) {
  radio.addEventListener('change', () => setStyle('cornerType', radio.value));
}
marginInput.addEventListener('input', () => setStyle('margin', Number(marginInput.value)));

/* ================= Colors ================= */

for (const [input, key] of colorInputs) {
  input.addEventListener('input', () => setStyle(key, input.value));
}
for (const radio of gradientTypeRadios) {
  radio.addEventListener('change', () => setStyle('gradientType', radio.value));
}
gradientToggle.addEventListener('change', () => setStyle('gradient', gradientToggle.checked));
cornerToggle.addEventListener('change', () => setStyle('cornerCustom', cornerToggle.checked));
transparentToggle.addEventListener('change', () =>
  setStyle('transparent', transparentToggle.checked),
);

/* ================= Presets ================= */

// The keys a preset sets (everything except its id and display name).
const presetKeys = (preset) => Object.keys(preset).filter((k) => k !== 'id' && k !== 'name');

// A preset is "active" when every color it sets matches the current state.
function syncPresets() {
  for (const button of presetsEl.children) {
    const preset = PRESETS.find((p) => p.id === button.dataset.preset);
    const active = presetKeys(preset).every((k) => state[k] === preset[k]);
    button.setAttribute('aria-pressed', String(active));
  }
}

for (const preset of PRESETS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'preset';
  button.dataset.preset = preset.id;
  button.title = preset.name;

  // The chip previews the preset: background ring, dot color (or gradient).
  const chip = document.createElement('span');
  chip.className = 'preset-chip';
  chip.setAttribute('aria-hidden', 'true');
  chip.style.setProperty('--chip-bg', preset.bg);
  chip.style.setProperty(
    '--chip-fg',
    preset.gradient ? `linear-gradient(135deg, ${preset.fg}, ${preset.fg2})` : preset.fg,
  );
  if (preset.cornerCustom) chip.style.setProperty('--chip-corner', preset.cornerColor);

  button.append(chip, preset.name.replace(' gradient', ''));
  button.addEventListener('click', () => {
    for (const key of presetKeys(preset)) state[key] = preset[key];
    syncControls();
    render({ animate: true });
  });
  presetsEl.append(button);
}

/* ================= Reset ================= */

$('reset-style').addEventListener('click', () => {
  for (const key of STYLE_KEYS) state[key] = DEFAULTS[key];
  // Keep H while a logo is on, otherwise go back to the default level.
  setEcl(state.logo ? 'H' : DEFAULTS.ecl);
  syncControls();
  render({ animate: true });
  toast('Style reset to default');
});

/* ================= Downloads ================= */

async function download(extension) {
  if (!state.data) return;
  try {
    const filename = await downloadQR(state, extension);
    toast(`Downloaded ${filename}`);
  } catch (err) {
    console.error(err);
    toast('Download failed. Please try again.', 'error');
  }
}

$('download-png').addEventListener('click', () => download('png'));
$('download-svg').addEventListener('click', () => download('svg'));
$('mobile-download').addEventListener('click', () => download('png'));

/* ================= Start ================= */

initPanels();
initThemeToggle();
syncControls();
render();
