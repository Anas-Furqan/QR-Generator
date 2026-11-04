// Self-hosted font: bundled by Vite, so no request goes to Google Fonts.
import '@fontsource-variable/plus-jakarta-sans';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { state, DEFAULTS, STYLE_KEYS } from './state.js';
import {
  BUILDERS,
  MAX_TEXT_BYTES,
  byteLength,
  densityProblem,
  maskWifiPassword,
  normalizePhone,
  normalizeWhatsApp,
} from './content.js';
import { renderPreview, renderSwatch } from './qr.js';
import { contrastProblem, readableTextColor } from './color.js';
import { PRESETS } from './presets.js';
import { validateLogoFile, readAsDataURL, composeLogo, makeThumbnail } from './logo.js';
import {
  FORMATS,
  canCopyImage,
  canShareFiles,
  copyQR,
  downloadQR,
  labelFontRatio,
  shareQR,
} from './export.js';
import { verifyScan } from './verify.js';
import { addToHistory, clearHistory, loadHistory } from './history.js';
import { debounce, initPanels, initThemeToggle, toast } from './ui.js';

const $ = (id) => document.getElementById(id);

// --- Elements ---
const tabs = [...document.querySelectorAll('[role="tab"]')];
const contentForm = $('content-form');
const contentError = $('content-error');
const urlInput = $('url-input');
const textInput = $('text-input');
const textCount = $('text-count');
const wifiSecurity = $('wifi-security');
const wifiPassword = $('wifi-password');
const wifiPasswordField = $('wifi-password-field');
const wifiPasswordToggle = $('wifi-password-toggle');
const waPhone = $('wa-phone');
const waPreview = $('wa-preview');
const phoneInput = $('phone-input');
const phonePreview = $('phone-preview');
const qrEmptyText = document.querySelector('#qr-empty span');
const stage = $('qr-stage');
const qrContainer = $('qr-container');
const qrEmpty = $('qr-empty');
const encodedWrap = $('encoded-wrap');
const encodedText = $('encoded-text');
const frameLabelEl = $('qr-frame-label');
const scanBadge = $('scan-badge');
const downloadBtn = $('download-btn');
const copyBtn = $('copy-btn');
const shareBtn = $('share-btn');
const mobileDownload = $('mobile-download');
const mobileShare = $('mobile-share');
// Every button that needs a QR to work (disabled while the preview is empty).
const actionButtons = [downloadBtn, copyBtn, shareBtn, mobileDownload, mobileShare];

const frameToggle = $('frame-toggle');
const frameOptions = $('frame-options');
const frameLabelInput = $('frame-label');
const formatRadios = document.querySelectorAll('input[name="exportFormat"]');
const sizeRadios = document.querySelectorAll('input[name="exportSize"]');

const historyList = $('history-list');
const historyEmpty = $('history-empty');
const historyClear = $('history-clear');

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
const transparentNote = $('transparent-note');
const bgField = $('bg-field');
const fgLabel = $('fg-label');
const contrastWarning = $('contrast-warning');
const contrastMessage = $('contrast-message');
const previewWarning = $('preview-warning');
const densityWarning = $('density-warning');
const densityMessage = $('density-message');
const presetsEl = $('presets');

// Color pickers: input element + the state key it controls.
const colorInputs = [
  [$('fg-color'), 'fg'],
  [$('fg2-color'), 'fg2'],
  [$('bg-color'), 'bg'],
  [$('corner-color'), 'cornerColor'],
  [$('frame-color'), 'frameColor'],
];

/* ================= Rendering ================= */

/** Show or hide the contrast and margin warnings for the current state. */
function updateWarnings() {
  const problem = contrastProblem(state);
  contrastWarning.hidden = !problem;
  contrastMessage.textContent = problem ?? '';
  previewWarning.hidden = !problem || !state.data;
  marginWarning.hidden = state.margin >= 4;

  const density = densityProblem(byteLength(state.data), Boolean(state.logo));
  densityWarning.hidden = !density;
  densityWarning.classList.toggle('note-danger', density?.level === 'strong');
  densityMessage.textContent = density?.message ?? '';
}

/**
 * Show the frame around the live preview. It's drawn with CSS using the same
 * proportions as the exported image (see FRAME in export.js).
 */
function updateFramePreview(hasData) {
  const framed = state.frame && hasData;
  const label = state.frameLabel.trim();
  stage.classList.toggle('is-framed', framed);
  stage.classList.toggle('no-label', framed && !label);
  frameLabelEl.hidden = !framed || !label;
  if (!framed) return;
  stage.style.setProperty('--frame-color', state.frameColor);
  stage.style.setProperty('--frame-text', readableTextColor(state.frameColor));
  stage.style.setProperty('--label-size', `${labelFontRatio(label || 'x') * 100}cqw`);
  frameLabelEl.textContent = label;
}

/** Redraw the preview (or the empty state) from the current state. */
function render({ animate = false } = {}) {
  const hasData = Boolean(state.data);
  qrEmpty.hidden = hasData;
  encodedWrap.hidden = !hasData;
  for (const button of actionButtons) button.disabled = !hasData;
  stage.classList.toggle('is-transparent', state.transparent && hasData && !state.frame);
  updateFramePreview(hasData);
  updateWarnings();

  if (!hasData) {
    qrContainer.replaceChildren();
    scanBadge.hidden = true;
    return;
  }
  updateEncodedText();
  try {
    renderPreview(qrContainer, state, { animate });
  } catch (err) {
    // The QR library throws if the content can't fit in any QR size.
    console.error(err);
    showError('That’s too much content for one QR code. Please shorten it.');
    scanBadge.hidden = true;
    return;
  }
  showScanState('checking');
  scheduleVerify();
}

/* ================= Scan check ================= */

const SCAN_MESSAGES = {
  checking: 'Checking that it scans…',
  ok: '✅ Scans correctly',
  warn: '⚠️ May be hard to scan on some phones',
  fail: '⚠️ May not scan — reduce logo size or increase contrast',
};

function showScanState(result) {
  scanBadge.hidden = false;
  scanBadge.dataset.state = result;
  scanBadge.textContent = SCAN_MESSAGES[result];
}

// Each check gets a number; results from an older check (the user kept
// changing things meanwhile) are ignored.
let verifyRun = 0;
const scheduleVerify = debounce(async () => {
  const run = ++verifyRun;
  const snapshot = { ...state };
  try {
    const result = await verifyScan(snapshot);
    if (run === verifyRun && snapshot.data === state.data) showScanState(result);
  } catch (err) {
    console.error(err);
    if (run === verifyRun) scanBadge.hidden = true;
  }
}, 400);

/* ================= Content: QR type tabs ================= */

/**
 * Show the exact encoded text under the QR so users can verify it. While the
 * WiFi password field is masked, the password is masked here too (the QR
 * itself still contains the real password).
 */
function updateEncodedText() {
  const masked = state.type === 'wifi' && wifiPassword.type === 'password';
  encodedText.textContent = masked ? maskWifiPassword(state.data) : state.data;
}

const EMPTY_MESSAGES = {
  url: 'Paste a link to see your QR code',
  text: 'Type some text to see your QR code',
  wifi: 'Enter your WiFi details to see your QR code',
  whatsapp: 'Enter a WhatsApp number to see your QR code',
  email: 'Enter an email address to see your QR code',
  phone: 'Enter a phone number to see your QR code',
};

const panelFor = (type) => $(`tabpanel-${type}`);

/** Collect the active tab's fields into an object, e.g. { ssid, password, ... }. */
function readFields(type) {
  const fields = {};
  for (const el of panelFor(type).querySelectorAll('[name]')) {
    fields[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return fields;
}

function showError(message, field) {
  contentError.textContent = message;
  contentError.hidden = false;
  const input = field && panelFor(state.type).querySelector(`[name="${field}"]`);
  if (input) input.setAttribute('aria-invalid', 'true');
}

function clearError() {
  contentError.hidden = true;
  for (const el of contentForm.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
}

/**
 * Build the QR text from the active tab and update the preview.
 * While typing we stay quiet about errors (half-typed input is always
 * "invalid") and just dim the old QR. Errors appear on Generate, or when the
 * user leaves the field that has the problem.
 *   showErrors: true = show every error, or the name of one field to check.
 *   switching: true when called right after changing tabs.
 */
function updateContent({ showErrors = false, switching = false } = {}) {
  const result = BUILDERS[state.type](readFields(state.type));
  const shouldShow = showErrors === true || (showErrors && showErrors === result.field);

  if (result.text === undefined) {
    // Nothing valid yet. After a tab switch, don't keep showing the old tab's QR.
    const clear = result.empty || switching;
    stage.classList.toggle('is-stale', !clear && Boolean(state.data));
    if (shouldShow && result.error) showError(result.error, result.field);
    if (clear && state.data) {
      state.data = '';
      render();
    }
    return null;
  }

  clearError();
  stage.classList.remove('is-stale');
  if (result.text !== state.data) {
    state.data = result.text;
    render({ animate: true });
  }
  return result.text;
}

// Live preview: redraw ~300ms after the user stops typing.
const livePreview = debounce(() => updateContent(), 300);

contentForm.addEventListener('input', () => {
  if (!contentError.hidden) clearError();
  updateHelpers();
  livePreview();
});

// Leaving a field shows its error (only for that field, not the whole form).
contentForm.addEventListener('focusout', (event) => {
  const field = event.target.name;
  if (field && event.target.value) updateContent({ showErrors: field });
});

// The Generate button (and Enter key) update immediately and show errors.
contentForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = updateContent({ showErrors: true });
  if (text && state.type === 'url') urlInput.value = text; // show the https:// we added
});

/** Live helpers under the inputs: text counter, phone previews, WiFi password. */
function updateHelpers() {
  textCount.textContent = `${byteLength(textInput.value)} / ${MAX_TEXT_BYTES}`;

  const wa = normalizeWhatsApp(waPhone.value);
  waPreview.hidden = !wa.digits;
  if (wa.digits) waPreview.textContent = `✓ Opens a chat with ${wa.display}`;

  const phone = normalizePhone(phoneInput.value);
  phonePreview.hidden = !phone.number;
  if (phone.number) phonePreview.textContent = `✓ Calls ${phone.display}`;

  wifiPasswordField.hidden = wifiSecurity.value === 'nopass';
}

wifiPasswordToggle.addEventListener('click', () => {
  const show = wifiPassword.type === 'password';
  wifiPassword.type = show ? 'text' : 'password';
  wifiPasswordToggle.setAttribute('aria-pressed', String(show));
  wifiPasswordToggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  updateEncodedText();
});

/**
 * Accessible tabs: click or use ←/→/Home/End. Only the selected tab is in the
 * Tab-key order (tabindex 0); the panels just get hidden, so their values stay.
 */
function selectTab(type, { focus = false } = {}) {
  state.type = type;
  for (const tab of tabs) {
    const selected = tab.dataset.type === type;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  for (const panel of contentForm.querySelectorAll('.tabpanel')) {
    panel.hidden = panel.dataset.type !== type;
  }
  qrEmptyText.textContent = EMPTY_MESSAGES[type];
  clearError();
  updateContent({ switching: true });
}

for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab.dataset.type));
  tab.addEventListener('keydown', (event) => {
    const i = tabs.indexOf(tab);
    const next = {
      ArrowRight: tabs[(i + 1) % tabs.length],
      ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
      Home: tabs[0],
      End: tabs[tabs.length - 1],
    }[event.key];
    if (!next) return;
    event.preventDefault();
    selectTab(next.dataset.type, { focus: true });
  });
}

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

/** Forget the logo (shared by the × button and restoring from Recent). */
function clearLogo() {
  state.logoSrc = null;
  state.logo = null;
  state.logoName = '';
  logoInput.value = '';
  logoOptions.hidden = true;
  eclBeforeLogo = null;
}

function removeLogo() {
  const previous = eclBeforeLogo;
  clearLogo();
  setEcl(previous ?? 'M');
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
  transparentNote.hidden = !state.transparent;
  bgField.classList.toggle('is-disabled', state.transparent);

  frameToggle.checked = state.frame;
  frameOptions.hidden = !state.frame;
  if (frameLabelInput.value !== state.frameLabel) frameLabelInput.value = state.frameLabel;

  checkRadio(formatRadios, state.exportFormat);
  checkRadio(sizeRadios, String(state.exportSize));
  for (const label of document.querySelectorAll('.download-label')) {
    label.textContent = `Download ${FORMATS[state.exportFormat].label}`;
  }

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

/* ================= Frame + export settings ================= */

frameToggle.addEventListener('change', () => setStyle('frame', frameToggle.checked));
frameLabelInput.addEventListener('input', () => setStyle('frameLabel', frameLabelInput.value));
for (const chip of document.querySelectorAll('[data-label]')) {
  chip.addEventListener('click', () => setStyle('frameLabel', chip.dataset.label));
}
// Export settings don't change the preview, so no re-render needed.
for (const radio of formatRadios) {
  radio.addEventListener('change', () => {
    state.exportFormat = radio.value;
    syncControls();
  });
}
for (const radio of sizeRadios) {
  radio.addEventListener('change', () => {
    state.exportSize = Number(radio.value);
    syncControls();
  });
}

/* ================= Download, copy, share ================= */

async function download() {
  if (!state.data) return;
  try {
    const filename = await downloadQR(state);
    toast(`Downloaded ${filename}`);
    saveRecent();
  } catch (err) {
    console.error(err);
    toast('Download failed. Please try again.', 'error');
  }
}

async function copy() {
  if (!state.data) return;
  if (!canCopyImage()) {
    toast('This browser can’t copy images. Use Download instead.', 'error');
    return;
  }
  try {
    await copyQR(state);
    toast('Copied to clipboard');
    saveRecent();
  } catch (err) {
    console.error(err);
    toast('Copying was blocked by the browser. Use Download instead.', 'error');
  }
}

async function share() {
  if (!state.data) return;
  try {
    await shareQR(state);
    saveRecent();
  } catch (err) {
    // AbortError = the user closed the share sheet; that's not an error.
    if (err.name === 'AbortError') return;
    console.error(err);
    toast('Sharing failed. Use Download instead.', 'error');
  }
}

downloadBtn.addEventListener('click', download);
mobileDownload.addEventListener('click', download);
copyBtn.addEventListener('click', copy);
shareBtn.addEventListener('click', share);
mobileShare.addEventListener('click', share);

/* ================= Recent QRs ================= */

// Settings saved with each entry (besides the content fields).
const SAVED_STYLE_KEYS = [...STYLE_KEYS, 'ecl', 'logoSize', 'logoPlate'];

/** Short, safe-to-store description of the QR for the Recent list. */
function describe(type, fields) {
  switch (type) {
    case 'url':
      return fields.url.trim();
    case 'text':
      return fields.text.trim().slice(0, 60);
    case 'wifi':
      return `WiFi · ${fields.ssid}`;
    case 'whatsapp':
      return `WhatsApp · ${normalizeWhatsApp(fields.phone).display ?? fields.phone}`;
    case 'email':
      return `Email · ${fields.to.trim()}`;
    default:
      return `Call · ${normalizePhone(fields.phone).display ?? fields.phone}`;
  }
}

async function saveRecent() {
  const fields = readFields(state.type);
  let logoThumb;
  try {
    if (state.logoSrc) logoThumb = await makeThumbnail(state.logoSrc);
  } catch {
    // No thumbnail is fine.
  }
  const saved = addToHistory({
    type: state.type,
    fields, // addToHistory removes the WiFi password before saving
    style: Object.fromEntries(SAVED_STYLE_KEYS.map((k) => [k, state[k]])),
    title: describe(state.type, fields),
    logoName: state.logoName,
    logoThumb,
    savedAt: Date.now(),
  });
  if (!saved) toast('Couldn’t save to Recent: browser storage is full or blocked.', 'error');
  renderHistory();
}

function timeAgo(ms) {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(ms).toLocaleDateString();
}

/** Build the Recent list. Text is set with textContent, never as HTML. */
function renderHistory() {
  const entries = loadHistory();
  historyList.replaceChildren();
  historyEmpty.hidden = entries.length > 0;
  historyClear.hidden = entries.length === 0;

  for (const entry of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';

    const icon = document.createElement('span');
    icon.className = 'history-icon';
    if (typeof entry.logoThumb === 'string' && entry.logoThumb.startsWith('data:image/')) {
      const img = document.createElement('img');
      img.src = entry.logoThumb;
      img.alt = '';
      icon.append(img);
    } else {
      // Reuse the matching tab's icon.
      const tab = tabs.find((t) => t.dataset.type === entry.type);
      icon.append(tab.querySelector('svg').cloneNode(true));
    }

    const text = document.createElement('span');
    text.className = 'history-text';
    const title = document.createElement('span');
    title.className = 'history-title';
    title.textContent = String(entry.title ?? '');
    const meta = document.createElement('span');
    meta.className = 'history-meta';
    const typeName = tabs.find((t) => t.dataset.type === entry.type).textContent.trim();
    meta.textContent = `${typeName} · ${timeAgo(Number(entry.savedAt) || Date.now())}`;
    text.append(title, meta);

    button.append(icon, text);
    button.addEventListener('click', () => restoreEntry(entry));
    const li = document.createElement('li');
    li.append(button);
    historyList.append(li);
  }
}

/** Put a saved QR back into the form and controls. */
function restoreEntry(entry) {
  // Content fields (the WiFi password was never saved, so it starts empty).
  for (const el of panelFor(entry.type).querySelectorAll('[name]')) {
    const value = entry.fields[el.name];
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = typeof value === 'string' ? value : '';
  }

  // The saved QR had no logo: remove the current one so the result matches.
  if (!entry.logoName && state.logo) clearLogo();

  // Style settings: only copy known keys with the right type.
  for (const key of SAVED_STYLE_KEYS) {
    if (typeof entry.style[key] === typeof DEFAULTS[key]) state[key] = entry.style[key];
  }
  setEcl(state.ecl);
  logoSize.value = state.logoSize;
  logoSizeValue.textContent = `${state.logoSize}%`;
  logoPlate.checked = state.logoPlate;
  syncControls();
  updateHelpers();
  selectTab(entry.type);
  render({ animate: true });

  if (entry.type === 'wifi' && entry.fields.security !== 'nopass') {
    toast('Enter the WiFi password again. It’s never saved.');
    wifiPassword.focus();
  } else if (entry.logoName && !state.logo) {
    toast('Logos aren’t kept in Recent. Upload it again if you need it.');
  }
}

historyClear.addEventListener('click', () => {
  clearHistory();
  renderHistory();
  toast('History cleared');
});

/* ================= Start ================= */

// Only show Share where the browser can share real image files (mostly phones).
const shareSupported = canShareFiles();
shareBtn.hidden = !shareSupported;
mobileShare.hidden = !shareSupported;

initPanels();
initThemeToggle();
syncControls();
updateHelpers();
renderHistory();
render();

// The frame label is measured with the web font, so redraw once it has loaded.
document.fonts?.ready.then(() => render());
