/* ============ Catculator — lógica científica y vida gatuna ============ */

// ---------- Estado de la calculadora ----------
let tokens = [];            // expresión en construcción (un token por pulsación)
let ans = 0;                // último resultado
let lastExprRaw = '';       // expresión evaluada (para la línea superior)
let memory = 0;             // memoria (MC/MR/M+/M-/MS)
let angleMode = localStorage.getItem('catculator-angle') || 'deg';
let inv = false;            // modo 2nd (funciones inversas)
let justEvaluated = false;
let errorState = false;

const elResult = document.getElementById('result');
const elExpr = document.getElementById('expression');
const elCat = document.getElementById('cat');
const elMouth = document.getElementById('mouth');
const elSpeech = document.getElementById('speech');
const elSpeechText = document.getElementById('speech-text');

// ---------- Formato de números ----------
function roundNice(n) {
  if (!isFinite(n)) return n;
  return parseFloat(n.toPrecision(12));
}

function groupInt(intStr) {
  const neg = intStr.startsWith('-');
  const digits = neg ? intStr.slice(1) : intStr;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped;
}

function formatNumber(n) {
  if (!isFinite(n)) return '¡Miau!';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
    return n.toExponential(6).replace('e', ' e');
  }
  const s = String(roundNice(n));
  if (s.includes('e')) return s;
  const [intPart, decPart] = s.split('.');
  return decPart !== undefined ? groupInt(intPart) + '.' + decPart : groupInt(intPart);
}

// ---------- Motor de expresiones ----------
const FUNCS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh', 'ln', 'log', 'sqrt', 'cbrt', 'abs'
]);

function fact(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error('dom');
  if (n > 170) throw new Error('overflow');
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function applyFunc(name, x) {
  const toRad = v => angleMode === 'deg' ? v * Math.PI / 180 : v;
  const fromRad = v => angleMode === 'deg' ? v * 180 / Math.PI : v;
  switch (name) {
    case 'sin': return Math.sin(toRad(x));
    case 'cos': return Math.cos(toRad(x));
    case 'tan': return Math.tan(toRad(x));
    case 'asin': if (x < -1 || x > 1) throw new Error('dom'); return fromRad(Math.asin(x));
    case 'acos': if (x < -1 || x > 1) throw new Error('dom'); return fromRad(Math.acos(x));
    case 'atan': return fromRad(Math.atan(x));
    case 'sinh': return Math.sinh(x);
    case 'cosh': return Math.cosh(x);
    case 'tanh': return Math.tanh(x);
    case 'ln': if (x <= 0) throw new Error('dom'); return Math.log(x);
    case 'log': if (x <= 0) throw new Error('dom'); return Math.log10(x);
    case 'sqrt': if (x < 0) throw new Error('dom'); return Math.sqrt(x);
    case 'cbrt': return Math.cbrt(x);
    case 'abs': return Math.abs(x);
  }
  throw new Error('func');
}

function applyOp(op, a, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': if (b === 0) throw new Error('div0'); return a / b;
    case 'mod': if (b === 0) throw new Error('div0'); return a % b;
    case '^': return Math.pow(a, b);
  }
  throw new Error('op');
}

// Tokeniza una cadena cruda en objetos {t, v}
function tokenize(str) {
  const toks = [];
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (c === ' ') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let num = '';
      while (i < str.length && /[0-9.]/.test(str[i])) num += str[i++];
      const v = Number(num);
      if (!isFinite(v)) throw new Error('num');
      toks.push({ t: 'num', v });
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let w = '';
      while (i < str.length && /[a-zA-Z]/.test(str[i])) w += str[i++];
      w = w.toLowerCase();
      if (FUNCS.has(w)) toks.push({ t: 'func', v: w });
      else if (w === 'pi') toks.push({ t: 'const', v: Math.PI });
      else if (w === 'e') toks.push({ t: 'const', v: Math.E });
      else if (w === 'ans') toks.push({ t: 'const', v: ans });
      else if (w === 'mem') toks.push({ t: 'const', v: memory });
      else if (w === 'mod') toks.push({ t: 'op', v: 'mod' });
      else throw new Error('word');
      continue;
    }
    i++;
    switch (c) {
      case 'π': toks.push({ t: 'const', v: Math.PI }); break;
      case '+': toks.push({ t: 'op', v: '+' }); break;
      case '-': case '−': toks.push({ t: 'op', v: '-' }); break;
      case '*': case '×': toks.push({ t: 'op', v: '*' }); break;
      case '/': case '÷': toks.push({ t: 'op', v: '/' }); break;
      case '^': toks.push({ t: 'op', v: '^' }); break;
      case '(': toks.push({ t: 'lp' }); break;
      case ')': toks.push({ t: 'rp' }); break;
      case '!': toks.push({ t: 'post', v: '!' }); break;
      case '%': toks.push({ t: 'post', v: '%' }); break;
      default: throw new Error('char');
    }
  }

  // Menos/más unario
  const res = [];
  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k];
    if (tk.t === 'op' && (tk.v === '-' || tk.v === '+')) {
      const prev = res[res.length - 1];
      const unary = !prev || prev.t === 'op' || prev.t === 'u' || prev.t === 'lp';
      if (unary) {
        if (tk.v === '-') res.push({ t: 'u' });
        continue; // '+' unario se ignora
      }
    }
    res.push(tk);
  }

  // Multiplicación implícita: 2π, 2(3), )(, 2sin(...
  const out = [];
  for (let k = 0; k < res.length; k++) {
    const cur = res[k];
    const prev = out[out.length - 1];
    if (prev) {
      const prevVal = prev.t === 'num' || prev.t === 'const' || prev.t === 'rp' || prev.t === 'post';
      const curOpens = cur.t === 'num' || cur.t === 'const' || cur.t === 'func' || cur.t === 'lp';
      if (prevVal && curOpens) out.push({ t: 'op', v: '*' });
    }
    out.push(cur);
  }
  return out;
}

function toRPN(toks) {
  const out = [], ops = [];
  const prec = t => t.t === 'u' ? 4 : t.v === '^' ? 5
    : (t.v === '*' || t.v === '/' || t.v === 'mod') ? 3 : 2;
  const rightAssoc = t => t.t === 'u' || t.v === '^';
  for (const tk of toks) {
    if (tk.t === 'num' || tk.t === 'const' || tk.t === 'post') {
      out.push(tk);
    } else if (tk.t === 'func' || tk.t === 'u') {
      ops.push(tk);
    } else if (tk.t === 'op') {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t === 'lp') break;
        if (top.t === 'func') { out.push(ops.pop()); continue; }
        const pt = prec(top), ct = prec(tk);
        if (pt > ct || (pt === ct && !rightAssoc(tk))) out.push(ops.pop());
        else break;
      }
      ops.push(tk);
    } else if (tk.t === 'lp') {
      ops.push(tk);
    } else if (tk.t === 'rp') {
      while (ops.length && ops[ops.length - 1].t !== 'lp') out.push(ops.pop());
      if (!ops.length) throw new Error('paren');
      ops.pop();
      if (ops.length && ops[ops.length - 1].t === 'func') out.push(ops.pop());
    }
  }
  while (ops.length) {
    const t = ops.pop();
    if (t.t === 'lp') throw new Error('paren');
    out.push(t);
  }
  return out;
}

function evalRPN(rpn) {
  const st = [];
  for (const tk of rpn) {
    if (tk.t === 'num' || tk.t === 'const') st.push(tk.v);
    else if (tk.t === 'u') { if (!st.length) throw new Error('bad'); st.push(-st.pop()); }
    else if (tk.t === 'post') { if (!st.length) throw new Error('bad'); const a = st.pop(); st.push(tk.v === '!' ? fact(a) : a / 100); }
    else if (tk.t === 'func') { if (!st.length) throw new Error('bad'); st.push(applyFunc(tk.v, st.pop())); }
    else if (tk.t === 'op') { if (st.length < 2) throw new Error('bad'); const b = st.pop(), a = st.pop(); st.push(applyOp(tk.v, a, b)); }
  }
  if (st.length !== 1 || !isFinite(st[0])) throw new Error('bad');
  return st[0];
}

function evaluate(str) {
  const toks = tokenize(str);
  if (!toks.length) throw new Error('empty');
  return roundNice(evalRPN(toRPN(toks)));
}

// ---------- Presentación de la expresión ----------
function prettify(raw) {
  let s = raw;
  const reps = [
    ['sqrt(', '√('], ['cbrt(', '∛('], ['*10^', '×10^'],
    ['^(-1)', '⁻¹'], ['^2', '²'], ['^3', '³'],
    ['mod', ' mod '], ['ans', 'Ans'], ['mem', 'M'],
    ['*', '×'], ['/', '÷'], ['-', '−']
  ];
  for (const [a, b] of reps) s = s.split(a).join(b);
  return s;
}

function rawExpr() { return tokens.join(''); }

function fitResult() {
  const t = elResult.textContent;
  elResult.classList.remove('small', 'tiny');
  if (t.length > 15) elResult.classList.add('tiny');
  else if (t.length > 10) elResult.classList.add('small');
}

function updateDisplay(popAnim = false) {
  if (errorState) {
    elResult.textContent = '¡Miau!';
    elExpr.textContent = ' ';
    fitResult();
    return;
  }
  if (justEvaluated) {
    elExpr.textContent = prettify(lastExprRaw) + ' =';
    elResult.textContent = formatNumber(ans);
  } else {
    const raw = rawExpr();
    elResult.textContent = raw ? prettify(raw) : '0';
    let preview = ' ';
    if (raw) {
      try { const v = evaluate(raw); if (isFinite(v)) preview = '= ' + formatNumber(v); }
      catch (e) { /* expresión incompleta: sin vista previa */ }
    }
    elExpr.textContent = preview;
  }
  fitResult();
  if (popAnim) {
    elResult.classList.remove('pop');
    void elResult.offsetWidth;
    elResult.classList.add('pop');
  }
}

// ---------- Entrada ----------
const OPENERS = /^(sqrt\(|cbrt\(|sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|ln\(|log\(|abs\(|e\^\(|10\^\(|\(|π|e|ans|mem|\.|\d)/;

function pushToken(tok) {
  if (errorState) clearAll(true);
  wakeUp();
  if (justEvaluated) {
    const continues = /^(\+|-|\*|\/|\^|!|%|mod|\^2|\^3|\^\(-1\))/.test(tok);
    tokens = continues ? ['ans'] : [];
    justEvaluated = false;
  }
  tokens.push(tok);
  updateDisplay();
  checkTypedEggs();
}

function backspace() {
  if (errorState) { clearAll(); return; }
  wakeUp();
  if (justEvaluated) { clearAll(true); return; }
  tokens.pop();
  updateDisplay();
}

function clearAll(silent) {
  tokens = [];
  errorState = false;
  justEvaluated = false;
  updateDisplay();
  if (!silent) {
    setMood('normal');
    say(randomFrom(['¡Borrón y gato nuevo! 🐱', 'Limpio como mis bigotes ✨', '¡Listo para cazar números!']), 2200);
  }
}

function equals() {
  if (errorState) return;
  wakeUp();
  const raw = rawExpr();
  if (!raw) { updateDisplay(true); return; }
  let v;
  try { v = evaluate(raw); }
  catch (e) { enterError(e.message); return; }
  lastExprRaw = raw;
  ans = v;
  justEvaluated = true;
  updateDisplay(true);
  celebrate(v);
}

// ± : niega el número final (lo envuelve en paréntesis)
function toggleSign() {
  if (errorState) return;
  wakeUp();
  if (justEvaluated) { tokens = ['(', '-', 'ans', ')']; justEvaluated = false; updateDisplay(); return; }
  let e = tokens.length - 1;
  while (e >= 0 && /^[0-9.]$/.test(tokens[e])) e--;
  const s = e + 1;
  if (s > tokens.length - 1) return; // no hay número al final
  if (tokens[s - 1] === '-' && tokens[s - 2] === '(' && tokens[tokens.length - 1] !== ')') {
    // no envuelto; caer al else
  }
  if (s >= 2 && tokens[s - 2] === '(' && tokens[s - 1] === '-' && tokens[tokens.length - 1] === ')') {
    tokens.splice(tokens.length - 1, 1);
    tokens.splice(s - 2, 2);
  } else {
    tokens.splice(s, 0, '(', '-');
    tokens.push(')');
  }
  updateDisplay();
}

function currentValue() {
  if (justEvaluated) return ans;
  try { const v = evaluate(rawExpr()); if (isFinite(v)) return v; } catch (e) {}
  return ans;
}

function memoryOp(op) {
  wakeUp();
  switch (op) {
    case 'mc': memory = 0; say('Memoria borrada 🧽', 1800); break;
    case 'mr': pushToken('mem'); break;
    case 'ms': memory = currentValue(); say('Guardado en memoria 📥', 1800); break;
    case 'm+': memory += currentValue(); say('Sumado a memoria ➕', 1800); break;
    case 'm-': memory -= currentValue(); say('Restado de memoria ➖', 1800); break;
  }
  updateMemChip();
}

function updateMemChip() {
  const chip = document.getElementById('mem-chip');
  if (chip) chip.classList.toggle('on', memory !== 0);
}

function setAngle(mode) {
  angleMode = mode;
  localStorage.setItem('catculator-angle', mode);
  const btn = document.getElementById('btn-angle');
  if (btn) btn.textContent = mode === 'deg' ? 'DEG' : 'RAD';
  updateDisplay();
}

function toggle2nd() {
  inv = !inv;
  document.getElementById('btn-2nd').classList.toggle('active', inv);
  document.querySelectorAll('.skey.fn').forEach(btn => {
    if (btn.dataset.label2) btn.textContent = inv ? btn.dataset.label2 : btn.dataset.label;
  });
}

// ---------- El gato: estados de ánimo ----------
const MOUTHS = {
  normal:    'M100,110 Q105,115 110,110 Q115,115 120,110',
  happy:     'M96,108 Q110,122 124,108',
  angry:     'M98,116 Q110,106 122,116',
  surprised: 'M104,110 a6,7 0 1,0 12,0 a6,7 0 1,0 -12,0'
};

let moodTimer = null;

function setMood(mood, duration) {
  elCat.classList.remove('mood-happy', 'mood-angry', 'mood-surprised', 'mood-sleep');
  if (mood !== 'normal') elCat.classList.add('mood-' + mood);
  elMouth.setAttribute('d', MOUTHS[mood] || MOUTHS.normal);
  elMouth.setAttribute('fill', mood === 'surprised' ? 'var(--fur-line)' : 'none');
  if (moodTimer) clearTimeout(moodTimer);
  if (duration) {
    moodTimer = setTimeout(() => setMood('normal'), duration);
  }
}

function enterError(kind) {
  errorState = true;
  justEvaluated = false;
  updateDisplay();
  setMood('angry', 3800);
  if (kind === 'div0') say('¡MIAU! ¡Entre cero NO, humano! 😾', 3800);
  else say(randomFrom([
    '¡Miau! Eso no computa 🙀',
    'Ni con nueve vidas resuelvo eso 😿',
    '¡Error gatuno! Revisa la operación 🐾'
  ]), 3800);
  playHiss();
}

// ---------- Burbuja de diálogo ----------
let speechTimer = null;
function say(text, duration = 2500) {
  elSpeechText.textContent = text;
  elSpeech.classList.remove('hidden');
  if (speechTimer) clearTimeout(speechTimer);
  speechTimer = setTimeout(() => elSpeech.classList.add('hidden'), duration);
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- Celebración al calcular ----------
function celebrate(result) {
  playPurr();
  spawnPawPrints();

  if (result === 9) {
    setMood('happy', 3000);
    say('¡9! Como mis vidas 🐾', 3000);
  } else if (result === 42) {
    setMood('surprised', 3000);
    say('La respuesta a todo... y al atún 🐟', 3200);
  } else if (String(Math.abs(result)).includes('666')) {
    setMood('surprised', 3000);
    say('Numeritos de gato negro 🐈‍⬛', 3000);
  } else if (result === 0) {
    setMood('normal');
    say('Cero... como los ratones que cacé hoy 😿', 3000);
  } else if (Math.abs(result) >= 1e9) {
    setMood('surprised', 3000);
    say('¡MIAU! ¡Qué número tan gatormemente grande! 🙀', 3200);
  } else {
    setMood('happy', 2500);
    say(randomFrom([
      '¡Purrfecto! 😺',
      '¡Miaugnífico!',
      '*ronroneo de aprobación*',
      '¡Ni un ratón lo calcula mejor!',
      '¡Eso fue gatástico! 🐾',
      'Las cuentas claras y el atún espeso 🐟'
    ]), 2500);
  }
}

function checkTypedEggs() {
  const raw = rawExpr();
  if (raw === '3.14' || raw === '3.1416') {
    say('Mmm... ¡pi! ¿Pastel de atún? 🥧', 2500);
    setMood('happy', 2000);
  }
}

// ---------- Huellitas ----------
function spawnPawPrints() {
  const count = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const paw = document.createElement('span');
      paw.className = 'paw-print';
      paw.textContent = '🐾';
      paw.style.left = 8 + Math.random() * (window.innerWidth - 60) + 'px';
      paw.style.top = 120 + Math.random() * (window.innerHeight - 220) + 'px';
      document.body.appendChild(paw);
      setTimeout(() => paw.remove(), 1700);
    }, i * 120);
  }
}

// ---------- Ojos que siguen el cursor ----------
const eyes = [
  { el: document.getElementById('eye-left'), cx: 86, cy: 78 },
  { el: document.getElementById('eye-right'), cx: 134, cy: 78 }
];

document.addEventListener('mousemove', (e) => {
  if (elCat.classList.contains('mood-sleep')) return;
  const rect = elCat.getBoundingClientRect();
  const scale = rect.width / 220;
  for (const eye of eyes) {
    const ex = rect.left + eye.cx * scale;
    const ey = rect.top + eye.cy * scale;
    const dx = e.clientX - ex;
    const dy = e.clientY - ey;
    const dist = Math.hypot(dx, dy) || 1;
    const r = Math.min(4, dist / 30);
    const px = (dx / dist) * r;
    const py = (dy / dist) * r;
    eye.el.querySelector('.pupil').setAttribute('transform', `translate(${px}, ${py})`);
    eye.el.querySelector('.glint').setAttribute('transform', `translate(${px * 0.5}, ${py * 0.5})`);
  }
});

// ---------- Parpadeo ----------
function scheduleBlink() {
  const delay = 2800 + Math.random() * 4200;
  setTimeout(() => {
    if (!elCat.classList.contains('mood-sleep')) {
      elCat.classList.add('blinking');
      setTimeout(() => elCat.classList.remove('blinking'), 160);
    }
    scheduleBlink();
  }, delay);
}
scheduleBlink();

// ---------- Siesta por inactividad ----------
let idleTimer = null;
function resetIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    setMood('sleep');
    say('Zzz... 💤', 3500);
  }, 45000);
}

function wakeUp() {
  if (elCat.classList.contains('mood-sleep')) {
    setMood('normal');
    say('¡Miau! ¿En qué estábamos? 🐱', 2200);
  }
  resetIdle();
}
resetIdle();

// ---------- Sonidos (sintetizados, sin archivos) ----------
let soundOn = localStorage.getItem('catculator-sound') !== 'off';
let audioCtx = null;

function ctx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playClick() {
  if (!soundOn) return;
  const ac = ctx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(720 + Math.random() * 120, ac.currentTime);
  gain.gain.setValueAtTime(0.09, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.06);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.07);
}

function playMeow() {
  if (!soundOn) return;
  const ac = ctx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  const t = ac.currentTime;
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.linearRampToValueAtTime(880, t + 0.12);
  osc.frequency.linearRampToValueAtTime(640, t + 0.28);
  osc.frequency.linearRampToValueAtTime(430, t + 0.42);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.14, t + 0.06);
  gain.gain.setValueAtTime(0.14, t + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  osc.connect(filter).connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.5);
}

function playPurr() {
  if (!soundOn) return;
  const ac = ctx();
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 42;
  lfo.type = 'sine';
  lfo.frequency.value = 24;
  lfoGain.gain.value = 0.055;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.07, t + 0.1);
  gain.gain.setValueAtTime(0.07, t + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  lfo.connect(lfoGain).connect(gain.gain);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  osc.connect(filter).connect(gain).connect(ac.destination);
  osc.start(t); lfo.start(t);
  osc.stop(t + 0.8); lfo.stop(t + 0.8);
}

function playHiss() {
  if (!soundOn) return;
  const ac = ctx();
  const t = ac.currentTime;
  const bufferSize = ac.sampleRate * 0.4;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2500;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(t);
}

// ---------- Botón de sonido ----------
const btnSound = document.getElementById('btn-sound');
function refreshSoundBtn() {
  btnSound.textContent = soundOn ? '🔊' : '🔇';
}
btnSound.addEventListener('click', () => {
  soundOn = !soundOn;
  localStorage.setItem('catculator-sound', soundOn ? 'on' : 'off');
  refreshSoundBtn();
  if (soundOn) { playMeow(); say('¡Miau! Sonido activado 🔊', 2000); }
  else say('Modo sigiloso, como buen gato 🤫', 2000);
});
refreshSoundBtn();

// ---------- Temas ----------
const themePanel = document.getElementById('theme-panel');
const btnTheme = document.getElementById('btn-theme');
const THEME_NAMES = {
  cian: '¡Cian, mi favorito! 💙',
  rosa: '¡Rosa purrincesa! 💗',
  menta: '¡Menta fresca! 💚',
  lavanda: '¡Lavanda relajante! 💜',
  atigrado: '¡Naranja atigrado! 🧡',
  noche: 'Modo gato nocturno 🌙'
};

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('catculator-theme', theme);
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  // Tiñe la barra de estado del celular del color del tema
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const bg1 = getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim();
  if (metaTheme && bg1) metaTheme.setAttribute('content', bg1);
}

btnTheme.addEventListener('click', (e) => {
  e.stopPropagation();
  themePanel.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!themePanel.classList.contains('hidden') &&
      !themePanel.contains(e.target) && e.target !== btnTheme) {
    themePanel.classList.add('hidden');
  }
});

document.querySelectorAll('.theme-swatch').forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme);
    say(THEME_NAMES[btn.dataset.theme], 2400);
    setMood('happy', 2000);
    playMeow();
    themePanel.classList.add('hidden');
  });
});

applyTheme(localStorage.getItem('catculator-theme') || 'cian');

// ---------- Pelaje del gato ----------
const FUR_NAMES = {
  carbon: '¡Mi pelaje de siempre! 🐱',
  naranja: '¡Naranja! ¿Hay lasaña? 🧡',
  gris: '¡Gris elegante, casi azul ruso! 🐭',
  negro: '¡Gato negro, suerte para ti! 🐈‍⬛',
  blanco: '¡Blanco como la leche! 🥛'
};

function applyFur(fur) {
  document.documentElement.setAttribute('data-fur', fur);
  localStorage.setItem('catculator-fur', fur);
  document.querySelectorAll('.fur-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fur === fur);
  });
}

document.querySelectorAll('.fur-swatch').forEach(btn => {
  btn.addEventListener('click', () => {
    applyFur(btn.dataset.fur);
    say(FUR_NAMES[btn.dataset.fur], 2400);
    setMood('happy', 2000);
    playMeow();
    themePanel.classList.add('hidden');
  });
});

applyFur(localStorage.getItem('catculator-fur') || 'carbon');

// ---------- Modo básica / científica ----------
const btnMode = document.getElementById('btn-mode');
const sciPad = document.getElementById('sci-pad');

function applyMode(mode) {
  const sci = mode === 'sci';
  document.getElementById('app').classList.toggle('sci-on', sci);
  sciPad.classList.toggle('hidden', !sci);
  btnMode.textContent = sci ? '🐱 Básica' : '🔬 Científica';
  localStorage.setItem('catculator-mode', mode);
}

btnMode.addEventListener('click', () => {
  const now = document.getElementById('app').classList.contains('sci-on') ? 'basic' : 'sci';
  applyMode(now);
  if (now === 'sci') { say('¡Modo científico! 🔬 A ronronear ecuaciones', 2600); setMood('happy', 2000); }
});

applyMode(localStorage.getItem('catculator-mode') || 'basic');

// ---------- Controles científicos ----------
document.getElementById('btn-2nd').addEventListener('click', () => { playClick(); toggle2nd(); });
document.getElementById('btn-angle').addEventListener('click', () => {
  playClick();
  setAngle(angleMode === 'deg' ? 'rad' : 'deg');
});
setAngle(angleMode);
updateMemChip();

// ---------- PWA ----------
// Ausente en Electron (file://) y en navegadores sin HTTPS: la app funciona igual sin él.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ---------- Acciones de botones ----------
function handleAction(action) {
  switch (action) {
    case 'clear': clearAll(); break;
    case 'back': backspace(); break;
    case 'equals': equals(); break;
    case 'negate': toggleSign(); break;
    case 'mc': case 'mr': case 'ms': case 'm+': case 'm-': memoryOp(action); break;
  }
}

function tokenFor(btn) {
  return (inv && btn.dataset.k2 !== undefined) ? btn.dataset.k2 : btn.dataset.k;
}

document.querySelectorAll('.key, .skey').forEach(btn => {
  btn.addEventListener('click', () => {
    playClick();
    if (btn.dataset.k !== undefined) pushToken(tokenFor(btn));
    else if (btn.dataset.action) handleAction(btn.dataset.action);
  });
});

// ---------- Teclado físico ----------
function flashKey(selector) {
  const btn = document.querySelector(selector);
  if (!btn) return;
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 120);
}

document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (/^[0-9]$/.test(k)) { playClick(); pushToken(k); flashKey(`.key[data-k="${k}"]`); }
  else if (k === '.' || k === ',') { playClick(); pushToken('.'); flashKey('.key[data-k="."]'); }
  else if (k === '+') { playClick(); pushToken('+'); flashKey('.key[data-k="+"]'); }
  else if (k === '-') { playClick(); pushToken('-'); flashKey('.key[data-k="-"]'); }
  else if (k === '*') { playClick(); pushToken('*'); flashKey('.key[data-k="*"]'); }
  else if (k === '/') { e.preventDefault(); playClick(); pushToken('/'); flashKey('.key[data-k="/"]'); }
  else if (k === '^') { playClick(); pushToken('^'); }
  else if (k === '(' || k === ')') { playClick(); pushToken(k); }
  else if (k === '!') { playClick(); pushToken('!'); }
  else if (k === '%') { playClick(); pushToken('%'); }
  else if (k === 'Enter' || k === '=') { e.preventDefault(); playClick(); equals(); flashKey('[data-action="equals"]'); }
  else if (k === 'Backspace') { playClick(); backspace(); flashKey('[data-action="back"]'); }
  else if (k === 'Escape' || k.toLowerCase() === 'c') { playClick(); clearAll(); flashKey('[data-action="clear"]'); }
});

// ---------- Clic en el gato ----------
elCat.addEventListener('click', () => {
  wakeUp();
  playMeow();
  setMood('happy', 2000);
  say(randomFrom([
    '¡Miau! 😺',
    '¡Prrrr! Me gustan las caricias',
    '¿Me trajiste atún? 🐟',
    '¡Cuidado con mis bigotes!',
    'Soy la mejor CATculadora del mundo 🐾'
  ]), 2400);
});

// ---------- Saludo inicial ----------
setTimeout(() => {
  say('¡Miau! Lista para calcular 🐾', 3000);
  setMood('happy', 2200);
}, 600);

updateDisplay();
