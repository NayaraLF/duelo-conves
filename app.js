'use strict';

/* ══════════════════════════════════════════════
   ESTADO GLOBAL
══════════════════════════════════════════════ */
const state = {
  mcs: [],
  structure: [],   // rounds: [ [ {type, participants[], winner} ] ]
  currentRound: 0,
};

/* Estado da Fase 1 */
const p1 = {
  numberedMCs: [],   // [{num, name}] – atribuição aleatória
  matchIdx:    0,    // índice da batalha atual em structure[0]
  drawn:       [],   // [{num, name}] sorteados para a batalha atual
  waitWinner:  false,
  done:        false,
  refOpen:     false,
};


/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
const $   = id  => document.getElementById(id);
const qs  = sel => document.querySelector(sel);
const qsa = sel => document.querySelectorAll(sel);

const STORAGE_KEY = 'battleapp_state';

function saveState() {
  try {
    const data = {
      state: { mcs: state.mcs, structure: state.structure, currentRound: state.currentRound },
      p1:    { numberedMCs: p1.numberedMCs, matchIdx: p1.matchIdx, drawn: p1.drawn,
               waitWinner: p1.waitWinner, done: p1.done, refOpen: p1.refOpen },
      activeScreen: document.querySelector('.screen.active')?.id || 'screen-input',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) { /* quota exceeded – silently ignore */ }
}

function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showToast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

function showScreen(id) {
  qsa('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}


/* ══════════════════════════════════════════════
   GERAÇÃO DO CHAVEAMENTO

   Regras:
   – Final sempre 1v1
   – N ímpar: 1 trio (3 batalham → 2 vencedores → desempate → 1 vencedor)
   – Trio resolve o ímpar internamente e avança 1 único vencedor
══════════════════════════════════════════════ */
function generateStructure(n) {
  const rounds = [];
  let cur = n;

  while (cur > 1) {
    const matches = [];

    if (cur % 2 === 0) {
      for (let i = 0; i < cur / 2; i++)
        matches.push({ type: 'duo', participants: [], winner: null });
      rounds.push(matches);
      cur = cur / 2;
    } else {
      // Ímpar: 1 trio (3→2→1 via desempate) + duos
      matches.push({ type: 'trio', participants: [], winner: null });
      for (let i = 0; i < (cur - 3) / 2; i++)
        matches.push({ type: 'duo', participants: [], winner: null });
      rounds.push(matches);
      cur = 1 + (cur - 3) / 2;  // = (cur - 1) / 2
    }
  }
  return rounds;
}

function getRequired(match) {
  if (match.type === 'trio') return 3;
  if (match.type === 'bye')  return 1;
  return 2;
}

function fillRound(matches, mcs) {
  let i = 0;
  for (const m of matches) {
    m.participants = [];
    m.winner = null;
    if (m.type === 'duo')  { m.participants.push(mcs[i++], mcs[i++]); }
    else if (m.type === 'trio') { m.participants.push(mcs[i++], mcs[i++], mcs[i++]); m.trioSelected = []; }
    else if (m.type === 'bye')  { m.participants.push(mcs[i++]); m.winner = m.participants[0]; }
  }
}

function getRoundWinners(roundIdx) {
  return state.structure[roundIdx].map(m => m.winner).filter(Boolean);
}

function isRoundComplete() {
  return state.structure[state.currentRound].every(m => m.winner !== null);
}


/* ══════════════════════════════════════════════
   TELA 1 — INPUT DE MCS
══════════════════════════════════════════════ */
function renderInputUI() {
  const list   = $('mc-list');
  const ctr    = $('mc-counter');
  const btnGen = $('btn-generate');
  const n      = state.mcs.length;

  ctr.textContent  = `${n} / 22 MCs adicionados`;
  btnGen.disabled  = n < 2;

  if (n === 0) {
    list.innerHTML = '<li class="list-empty">Adicione os MCs acima ☝️</li>';
    return;
  }
  list.innerHTML = state.mcs.map((name, i) => `
    <li class="mc-item" style="animation-delay:${Math.min(i,8)*0.04}s">
      <span class="mc-num">${i + 1}</span>
      <span class="mc-name-text">${escHtml(name)}</span>
      <button class="mc-del" data-idx="${i}" aria-label="Remover">✕</button>
    </li>`).join('');
}

function addMC() {
  const inp  = $('mc-input');
  const name = inp.value.trim();
  if (!name) return;
  if (state.mcs.length >= 22) { showToast('⚠️ Máximo de 22 MCs'); return; }
  if (state.mcs.some(m => m.toLowerCase() === name.toLowerCase())) {
    inp.classList.add('error');
    setTimeout(() => inp.classList.remove('error'), 500);
    showToast('⚠️ MC já cadastrado!');
    return;
  }
  state.mcs.push(name);
  inp.value = '';
  inp.focus();
  saveState();
  renderInputUI();
}

function removeMC(idx) {
  state.mcs.splice(idx, 1);
  saveState();
  renderInputUI();
}

function onGenerate() {
  if (state.mcs.length < 2) return;
  state.structure    = generateStructure(state.mcs.length);
  state.currentRound = 0;
  initPhase1();
  saveState();
  renderPhase1Screen();
  showScreen('screen-setup');
}


/* ══════════════════════════════════════════════
   TELA 2 — FASE 1: SORTEIO AO VIVO
══════════════════════════════════════════════ */
function initPhase1() {
  const shuffled  = shuffle([...state.mcs]);
  p1.numberedMCs  = shuffled.map((name, i) => ({ num: i + 1, name }));
  p1.matchIdx     = 0;
  p1.drawn        = [];
  p1.waitWinner   = false;
  p1.done         = false;
  p1.refOpen      = false;
}

function renderPhase1Screen() {
  // Referência
  renderRefGrid();
  // Painel fechado
  $('ref-panel').classList.remove('open');
  $('btn-toggle-ref').classList.remove('open');
  qs('.ref-arrow').textContent = '▾';

  // Status inicial
  refreshP1Status();

  // Grade de números
  refreshNumbersGrid();

  // Limpa cards anteriores
  $('p1-cards').innerHTML = '';

  // Botão próxima fase
  const btn = $('btn-to-phase2');
  btn.disabled    = true;
  btn.textContent = 'SORTEAR PRÓXIMA FASE  🎲';
}

/* ── Referência numerada ── */
function renderRefGrid() {
  // Mostra apenas os MCs disponíveis (não usados, não sorteados)
  const visible = p1.numberedMCs.filter(mc => mc.num > 0);
  $('ref-grid').innerHTML = visible.map(({ num, name }) => `
    <div class="ref-item">
      <span class="ref-num">${num}</span>
      <span class="ref-name">${escHtml(name)}</span>
    </div>`).join('');
}

function toggleRef() {
  p1.refOpen = !p1.refOpen;
  $('ref-panel').classList.toggle('open', p1.refOpen);
  $('btn-toggle-ref').classList.toggle('open', p1.refOpen);
  qs('.ref-arrow').textContent = p1.refOpen ? '▴' : '▾';
}

/* ── Status da batalha em andamento ── */
function refreshP1Status() {
  const label = $('p1-status-label');
  const slots = $('p1-slots');
  const undo  = $('btn-undo');
  const hint  = $('setup-hint');
  const total = state.structure[0].length;

  if (p1.done) {
    label.textContent = '✅ FASE 1 CONCLUÍDA';
    label.className   = 'p1-status-label done';
    slots.innerHTML   = '';
    undo.disabled     = true;
    hint.textContent  = 'Fase 1 concluída! Sorteie a próxima fase abaixo ↓';
    return;
  }

  const match = state.structure[0][p1.matchIdx];
  const req   = getRequired(match);

  if (p1.waitWinner) {
    const wMatch = state.structure[0][p1.matchIdx];
    if (wMatch.type === 'trio') {
      const n = (wMatch.trioSelected || []).length;
      if (n < 2) {
        label.textContent = `BATALHA ${p1.matchIdx + 1} · TRIO — ESCOLHA ${n}/2 VENCEDORES`;
        hint.textContent  = n === 0 ? 'Toque em 2 vencedores no card abaixo' : 'Toque no 2º vencedor no card abaixo';
      } else {
        label.textContent = `BATALHA ${p1.matchIdx + 1} · TRIO — DESEMPATE ↓`;
        hint.textContent  = 'Escolha o vencedor do desempate no card abaixo';
      }
    } else {
      label.textContent = `BATALHA ${p1.matchIdx + 1} DE ${total} — ESCOLHA O VENCEDOR ↓`;
      hint.textContent  = 'Toque no nome do vencedor no card abaixo';
    }
    label.className = 'p1-status-label active';
    slots.innerHTML = '';
    undo.disabled   = true;
    return;
  }

  const typeLabel = match.type === 'trio' ? 'TRIO' : match.type === 'bye' ? 'DIRETA' : '1v1';
  label.textContent = `BATALHA ${p1.matchIdx + 1} DE ${total} · ${typeLabel}`;
  label.className   = 'p1-status-label active';

  // Slots visuais
  let html = '';
  for (let i = 0; i < req; i++) {
    if (i > 0) html += '<span class="p1-arrow">→</span>';
    html += i < p1.drawn.length
      ? `<div class="p1-slot filled">${escHtml(p1.drawn[i].name)}</div>`
      : `<div class="p1-slot">?</div>`;
  }
  slots.innerHTML = html;
  undo.disabled   = p1.drawn.length === 0;

  const rem = req - p1.drawn.length;
  hint.textContent = rem === 1
    ? 'Toque em mais 1 número para completar a batalha'
    : `Toque em ${rem} números para formar a batalha`;
}

/* ── Grade de números ── */
function getUsedNames() {
  const used = new Set();
  state.structure[0].forEach((m, idx) => {
    if (idx < p1.matchIdx) {
      m.participants.forEach(name => used.add(name));
    }
  });
  return used;
}

/* Renumera os MCs disponíveis (não usados e não sorteados na batalha atual) de 1 em diante */
function renumberAvailable() {
  const usedNames = getUsedNames();
  const drawnNames = new Set(p1.drawn.map(d => d.name));
  let counter = 1;
  p1.numberedMCs = p1.numberedMCs.map(mc => {
    if (usedNames.has(mc.name) || drawnNames.has(mc.name)) {
      return { ...mc, num: -1 }; // marca como indisponível
    }
    return { ...mc, num: counter++ };
  });
}

function refreshNumbersGrid() {
  // Mostra apenas os MCs disponíveis (num > 0)
  const available = p1.numberedMCs.filter(mc => mc.num > 0);

  if (p1.waitWinner || p1.done) {
    $('numbers-grid').innerHTML = available.map(({ num }) =>
      `<button class="num-btn available wait" disabled data-num="${num}">${num}</button>`
    ).join('');
    return;
  }

  $('numbers-grid').innerHTML = available.map(({ num }) =>
    `<button class="num-btn available" data-num="${num}">${num}</button>`
  ).join('');
}

/* ── Sorteio de números ── */
function onNumberTap(num) {
  if (p1.waitWinner || p1.done) return;
  const mc = p1.numberedMCs.find(m => m.num === num);
  if (!mc || mc.num <= 0) return;

  p1.drawn.push({ num: mc.num, name: mc.name });

  // Renumera os restantes de 1 em diante
  renumberAvailable();
  saveState();

  const match = state.structure[0][p1.matchIdx];
  if (p1.drawn.length >= getRequired(match)) {
    buildBattle();
  } else {
    renderRefGrid();
    refreshP1Status();
    refreshNumbersGrid();
  }
}

function undoLastDraw() {
  if (p1.drawn.length === 0 || p1.waitWinner || p1.done) return;
  p1.drawn.pop();

  // Renumera de novo incluindo o MC devolvido
  renumberAvailable();
  saveState();

  renderRefGrid();
  refreshP1Status();
  refreshNumbersGrid();
}

/* ── Batalha formada ── */
function buildBattle() {
  const match = state.structure[0][p1.matchIdx];
  match.participants = p1.drawn.map(d => d.name);

  if (match.type === 'bye') {
    match.winner = match.participants[0];
    saveState();
    appendByeCard(p1.matchIdx);
    advanceP1();
  } else {
    match.winner  = null;
    if (match.type === 'trio') match.trioSelected = [];
    p1.waitWinner = true;
    saveState();
    appendBattleCard(p1.matchIdx);   // card ativo
    refreshP1Status();
    refreshNumbersGrid();
    scrollToCard(p1.matchIdx);
  }
}

/* ── Interação unificada para duo e trio ── */
function handleMatchInteraction(match, name, role) {
  if (match.type === 'trio') {
    if (role === 'trio-select') {
      const sel = match.trioSelected;
      const idx = sel.indexOf(name);
      if (idx >= 0) {
        sel.splice(idx, 1);
        match.winner = null; // desfaz o desempate se havia
      } else if (sel.length < 2) {
        sel.push(name);
      }
    } else if (role === 'trio-sub' && match.trioSelected.length === 2) {
      match.winner = match.winner === name ? null : name;
    }
  } else {
    match.winner = match.winner === name ? null : name;
  }
}

/* ── HTML compartilhado para participantes do card ── */
function buildParticipantsHTML(match, matchIdx, attrKey) {
  const isTrio = match.type === 'trio';
  const isDone = match.winner !== null;
  const sel    = match.trioSelected || [];

  if (!isTrio) {
    return match.participants.map((name, i) => {
      const isW = match.winner === name;
      const isL = isDone && !isW;
      let cls = 'battle-participant';
      if (isW) cls += ' winner';
      if (isL) cls += ' loser';
      const vs = i > 0
        ? `<div class="battle-vs"><div class="battle-vs-bar"></div><span class="battle-vs-text">VS</span><div class="battle-vs-bar"></div></div>`
        : '';
      return `${vs}
        <div class="${cls}" data-${attrKey}="${matchIdx}" data-name="${escHtml(name)}" data-role="winner">
          <span class="p-name">${escHtml(name)}</span><span class="p-check">✓</span>
        </div>`;
    }).join('');
  }

  /* ─ Trio: seção superior (3 MCs) ─ */
  const twoSel = sel.length === 2;
  const top = match.participants.map((name, i) => {
    const isAdv = sel.includes(name);
    const isOut = twoSel && !isAdv;
    let cls = 'battle-participant';
    if (isAdv) cls += ' trio-adv';
    if (isOut) cls += ' trio-out';
    const canTap = !isDone && (!twoSel || isAdv);
    const attrs  = canTap
      ? `data-${attrKey}="${matchIdx}" data-name="${escHtml(name)}" data-role="trio-select"`
      : '';
    const vs = i > 0
      ? `<div class="battle-vs"><div class="battle-vs-bar"></div><span class="battle-vs-text">•</span><div class="battle-vs-bar"></div></div>`
      : '';
    return `${vs}
      <div class="${cls}" ${attrs}>
        ${isAdv ? '<span class="trio-adv-badge">↑</span>' : ''}
        <span class="p-name">${escHtml(name)}</span>
      </div>`;
  }).join('');

  /* ─ Trio: seção de desempate (aparece quando 2 selecionados) ─ */
  let sub = '';
  if (sel.length === 2) {
    const subParts = sel.map((name, i) => {
      const isW = match.winner === name;
      const isL = match.winner !== null && !isW;
      let cls = 'battle-participant';
      if (isW) cls += ' winner';
      if (isL) cls += ' loser';
      const attrs = isDone
        ? ''
        : `data-${attrKey}="${matchIdx}" data-name="${escHtml(name)}" data-role="trio-sub"`;
      const vs = i > 0
        ? `<div class="battle-vs"><div class="battle-vs-bar"></div><span class="battle-vs-text">VS</span><div class="battle-vs-bar"></div></div>`
        : '';
      return `${vs}
        <div class="${cls}" ${attrs}>
          <span class="p-name">${escHtml(name)}</span><span class="p-check">✓</span>
        </div>`;
    }).join('');
    sub = `<div class="trio-sub-section">
      <div class="trio-sub-label">⚡ DESEMPATE — ESCOLHA O VENCEDOR</div>
      ${subParts}
    </div>`;
  }

  return top + sub;
}

function getCardLabel(match) {
  if (match.winner !== null)          return '· CONCLUÍDA ✅';
  if (match.type !== 'trio')          return '· ESCOLHA O VENCEDOR';
  const n = (match.trioSelected || []).length;
  if (n < 2)                          return `· ESCOLHA 2 VENCEDORES (${n}/2)`;
  return '· DESEMPATE';
}


/* ── Renderiza card de batalha (Fase 1) ── */
function appendBattleCard(matchIdx) {
  const match  = state.structure[0][matchIdx];
  const isTrio = match.type === 'trio';
  const isDone = match.winner !== null;

  let inner = buildParticipantsHTML(match, matchIdx, 'p1match');

  // Injeta pill de número em cada participante
  match.participants.forEach(name => {
    const mc = p1.numberedMCs.find(x => x.name === name);
    if (!mc) return;
    inner = inner.replace(
      `<span class="p-name">${escHtml(name)}</span>`,
      `<span class="card-num-pill">#${mc.num}</span><span class="p-name">${escHtml(name)}</span>`
    );
  });

  const cardCls = ['battle-card', isDone ? 'done' : 'active', isTrio ? 'trio' : ''].filter(Boolean).join(' ');

  $('p1-cards').insertAdjacentHTML('beforeend', `
    <div class="${cardCls}" id="p1card-${matchIdx}">
      <div class="battle-header">
        <span class="battle-num">BATALHA ${matchIdx + 1} ${getCardLabel(match)}</span>
        <span class="battle-badge ${isTrio ? 'is-trio' : ''}">${isTrio ? 'TRIO 🔱' : '1v1'}</span>
      </div>
      ${inner}
    </div>`);
}

function appendByeCard(matchIdx) {
  const match = state.structure[0][matchIdx];
  const mc    = p1.numberedMCs.find(x => x.name === match.participants[0]);
  $('p1-cards').insertAdjacentHTML('beforeend', `
    <div class="bye-pass-card" id="p1card-${matchIdx}">
      <span class="bye-icon">🏅</span>
      <div>
        <div class="bye-name">${mc ? `#${mc.num} — ` : ''}${escHtml(match.participants[0])}</div>
        <div class="bye-label">Avança direto para a próxima fase</div>
      </div>
    </div>`);
}

function refreshP1Card(matchIdx) {
  const old = $(`p1card-${matchIdx}`);
  if (old) old.remove();
  appendBattleCard(matchIdx);
}

function scrollToCard(matchIdx) {
  setTimeout(() => {
    $(`p1card-${matchIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 120);
}

/* ── Avança para próxima batalha ── */
function advanceP1() {
  p1.matchIdx++;
  p1.drawn      = [];
  p1.waitWinner = false;

  // Renumera os MCs restantes de 1 em diante
  renumberAvailable();
  saveState();

  if (p1.matchIdx >= state.structure[0].length) {
    // Fase 1 completa
    p1.done = true;
    saveState();
    renderRefGrid();
    refreshP1Status();
    refreshNumbersGrid();
    const btn = $('btn-to-phase2');
    btn.disabled    = false;
    btn.textContent = state.structure.length === 1
      ? '👑 REVELAR CAMPEÃO'
      : 'SORTEAR PRÓXIMA FASE  🎲';
    return;
  }

  renderRefGrid();
  refreshP1Status();
  refreshNumbersGrid();
}

/* ── Sortear próxima fase (ou revelar campeão) ── */
async function onToPhase2() {
  if (state.structure.length === 1) {
    // Só havia 1 round → Fase 1 era a final
    showChampion(state.structure[0][0].winner);
    return;
  }

  const winners = getRoundWinners(0);
  await drawAnimation(winners);

  state.currentRound = 1;
  fillRound(state.structure[1], winners);
  saveState();

  renderTournamentScreen();
  showScreen('screen-tournament');
}


/* ══════════════════════════════════════════════
   TELA 3 — TORNEIO (Fase 2+)
══════════════════════════════════════════════ */
function renderTournamentScreen() {
  const body        = $('tournament-body');
  const totalRounds = state.structure.length;
  const isLast      = state.currentRound === totalRounds - 1;

  // Label
  const label = $('round-label');
  if (isLast) {
    label.textContent = '🏆 FINAL';
    label.className   = 'round-label is-final';
  } else {
    label.textContent = `FASE ${state.currentRound + 1} DE ${totalRounds}`;
    label.className   = 'round-label';
  }

  $('round-hint').textContent = isLast
    ? 'Quem leva o título?'
    : 'Toque no vencedor de cada batalha';

  // Dots (todos os rounds, destaca atual)
  $('round-dots').innerHTML = Array.from({ length: totalRounds }, (_, i) => {
    const cls = i < state.currentRound ? 'done' : i === state.currentRound ? 'active' : '';
    return `<div class="dot ${cls}"></div>`;
  }).join('');

  // Batalhas
  body.innerHTML = state.structure[state.currentRound]
    .map((match, mIdx) => buildTournamentCard(match, mIdx))
    .join('');

  updateAdvanceBtn();
}

function buildTournamentCard(match, mIdx) {
  if (match.type === 'bye') {
    return `
      <div class="bye-pass-card">
        <span class="bye-icon">🏅</span>
        <div>
          <div class="bye-name">${escHtml(match.participants[0])}</div>
          <div class="bye-label">Avança direto para a próxima fase</div>
        </div>
      </div>`;
  }

  const isTrio = match.type === 'trio';
  const isDone = match.winner !== null;
  const inner  = buildParticipantsHTML(match, mIdx, 'match');
  const cardCls = ['battle-card', isDone ? 'done' : (isTrio ? 'trio' : ''), isTrio && !isDone ? 'trio' : '']
    .filter(Boolean).filter((v,i,a) => a.indexOf(v) === i).join(' ');

  return `
    <div class="${cardCls}" id="tcard-${mIdx}">
      <div class="battle-header">
        <span class="battle-num">BATALHA ${mIdx + 1} ${getCardLabel(match)}</span>
        <span class="battle-badge ${isTrio ? 'is-trio' : ''}">${isTrio ? 'TRIO 🔱' : '1v1'}</span>
      </div>
      ${inner}
    </div>`;
}

function onTournamentParticipantTap(el) {
  const mIdx  = parseInt(el.dataset.match);
  const name  = el.dataset.name;
  const role  = el.dataset.role;
  const match = state.structure[state.currentRound][mIdx];
  if (match.type === 'bye') return;

  handleMatchInteraction(match, name, role);
  saveState();

  // Re-renderiza só o card afetado
  const old = $(`tcard-${mIdx}`);
  if (old) {
    const tmp = document.createElement('div');
    tmp.innerHTML = buildTournamentCard(match, mIdx);
    old.replaceWith(tmp.firstElementChild);
  }
  updateAdvanceBtn();
}

function updateAdvanceBtn() {
  const btn    = $('btn-advance');
  const isLast = state.currentRound === state.structure.length - 1;
  btn.disabled    = !isRoundComplete();
  btn.textContent = isLast
    ? '👑 REVELAR CAMPEÃO'
    : 'SORTEAR PRÓXIMA FASE  🎲';
}

async function onAdvance() {
  if (!isRoundComplete()) return;

  const isLast = state.currentRound === state.structure.length - 1;

  if (isLast) {
    // Último round: campeão é o vencedor do único duelo final
    const champion = state.structure[state.currentRound][0].winner;
    if (champion) showChampion(champion);
    return;
  }

  const winners = getRoundWinners(state.currentRound);
  await drawAnimation(winners);

  state.currentRound++;
  fillRound(state.structure[state.currentRound], winners);
  saveState();
  renderTournamentScreen();
}


/* ══════════════════════════════════════════════
   SORTEIO — sem animação (transição instantânea)
══════════════════════════════════════════════ */
async function drawAnimation(_names) {
  // Animação removida para transição imediata
}


/* ══════════════════════════════════════════════
   TELA 4 — CAMPEÃO
══════════════════════════════════════════════ */
function showChampion(name) {
  $('champ-name').textContent = name;
  showScreen('screen-champion');
}


/* ══════════════════════════════════════════════
   REINICIAR
══════════════════════════════════════════════ */
function resetAll() {
  state.mcs          = [];
  state.structure    = [];
  state.currentRound = 0;
  p1.numberedMCs = []; p1.matchIdx = 0; p1.drawn = [];
  p1.waitWinner  = false; p1.done = false; p1.refOpen = false;
  clearSavedState();
  renderInputUI();
  showScreen('screen-input');
}


/* ══════════════════════════════════════════════
   GERAÇÃO DA IMAGEM DO CHAVEAMENTO
══════════════════════════════════════════════ */

function showBracketModal() {
  $('bracket-modal').classList.add('open');
  $('bracket-modal').setAttribute('aria-hidden', 'false');
  drawBracketCanvas();
}

function closeBracketModal() {
  $('bracket-modal').classList.remove('open');
  $('bracket-modal').setAttribute('aria-hidden', 'true');
}

function downloadBracket() {
  const canvas = $('bracket-canvas');
  const link   = document.createElement('a');
  link.download = 'chaveamento.png';
  link.href     = canvas.toDataURL('image/png');
  link.click();
}

function drawBracketCanvas() {
  const rounds = state.structure;
  const nR     = rounds.length;
  const canvas = $('bracket-canvas');
  const ctx    = canvas.getContext('2d');

  /* ── Layout ── */
  const BW = 190;   // largura da barra de nome
  const BH = 38;    // altura da barra
  const PG = 6;     // gap entre barras do mesmo duelo
  const MG = 24;    // gap entre duelos no mesmo round
  const RG = 80;    // gap horizontal entre rounds
  const PX = 44;    // padding lateral
  const PT = 108;   // padding topo (área do título)
  const PB = 44;    // padding inferior

  const matchH = m => m.participants.length * (BH + PG) - PG;

  /* ── Tamanho do canvas ── */
  const r0TotalH = rounds[0].reduce((h, m, i) => h + matchH(m) + (i ? MG : 0), 0);
  canvas.width  = PX * 2 + nR * BW + (nR - 1) * RG;
  canvas.height = PT + r0TotalH + PB;

  /* ── Fundo ── */
  ctx.fillStyle = '#07070a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* ── Triângulos decorativos ── */
  const tri = (pts, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.closePath(); ctx.fill();
  };
  const W = canvas.width, H = canvas.height;
  tri([[0,0],[180,0],[0,180]], 'rgba(180,0,20,0.12)');
  tri([[W,H],[W-180,H],[W,H-180]], 'rgba(180,0,20,0.10)');
  tri([[0,H],[80,H],[0,H-80]], 'rgba(180,0,20,0.06)');
  tri([[W,0],[W-80,0],[W,80]], 'rgba(180,0,20,0.06)');

  /* ── Linha horizontal de separação do título ── */
  ctx.strokeStyle = '#d4001f';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(PX, PT - 10);
  ctx.lineTo(W - PX, PT - 10);
  ctx.stroke();

  /* ── Título ── */
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = '#ff1f40';
  ctx.font         = '900 28px Impact, Arial Black, sans-serif';
  ctx.fillText('CHAVEAMENTO COMPLETO', W / 2, 36);

  /* ── Nome do campeão ── */
  const champ = rounds[nR - 1][0]?.winner;
  if (champ) {
    ctx.font      = '700 15px Arial, sans-serif';
    ctx.fillStyle = '#f5a623';
    ctx.fillText(`CAMPEAO: ${champ.toUpperCase()}`, W / 2, 68);
  }

  /* ── Posições verticais de cada duelo ── */
  // pos[r][m] = { t: topY, b: botY, c: centerY }
  const pos = [];

  // Round 0: distribuição uniforme
  const p0 = [];
  let cy = PT;
  rounds[0].forEach((m, i) => {
    if (i) cy += MG;
    const h = matchH(m);
    p0.push({ t: cy, b: cy + h, c: cy + h / 2 });
    cy += h;
  });
  pos.push(p0);

  // Rounds seguintes: centraliza entre os duelos fonte
  for (let r = 1; r < nR; r++) {
    const prev = pos[r - 1];
    const pr   = [];
    let si     = 0;

    rounds[r].forEach(m => {
      const srcN  = m.participants.length;  // 1, 2 ou 3
      const srcs  = prev.slice(si, si + srcN);
      si         += srcN;
      const top    = srcs[0]?.t ?? PT;
      const bot    = srcs[srcs.length - 1]?.b ?? top;
      const center = (top + bot) / 2;
      const h      = matchH(m);
      pr.push({ t: center - h / 2, b: center + h / 2, c: center });
    });
    pos.push(pr);
  }

  /* ── Linhas de conexão entre rounds ── */
  const rndRect = (cx, cy, cw, ch, r) => {
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.lineTo(cx + cw - r, cy);   ctx.arcTo(cx+cw, cy, cx+cw, cy+r, r);
    ctx.lineTo(cx + cw, cy+ch-r);  ctx.arcTo(cx+cw, cy+ch, cx+cw-r, cy+ch, r);
    ctx.lineTo(cx + r, cy + ch);   ctx.arcTo(cx, cy+ch, cx, cy+ch-r, r);
    ctx.lineTo(cx, cy + r);        ctx.arcTo(cx, cy, cx+r, cy, r);
    ctx.closePath();
  };

  for (let r = 0; r < nR - 1; r++) {
    const xR  = PX + r * (BW + RG) + BW;
    const xL  = PX + (r + 1) * (BW + RG);
    const midX = (xR + xL) / 2;

    rounds[r].forEach((m, mIdx) => {
      if (!m.winner) return;

      const destIdx = rounds[r + 1].findIndex(nm =>
        nm.participants.includes(m.winner)
      );
      if (destIdx === -1) return;

      const fromY = pos[r][mIdx]?.c ?? 0;
      const toY   = pos[r + 1][destIdx]?.c ?? 0;

      ctx.strokeStyle = 'rgba(160,0,0,0.55)';
      ctx.lineWidth   = 1.8;
      ctx.beginPath();
      ctx.moveTo(xR, fromY);
      ctx.bezierCurveTo(midX, fromY, midX, toY, xL, toY);
      ctx.stroke();
    });
  }

  /* ── Desenha os duelos ── */
  rounds.forEach((round, rIdx) => {
    const x     = PX + rIdx * (BW + RG);
    const isFin = rIdx === nR - 1;

    round.forEach((m, mIdx) => {
      const mp = pos[rIdx][mIdx];
      if (!mp) return;
      drawBars(ctx, m, x, mp.t, BW, BH, PG, isFin, rndRect);
    });

    /* Rótulo do round */
    const lx = x + BW / 2;
    const ly = (pos[rIdx][0]?.t ?? PT) - 14;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = '600 11px Arial, sans-serif';
    ctx.fillStyle    = '#50506a';
    ctx.fillText(
      isFin ? 'FINAL' : `FASE ${rIdx + 1}`,
      lx, Math.max(ly, PT - 22)
    );
  });
}

/* ── Renderiza as barras de um duelo ── */
function drawBars(ctx, match, x, topY, bw, bh, pg, isFinal, rndRect) {
  const isTrio = match.type === 'trio';
  const sel    = match.trioSelected || [];

  /* Barras dos participantes principais */
  match.participants.forEach((name, i) => {
    const y   = topY + i * (bh + pg);
    const isW = isTrio
      ? sel.includes(name)
      : match.winner === name;
    const isL = isTrio
      ? (sel.length === 2 && !sel.includes(name))
      : (match.winner !== null && !isW);

    /* Fill */
    ctx.fillStyle = isW
      ? (isTrio ? 'rgba(245,166,35,0.18)' : (isFinal ? '#a07000' : '#4a3000'))
      : isL ? '#0c0c12'
      : '#5e0010';
    rndRect(x, y, bw, bh, 4); ctx.fill();

    /* Border */
    ctx.strokeStyle = isW
      ? '#f5a623'
      : isL ? '#18181f' : '#8b001a';
    ctx.lineWidth = isW ? 2 : 1;
    rndRect(x, y, bw, bh, 4); ctx.stroke();

    /* Texto */
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle    = isW ? '#ffd060' : isL ? '#2a2a38' : '#f0f0ec';
    ctx.font         = `${isW ? '700' : '600'} 14px Arial, sans-serif`;

    let disp = name.toUpperCase();
    const maxW = bw - (isW ? 36 : 18);
    while (ctx.measureText(disp).width > maxW && disp.length > 2)
      disp = disp.slice(0, -1);
    if (disp.length < name.toUpperCase().length) disp += '...';

    if (isW && !isTrio) {
      ctx.fillStyle = isFinal ? '#f5a623' : '#c89000';
      ctx.font      = '700 12px Arial, sans-serif';
      ctx.fillText(isFinal ? '*' : '>', x + 8, y + bh / 2);
      ctx.fillStyle = '#ffd060';
      ctx.font      = '700 14px Arial, sans-serif';
      ctx.fillText(disp, x + 22, y + bh / 2);
    } else {
      ctx.fillText(disp, x + 10, y + bh / 2);
    }
  });

  /* Seção de desempate do trio */
  if (isTrio && sel.length === 2 && match.winner) {
    const subTopY = topY + match.participants.length * (bh + pg) + 8;

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.font         = '600 10px Arial, sans-serif';
    ctx.fillStyle    = '#f5a623';
    ctx.fillText('DESEMPATE', x, subTopY - 2);

    sel.forEach((name, i) => {
      const y   = subTopY + 10 + i * (bh + pg);
      const isW = match.winner === name;
      const isL = !isW;

      ctx.fillStyle = isW ? (isFinal ? '#a07000' : '#4a3000') : '#0c0c12';
      rndRect(x, y, bw, bh, 4); ctx.fill();

      ctx.strokeStyle = isW ? '#f5a623' : '#18181f';
      ctx.lineWidth   = isW ? 2 : 1;
      rndRect(x, y, bw, bh, 4); ctx.stroke();

      ctx.fillStyle    = isW ? '#ffd060' : '#2a2a38';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.font         = `${isW ? '700' : '600'} 14px Arial, sans-serif`;

      let disp = name.toUpperCase();
      const maxW = bw - (isW ? 36 : 18);
      while (ctx.measureText(disp).width > maxW && disp.length > 2)
        disp = disp.slice(0, -1);
      if (disp.length < name.toUpperCase().length) disp += '...';

      if (isW) {
        ctx.fillStyle = isFinal ? '#f5a623' : '#c89000';
        ctx.font      = '700 12px Arial, sans-serif';
        ctx.fillText(isFinal ? '*' : '>', x + 8, y + bh / 2);
        ctx.fillStyle = '#ffd060';
        ctx.font      = '700 14px Arial, sans-serif';
        ctx.fillText(disp, x + 22, y + bh / 2);
      } else {
        ctx.fillText(disp, x + 10, y + bh / 2);
      }
    });
  }
}


/* ══════════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════════ */
function setupEvents() {
  /* Tela 1 */
  $('mc-input').addEventListener('keydown', e => { if (e.key === 'Enter') addMC(); });
  $('btn-add').addEventListener('click', addMC);
  $('mc-list').addEventListener('click', e => {
    const btn = e.target.closest('.mc-del');
    if (btn) removeMC(parseInt(btn.dataset.idx));
  });
  $('btn-generate').addEventListener('click', onGenerate);

  /* Tela 2 — Fase 1 */
  $('btn-back').addEventListener('click', () => showScreen('screen-input'));
  $('btn-toggle-ref').addEventListener('click', toggleRef);
  $('btn-undo').addEventListener('click', undoLastDraw);

  $('numbers-grid').addEventListener('click', e => {
    const btn = e.target.closest('.num-btn');
    if (btn && !btn.disabled) onNumberTap(parseInt(btn.dataset.num));
  });

  $('p1-cards').addEventListener('click', e => {
    const el = e.target.closest('[data-p1match]');
    if (!el) return;
    const matchIdx = parseInt(el.dataset.p1match);
    if (matchIdx !== p1.matchIdx || !p1.waitWinner) return;
    const match = state.structure[0][matchIdx];
    if (match.type === 'bye') return;

    handleMatchInteraction(match, el.dataset.name, el.dataset.role);

    if (match.winner) {
      p1.waitWinner = false;
      saveState();
      refreshP1Card(matchIdx);
      advanceP1();
      return;
    }
    refreshP1Card(matchIdx);
    refreshP1Status();
    saveState();
  });

  $('btn-to-phase2').addEventListener('click', onToPhase2);

  /* Tela 3 — Torneio */
  $('tournament-body').addEventListener('click', e => {
    const p = e.target.closest('[data-match]');
    if (p) onTournamentParticipantTap(p);
  });
  $('btn-advance').addEventListener('click', onAdvance);

  /* Tela 4 + modal do chaveamento */
  $('btn-show-bracket').addEventListener('click', showBracketModal);
  $('btn-close-bracket').addEventListener('click', closeBracketModal);
  $('btn-dl-bracket').addEventListener('click', downloadBracket);
  $('bracket-modal').addEventListener('click', e => {
    if (e.target === $('bracket-modal')) closeBracketModal();
  });
  $('btn-new').addEventListener('click', resetAll);
}


/* ══════════════════════════════════════════════
   RESTAURAR ESTADO SALVO
══════════════════════════════════════════════ */
function restoreFromSaved(saved) {
  // Restaura state
  state.mcs          = saved.state.mcs;
  state.structure    = saved.state.structure;
  state.currentRound = saved.state.currentRound;

  // Restaura p1
  p1.numberedMCs = saved.p1.numberedMCs;
  p1.matchIdx    = saved.p1.matchIdx;
  p1.drawn       = saved.p1.drawn;
  p1.waitWinner  = saved.p1.waitWinner;
  p1.done        = saved.p1.done;
  p1.refOpen     = saved.p1.refOpen;

  const screen = saved.activeScreen;

  if (screen === 'screen-input') {
    renderInputUI();
    showScreen('screen-input');

  } else if (screen === 'screen-setup') {
    // Re-renderiza Fase 1 completamente
    renderRefGrid();
    $('ref-panel').classList.toggle('open', p1.refOpen);
    $('btn-toggle-ref').classList.toggle('open', p1.refOpen);
    qs('.ref-arrow').textContent = p1.refOpen ? '▴' : '▾';
    refreshP1Status();
    refreshNumbersGrid();

    // Re-cria os cards das batalhas já formadas
    $('p1-cards').innerHTML = '';
    for (let i = 0; i < p1.matchIdx; i++) {
      const m = state.structure[0][i];
      if (m.type === 'bye') {
        appendByeCard(i);
      } else {
        appendBattleCard(i);
      }
    }
    // Se estava esperando vencedor, mostra o card ativo
    if (p1.waitWinner && p1.matchIdx < state.structure[0].length) {
      appendBattleCard(p1.matchIdx);
    }

    // Atualiza botão de próxima fase
    const btn = $('btn-to-phase2');
    if (p1.done) {
      btn.disabled    = false;
      btn.textContent = state.structure.length === 1
        ? '👑 REVELAR CAMPEÃO'
        : 'SORTEAR PRÓXIMA FASE  🎲';
    } else {
      btn.disabled    = true;
      btn.textContent = 'SORTEAR PRÓXIMA FASE  🎲';
    }

    showScreen('screen-setup');

  } else if (screen === 'screen-tournament') {
    renderTournamentScreen();
    showScreen('screen-tournament');

  } else if (screen === 'screen-champion') {
    const lastRound = state.structure[state.structure.length - 1];
    const champ     = lastRound?.[0]?.winner;
    if (champ) {
      $('champ-name').textContent = champ;
      showScreen('screen-champion');
    } else {
      // Fallback: se algo deu errado, volta à tela inicial
      renderInputUI();
      showScreen('screen-input');
    }
  } else {
    renderInputUI();
    showScreen('screen-input');
  }
}


/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setupEvents();

  const saved = loadSavedState();
  if (saved && saved.state && saved.state.structure && saved.state.structure.length > 0) {
    restoreFromSaved(saved);
  } else {
    renderInputUI();
    showScreen('screen-input');
  }
});
