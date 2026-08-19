/* ============ Catculator — lógica científica y vida gatuna ============ */

/* ---------- Almacenamiento a prueba de balas ----------
   localStorage puede LANZAR, no solo devolver null: WebView con almacenamiento
   apagado, modo privado de Safari, cuota llena. Como la primera línea del script
   ya lo toca, una excepción ahí mataba el archivo entero y dejaba la app en
   blanco. Con este envoltorio, sin almacenamiento la app funciona igual: solo
   no recuerda nada entre sesiones. */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin espacio o sin permiso */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  json(k, porDefecto) {
    try {
      const v = JSON.parse(this.get(k));
      return (v && typeof v === 'object') ? v : porDefecto;
    } catch (e) { return porDefecto; }
  }
};

/* ---------- Idioma ----------
   Arranca con el del sistema; en cuanto el humano elige uno a mano, manda él.
   Los textos viven en idiomas.js, que se carga antes que este archivo. */
let IDIOMA = (() => {
  const guardado = store.get('catculator-idioma');
  if (IDIOMAS.indexOf(guardado) !== -1) return guardado;
  return String(navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
})();

/* Texto de una clave. Si el valor es un arreglo devuelve una frase al azar: así
   el gato no repite siempre lo mismo. {n}, {a} y {b} se sustituyen por lo que
   venga en 'vals'. Una clave que falte cae al español antes que dejar un hueco
   en blanco en la interfaz. */
function t(clave, vals) {
  let v = TEXTOS[IDIOMA][clave];
  if (v === undefined) v = TEXTOS.es[clave];
  if (v === undefined) return clave;
  if (Array.isArray(v)) v = v[Math.floor(Math.random() * v.length)];
  if (vals) for (const k of Object.keys(vals)) v = v.split('{' + k + '}').join(vals[k]);
  return v;
}

// °C, °F y K se escriben igual en todos los idiomas: si no hay entrada en el
// diccionario, la propia clave es la etiqueta.
const etiquetaUnidad = u => TEXTOS[IDIOMA]['u.' + u] || TEXTOS.es['u.' + u] || u;

/* Recorre el HTML y coloca los textos. Cada marca dice a dónde va:
     data-i18n        → el texto visible
     data-i18n-title  → el atributo title
     data-i18n-ph     → el placeholder
     data-i18n-aria   → el aria-label
     data-i18n-aria2  → el nombre alterno de las teclas que cambian con 2nd
     data-i18n-desc   → el aria-description
   Se llama al arrancar y cada vez que se cambia de idioma. */
function traducirDOM() {
  const cada = (attr, fn) => document.querySelectorAll('[' + attr + ']')
    .forEach(el => fn(el, t(el.getAttribute(attr))));

  cada('data-i18n',       (el, v) => { el.textContent = v; });
  cada('data-i18n-title', (el, v) => el.setAttribute('title', v));
  cada('data-i18n-ph',    (el, v) => el.setAttribute('placeholder', v));
  cada('data-i18n-desc',  (el, v) => el.setAttribute('aria-description', v));
  cada('data-i18n-aria2', (el, v) => { el.dataset.aria2 = v; });
  cada('data-i18n-aria',  (el, v) => {
    el.setAttribute('aria-label', v);
    // Las teclas con segunda función guardan su nombre base para que
    // toggle2nd pueda ir y volver entre los dos.
    if (el.hasAttribute('data-i18n-aria2')) el.dataset.aria = v;
  });

  document.documentElement.lang = IDIOMA;
}
traducirDOM();

// ---------- Estado de la calculadora ----------
let tokens = [];            // expresión en construcción (un token por pulsación)
/* Dónde se inserta lo próximo que se teclee: 0 = antes del primer token,
   tokens.length = al final (que es lo de siempre). Que cada pulsación sea un
   token atómico es lo que hace barato tener cursor: es un índice del arreglo y
   no una posición dentro de una cadena, así que nadie tiene que saber cuánto
   ocupa 'sqrt(' ni dónde empieza un número de varias cifras. */
let cursor = 0;
let ans = 0;                // último resultado
let lastExprRaw = '';       // expresión evaluada (para la línea superior)
let memory = 0;             // memoria (MC/MR/M+/M-/MS)
let angleMode = store.get('catculator-angle') || 'deg';
let inv = false;            // modo 2nd (funciones inversas)
let justEvaluated = false;
let errorState = false;
let ansFrac = null;         // {n, d} si el resultado tiene fracción exacta
let fracMode = false;       // mostrar el resultado como fracción
let quizMode = false;       // modo aprendiz: el gato pregunta
let quiz = null;            // pregunta actual {text, answer}
let racha = 0;              // aciertos seguidos en el quiz
let mejorRacha = parseInt(store.get('catculator-racha') || '0', 10);
// Un JSON válido que NO sea arreglo (localStorage manoseado, versión vieja del
// formato) hacía que addHistory reventara en cada '='. Se exige arreglo.
const histGuardado = store.json('catculator-history', null);
let history = Array.isArray(histGuardado) ? histGuardado : [];

const elResult = document.getElementById('result');
const elExpr = document.getElementById('expression');
const elCat = document.getElementById('cat');
const elMouth = document.getElementById('mouth');
const elSpeech = document.getElementById('speech');
const elSpeechText = document.getElementById('speech-text');
const elFrac = document.getElementById('btn-frac');

// ---------- Formato de números ----------
/* Los separadores salen del idioma del sistema: 1.234,5 en español de España,
   1,234.5 en inglés y en español latinoamericano.

   Con una excepción: unos cuantos idiomas —el español de COSTA RICA entre
   ellos, y el francés— separan los miles con un espacio duro (U+00A0), y en una
   pantalla de calculadora "1 234 567,89" se lee como tres números pegados en
   vez de uno. Cuando toca espacio se cambia por el símbolo que no esté haciendo
   de decimal, que es lo que la gente espera ver ahí. */
function derivarSeparadores(idioma) {
  try {
    const partes = new Intl.NumberFormat(idioma).formatToParts(12345.6);
    const busca = tipo => (partes.find(p => p.type === tipo) || {}).value;
    const decimal = busca('decimal') || '.';
    let miles = busca('group') || ',';
    if (/\s/.test(miles)) miles = decimal === ',' ? '.' : ',';
    return { miles, decimal };
  } catch (e) { return { miles: ',', decimal: '.' }; }
}

/* Si el humano eligió idioma a mano, los números siguen ESE idioma; si no, los
   del sistema. Importa: con la interfaz en inglés y separadores españoles,
   39,370079 inches se lee como treinta y nueve mil. Y respetar el sistema
   cuando no hay elección evita estropeárselo a quien está en México, donde
   es-MX escribe 1,234.56 y no 1.234,56. */
let SEP = derivarSeparadores(store.get('catculator-idioma') || undefined);

/* Deshace el formato bonito y deja un número que entiende JS (y cualquier otra
   app donde se pegue): sin separador de miles y con punto decimal. */
function textoANumeroPlano(texto) {
  return texto.split(SEP.miles).join('').split(SEP.decimal).join('.');
}

function roundNice(n) {
  if (!isFinite(n)) return n;
  return parseFloat(n.toPrecision(12));
}

function groupInt(intStr) {
  const neg = intStr.startsWith('-');
  const digits = neg ? intStr.slice(1) : intStr;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, SEP.miles);
  return (neg ? '-' : '') + grouped;
}

function formatNumber(n) {
  if (!isFinite(n)) return t('miau');
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
    return n.toExponential(6).replace('.', SEP.decimal).replace('e', ' e');
  }
  const s = String(roundNice(n));
  if (s.includes('e')) return s;
  const [intPart, decPart] = s.split('.');
  return decPart !== undefined ? groupInt(intPart) + SEP.decimal + decPart : groupInt(intPart);
}

// ---------- Fracciones ----------
// Convierte un decimal en fracción exacta y simplificada usando fracciones
// continuas. Devuelve {n, d} solo si la fracción reproduce el número con
// precisión y el denominador es razonable; para π, √2 y compañía devuelve
// null en vez de inventar una fracción monstruosa.
function toFraction(x) {
  if (!isFinite(x) || Number.isInteger(x)) return null;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (ax >= 1e9) return null;
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = ax;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > 10000) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    const rest = b - a;
    if (rest < 1e-12) break;
    b = 1 / rest;
  }
  if (k1 < 2) return null;
  if (Math.abs(ax - h1 / k1) > ax * 1e-9 + 1e-12) return null;
  return { n: sign * h1, d: k1 };
}

function formatFraction(f) {
  return groupInt(String(f.n)) + '/' + groupInt(String(f.d));
}

/* Convierte un número en la lista de teclas que lo escribirían (para reutilizar
   valores del historial o del conversor).

   Ojo con la notación exponencial: si se cuela una 'e' en la cadena, al partirla
   en caracteres el tokenizador la lee como el número de Euler y 1e21 terminaba
   valiendo 23.7 sin avisar. toFixed tampoco salva: desde 1e21 él también
   devuelve exponencial, así que ahí se expande con BigInt (todo float de ese
   tamaño ya es entero). Si aun así queda una 'e', se devuelve 0 antes que un
   número inventado. */
function numberToTokens(v) {
  let s = String(roundNice(v));
  if (s.includes('e')) {
    if (Math.abs(v) >= 1e21) {
      try { s = BigInt(v).toString(); } catch (err) { s = '0'; }
    } else {
      s = v.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
    }
  }
  return (s.includes('e') ? '0' : s).split('');
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

  expandPercents(res);

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

/* Porcentaje como lo espera cualquiera que venga de una calculadora de bolsillo.

   El % suelto es "entre cien" y así lo dejan iOS, Android y Windows... salvo
   cuando cuelga de una suma o una resta: ahí el porcentaje se toma SOBRE lo que
   va antes. 50+10% son 55, no 50.1. Multiplicación y división no cambian:
   200*10% siguen siendo 20.

   Se reescribe el flujo de tokens antes de armar la RPN: el operando marcado con
   % se cambia por "(lo de la izquierda) * operando / 100". La izquierda se corta
   en el paréntesis en el que estemos, para que (50+10%) sean 55 y no un
   paréntesis descuadrado. */
function expandPercents(toks) {
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].t !== 'post' || toks[i].v !== '%') continue;

    // 1. Dónde arranca el operando al que se pega este %
    let ini = i - 1;
    if (ini < 0) continue;
    if (toks[ini].t === 'rp') {
      let hondo = 0;
      while (ini >= 0) {
        if (toks[ini].t === 'rp') hondo++;
        else if (toks[ini].t === 'lp' && --hondo === 0) break;
        ini--;
      }
      if (ini < 0) continue;
      if (ini > 0 && toks[ini - 1].t === 'func') ini--;   // sqrt(9)% incluye el sqrt
    } else if (toks[ini].t !== 'num' && toks[ini].t !== 'const') {
      continue;
    }
    while (ini > 0 && toks[ini - 1].t === 'u') ini--;      // el menos unario va pegado

    // 2. Solo + y − cambian el significado del %
    const opIdx = ini - 1;
    if (opIdx < 0) continue;
    const op = toks[opIdx];
    if (op.t !== 'op' || (op.v !== '+' && op.v !== '-')) continue;

    // 3. El contexto izquierdo, sin salirse del paréntesis actual
    let desde = opIdx - 1, hondo = 0;
    while (desde >= 0) {
      const t = toks[desde];
      if (t.t === 'rp') hondo++;
      else if (t.t === 'lp') { if (hondo === 0) break; hondo--; }
      desde--;
    }
    desde++;
    if (desde >= opIdx) continue;   // no hay nada a la izquierda sobre qué aplicar

    const nuevo = [
      { t: 'lp' }, ...toks.slice(desde, opIdx), { t: 'rp' },
      { t: 'op', v: '*' },
      ...toks.slice(ini, i),
      { t: 'op', v: '/' }, { t: 'num', v: 100 }
    ];
    toks.splice(ini, i - ini + 1, ...nuevo);
    i = ini + nuevo.length - 1;
  }
  return toks;
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
    ['*', '×'], ['/', '÷'], ['-', '−'],
    // Lo que se teclea guarda el punto por dentro, pero se enseña con el
    // separador del país: si no, escribías 0.5 y al pulsar = salía 0,5.
    ['.', SEP.decimal]
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

/* Dibuja la expresión token a token, en vez de como una sola cadena de texto.
   Hace falta para dos cosas: poner el cursor ENTRE dos pulsaciones, y saber
   sobre cuál se ha tocado (cada <span> lleva su índice).

   prettify se aplica a cada token por separado y no a la cadena entera. Se
   puede porque todos los tokens son unidades completas —'sqrt(', '^(-1)',
   '*10^'…— y ninguna sustitución cruza de un token al siguiente. */
function pintarExpresion() {
  const nuevoCaret = () => {
    const c = document.createElement('span');
    c.className = 'caret';
    return c;
  };
  const frag = document.createDocumentFragment();
  for (let i = 0; i < tokens.length; i++) {
    if (i === cursor) frag.appendChild(nuevoCaret());
    const s = document.createElement('span');
    s.className = 'tok';
    s.dataset.i = String(i);
    s.textContent = prettify(tokens[i]);
    frag.appendChild(s);
  }
  if (cursor === tokens.length) frag.appendChild(nuevoCaret());
  elResult.textContent = '';
  elResult.appendChild(frag);
  /* Con una cuenta larga la pantalla recorta por los lados, y editando en medio
     te quedabas escribiendo a ciegas. Un elemento con overflow oculto sigue
     pudiéndose desplazar por código, así que se arrastra lo justo para que el
     cursor vuelva a verse. */
  const c = elResult.querySelector('.caret');
  if (!c) return;
  const caja = elResult.getBoundingClientRect();
  const cc = c.getBoundingClientRect();
  const margen = 14;
  if (cc.left < caja.left + margen) elResult.scrollLeft -= (caja.left + margen - cc.left);
  else if (cc.right > caja.right - margen) elResult.scrollLeft += (cc.right - caja.right + margen);
}

function updateDisplay(popAnim = false) {
  /* Red de seguridad: hay varios sitios que reemplazan tokens en bloque (el
     historial, el conversor, el modo aprendiz). Si alguno olvida recolocar el
     cursor, aquí se recorta al rango válido en vez de romperse. */
  cursor = Math.min(tokens.length, Math.max(0, cursor));
  elFrac.classList.toggle('hidden', !(justEvaluated && ansFrac && !errorState && !quizMode));
  elFrac.classList.toggle('active', fracMode);
  if (errorState) {
    elResult.textContent = t('miau');
    elExpr.textContent = ' ';
    fitResult();
    guardarSesion();
    return;
  }
  if (quizMode) {
    elExpr.textContent = '🎓 ' + (quiz ? quiz.text + ' = ?' : '') +
      (racha > 0 ? '  ·  🔥' + racha : '');
    elResult.textContent = tokens.length ? prettify(rawExpr()) : '?';
    fitResult();
    return;                                  // el quiz no se guarda: es de usar y tirar
  }
  if (justEvaluated) {
    elExpr.textContent = prettify(lastExprRaw) + ' =';
    elResult.textContent = (fracMode && ansFrac) ? formatFraction(ansFrac) : formatNumber(ans);
  } else {
    const raw = rawExpr();
    if (raw) pintarExpresion();
    else elResult.textContent = '0';
    let preview = ' ';
    if (raw) {
      try { const v = evaluate(raw); if (isFinite(v)) preview = '= ' + formatNumber(v); }
      catch (e) { /* expresión incompleta: sin vista previa */ }
    }
    elExpr.textContent = preview;
  }
  fitResult();
  guardarSesion();
  if (popAnim) {
    elResult.classList.remove('pop');
    void elResult.offsetWidth;
    elResult.classList.add('pop');
  }
}

// ---------- Entrada ----------
const OPENERS = /^(sqrt\(|cbrt\(|sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|ln\(|log\(|abs\(|e\^\(|10\^\(|\(|π|e|ans|mem|\.|\d)/;

/* Mete tokens donde esté el cursor y lo deja detrás de lo insertado. Pasan por
   aquí el teclado en pantalla, el teclado físico y el pegado. */
function insertarTokens(lista) {
  tokens.splice(cursor, 0, ...lista);
  cursor += lista.length;
}

function pushToken(tok) {
  if (errorState) clearAll(true);
  wakeUp();
  if (justEvaluated) {
    // Si sigue operando, arrastra el resultado como número visible (no "Ans")
    const continues = /^(\+|-|\*|\/|\^|!|%|mod|\^2|\^3|\^\(-1\))/.test(tok);
    tokens = continues ? numberToTokens(ans) : [];
    cursor = tokens.length;
    justEvaluated = false;
  }
  insertarTokens([tok]);
  updateDisplay();
  checkTypedEggs();
}

function backspace() {
  if (errorState) { clearAll(); return; }
  wakeUp();
  if (justEvaluated) { clearAll(true); return; }
  // Borra lo que queda DETRÁS del cursor, como cualquier campo de texto.
  if (cursor > 0) {
    tokens.splice(cursor - 1, 1);
    cursor--;
  }
  updateDisplay();
}

function clearAll(silent) {
  tokens = [];
  cursor = 0;
  errorState = false;
  justEvaluated = false;
  updateDisplay();
  if (!silent) {
    setMood('normal');
    say(t('say.limpiar'), 2200);
  }
}

/* Los dos únicos sitios por los que se mueve el cursor. Recortan solos al rango
   válido, así que quien llama no tiene que comprobar nada. moverCursor devuelve
   si de verdad se movió, para no repetir el sonido al topar con el borde. */
function moverCursor(delta) {
  const antes = cursor;
  cursor = Math.min(tokens.length, Math.max(0, cursor + delta));
  if (cursor !== antes) updateDisplay();
  return cursor !== antes;
}

function ponerCursor(i) {
  const antes = cursor;
  cursor = Math.min(tokens.length, Math.max(0, i));
  if (cursor !== antes) updateDisplay();
}

/* La última operación de la cuenta, guardada para poder repetirla: 5+3= da 8, y
   volver a pulsar = da 11, y otra vez 14. Las calculadoras de bolsillo llevan
   haciendo esto toda la vida y sirve para ir sumando de tres en tres, o para
   encadenar descuentos, sin reescribir nada.

   Se busca el último operador que esté FUERA de todo paréntesis: en (1+2)*3 lo
   que se repite es ×3, no +2. Los tokens de función terminan en '(' —'sqrt(',
   'sin('— y por eso cuentan como apertura; '^(-1)' trae su paréntesis ya
   cerrado dentro, así que no descuadra nada. */
let repetible = null;

function colaRepetible(lista) {
  const BINARIOS = ['+', '-', '*', '/', '^', 'mod'];
  let hondo = 0;
  let corte = -1;
  for (let i = 0; i < lista.length; i++) {
    const tk = lista[i];
    if (tk === ')') hondo--;
    else if (tk.endsWith('(')) hondo++;
    // i > 0 deja fuera el menos de "-5", que es signo y no resta
    else if (hondo === 0 && i > 0 && BINARIOS.indexOf(tk) !== -1) corte = i;
  }
  if (corte <= 0 || corte === lista.length - 1) return null;
  return lista.slice(corte);
}

function equals() {
  if (errorState) return;
  wakeUp();
  if (quizMode) { checkQuiz(); return; }
  // Segundo = seguido: repite la última operación sobre el resultado anterior.
  if (justEvaluated && repetible) {
    tokens = numberToTokens(ans).concat(repetible);
    cursor = tokens.length;
    justEvaluated = false;
  }
  const raw = rawExpr();
  if (!raw) { updateDisplay(true); return; }
  let v;
  try { v = evaluate(raw); }
  catch (e) { enterError(e.message); return; }
  repetible = colaRepetible(tokens);
  lastExprRaw = raw;
  ans = v;
  ansFrac = toFraction(v);
  fracMode = false;
  justEvaluated = true;
  cursor = tokens.length;
  addHistory(raw, v);
  updateDisplay(true);
  celebrate(v);
}

/* ± : niega el número final envolviéndolo en (−…).

   La versión anterior solo sabía ir de ida: buscaba el número final recorriendo
   dígitos hacia atrás, pero cuando ya estaba negado el último token era ')' y el
   bucle no avanzaba, así que salía sin hacer nada. Ahora se mira primero si la
   cola ya tiene forma de (−123) y en ese caso se desenvuelve. */
function toggleSign() {
  if (errorState) return;
  wakeUp();
  if (justEvaluated) { tokens = numberToTokens(-ans); cursor = tokens.length; justEvaluated = false; updateDisplay(); return; }

  const esDigito = t => /^[0-9.]$/.test(t);

  /* Trabaja sobre el número que queda JUSTO ANTES del cursor, no sobre el final
     de la expresión. Con el cursor al final —el caso de siempre— sale lo mismo
     que antes; con el cursor en medio, niega el número que estás tocando. */

  // ¿Ya está negado? Quitarle el envoltorio.
  if (tokens[cursor - 1] === ')') {
    let i = cursor - 2;
    while (i >= 0 && esDigito(tokens[i])) i--;
    const hayDigitos = i < cursor - 2;
    if (hayDigitos && i >= 1 && tokens[i] === '-' && tokens[i - 1] === '(') {
      tokens.splice(cursor - 1, 1);          // el ')' del final
      tokens.splice(i - 1, 2);               // el '(' y el '-'
      cursor -= 3;
      updateDisplay();
      return;
    }
  }

  // Si no, envolver el número que esté justo antes del cursor.
  let e = cursor - 1;
  while (e >= 0 && esDigito(tokens[e])) e--;
  const s = e + 1;
  if (s > cursor - 1) return;                // no hay número que negar
  tokens.splice(s, 0, '(', '-');             // se cuelan 2 tokens antes del cursor
  tokens.splice(cursor + 2, 0, ')');         // y el cierre va detrás del número
  cursor += 3;
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
    case 'mc': memory = 0; say(t('say.mem.borrada'), 1800); break;
    case 'mr': pushToken('mem'); break;
    case 'ms': memory = currentValue(); say(t('say.mem.guardada'), 1800); break;
    case 'm+': memory += currentValue(); say(t('say.mem.sumada'), 1800); break;
    case 'm-': memory -= currentValue(); say(t('say.mem.restada'), 1800); break;
  }
  updateMemChip();
}

function updateMemChip() {
  const chip = document.getElementById('mem-chip');
  if (chip) chip.classList.toggle('on', memory !== 0);
}

function setAngle(mode) {
  angleMode = mode;
  store.set('catculator-angle', mode);
  const btn = document.getElementById('btn-angle');
  if (btn) btn.textContent = mode === 'deg' ? 'DEG' : 'RAD';
  updateDisplay();
}

function toggle2nd() {
  inv = !inv;
  document.getElementById('btn-2nd').classList.toggle('active', inv);
  document.querySelectorAll('.skey.fn').forEach(btn => {
    if (btn.dataset.label2) btn.textContent = inv ? btn.dataset.label2 : btn.dataset.label;
    // el nombre hablado cambia con la tecla: sin → arcoseno
    if (btn.dataset.aria2) btn.setAttribute('aria-label', inv ? btn.dataset.aria2 : btn.dataset.aria);
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
  say(kind === 'div0' ? t('say.error.div0') : t('say.error'), 3800);
  playGrowl();
  // Dividir entre cero es lo imperdonable: gruñe y encima bufa
  if (kind === 'div0') setTimeout(playHiss, 450);
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
    say(t('say.nueve'), 3000);
  } else if (result === 42) {
    setMood('surprised', 3000);
    say(t('say.42'), 3200);
  } else if (String(Math.abs(result)).includes('666')) {
    setMood('surprised', 3000);
    say(t('say.666'), 3000);
  } else if (result === 0) {
    setMood('normal');
    say(t('say.cero'), 3000);
  } else if (Math.abs(result) >= 1e9) {
    setMood('surprised', 3000);
    say(t('say.grande'), 3200);
  } else {
    setMood('happy', 2500);
    say(t('say.bien'), 2500);
  }
}

function checkTypedEggs() {
  const raw = rawExpr();
  if (raw === '3.14' || raw === '3.1416') {
    say(t('say.pi'), 2500);
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

/* getBoundingClientRect fuerza al navegador a recalcular el diseño, y aquí se
   llamaba en CADA movimiento del ratón. Se guarda y solo se tira a la basura
   cuando el gato pudo haberse movido. */
let catRect = null;
const olvidarCatRect = () => { catRect = null; };
window.addEventListener('resize', olvidarCatRect);
window.addEventListener('scroll', olvidarCatRect, true);
if (window.ResizeObserver) new ResizeObserver(olvidarCatRect).observe(elCat);

document.addEventListener('mousemove', (e) => {
  if (elCat.classList.contains('mood-sleep')) return;
  if (!catRect) catRect = elCat.getBoundingClientRect();
  const rect = catRect;
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
    say(t('say.dormir'), 3500);
  }, 45000);
}

function wakeUp() {
  if (elCat.classList.contains('mood-sleep')) {
    setMood('normal');
    say(t('say.despertar'), 2200);
  }
  resetIdle();
}
resetIdle();

// ---------- Sonidos (sintetizados, sin archivos) ----------
let soundOn = store.get('catculator-sound') !== 'off';
let audioCtx = null;

function ctx() {
  const recienNacido = !audioCtx;
  if (!audioCtx) audioCtx = new AudioContext();
  /* Solo se reanuda un contexto vivo. Las pruebas cambian audioCtx por uno
     offline, y a ese resume() le sienta fatal: lanza InvalidStateError sin que
     nadie lo recoja. Se distingue por startRendering, que solo tiene el
     offline. Y el promise se atrapa: si el navegador se niega a arrancar el
     audio, no es motivo para ensuciar la consola. */
  if (typeof audioCtx.startRendering !== 'function' && audioCtx.state === 'suspended') {
    const p = audioCtx.resume();
    if (p && p.catch) p.catch(() => {});
  }
  /* En cuanto hay contexto se decodifica lo que estuviera esperando. Sin esto
     el primer rugido siempre saldría sintetizado —justo el que se oye al
     elegir el pelaje, que es el peor momento para enseñar el plan B—. */
  if (recienNacido && typeof decodificarRugido === 'function') {
    for (const especie of Object.keys(rugidoBytes)) decodificarRugido(especie);
  }
  return audioCtx;
}

/* Aquí vivía la vibración al pulsar, y se quitó a conciencia el 19-ago-2026.

   No es que no funcionara: es que en Android NO PUEDE funcionar sin declarar el
   permiso VIBRATE, y "sin permisos" es uno de los tres ganchos de la ficha
   —junto a "sin anuncios" y "sin conexión"—, además de una promesa literal de
   privacidad.html, que es el documento que Play exige.

   Un zumbido de 12 ms no vale lo que cuesta romper eso. Si algún día se
   reconsidera, la vía que NO gasta el permiso es performHapticFeedback() de
   Android, que es la que usa el teclado del sistema; pide un plugin nativo
   propio de unas 30 líneas de Java. La vía web (navigator.vibrate) no sirve:
   dentro de la app instalada falla en silencio sin el permiso. */

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

/* ---------- La voz depende de la especie ----------
   Un león con maullido de gato rompe la ilusión igual que le pasaba a la cara.
   Se saca a una función aparte, en vez de mirar el atributo dentro de
   playMeow, para poder probarlo sin tener que escuchar nada. */
/* Solo cuatro felinos en el mundo rugen —león, tigre, leopardo y jaguar— y es
   por una razón anatómica: tienen el hioides sin osificar del todo. Los demás
   no pueden, por grandes que sean. Así que esta lista no es una simplificación
   para la app: es la lista real, y por eso el guepardo y el leopardo de las
   nieves tienen voz propia en vez de rugido.

   El guepardo pía como un pájaro (chirrido) y el leopardo de las nieves
   resopla (prusten, el bufido amistoso que también hacen los tigres). */
const RUGEN = ['leon', 'tigre', 'leopardo', 'jaguar'];
const VOZ_PROPIA = { guepardo: 'chirrido', nieves: 'prusten' };
function vozDeLaEspecie() {
  const pelaje = document.documentElement.getAttribute('data-fur');
  if (RUGEN.includes(pelaje)) return 'rugido';
  return VOZ_PROPIA[pelaje] || 'maullido';
}

/* ---------- El rugido ----------
   Cuarta versión, y la primera que cambia de objetivo en vez de cambiar de
   parámetros.

   Las tres anteriores fueron intentos de rugido realista: fuente glotal
   escrita ciclo a ciclo, formantes de tracto de león, turbulencia acoplada,
   reverberación, roturas de voz. Cada una medía mejor que la anterior y las
   tres sonaron mal. El error no estaba en los números: estaba en la meta.

   Catculator es un gato de vectores con bocadillo de diálogo. Todos sus
   sonidos son síntesis simple y corta: el clic son 60 ms de seno, el
   ronroneo un diente de sierra a 42 Hz, el bufido ruido pasado por un
   pasaaltos. Y el maullido —el único que nunca ha dado problemas— son dos
   pasabanda barriendo sobre una sierra, catorce líneas. Un rugido de
   documental metido en esa familia suena a intruso aunque sea acústicamente
   impecable: no desentona por malo, desentona por ajeno.

   Así que este rugido es el maullido con dos octavas menos y peor carácter.
   Mismo motor —sierra más dos formantes que se cierran—, mismos modales,
   misma duración corta. No es un león de verdad: es el gato de la app
   poniéndose serio, que es lo que la app pide.

   Lo único que se hereda de las versiones realistas es lo que se aprendió
   sufriendo, y son tres reglas, no tres mil parámetros:

   - El tono BAJA. Un tono que sube es un instrumento de viento (así sonaba
     la primera versión: a corneta).
   - Nada de moduladores regulares gordos. Un LFO de volumen a 26 Hz es un
     motor y uno de altura a 11 Hz es un balido de cabra. El vibrato se queda
     donde lo tiene el maullido: lento y de puntillas.
   - El subarmónico, flojo. Con el grave al mismo nivel que el tono, lo que
     se oye no es aspereza sino la nota una octava más abajo. Medido en la
     versión que se tiró: el código decía 125 Hz y sonaba a 50.

   El motor realista está en el historial de git por si algún día se quiere
   volver, pero volver no es el plan. */

/* Un golpe de rugido: el maullido, transportado y con la boca cerrándose.
   Devuelve nada; el guion lo lleva playRoar. */
function golpeDeRugido(ac, destino, t0, r) {
  const fin = t0 + r.dur;

  /* --- La voz --- */
  const voz = ac.createGain();
  voz.gain.value = 1;

  /* La sierra principal, y otra una octava abajo para el peso. Muy floja: al
     0,3 la forma de onda ya es periódica en el grave y el tono percibido se
     cae la octava —medido, 86 Hz teniendo 172—, que es el fallo que se llevó
     por delante la primera versión. */
  for (const [octava, nivel] of [[1, 1], [0.5, 0.14]]) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    // Empuja, se sostiene y se derrumba. El maullido sube al final; esto no
    osc.frequency.setValueAtTime(r.hz[0] * octava, t0);
    osc.frequency.linearRampToValueAtTime(r.hz[1] * octava, t0 + r.dur * 0.14);
    osc.frequency.setValueAtTime(r.hz[1] * octava, t0 + r.dur * 0.55);
    osc.frequency.linearRampToValueAtTime(r.hz[2] * octava, fin);

    // Vibrato lento y de puntillas, como el del maullido
    const vib = ac.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 5.2;
    const vibG = ac.createGain();
    vibG.gain.value = 22;            // centésimas de tono
    vib.connect(vibG).connect(osc.detune);

    const g = ac.createGain();
    g.gain.value = nivel;
    osc.connect(g).connect(voz);
    osc.start(t0); vib.start(t0);
    osc.stop(fin + 0.05); vib.stop(fin + 0.05);
  }

  /* --- El aire, que es lo que separa un gruñido de una nota ---
     Va por la misma boca que la voz: por eso se conecta antes de los
     formantes y no directamente a la salida. */
  const aire = ac.createBufferSource();
  const n = Math.floor(ac.sampleRate * (r.dur + 0.05));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  aire.buffer = buf;
  const aireG = ac.createGain();
  aireG.gain.value = r.aire;
  aire.connect(aireG).connect(voz);
  aire.start(t0); aire.stop(fin + 0.05);

  /* --- El énfasis ---
     Una sierra cae 6 dB por octava, así que a esta altura de tono los
     formantes se quedan sin material y todo se apelotona abajo: medido sin
     esto, el 74% de la energía entre 100 y 200 Hz y un 3% por encima de 800.
     Un zumbido tapado. El maullido no lo necesita porque vive dos octavas
     más arriba; aquí sí. */
  const enfasis = ac.createBiquadFilter();
  enfasis.type = 'highshelf';
  enfasis.frequency.value = 500;
  enfasis.gain.value = 14;
  voz.connect(enfasis);

  /* --- La boca: dos formantes que se cierran ---
     Igual que en el maullido, pero más abajo y más lento. Que se muevan es
     lo que da la sensación de mandíbula; que se cierren (y no que se abran)
     es lo que evita que suene a metal. */
  const f1 = ac.createBiquadFilter();
  f1.type = 'bandpass'; f1.Q.value = 4;
  f1.frequency.setValueAtTime(r.boca[0], t0);
  f1.frequency.linearRampToValueAtTime(r.boca[1], fin);
  const f2 = ac.createBiquadFilter();
  f2.type = 'bandpass'; f2.Q.value = 5;
  f2.frequency.setValueAtTime(r.boca[2], t0);
  f2.frequency.linearRampToValueAtTime(r.boca[3], fin);
  // Y el cuerpo grave directo, como el f0 del maullido. Va sin énfasis y con
  // poco nivel: es el peso del bicho, no el sonido
  const cuerpo = ac.createBiquadFilter();
  cuerpo.type = 'lowpass';
  cuerpo.frequency.value = 230;

  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(r.vol, t0 + Math.min(0.05, r.dur * 0.12));
  env.gain.setValueAtTime(r.vol, t0 + r.dur * 0.6);
  env.gain.linearRampToValueAtTime(r.vol * 0.45, t0 + r.dur * 0.9);
  env.gain.exponentialRampToValueAtTime(0.0001, fin);

  const g1 = ac.createGain(); g1.gain.value = 1.0;
  const g2 = ac.createGain(); g2.gain.value = 0.7;
  const g0 = ac.createGain(); g0.gain.value = 0.22;
  enfasis.connect(f1).connect(g1).connect(env);
  enfasis.connect(f2).connect(g2).connect(env);
  voz.connect(cuerpo).connect(g0).connect(env);
  env.connect(destino);
}

/* Las dos voces. El león suelta el bramido y lo remata con un gruñido; el
   tigre va más grave, más corto y más sucio. Duraciones cortas a propósito:
   ningún otro sonido de la app pasa del segundo. */
const RUGIDOS = {
  leon: {
    aire: 0.10,
    golpes: [
      { t: 0.05, dur: 0.95, hz: [150, 172, 96], boca: [700, 430, 1650, 980], vol: 0.14 },
      { t: 1.12, dur: 0.28, hz: [120, 128, 78], boca: [620, 390, 1480, 880], vol: 0.08 }
    ]
  },
  tigre: {
    aire: 0.16,
    golpes: [
      { t: 0.05, dur: 0.62, hz: [118, 132, 74], boca: [620, 380, 1450, 880], vol: 0.15 },
      { t: 0.76, dur: 0.19, hz: [100, 106, 66], boca: [560, 350, 1330, 800], vol: 0.07 }
    ]
  },
  /* El leopardo y el jaguar también necesitan receta, aunque casi nunca suene:
     sin ella caían en la del león por el `|| RUGIDOS.leon` de abajo, y los dos
     sonaban exactamente igual que él —medido, mismo F0 y mismo espectro—. Un
     plan B que suplanta a otro animal es peor que un plan B feo. */
  leopardo: {
    aire: 0.12,
    golpes: [
      { t: 0.05, dur: 0.70, hz: [176, 198, 116], boca: [760, 470, 1800, 1080], vol: 0.15 },
      { t: 0.84, dur: 0.22, hz: [148, 156, 98], boca: [700, 430, 1650, 990], vol: 0.08 }
    ]
  },
  jaguar: {
    aire: 0.14,
    golpes: [
      { t: 0.05, dur: 0.80, hz: [128, 144, 82], boca: [660, 400, 1540, 930], vol: 0.16 },
      { t: 0.96, dur: 0.24, hz: [110, 116, 72], boca: [600, 370, 1420, 850], vol: 0.08 }
    ]
  }
};

/* Devuelve el guion que acaba de programar —[{t, dur}]— para que las pruebas
   midan los huecos donde de verdad están y no en tiempos copiados a mano que
   se quedan viejos al primer retoque. */
function rugidoSintetizado(especie) {
  if (!soundOn) return [];
  const ac = ctx();
  const t = ac.currentTime;
  const r = RUGIDOS[especie || document.documentElement.getAttribute('data-fur')] || RUGIDOS.leon;

  const bus = ac.createGain();
  bus.gain.value = 1;
  bus.connect(ac.destination);

  return r.golpes.map(golpe => {
    golpeDeRugido(ac, bus, t + golpe.t, Object.assign({ aire: r.aire }, golpe));
    return { t: golpe.t, dur: golpe.dur };
  });
}

/* ---------- El rugido grabado ----------
   Después de cuatro motores de síntesis —realista, con gesto, y el simple que
   hay arriba— el veredicto seguía siendo el mismo: mejor, pero no suena a un
   león. Así que el rugido, y solo el rugido, sale de una grabación. El
   maullido, el ronroneo, el bufido y el clic siguen sintetizados: ninguno de
   ellos tenía problema.

   Las dos grabaciones son de felinos de verdad y ninguna obliga a atribuir,
   que para una app publicada en dos tiendas es lo que importa:

   - león: dominio público, grabado en un zoológico de Tamil Nadu.
   - tigre: CC0, de Freesound vía Wikimedia Commons.

   La procedencia completa está en CREDITOS.md. Ambas van a 16 kHz mono, que
   no pierde nada: se midió que ninguna tiene energía por encima de 8 kHz.

   La síntesis se queda de plan B. No es paranoia: el archivo puede no estar
   (una compilación que se olvide de copiarlo), puede llegar corrupto, o puede
   no haber terminado de cargar cuando el usuario pulsa. En cualquiera de esos
   casos el gato ruge igual, peor pero ruge. */
const RUGIDOS_GRABADOS = {
  leon: 'sonidos/rugido-leon.wav',
  tigre: 'sonidos/rugido-tigre.wav',
  leopardo: 'sonidos/rugido-leopardo.wav',
  jaguar: 'sonidos/rugido-jaguar.wav'
};
const rugidoBytes = {};        // especie -> ArrayBuffer del archivo, sin decodificar
const rugidoListo = {};        // especie -> AudioBuffer ya decodificado
const rugidoEnVuelo = {};      // especie -> promesa de la descarga
const rugidoPreparando = {};   // especie -> promesa de "descargado Y decodificado"

/* Descarga y punto: NO decodifica. Decodificar exige un AudioContext vivo, y
   esto corre al elegir pelaje —o sea, al arrancar la app, antes de que el
   usuario haya tocado nada—. Crear ahí un AudioContext es buscarse problemas:
   en una máquina sin salida de audio se queda colgado, y con las políticas de
   autoarranque del navegador nace suspendido de todas formas. Así que los
   bytes se guardan crudos y se decodifican en el primer rugido, que por
   definición viene de un clic. */
function cargarRugido(especie) {
  if (!RUGIDOS_GRABADOS[especie] || rugidoBytes[especie] || rugidoEnVuelo[especie]) return;
  rugidoEnVuelo[especie] = fetch(RUGIDOS_GRABADOS[especie])
    .then(res => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.status))))
    .then(bytes => {
      rugidoBytes[especie] = bytes;
      // Si ya hay contexto —o sea, si ya sonó algo— no hay por qué esperar
      if (audioCtx) decodificarRugido(especie);
    })
    .catch(() => { /* sin ruido: para eso está el plan B */ });
}

/* Deja la grabación lista para sonar y dice si lo consiguió. Decodificar
   consume el ArrayBuffer, así que se saca de rugidoBytes al entrar: si no, un
   segundo intento trabajaría sobre un buffer ya vaciado y fallaría en silencio.
   Necesita un AudioContext, o sea que solo se llama desde un gesto del usuario. */
function prepararRugido(especie) {
  if (rugidoListo[especie]) return Promise.resolve(true);
  if (!RUGIDOS_GRABADOS[especie]) return Promise.resolve(false);
  /* La promesa se guarda y se comparte. Sin esto, dos llamadas seguidas se
     pisan: la primera se lleva los bytes para decodificarlos y la segunda,
     al no encontrarlos, contesta "no hay grabación" y manda al plan B. Pasa
     con dos clics rápidos, que no es un caso raro. */
  if (rugidoPreparando[especie]) return rugidoPreparando[especie];
  cargarRugido(especie);
  rugidoPreparando[especie] = (rugidoEnVuelo[especie] || Promise.resolve()).then(() => {
    if (rugidoListo[especie]) return true;
    const bytes = rugidoBytes[especie];
    if (!bytes) return false;
    delete rugidoBytes[especie];
    return ctx().decodeAudioData(bytes)
      .then(buf => { rugidoListo[especie] = buf; return true; })
      .catch(() => false);
  });
  return rugidoPreparando[especie];
}
// Se conserva el nombre viejo: ctx() lo llama al nacer para adelantar trabajo
function decodificarRugido(especie) { prepararRugido(especie); }

function sonarGrabacion(especie) {
  const ac = ctx();
  const src = ac.createBufferSource();
  src.buffer = rugidoListo[especie];
  const g = ac.createGain();
  g.gain.value = 0.9;
  src.connect(g).connect(ac.destination);
  src.start(ac.currentTime);
}

function playRoar(especie) {
  if (!soundOn) return [];
  const cual = especie || document.documentElement.getAttribute('data-fur');

  if (rugidoListo[cual]) {
    sonarGrabacion(cual);
    return [{ t: 0, dur: rugidoListo[cual].duration, grabado: true }];
  }
  if (!RUGIDOS_GRABADOS[cual]) return rugidoSintetizado(especie);

  /* Hay grabación pero todavía no está lista. Antes se tiraba del plan B en el
     acto, y por eso el PRIMER rugido de cada felino —justo el de estrenarlo,
     que es el que más se oye— sonaba distinto de todos los demás: elegir el
     pelaje arranca la descarga y el sonido salía en el mismo suspiro, sin
     tiempo de que llegara nada.

     Ahora se le da un respiro. Es un archivo local: tarda unos 20 ms, y 300 de
     margen no se notan al pulsar. Si tarda más o falla, entonces sí suena el
     sintetizado, que para eso está: lo que no puede pasar es quedarse mudo. */
  let resuelto = false;
  const plazo = setTimeout(() => {
    if (resuelto) return;
    resuelto = true;
    rugidoSintetizado(especie);
  }, 300);

  prepararRugido(cual).then(listo => {
    if (resuelto) return;
    resuelto = true;
    clearTimeout(plazo);
    if (listo) sonarGrabacion(cual);
    else rugidoSintetizado(especie);
  });
  return [{ t: 0, dur: 0, esperando: true }];
}

/* ---------- El chirrido del guepardo ----------
   Suena a pájaro, y no es una licencia: el guepardo pía de verdad, con un
   sonido que la gente confunde con un ave si no ve al animal. Esto sí sale
   bien sintetizado —al revés que el rugido— porque es corto, agudo y casi un
   tono puro: justo lo que un oscilador hace de sobra.

   Son tres píos con una subida y bajada rápida de tono. La aleatoriedad no es
   adorno: tres píos idénticos suenan a alarma de microondas. */
function playChirrido() {
  if (!soundOn) return;
  const ac = ctx();
  const t0 = ac.currentTime;
  const cuantos = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < cuantos; i++) {
    const t = t0 + i * (0.135 + Math.random() * 0.05);
    const dur = 0.075 + Math.random() * 0.03;
    const base = 1150 + Math.random() * 350;

    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base * 0.72, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + dur * 0.35);
    osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + dur);

    // Un poco de sierra por encima: el pío del guepardo no es un seno limpio
    const aspero = ac.createOscillator();
    aspero.type = 'sawtooth';
    aspero.frequency.setValueAtTime(base * 0.72, t);
    aspero.frequency.exponentialRampToValueAtTime(base * 1.5, t + dur * 0.35);
    aspero.frequency.exponentialRampToValueAtTime(base * 0.9, t + dur);
    const asperoG = ac.createGain();
    asperoG.gain.value = 0.18;

    const boca = ac.createBiquadFilter();
    boca.type = 'bandpass';
    boca.frequency.value = base * 1.35;
    boca.Q.value = 2.2;

    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.11, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(boca);
    aspero.connect(asperoG).connect(boca);
    boca.connect(env).connect(ac.destination);
    osc.start(t); aspero.start(t);
    osc.stop(t + dur + 0.02); aspero.stop(t + dur + 0.02);
  }
}

/* ---------- El prusten del leopardo de las nieves ----------
   El resoplido amistoso: aire soltado por la nariz en ráfagas rápidas, sin
   voz. Es puro ruido pulsado, así que aquí un modulador regular sí vale —lo
   que en el rugido sonaba a motor, aquí ES el sonido—. La diferencia está en
   que no hay ningún oscilador debajo: si lo hubiera, volvería a sonar a
   máquina. */
function playPrusten() {
  if (!soundOn) return;
  const ac = ctx();
  const t = ac.currentTime;
  const dur = 0.5;
  const sr = ac.sampleRate;
  const n = Math.floor(sr * dur);
  const buf = ac.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const pulsos = 20;                       // ráfagas por segundo
  for (let i = 0; i < n; i++) {
    const fase = (i / sr) * pulsos % 1;
    // Cada ráfaga: sube de golpe y se apaga; entre ráfaga y ráfaga no hay cero
    const sobre = 0.25 + 0.75 * Math.pow(Math.max(0, 1 - fase * 1.6), 1.8);
    d[i] = (Math.random() * 2 - 1) * sobre;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;

  const nariz = ac.createBiquadFilter();
  nariz.type = 'bandpass';
  nariz.frequency.value = 750;             // sale por la nariz, no por la boca
  nariz.Q.value = 0.9;
  const cuerpo = ac.createBiquadFilter();
  cuerpo.type = 'lowpass';
  cuerpo.frequency.value = 1700;

  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(0.17, t + 0.06);
  env.gain.setValueAtTime(0.17, t + dur * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(nariz).connect(cuerpo).connect(env).connect(ac.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function playMeow() {
  if (!soundOn) return;
  const voz = vozDeLaEspecie();
  if (voz === 'rugido') { playRoar(); return; }
  if (voz === 'chirrido') { playChirrido(); return; }
  if (voz === 'prusten') { playPrusten(); return; }
  const ac = ctx();
  const t = ac.currentTime;
  // Cada maullido sale un poco distinto: tono y duración aleatorios
  const p = 0.9 + Math.random() * 0.25;
  const dur = 0.5 + Math.random() * 0.15;

  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  // Contorno "mi-a-u": sube rápido, meseta y cae
  osc.frequency.setValueAtTime(340 * p, t);
  osc.frequency.linearRampToValueAtTime(760 * p, t + dur * 0.22);
  osc.frequency.setValueAtTime(760 * p, t + dur * 0.5);
  osc.frequency.linearRampToValueAtTime(300 * p, t + dur);

  // Vibrato suave en la meseta
  const vib = ac.createOscillator();
  const vibGain = ac.createGain();
  vib.type = 'sine';
  vib.frequency.value = 6.5;
  vibGain.gain.value = 12;
  vib.connect(vibGain).connect(osc.frequency);

  // Dos formantes en paralelo que barren de "iii" a "aau" — la "boca" del gato
  const f1 = ac.createBiquadFilter();
  f1.type = 'bandpass'; f1.Q.value = 5;
  f1.frequency.setValueAtTime(1000, t);
  f1.frequency.linearRampToValueAtTime(650, t + dur);
  const f2 = ac.createBiquadFilter();
  f2.type = 'bandpass'; f2.Q.value = 7;
  f2.frequency.setValueAtTime(2400, t);
  f2.frequency.linearRampToValueAtTime(950, t + dur);
  // Y un poco de cuerpo grave directo
  const f0 = ac.createBiquadFilter();
  f0.type = 'lowpass';
  f0.frequency.value = 500;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
  gain.gain.setValueAtTime(0.16, t + dur * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const g1 = ac.createGain(); g1.gain.value = 0.7;
  const g2 = ac.createGain(); g2.gain.value = 0.4;
  const g0 = ac.createGain(); g0.gain.value = 0.25;
  osc.connect(f1).connect(g1).connect(gain);
  osc.connect(f2).connect(g2).connect(gain);
  osc.connect(f0).connect(g0).connect(gain);
  gain.connect(ac.destination);

  osc.start(t); vib.start(t);
  osc.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
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

function playGrowl() {
  if (!soundOn) return;
  const ac = ctx();
  const t = ac.currentTime;
  const dur = 0.65;

  // Base grave que desciende — la amenaza
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.linearRampToValueAtTime(70, t + dur);

  // Aspereza: tremolo rápido sobre el volumen
  const trem = ac.createOscillator();
  const tremGain = ac.createGain();
  trem.type = 'sine';
  trem.frequency.value = 28;
  tremGain.gain.value = 0.05;

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 380;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.13, t + 0.08);
  gain.gain.setValueAtTime(0.13, t + dur * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  trem.connect(tremGain).connect(gain.gain);

  // Rugosidad: ruido grave por debajo
  const bufferSize = ac.sampleRate * dur;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const nFilter = ac.createBiquadFilter();
  nFilter.type = 'lowpass';
  nFilter.frequency.value = 220;
  const nGain = ac.createGain();
  nGain.gain.value = 0.35;
  noise.connect(nFilter).connect(nGain).connect(gain);

  osc.connect(filter).connect(gain).connect(ac.destination);
  osc.start(t); trem.start(t); noise.start(t);
  osc.stop(t + dur); trem.stop(t + dur);
}

// ---------- Botón de sonido ----------
const btnSound = document.getElementById('btn-sound');
function refreshSoundBtn() {
  btnSound.textContent = soundOn ? '🔊' : '🔇';
  btnSound.setAttribute('aria-pressed', String(soundOn)); // el emoji no lo dice solo
}
btnSound.addEventListener('click', () => {
  soundOn = !soundOn;
  store.set('catculator-sound', soundOn ? 'on' : 'off');
  refreshSoundBtn();
  if (soundOn) { playMeow(); say(t('say.sonido.on'), 2000); }
  else say(t('say.sonido.off'), 2000);
});
refreshSoundBtn();

// ---------- Temas ----------
const themePanel = document.getElementById('theme-panel');
const btnTheme = document.getElementById('btn-theme');

/* guardar=false es para el tema que se elige solo (el del sistema): así la app
   sigue al sistema hasta que el humano toque un color, y desde ahí manda él. */
function applyTheme(theme, guardar = true) {
  document.documentElement.setAttribute('data-theme', theme);
  if (guardar) store.set('catculator-theme', theme);
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
  closePanels(themePanel);
  themePanel.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  for (const [panel, btn] of panelPairs()) {
    if (!panel.classList.contains('hidden') &&
        !panel.contains(e.target) && e.target !== btn) {
      panel.classList.add('hidden');
      btn.classList.remove('active');
    }
  }
});

document.querySelectorAll('.theme-swatch').forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme);
    say(t('say.tema.' + btn.dataset.theme), 2400);
    setMood('happy', 2000);
    playMeow();
    themePanel.classList.add('hidden');
  });
});

// Primera vez: si el sistema está en oscuro, se abre en Noche en vez de deslumbrar
const temaGuardado = store.get('catculator-theme');
const mqOscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
applyTheme(temaGuardado || (mqOscuro && mqOscuro.matches ? 'noche' : 'cian'), !!temaGuardado);

// Mientras no haya elegido tema, la app acompaña los cambios del sistema
if (!temaGuardado && mqOscuro && mqOscuro.addEventListener) {
  mqOscuro.addEventListener('change', e => {
    if (!store.get('catculator-theme')) applyTheme(e.matches ? 'noche' : 'cian', false);
  });
}

// ---------- Pelaje del gato ----------
function applyFur(fur) {
  document.documentElement.setAttribute('data-fur', fur);
  store.set('catculator-fur', fur);
  document.querySelectorAll('.fur-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fur === fur);
  });
  /* Aquí es donde el rugido pasa a ser posible, así que aquí se pide el
     archivo. Pedirlo al arrancar sería gastar 50 KB con quien nunca se pone
     de león; pedirlo al pulsar llegaría tarde y sonaría el sintetizado. */
  cargarRugido(fur);
}

document.querySelectorAll('.fur-swatch').forEach(btn => {
  btn.addEventListener('click', () => {
    applyFur(btn.dataset.fur);
    say(t('say.pelaje.' + btn.dataset.fur), 2400);
    setMood('happy', 2000);
    playMeow();
    themePanel.classList.add('hidden');
  });
});

applyFur(store.get('catculator-fur') || 'carbon');

// ---------- Atuendos del gato ----------
function applyOutfit(outfit) {
  document.documentElement.setAttribute('data-outfit', outfit);
  store.set('catculator-outfit', outfit);
  document.querySelectorAll('.outfit-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.outfit === outfit);
  });
}

document.querySelectorAll('.outfit-swatch').forEach(btn => {
  btn.addEventListener('click', () => {
    applyOutfit(btn.dataset.outfit);
    say(t('say.atuendo.' + btn.dataset.outfit), 2400);
    setMood('happy', 2000);
    playMeow();
    themePanel.classList.add('hidden');
  });
});

applyOutfit(store.get('catculator-outfit') || 'ninguno');

// ---------- Modo básica / científica ----------
const btnMode = document.getElementById('btn-mode');
const sciPad = document.getElementById('sci-pad');

function applyMode(mode) {
  const sci = mode === 'sci';
  document.getElementById('app').classList.toggle('sci-on', sci);
  sciPad.classList.toggle('hidden', !sci);
  btnMode.textContent = sci ? t('ctrl.basica') : t('ctrl.cientifica');
  store.set('catculator-mode', mode);
}

btnMode.addEventListener('click', () => {
  const now = document.getElementById('app').classList.contains('sci-on') ? 'basic' : 'sci';
  applyMode(now);
  if (now === 'sci') setMood('happy', 2000);
});

applyMode(store.get('catculator-mode') || 'basic');

// ---------- Controles científicos ----------
document.getElementById('btn-2nd').addEventListener('click', () => { playClick(); toggle2nd(); });
document.getElementById('btn-angle').addEventListener('click', () => {
  playClick();
  setAngle(angleMode === 'deg' ? 'rad' : 'deg');
});
setAngle(angleMode);
updateMemChip();

// ---------- Paneles laterales ----------
const historyPanel = document.getElementById('history-panel');
const convPanel = document.getElementById('conv-panel');
const btnHistory = document.getElementById('btn-history');
const btnConv = document.getElementById('btn-conv');
const btnQuiz = document.getElementById('btn-quiz');

function panelPairs() {
  return [
    [themePanel, btnTheme], [historyPanel, btnHistory],
    [convPanel, btnConv], [notesPanel, btnNotes], [shopPanel, btnShop]
  ];
}

function closePanels(except) {
  for (const [panel, btn] of panelPairs()) {
    if (panel !== except) {
      panel.classList.add('hidden');
      btn.classList.remove('active');
    }
  }
}

// ---------- Copiar resultado ----------
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.className = 'copy-helper';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove();
  return ok;
}

function copyResult() {
  if (errorState || quizMode) return;
  wakeUp();
  const text = textoANumeroPlano(elResult.textContent);
  const done = () => {
    playClick();
    setMood('happy', 1600);
    say(t('say.copiado'), 2000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => { if (fallbackCopy(text)) done(); });
  } else if (fallbackCopy(text)) {
    done();
  }
}

// ---------- Pegar ----------
/* Copiar el resultado ya estaba; meter un número desde fuera, no. Y es lo que
   más falta hace a diario: tienes el precio en el navegador o en un mensaje y
   tocaba teclearlo a mano mirando.

   Lo pegado puede venir de cualquier parte, así que se limpia a conciencia:
   símbolos de moneda, espacios, letras. Lo que quede tiene que ser UN número,
   y si no lo es se dice en vez de inventarse algo. */
function numeroPegado(texto) {
  if (typeof texto !== 'string') return null;
  let s = texto.trim();
  if (!s || s.length > 40) return null;
  s = s.replace(/[^\d.,\-+]/g, '');          // "$ 1 234,50" -> "1234,50"
  if (!s) return null;
  const negativo = s.startsWith('-');
  if (negativo || s.startsWith('+')) s = s.slice(1);
  /* El signo solo vale al principio. Sin esto "12+34" perdía el más y entraba
     como 1234, que es peor que no pegar nada: un número inventado con pinta de
     correcto. Lo mismo con "10-3" o con un rango tipo "5-7". */
  if (/[+\-]/.test(s)) return null;
  if (!/\d/.test(s)) return null;

  const puntos = (s.match(/\./g) || []).length;
  const comas  = (s.match(/,/g)  || []).length;
  let dec = null;                            // cuál de los dos hace de decimal
  if (puntos && comas) {
    /* Con los dos presentes manda el último: 1.234,56 y 1,234.56 son el mismo
       número escrito en dos países distintos. */
    dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
  } else if (puntos === 1 || comas === 1) {
    const sep = puntos ? '.' : ',';
    /* Uno solo es ambiguo: "1.234" son mil doscientos treinta y cuatro en
       España y uno coma doscientos treinta y cuatro en inglés. Con exactamente
       tres cifras detrás se toma por millares, pero solo si ese es el
       separador de millares del idioma en curso. */
    dec = (s.split(sep)[1].length === 3 && sep === SEP.miles) ? null : sep;
  }

  let limpio;
  if (dec === null) {
    const sep = puntos ? '.' : (comas ? ',' : null);
    if (sep) {
      /* Si van de millares, tienen que estar bien puestos. Sin esto "1.2.3"
         —una fecha, una versión— se colaba como 123. */
      const grupos = s.split(sep);
      const bien = grupos[0].length >= 1 && grupos[0].length <= 3 &&
        grupos.slice(1).every(g => g.length === 3);
      if (!bien) return null;
    }
    limpio = s.replace(/[.,]/g, '');
  } else {
    const otro = dec === '.' ? ',' : '.';
    limpio = s.split(otro).join('').split(dec).join('.');
  }
  if (!/^\d*\.?\d+$|^\d+\.?\d*$/.test(limpio)) return null;
  const v = parseFloat(limpio);
  if (!isFinite(v)) return null;
  return negativo ? -v : v;
}

function pegarTexto(texto) {
  if (quizMode) return false;
  const v = numeroPegado(texto);
  if (v === null) {
    say(t('say.pegar.no'), 2600);
    setMood('surprised', 1800);
    return false;
  }
  if (errorState) clearAll(true);
  if (justEvaluated) { tokens = []; cursor = 0; justEvaluated = false; }
  insertarTokens(numberToTokens(v));
  playClick();
  updateDisplay(true);
  say(t('say.pegado'), 1800);
  setMood('happy', 1400);
  return true;
}

/* Ctrl+V y el menú "Pegar" del escritorio entran por aquí.

   EL PEGADO DOBLE. En el Catculator de Windows un Ctrl+V puede llegar por dos
   caminos a la vez: el acelerador del menú de Electron, que llama a
   webContents.paste(), y el manejo que Chromium hace de la tecla por su cuenta.
   Cuando pasan los dos, el mismo número entra dos veces y "0" se convierte en
   "00" en pantalla.

   No se arregla quitando uno de los dos caminos —hacen falta los dos, cada uno
   cubre situaciones distintas— sino ignorando el repetido: si llega el MISMO
   texto dos veces en menos de un cuarto de segundo, es el eco, no una persona
   pegando dos veces. A mano no se puede pulsar dos veces tan rápido y encima
   con el mismo contenido. */
let ultimoPegado = { texto: null, cuando: 0 };

document.addEventListener('paste', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;   // el bloc de notas es suyo
  const datos = e.clipboardData || window.clipboardData;
  if (!datos) return;
  const texto = datos.getData('text');
  const ahora = Date.now();
  if (texto === ultimoPegado.texto && ahora - ultimoPegado.cuando < 250) {
    e.preventDefault();
    return;
  }
  ultimoPegado = { texto: texto, cuando: ahora };
  if (pegarTexto(texto)) e.preventDefault();
});

/* En el móvil no hay evento paste sin un campo de texto donde pegar, así que
   la vía es la pulsación larga sobre la pantalla — que además es lo que hacen
   la calculadora de Android y la del iPhone, o sea que ya está en los dedos.

   LEER el portapapeles tiene dos caminos, y hay que probarlos en este orden:

   1. El plugin de Capacitor, que en Android baja al ClipboardManager nativo.
      Es el ÚNICO que funciona dentro de la app instalada: el WebView de
      Android no implementa navigator.clipboard.readText —ni siquiera lo pide,
      lo rechaza— así que la vía web fallaba siempre y el gato acababa diciendo
      que no le dejaban mirar. Escribir sí funciona en los dos sitios, y por eso
      copyResult no necesita nada de esto.
   2. navigator.clipboard, para el escritorio y para la PWA en un navegador de
      verdad, donde sí existe y pide permiso la primera vez.

   En Android 12 y posteriores el sistema enseña un aviso propio ("Catculator ha
   pegado del portapapeles") cada vez que se lee. Es del sistema operativo, no
   se puede quitar, y está bien que se vea. */
function pedirPegar() {
  const nativo = window.Capacitor && window.Capacitor.Plugins &&
                 window.Capacitor.Plugins.Clipboard;
  if (nativo && nativo.read) {
    nativo.read()
      .then(r => pegarTexto(r && r.value))
      .catch(() => say(t('say.pegar.permiso'), 2800));
    return;
  }
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText()
      .then(pegarTexto)
      .catch(() => say(t('say.pegar.permiso'), 2800));
    return;
  }
  say(t('say.pegar.permiso'), 2800);
}

let tempPulsacion = null;
let huboPulsacionLarga = false;
elResult.addEventListener('pointerdown', () => {
  huboPulsacionLarga = false;
  clearTimeout(tempPulsacion);
  tempPulsacion = setTimeout(() => {
    huboPulsacionLarga = true;                // para que el click de después no haga nada
    pedirPegar();
  }, 550);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
  elResult.addEventListener(ev, () => clearTimeout(tempPulsacion));
}

/* Un toque corto hace una cosa u otra según lo que haya delante: con un
   resultado en pantalla lo natural es copiarlo; escribiendo una cuenta, lo
   natural es llevar el cursor a donde has tocado. */
elResult.addEventListener('click', (e) => {
  if (huboPulsacionLarga) { huboPulsacionLarga = false; return; }
  if (justEvaluated || errorState || quizMode || !tokens.length) { copyResult(); return; }
  const span = e.target && e.target.closest ? e.target.closest('.tok') : null;
  if (span) {
    // Mitad izquierda del token: delante. Mitad derecha: detrás.
    const i = parseInt(span.dataset.i, 10);
    const r = span.getBoundingClientRect();
    ponerCursor(e.clientX < r.left + r.width / 2 ? i : i + 1);
  } else {
    const r = elResult.getBoundingClientRect();
    ponerCursor(e.clientX < r.left + r.width / 2 ? 0 : tokens.length);
  }
});

// El resultado también se copia con el teclado: es un div, así que hay que
// darle el papel de botón a mano (el tabindex vive en el HTML).
elResult.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyResult(); }
});

// ---------- Historial ----------
const historyList = document.getElementById('history-list');

function addHistory(exprRaw, result) {
  history.unshift({ e: prettify(exprRaw), r: formatNumber(result), v: result });
  if (history.length > 40) history.length = 40;
  store.set('catculator-history', JSON.stringify(history));
}

function renderHistory() {
  historyList.textContent = '';
  if (!history.length) {
    const p = document.createElement('p');
    p.className = 'history-empty';
    p.textContent = t('hist.vacio');
    historyList.appendChild(p);
    return;
  }
  for (const item of history) {
    const btn = document.createElement('button');
    btn.className = 'history-item';
    btn.title = t('hist.usar');
    const ex = document.createElement('span');
    ex.className = 'history-expr';
    ex.textContent = item.e + ' =';
    const rs = document.createElement('span');
    rs.className = 'history-res';
    rs.textContent = item.r;
    btn.append(ex, rs);
    btn.addEventListener('click', () => {
      playClick();
      if (errorState) clearAll(true);
      if (quizMode) return;
      justEvaluated = false;
      tokens = numberToTokens(item.v);
      cursor = tokens.length;
      closePanels();
      updateDisplay(true);
      say(t('say.hist.usado'), 2000);
    });
    historyList.appendChild(btn);
  }
}

btnHistory.addEventListener('click', (e) => {
  e.stopPropagation();
  playClick();
  wakeUp();
  closePanels(historyPanel);
  renderHistory();
  historyPanel.classList.toggle('hidden');
});

document.getElementById('btn-history-clear').addEventListener('click', () => {
  playClick();
  history = [];
  store.del('catculator-history');
  renderHistory();
  say(t('say.hist.borrado'), 2200);
});

// ---------- Conversor de unidades ----------
// Factores hacia la unidad base de cada categoría; temperatura va aparte
// porque no es un simple factor (tiene desplazamiento).
/* Las claves son códigos, NO nombres: antes la unidad se llamaba 'pulgadas' y
   ese mismo texto era la clave del factor, así que traducirla habría roto la
   conversión. Ahora el nombre visible sale del diccionario (etiquetaUnidad) y
   la clave nunca cambia de idioma. Los símbolos de temperatura se quedan como
   están porque se escriben igual en todas partes. */
const CONV = {
  longitud: {
    units: {
      mm: 0.001, cm: 0.01, m: 1, km: 1000,
      in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344
    },
    def: ['cm', 'in']
  },
  peso: {
    units: { mg: 1e-6, g: 0.001, kg: 1, lb: 0.45359237, oz: 0.028349523125, t: 1000 },
    def: ['kg', 'lb']
  },
  temperatura: {
    units: { '°C': 1, '°F': 1, 'K': 1 },
    def: ['°C', '°F']
  },
  volumen: {
    units: { ml: 0.001, l: 1, cup: 0.24, gal: 3.785411784, floz: 0.0295735295625 },
    def: ['l', 'gal']
  },
  velocidad: {
    units: { ms: 1, kmh: 1 / 3.6, mph: 0.44704, kn: 0.514444 },
    def: ['kmh', 'mph']
  }
};

const convCat = document.getElementById('conv-cat');
const convValue = document.getElementById('conv-value');
const convFrom = document.getElementById('conv-from');
const convTo = document.getElementById('conv-to');
const convResult = document.getElementById('conv-result');
let lastConv = null;

function fillSelect(sel, values, chosen) {
  sel.textContent = '';
  for (const v of values) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = etiquetaUnidad(v);
    if (v === chosen) opt.selected = true;
    sel.appendChild(opt);
  }
}

function llenarCategorias() {
  const elegida = convCat.value;
  convCat.textContent = '';
  for (const key of Object.keys(CONV)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = t('cat.' + key);
    if (key === elegida) opt.selected = true;
    convCat.appendChild(opt);
  }
}
llenarCategorias();

function convSetCategory(key) {
  const cat = CONV[key];
  fillSelect(convFrom, Object.keys(cat.units), cat.def[0]);
  fillSelect(convTo, Object.keys(cat.units), cat.def[1]);
  convCompute();
}

function convertTemp(v, from, to) {
  let c;
  if (from === '°C') c = v;
  else if (from === '°F') c = (v - 32) * 5 / 9;
  else c = v - 273.15;
  if (to === '°C') return c;
  if (to === '°F') return c * 9 / 5 + 32;
  return c + 273.15;
}

function convCompute() {
  const v = parseFloat(convValue.value);
  if (!isFinite(v)) {
    convResult.textContent = '—';
    lastConv = null;
    return;
  }
  const key = convCat.value;
  const from = convFrom.value, to = convTo.value;
  let r;
  if (key === 'temperatura') r = convertTemp(v, from, to);
  else r = v * CONV[key].units[from] / CONV[key].units[to];
  lastConv = roundNice(r);
  const shown = isFinite(lastConv) ? parseFloat(lastConv.toPrecision(8)) : lastConv;
  convResult.textContent = formatNumber(v) + ' ' + etiquetaUnidad(from) +
    ' = ' + formatNumber(shown) + ' ' + etiquetaUnidad(to);
}

convCat.addEventListener('change', () => convSetCategory(convCat.value));
convValue.addEventListener('input', convCompute);
convFrom.addEventListener('change', convCompute);
convTo.addEventListener('change', convCompute);

document.getElementById('conv-swap').addEventListener('click', () => {
  playClick();
  const a = convFrom.value;
  convFrom.value = convTo.value;
  convTo.value = a;
  convCompute();
});

document.getElementById('btn-conv-use').addEventListener('click', () => {
  if (lastConv === null || !isFinite(lastConv)) return;
  playClick();
  if (errorState) clearAll(true);
  if (quizMode) return;
  justEvaluated = false;
  tokens = numberToTokens(lastConv);
  cursor = tokens.length;
  closePanels();
  updateDisplay(true);
  setMood('happy', 1800);
  say(t('say.conv.usado'), 2200);
});

btnConv.addEventListener('click', (e) => {
  e.stopPropagation();
  playClick();
  wakeUp();
  closePanels(convPanel);
  if (convPanel.classList.contains('hidden')) {
    const v = currentValue();
    if (isFinite(v) && Math.abs(v) < 1e12) convValue.value = String(roundNice(v));
    convCompute();
  }
  convPanel.classList.toggle('hidden');
});

convSetCategory('longitud');

// ---------- Modo compras ----------
const shopPanel = document.getElementById('shop-panel');
const btnShop = document.getElementById('btn-shop');
const shopPrice = document.getElementById('shop-price');
const shopIn = {
  desc: document.getElementById('shop-desc'),
  iva: document.getElementById('shop-iva'),
  tip: document.getElementById('shop-tip'),
  split: document.getElementById('shop-split')
};
const shopOut = {
  desc: document.getElementById('shop-desc-res'),
  iva: document.getElementById('shop-iva-res'),
  noiva: document.getElementById('shop-noiva-res'),
  tip: document.getElementById('shop-tip-res'),
  split: document.getElementById('shop-split-res')
};

// ---------- Divisas del Modo compras ----------
// Cada tasa es "cuántas unidades de esa moneda vale 1 USD". La app no toca la
// red, así que son valores aproximados que el usuario mantiene al día a mano.
const CURRENCIES = [
  { code: 'CRC', flag: '🇨🇷', sym: '₡',   rate: 510 },
  { code: 'USD', flag: '🇺🇸', sym: '$',   rate: 1 },
  { code: 'EUR', flag: '🇪🇺', sym: '€',   rate: 0.92 },
  { code: 'MXN', flag: '🇲🇽', sym: 'MX$', rate: 18 },
  { code: 'CAD', flag: '🇨🇦', sym: 'C$',  rate: 1.38 },
  { code: 'BRL', flag: '🇧🇷', sym: 'R$',  rate: 5.5 },
  { code: 'ARS', flag: '🇦🇷', sym: 'AR$', rate: 1010 },
  { code: 'COP', flag: '🇨🇴', sym: 'CO$', rate: 4000 },
  { code: 'CLP', flag: '🇨🇱', sym: 'CL$', rate: 950 },
  { code: 'PEN', flag: '🇵🇪', sym: 'S/',  rate: 3.7 },
  { code: 'GTQ', flag: '🇬🇹', sym: 'Q',   rate: 7.7 }
];

/* Fecha en que se escribieron las tasas que trae la app de fábrica. Sin esto,
   una tasa de hace dos años se ve exactamente igual que una de hoy y el usuario
   convierte con números viejos sin enterarse. La app no toca la red, así que lo
   único honesto que puede hacer es decir cuándo se actualizó por última vez. */
/* Ojo con el mes: en JavaScript enero es 0, así que 6 es julio. Se construye
   como fecha LOCAL a propósito — Date.parse('2026-07-24') la interpreta en UTC
   y en Costa Rica (UTC−6) se mostraba como 23 de julio, un día antes. */
const TASAS_DE_FABRICA = new Date(2026, 6, 24).getTime();
const fechasTasas = store.json('catculator-rates-fechas', {});

const savedRates = store.json('catculator-rates', {});
for (const c of CURRENCIES) {
  const r = parseFloat(savedRates[c.code]);
  if (isFinite(r) && r > 0) c.rate = r;
}
function saveRates() {
  const o = {};
  for (const c of CURRENCIES) o[c.code] = c.rate;
  store.set('catculator-rates', JSON.stringify(o));
  store.set('catculator-rates-fechas', JSON.stringify(fechasTasas));
}
const rateOf = code => { const c = CURRENCIES.find(x => x.code === code); return c ? c.rate : NaN; };

/* Cuánto hace que se tocó una tasa. 'vieja' a los dos meses: es cuando una
   cotización deja de ser una aproximación razonable y pasa a ser un error. */
function antiguedadTasa(code) {
  const propia = fechasTasas[code] !== undefined;
  const cuando = propia ? fechasTasas[code] : TASAS_DE_FABRICA;
  const dias = Math.floor((Date.now() - cuando) / 86400000);
  const vieja = dias >= 60;
  if (!propia) {
    const fecha = new Date(TASAS_DE_FABRICA).toLocaleDateString(IDIOMA === 'es' ? 'es' : 'en');
    return { texto: t('tasa.nunca', { n: fecha }), vieja };
  }
  if (dias <= 0) return { texto: t('tasa.hoy'), vieja };
  if (dias === 1) return { texto: t('tasa.undia'), vieja };
  if (dias < 30) return { texto: t('tasa.dias', { n: dias }), vieja };
  const meses = Math.round(dias / 30);
  if (meses === 1) return { texto: t('tasa.unmes'), vieja };
  return { texto: t('tasa.meses', { n: meses }), vieja };
}

const shopFromSel = document.getElementById('shop-from');
const shopToSel = document.getElementById('shop-to');
const shopConvRes = document.getElementById('shop-conv-res');
const shopSwap = document.getElementById('shop-swap');
const shopRateFields = document.getElementById('shop-rate-fields');
const shopConvAmount = document.getElementById('shop-conv-amount');

function fillCurrencySelect(sel) {
  const elegida = sel.value;
  sel.textContent = '';
  for (const c of CURRENCIES) {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = c.flag + ' ' + c.code + ' · ' + t('m.' + c.code);
    sel.appendChild(opt);
  }
  if (elegida) sel.value = elegida;
}
fillCurrencySelect(shopFromSel);
fillCurrencySelect(shopToSel);
shopFromSel.value = store.get('catculator-shop-from') || 'CRC';
if (!shopFromSel.value) shopFromSel.value = 'CRC';
shopToSel.value = store.get('catculator-shop-to') || 'USD';
if (!shopToSel.value) shopToSel.value = 'USD';
shopFromSel.addEventListener('change', () => {
  store.set('catculator-shop-from', shopFromSel.value);
  renderRateFields();
  renderConv();
});
shopToSel.addEventListener('change', () => {
  store.set('catculator-shop-to', shopToSel.value);
  renderRateFields();
  renderConv();
});
shopSwap.addEventListener('click', () => {
  playClick();
  const a = shopFromSel.value;
  shopFromSel.value = shopToSel.value;
  shopToSel.value = a;
  store.set('catculator-shop-from', shopFromSel.value);
  store.set('catculator-shop-to', shopToSel.value);
  renderRateFields();
  renderConv();
});
shopConvRes.addEventListener('click', () => useShopValue(parseFloat(shopConvRes.dataset.v)));
shopConvAmount.addEventListener('input', renderConv);

// Coloca un valor de un resultado del panel en la calculadora
function useShopValue(v) {
  if (!isFinite(v) || quizMode) return;
  playClick();
  if (errorState) clearAll(true);
  justEvaluated = false;
  tokens = numberToTokens(v);
  cursor = tokens.length;
  closePanels();
  updateDisplay(true);
  setMood('happy', 1800);
  say(t('say.shop.usado'), 2200);
}

// Conversión única: convierte el MONTO propio del conversor de "desde" a "hacia"
function renderConv() {
  const p = parseFloat(shopConvAmount.value);
  const rateF = rateOf(shopFromSel.value);
  const rateT = rateOf(shopToSel.value);
  const toCur = CURRENCIES.find(x => x.code === shopToSel.value);
  const nice = n => Math.round(n * 100) / 100;
  if (!isFinite(p) || !isFinite(rateF) || rateF <= 0 || !isFinite(rateT) || rateT <= 0) {
    shopConvRes.textContent = '—';
    shopConvRes.dataset.v = '';
    return;
  }
  const amt = nice(p * rateT / rateF);
  shopConvRes.textContent = (toCur ? toCur.sym + ' ' : '') + formatNumber(amt);
  shopConvRes.dataset.v = String(amt);
}

// Campo de tasa SOLO para la(s) divisa(s) en uso (relativa al dólar, "1 $ = X").
// Se edita a mano porque la app no toca internet. El dólar es la base, no se muestra.
function renderRateFields() {
  shopRateFields.innerHTML = '';
  const codes = [];
  for (const code of [shopFromSel.value, shopToSel.value]) {
    if (code !== 'USD' && codes.indexOf(code) === -1) codes.push(code);
  }
  for (const code of codes) {
    const c = CURRENCIES.find(x => x.code === code);
    if (!c) continue;
    const row = document.createElement('div');
    row.className = 'shop-rate-row';
    const label = document.createElement('span');
    label.className = 'shop-rate-label';
    label.textContent = t('shop.tasa.etiqueta');
    const inp = document.createElement('input');
    inp.className = 'shop-pct wide';
    inp.type = 'number';
    inp.step = 'any';
    inp.inputMode = 'decimal';
    inp.value = String(c.rate);
    inp.setAttribute('aria-label', t('shop.tasa.aria', { n: t('m.' + c.code) }));

    // Cuándo se actualizó, debajo del campo
    const edad = document.createElement('div');
    edad.className = 'shop-rate-edad';
    const pintarEdad = () => {
      const a = antiguedadTasa(c.code);
      edad.textContent = a.texto;
      edad.classList.toggle('vieja', a.vieja);
    };
    pintarEdad();

    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      if (!isFinite(v) || v <= 0) return;
      c.rate = v;
      fechasTasas[c.code] = Date.now();   // tocarla es actualizarla
      saveRates();
      pintarEdad();
      renderConv();
    });

    const codeSpan = document.createElement('span');
    codeSpan.className = 'shop-rate-code';
    codeSpan.textContent = c.flag + ' ' + c.code;
    row.appendChild(label);
    row.appendChild(inp);
    row.appendChild(codeSpan);
    shopRateFields.appendChild(row);
    shopRateFields.appendChild(edad);
  }
}
renderRateFields();

// Los porcentajes, personas y tasa quedan guardados entre sesiones
const shopGuardado = store.json('catculator-shop', {});
for (const k of Object.keys(shopIn)) {
  if (shopGuardado[k] !== undefined) shopIn[k].value = shopGuardado[k];
}

function shopCompute() {
  const ajustes = {};
  for (const k of Object.keys(shopIn)) ajustes[k] = shopIn[k].value;
  store.set('catculator-shop', JSON.stringify(ajustes));

  const p = parseFloat(shopPrice.value);
  const val = k => parseFloat(shopIn[k].value);
  const nice = n => Math.round(n * 100) / 100; // plata: 2 decimales
  const set = (el, txt, v) => {
    if (txt === null) { el.textContent = '—'; el.dataset.v = ''; }
    else { el.textContent = txt; el.dataset.v = String(nice(v)); }
  };
  if (!isFinite(p)) {
    for (const el of Object.values(shopOut)) set(el, null);
    return;
  }
  const d = val('desc');
  if (isFinite(d)) {
    const pagas = nice(p * (1 - d / 100));
    set(shopOut.desc, formatNumber(pagas) + '  (−' + formatNumber(nice(p - pagas)) + ')', pagas);
  } else set(shopOut.desc, null);

  const iva = val('iva');
  if (isFinite(iva)) { const t = nice(p * (1 + iva / 100)); set(shopOut.iva, formatNumber(t), t); }
  else set(shopOut.iva, null);

  // Desglose: el precio ya trae el IVA incluido; saca cuánto costaba antes (base)
  // y de paso cuánto de ese precio es impuesto.
  if (isFinite(iva) && (1 + iva / 100) > 0) {
    const base = nice(p / (1 + iva / 100));
    set(shopOut.noiva, formatNumber(base) + '  (' + t('shop.ivaparte', { n: formatNumber(nice(p - base)) }) + ')', base);
  } else set(shopOut.noiva, null);

  const tip = val('tip');
  if (isFinite(tip)) { const t = nice(p * (1 + tip / 100)); set(shopOut.tip, formatNumber(t), t); }
  else set(shopOut.tip, null);

  const n = val('split');
  if (isFinite(n) && n >= 1) { const c = nice(p / Math.round(n)); set(shopOut.split, t('shop.cu', { n: formatNumber(c) }), c); }
  else set(shopOut.split, null);
}

shopPrice.addEventListener('input', shopCompute);
for (const el of Object.values(shopIn)) el.addEventListener('input', shopCompute);

for (const el of Object.values(shopOut)) {
  el.addEventListener('click', () => useShopValue(parseFloat(el.dataset.v)));
}

btnShop.addEventListener('click', (e) => {
  e.stopPropagation();
  playClick();
  wakeUp();
  const opening = shopPanel.classList.contains('hidden');
  closePanels(shopPanel);
  shopPanel.classList.toggle('hidden');
  btnShop.classList.toggle('active', opening);
  if (opening) {
    const v = currentValue();
    if (isFinite(v) && v > 0 && Math.abs(v) < 1e12) {
      shopPrice.value = String(roundNice(v));
      shopConvAmount.value = String(roundNice(v));
    }
    shopCompute();
    renderConv();
    say(t('say.shop.abrir'), 2400);
  }
});

shopCompute();
renderConv();

// ---------- Bloc de notas ----------
const notesPanel = document.getElementById('notes-panel');
const btnNotes = document.getElementById('btn-notes');
const notesText = document.getElementById('notes-text');

notesText.value = store.get('catculator-notes') || '';

notesText.addEventListener('input', () => {
  store.set('catculator-notes', notesText.value);
});

btnNotes.addEventListener('click', (e) => {
  e.stopPropagation();
  playClick();
  wakeUp();
  const opening = notesPanel.classList.contains('hidden');
  closePanels(notesPanel);
  notesPanel.classList.toggle('hidden');
  btnNotes.classList.toggle('active', opening);
  if (opening) {
    say(t('say.notas.abrir'), 2400);
    notesText.focus();
  }
});

// Inserta el número en pantalla donde esté el cursor del bloc
document.getElementById('btn-notes-insert').addEventListener('click', () => {
  if (errorState) return;
  playClick();
  const num = textoANumeroPlano(elResult.textContent);
  const before = notesText.value.slice(0, notesText.selectionStart);
  const after = notesText.value.slice(notesText.selectionEnd);
  const sep = before && !/[\s\n]$/.test(before) ? ' ' : '';
  notesText.value = before + sep + num + after;
  const pos = (before + sep + num).length;
  notesText.setSelectionRange(pos, pos);
  notesText.focus();
  store.set('catculator-notes', notesText.value);
});

document.getElementById('btn-notes-clear').addEventListener('click', () => {
  playClick();
  notesText.value = '';
  store.del('catculator-notes');
  notesText.focus();
  say(t('say.notas.borrado'), 2000);
});

// ---------- Modo aprendiz: el gato pregunta ----------
function newQuiz() {
  // Sube de nivel cada 5 aciertos seguidos
  const lvl = Math.min(3, Math.floor(racha / 5));
  const R = n => Math.floor(Math.random() * n);
  const kind = randomFrom(['suma', 'resta', 'tabla', 'div']);
  let a, b, answer, text;
  if (kind === 'suma') {
    const m = 10 + lvl * 30;
    a = R(m) + 1; b = R(m) + 1;
    answer = a + b; text = a + ' + ' + b;
  } else if (kind === 'resta') {
    const m = 10 + lvl * 30;
    a = R(m) + 5; b = R(a) + 1;
    answer = a - b; text = a + ' − ' + b;
  } else if (kind === 'tabla') {
    a = R(9 + lvl) + 2; b = R(9) + 2;
    answer = a * b; text = a + ' × ' + b;
  } else {
    b = R(9) + 2; answer = R(9 + lvl) + 2;
    a = b * answer;
    text = a + ' ÷ ' + b;
  }
  quiz = { text, answer };
  updateDisplay();
}

function checkQuiz() {
  const raw = rawExpr();
  if (!raw) return;
  let v;
  try { v = evaluate(raw); }
  catch (e) {
    tokens = [];
    cursor = 0;
    updateDisplay();
    say(t('say.quiz.nonumero'), 2200);
    return;
  }
  tokens = [];
  cursor = 0;
  if (v === quiz.answer) {
    racha++;
    playPurr();
    spawnPawPrints();
    setMood('happy', 2000);
    let frase = t('say.quiz.bien') + ' 🔥' + racha;
    if (racha > mejorRacha) {
      mejorRacha = racha;
      store.set('catculator-racha', String(mejorRacha));
      if (racha >= 3) frase = t('say.quiz.nuevorecord', { n: racha });
    }
    say(frase, 2400);
    newQuiz();
  } else {
    playGrowl();
    setMood('angry', 2600);
    say(t('say.quiz.mal', { a: quiz.text, b: quiz.answer }), 3200);
    racha = 0;
    newQuiz();
  }
}

btnQuiz.addEventListener('click', () => {
  playClick();
  wakeUp();
  quizMode = !quizMode;
  btnQuiz.classList.toggle('active', quizMode);
  btnQuiz.setAttribute('aria-pressed', String(quizMode));
  closePanels();
  tokens = [];
  cursor = 0;
  errorState = false;
  justEvaluated = false;
  if (quizMode) {
    racha = 0;
    setMood('happy', 2200);
    say(t('say.quiz.inicio') + (mejorRacha ? t('say.quiz.record', { n: mejorRacha }) : ''), 3200);
    newQuiz();
  } else {
    quiz = null;
    say(t('say.quiz.fin'), 2400);
    updateDisplay();
  }
});

// ---------- Botón fracción ↔ decimal ----------
elFrac.addEventListener('click', () => {
  if (!ansFrac || !justEvaluated) return;
  playClick();
  wakeUp();
  fracMode = !fracMode;
  updateDisplay(true);
  if (fracMode) {
    setMood('happy', 2000);
    say(t('say.frac'), 2400);
  }
});

/* ---------- PWA ----------
   Ausente en Electron (file://) y en navegadores sin HTTPS: la app funciona
   igual sin él.

   El caché es "primero lo guardado", así que al publicar una versión nueva el
   usuario sigue viendo la vieja hasta que vuelva a entrar. En vez de dejarlo
   adivinando, el gato se lo dice. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const entrante = reg.installing;
        if (!entrante) return;
        entrante.addEventListener('statechange', () => {
          // Sin controller es la primera visita: no hay nada viejo que avisar.
          if (entrante.state === 'installed' && navigator.serviceWorker.controller) {
            setMood('surprised', 3000);
            say(t('say.nueva'), 6000);
          }
        });
      });
    }).catch(() => {});
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

/* La tecla decimal enseña el separador del país. Por dentro el token sigue
   siendo '.' siempre; esto es solo lo que se ve y lo que se lee en voz alta.
   El teclado físico ya acepta las dos.

   Va DESPUÉS de traducirDOM a propósito: esa tecla también tiene data-i18n-aria
   y si se tradujera después, pisaría el nombre correcto. */
function ponerTeclaDecimal() {
  const tecla = document.querySelector('.key[data-k="."]');
  if (!tecla) return;
  tecla.textContent = SEP.decimal;
  tecla.setAttribute('aria-label', t(SEP.decimal === ',' ? 'k.coma' : 'k.punto'));
}
ponerTeclaDecimal();

// ---------- Teclado físico ----------
function flashKey(selector) {
  const btn = document.querySelector(selector);
  if (!btn) return;
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 120);
}

document.addEventListener('keydown', (e) => {
  // Escribiendo en el bloc de notas o el conversor, las teclas son suyas
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  /* Los atajos del sistema no son teclas de calculadora: sin esto, Ctrl+C
     borraba la cuenta entera porque abajo la 'c' es "Clear". Se deja pasar
     Ctrl+Alt porque en los teclados latinoamericanos eso es AltGr y sí escribe
     caracteres de verdad. */
  if ((e.ctrlKey || e.metaKey) && !e.altKey) return;
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
  /* Mover el cursor por la cuenta. Con un resultado en pantalla no hay nada que
     recorrer, así que las flechas se quedan quietas. */
  else if (k === 'ArrowLeft')  { e.preventDefault(); if (!justEvaluated && moverCursor(-1)) playClick(); }
  else if (k === 'ArrowRight') { e.preventDefault(); if (!justEvaluated && moverCursor(1)) playClick(); }
  else if (k === 'Home') { e.preventDefault(); if (!justEvaluated) ponerCursor(0); }
  else if (k === 'End')  { e.preventDefault(); if (!justEvaluated) ponerCursor(tokens.length); }
  else if (k === 'Escape' || k.toLowerCase() === 'c') { playClick(); clearAll(); flashKey('[data-action="clear"]'); }
});

// ---------- Clic en el gato ----------
elCat.addEventListener('click', () => {
  wakeUp();
  setMood('happy', 2000);
  // A veces maúlla, a veces ronronea — con frase a juego
  if (Math.random() < 0.45) {
    playPurr();
    say(t('say.ronroneo'), 2400);
  } else {
    playMeow();
    say(t('say.miau'), 2400);
  }
});

/* ---------- Estados para lectores de pantalla ----------
   Los paneles se abren y se cierran desde muchos lados: su botón, un clic
   afuera, elegir un color, entrar al modo aprendiz, el botón atrás. En vez de
   perseguir cada camino (y olvidar uno) se vigila la clase .hidden del panel:
   el estado sale del mismo lugar del que sale lo que se ve. */
for (const [panel, btn] of panelPairs()) {
  const reflejar = () => btn.setAttribute('aria-expanded', String(!panel.classList.contains('hidden')));
  new MutationObserver(reflejar).observe(panel, { attributes: true, attributeFilter: ['class'] });
  reflejar();
}

/* ---------- Botón físico "atrás" de Android ----------
   Sin esto, "atrás" cerraba la app aunque hubiera un panel abierto. Ojo: apenas
   se registra el escuchador, Capacitor deja de salir por su cuenta, así que
   todos los caminos tienen que terminar en algo — incluido exitApp(). */
const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
if (capApp) {
  capApp.addListener('backButton', () => {
    const hayPanelAbierto = panelPairs().some(([panel]) => !panel.classList.contains('hidden'));
    if (hayPanelAbierto) { closePanels(); return; }
    if (quizMode) { btnQuiz.click(); return; }   // salir del modo aprendiz
    capApp.exitApp();
  });
}

/* ---------- Cambio de idioma en caliente ----------
   Sin recargar la página: se vuelve a traducir el HTML y se reconstruye todo lo
   que se generó desde JavaScript (los desplegables, los campos de tasas, las
   etiquetas calculadas). Recargar habría sido más corto, pero se llevaría por
   delante la cuenta que el humano tenga a medio escribir. */
function aplicarIdioma(nuevo) {
  if (IDIOMAS.indexOf(nuevo) === -1 || nuevo === IDIOMA) return;
  IDIOMA = nuevo;
  store.set('catculator-idioma', IDIOMA);

  // Los separadores de miles y decimales van con el idioma elegido
  SEP = derivarSeparadores(IDIOMA);

  traducirDOM();
  marcarIdiomaActivo();

  // Lo que no vive en el HTML hay que rehacerlo a mano
  llenarCategorias();
  convSetCategory(convCat.value);
  fillCurrencySelect(shopFromSel);
  fillCurrencySelect(shopToSel);
  renderRateFields();
  renderConv();
  shopCompute();
  applyMode(document.getElementById('app').classList.contains('sci-on') ? 'sci' : 'basic');
  ponerTeclaDecimal();
  renderHistory();
  refreshSoundBtn();
  updateDisplay();
}

/* El botón dice el idioma que se está usando ahora mismo, no al que se va a
   cambiar: es lo que espera quien lo mira sin pulsarlo. La etiqueta se saca
   de IDIOMAS y no de una lista aparte, para que al añadir un idioma no haya
   que acordarse de tocar esto. */
const btnLang = document.getElementById('btn-lang');
function marcarIdiomaActivo() {
  btnLang.textContent = IDIOMA.slice(0, 2).toUpperCase();
}

btnLang.addEventListener('click', () => {
  playClick();
  const i = IDIOMAS.indexOf(IDIOMA);
  aplicarIdioma(IDIOMAS[(i + 1) % IDIOMAS.length]);
  say(t('say.idioma'), 2400);
  setMood('happy', 2000);
});
marcarIdiomaActivo();

// ---------- Saludo inicial ----------
setTimeout(() => {
  say(t('say.saludo'), 3000);
  setMood('happy', 2200);
}, 600);

/* ---------- La cuenta a medias ----------
   Se guardaba ya todo lo demás —tema, felino, atuendo, idioma, historial,
   notas, lista de compras— menos lo único que de verdad duele perder: la
   operación a medio escribir. Sales a mirar un precio, vuelves, y la pantalla
   estaba en blanco.

   Se escribe en cada updateDisplay. Son cuatro campos y localStorage ya se
   tocaba en cada '=' para el historial, así que no cambia nada en la práctica. */
/* La clave va escrita a pelo en los dos sitios, como todas las demás de este
   archivo. Con una const aquí abajo reventaba: updateDisplay llama a
   guardarSesion mucho antes de que el hilo llegue a esta línea, y una const sin
   inicializar todavía no se puede ni leer. */
function guardarSesion() {
  if (quizMode) return;                      // el modo aprendiz es de usar y tirar
  store.set('catculator-sesion', JSON.stringify({
    tokens: tokens,
    cursor: cursor,
    ans: ans,
    expr: lastExprRaw,
    hecho: justEvaluated
  }));
}

/* Al volver, nada de lo guardado es de fiar: localStorage lo puede haber tocado
   cualquiera y una versión vieja pudo dejar otro formato. Se valida la lista
   entera contra el propio tokenizador y, si algo no cuadra, se arranca en
   blanco — que es exactamente lo que pasaba antes de existir esto. */
function restaurarSesion() {
  const s = store.json('catculator-sesion', null);
  if (!s || !Array.isArray(s.tokens)) return;
  const lista = s.tokens.filter(x => typeof x === 'string');
  if (lista.length !== s.tokens.length || lista.length > 400) return;
  try { if (lista.length) tokenize(lista.join('')); }
  catch (e) { return; }
  tokens = lista;
  cursor = (typeof s.cursor === 'number' && s.cursor >= 0 && s.cursor <= tokens.length)
    ? s.cursor : tokens.length;
  if (typeof s.ans === 'number' && isFinite(s.ans)) ans = s.ans;
  if (typeof s.expr === 'string') lastExprRaw = s.expr;
  /* El estado "ya evaluado" solo se restaura si hay expresión que enseñar
     encima; si no, saldría un resultado suelto sin su cuenta. */
  if (s.hecho === true && lastExprRaw) {
    justEvaluated = true;
    ansFrac = toFraction(ans);
  }
}
restaurarSesion();

updateDisplay();
