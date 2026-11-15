/* Tiny Explorers — Explore Outside (real-world scavenger hunts)
 * Photos are stored only on this device (IndexedDB). No accounts, no network.
 * Relies on speak(), chime() and burst() defined in index.html.
 */
(function () {
  'use strict';

  // ---------- HUNT DATA (add new hunts here) ----------
  const HUNTS = [
    {
      id: 'backyard', title: 'Backyard', emoji: '🌳', color: '#6BCB77', light: '#E3F7E6',
      items: [
        { id: 'leaf',   word: 'Leaf',   emoji: '🍃', find: 'a leaf' },
        { id: 'flower', word: 'Flower', emoji: '🌼', find: 'a flower' },
        { id: 'rock',   word: 'Rock',   emoji: '🪨', find: 'a rock' },
        { id: 'bug',    word: 'Bug',    emoji: '🐞', find: 'a bug' },
        { id: 'bird',   word: 'Bird',   emoji: '🐦', find: 'a bird' },
        { id: 'stick',  word: 'Stick',  emoji: '🪵', find: 'a stick' }
      ]
    },
    {
      id: 'walk', title: 'Neighborhood Walk', emoji: '🏘️', color: '#4A90E2', light: '#E2EEFB',
      items: [
        { id: 'redcar',  word: 'Red Car',   emoji: '🚗', find: 'a red car' },
        { id: 'dog',     word: 'Dog',       emoji: '🐕', find: 'a dog' },
        { id: 'stop',    word: 'Stop Sign', emoji: '🛑', find: 'a stop sign' },
        { id: 'tree',    word: 'Tree',      emoji: '🌳', find: 'a tree' },
        { id: 'bike',    word: 'Bike',      emoji: '🚲', find: 'a bike' },
        { id: 'mailbox', word: 'Mailbox',   emoji: '📮', find: 'a mailbox' }
      ]
    },
    {
      id: 'indoors', title: 'Rainy Day Indoors', emoji: '🏠', color: '#FF9F45', light: '#FFEBD8',
      items: [
        { id: 'round', word: 'Round',  emoji: '⚽', find: 'something round' },
        { id: 'blue',  word: 'Blue',   emoji: '🔵', find: 'something blue' },
        { id: 'soft',  word: 'Soft',   emoji: '🧸', find: 'something soft' },
        { id: 'spoon', word: 'Spoon',  emoji: '🥄', find: 'a spoon' },
        { id: 'book',  word: 'Book',   emoji: '📖', find: 'a book' },
        { id: 'shoes', word: 'Shoes',  emoji: '👟', find: 'your shoes' }
      ]
    }
  ];

  const PRAISE = ['Great exploring!', 'You are a super explorer!', 'Amazing job!', 'Wow, well done!'];

  // ---------- STORAGE (IndexedDB, falls back to memory) ----------
  const DB_NAME = 'tiny-explorers', STORE = 'finds';
  let dbPromise = null;
  let finds = new Map();      // key -> {key, huntId, itemId, blob, foundAt}
  const urls = new Map();     // key -> object URL

  const keyOf = (huntId, itemId) => huntId + ':' + itemId;

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(new Error('no indexedDB'));
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  function withStore(mode, fn) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  function loadFinds() {
    return withStore('readonly', s => s.getAll())
      .then(rows => { finds = new Map((rows || []).map(r => [r.key, r])); })
      .catch(() => {});
  }

  function forgetUrl(key) {
    if (urls.has(key)) { URL.revokeObjectURL(urls.get(key)); urls.delete(key); }
  }

  function urlFor(rec) {
    if (!urls.has(rec.key)) urls.set(rec.key, URL.createObjectURL(rec.blob));
    return urls.get(rec.key);
  }

  function saveFind(huntId, itemId, blob) {
    const rec = { key: keyOf(huntId, itemId), huntId, itemId, blob, foundAt: Date.now() };
    forgetUrl(rec.key);
    finds.set(rec.key, rec);
    return withStore('readwrite', s => s.put(rec)).catch(() => {});
  }

  function clearFinds() {
    finds.forEach((_, k) => forgetUrl(k));
    finds.clear();
    return withStore('readwrite', s => s.clear()).catch(() => {});
  }

  const foundCount = hunt => hunt.items.filter(i => finds.has(keyOf(hunt.id, i.id))).length;

  // ---------- IMAGE RESIZE ----------
  function resizeImage(file, max) {
    return new Promise((resolve) => {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * scale));
        c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(src);
        c.toBlob(b => resolve(b || file), 'image/jpeg', 0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(src); resolve(file); };
      img.src = src;
    });
  }

  // ---------- DOM HELPERS ----------
  const $ = id => document.getElementById(id);
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    });
    kids.flat().forEach(k => { if (k != null) el.append(k); });
    return el;
  }

  function go(to, back) {
    document.querySelectorAll('#app > .screen').forEach(s => {
      const hidden = s.classList.contains('hidden-left') || s.classList.contains('hidden-right');
      if (s === to) s.classList.remove('hidden-left', 'hidden-right');
      else if (!hidden) s.classList.add(back ? 'hidden-right' : 'hidden-left');
    });
  }

  function show(overlay) { overlay.hidden = false; }
  function hide(overlay) { overlay.hidden = true; }

  // ---------- ELEMENTS ----------
  const homeScreen = $('home-screen');
  const huntsScreen = $('hunts-screen');
  const huntScreen = $('hunt-screen');
  const stickersScreen = $('stickers-screen');
  const itemOverlay = $('item-overlay');
  const itemSheet = $('item-sheet');
  const gateOverlay = $('gate-overlay');
  const settingsOverlay = $('settings-overlay');
  const doneOverlay = $('done-overlay');
  const camera = $('camera-input');

  let currentHunt = null;
  let cur = null; // {hunt, item, state, pendingBlob, pendingUrl}

  // ---------- HUNT LIST ----------
  function renderHunts() {
    const list = $('hunt-list');
    list.innerHTML = '';
    HUNTS.forEach(hunt => {
      const n = foundCount(hunt), total = hunt.items.length, done = n === total;
      list.append(h('button', {
        class: 'hunt-card', style: `background:${hunt.color}`,
        onclick: () => openHunt(hunt)
      },
        h('span', { class: 'hunt-emoji' }, hunt.emoji),
        h('span', { class: 'hunt-info' },
          h('span', { class: 'hunt-name' }, hunt.title),
          h('span', { class: 'hunt-bar' }, h('span', { class: 'hunt-fill', style: `width:${(n / total) * 100}%` })),
          h('span', { class: 'hunt-count' }, done ? 'All found! 🏆' : `${n} / ${total} found`)
        )
      ));
    });
    const totalFound = finds.size;
    $('sticker-count').textContent = totalFound ? `(${totalFound})` : '';
  }

  // ---------- SINGLE HUNT ----------
  function openHunt(hunt) {
    currentHunt = hunt;
    renderHunt();
    go(huntScreen);
    speak(`${hunt.title}. What can you find?`);
  }

  function renderHunt() {
    const hunt = currentHunt;
    $('hunt-title').textContent = `${hunt.emoji} ${hunt.title}`;
    $('hunt-progress').textContent = `${foundCount(hunt)} / ${hunt.items.length}`;
    const grid = $('find-grid');
    grid.innerHTML = '';
    hunt.items.forEach(item => {
      const rec = finds.get(keyOf(hunt.id, item.id));
      const tile = h('button', {
        class: 'find-tile' + (rec ? ' found' : ''),
        style: rec ? `background-image:url("${urlFor(rec)}")` : `background:${hunt.light}`,
        'aria-label': rec ? `${item.word}, found` : `Find ${item.find}`,
        onclick: () => openItem(hunt, item)
      },
        rec ? h('span', { class: 'tile-badge' }, item.emoji) : h('span', { class: 'tile-emoji' }, item.emoji),
        h('span', { class: 'tile-word' }, item.word),
        rec ? h('span', { class: 'tile-star' }, '⭐') : null
      );
      grid.append(tile);
    });
  }

  // ---------- ITEM SHEET ----------
  function openItem(hunt, item) {
    cur = { hunt, item, state: 'ask', pendingBlob: null, pendingUrl: null };
    renderSheet();
    show(itemOverlay);
    const found = finds.has(keyOf(hunt.id, item.id));
    speak(found ? `You found ${item.find}!` : `Can you find ${item.find}?`);
  }

  function closeItem() {
    if (cur && cur.pendingUrl) URL.revokeObjectURL(cur.pendingUrl);
    cur = null;
    hide(itemOverlay);
  }

  function renderSheet() {
    const { hunt, item, state } = cur;
    const rec = finds.get(keyOf(hunt.id, item.id));
    itemSheet.innerHTML = '';
    itemSheet.style.setProperty('--hunt', hunt.color);
    if (state !== 'earned') {
      itemSheet.append(h('button', { class: 'sheet-close', 'aria-label': 'Close', onclick: closeItem }, '✕'));
    }

    if (state === 'ask') {
      itemSheet.append(
        rec ? h('img', { class: 'sheet-photo', src: urlFor(rec), alt: item.word })
            : h('div', { class: 'sheet-emoji', style: `background:${hunt.light}` }, item.emoji),
        h('div', { class: 'sheet-word' }, item.word),
        h('p', { class: 'sheet-text' }, rec ? `You found ${item.find}! ⭐` : `Can you find ${item.find}?`),
        h('button', { class: 'big-btn primary', onclick: () => camera.click() },
          rec ? '📷 Take a new photo' : '📷 I found it!'),
        h('button', { class: 'link-btn', onclick: () => speak(`Can you find ${item.find}?`) }, '🔊 Hear it again')
      );
    } else if (state === 'confirm') {
      itemSheet.append(
        h('img', { class: 'sheet-photo', src: cur.pendingUrl, alt: 'Your photo' }),
        h('div', { class: 'grownup-label' }, '👋 Grown-up check'),
        h('p', { class: 'sheet-text' }, `Is this ${item.find}?`),
        h('div', { class: 'btn-row' },
          h('button', { class: 'big-btn secondary', onclick: retry }, '↩️ Try again'),
          h('button', { class: 'big-btn primary', onclick: confirmFind }, '✅ Yes!')
        )
      );
    } else if (state === 'earned') {
      itemSheet.append(
        h('div', { class: 'sticker-pop' }, item.emoji),
        h('div', { class: 'sheet-word' }, 'Sticker earned!'),
        h('p', { class: 'sheet-text' }, `You found ${item.find}!`)
      );
    }
  }

  function retry() {
    if (cur.pendingUrl) URL.revokeObjectURL(cur.pendingUrl);
    cur.pendingBlob = cur.pendingUrl = null;
    cur.state = 'ask';
    renderSheet();
    camera.click();
  }

  camera.addEventListener('change', async () => {
    const file = camera.files && camera.files[0];
    camera.value = '';
    if (!file || !cur) return;
    const blob = await resizeImage(file, 600);
    if (!cur) return;
    if (cur.pendingUrl) URL.revokeObjectURL(cur.pendingUrl);
    cur.pendingBlob = blob;
    cur.pendingUrl = URL.createObjectURL(blob);
    cur.state = 'confirm';
    renderSheet();
  });

  async function confirmFind() {
    const { hunt, item, pendingBlob } = cur;
    const wasComplete = foundCount(hunt) === hunt.items.length;
    await saveFind(hunt.id, item.id, pendingBlob);
    if (cur.pendingUrl) URL.revokeObjectURL(cur.pendingUrl);
    cur.pendingUrl = null;
    cur.state = 'earned';
    renderSheet();
    chime();
    burst(itemSheet);
    speak(`You found ${item.find}! ${PRAISE[Math.floor(Math.random() * PRAISE.length)]}`);
    renderHunt();
    renderHunts();
    setTimeout(() => {
      closeItem();
      if (!wasComplete && foundCount(hunt) === hunt.items.length) celebrate(hunt);
    }, 1800);
  }

  // ---------- HUNT COMPLETE ----------
  function celebrate(hunt) {
    $('done-text').textContent = `You finished the ${hunt.title} hunt!`;
    show(doneOverlay);
    const sheet = doneOverlay.querySelector('.sheet');
    chime(); burst(sheet);
    setTimeout(() => burst(sheet), 400);
    speak(`Hooray! You finished the ${hunt.title} hunt! You are a super explorer!`);
  }

  // ---------- STICKER BOOK ----------
  function renderStickers() {
    const grid = $('sticker-grid');
    grid.innerHTML = '';
    const all = [];
    HUNTS.forEach(hunt => hunt.items.forEach(item => {
      const rec = finds.get(keyOf(hunt.id, item.id));
      if (rec) all.push({ hunt, item, rec });
    }));
    all.sort((a, b) => b.rec.foundAt - a.rec.foundAt);
    $('stickers-total').textContent = `${all.length} / ${HUNTS.reduce((n, x) => n + x.items.length, 0)}`;
    if (!all.length) {
      grid.append(h('div', { class: 'empty' },
        h('div', { class: 'empty-emoji' }, '🔍'),
        h('p', null, 'No stickers yet.'),
        h('p', null, 'Go on a hunt to find some!')));
      return;
    }
    all.forEach(({ hunt, item, rec }) => {
      grid.append(h('button', {
        class: 'sticker', style: `border-color:${hunt.color}`,
        onclick: (e) => { speak(item.word); burst(e.currentTarget); }
      },
        h('img', { src: urlFor(rec), alt: item.word }),
        h('span', { class: 'sticker-badge' }, item.emoji),
        h('span', { class: 'sticker-word' }, item.word)
      ));
    });
  }

  // ---------- PARENT GATE ----------
  function openGate() {
    const a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
    const answer = a + b;
    const choices = new Set([answer]);
    while (choices.size < 3) {
      const c = answer + (Math.floor(Math.random() * 7) - 3);
      if (c > 0) choices.add(c);
    }
    $('gate-question').textContent = `What is ${a} + ${b}?`;
    const row = $('gate-choices');
    row.innerHTML = '';
    [...choices].sort(() => Math.random() - 0.5).forEach(c => {
      row.append(h('button', {
        class: 'big-btn secondary gate-choice',
        onclick: () => {
          if (c === answer) { hide(gateOverlay); openSettings(); }
          else {
            const sheet = gateOverlay.querySelector('.sheet');
            sheet.classList.remove('shake'); void sheet.offsetWidth; sheet.classList.add('shake');
            openGate();
          }
        }
      }, String(c)));
    });
    show(gateOverlay);
  }

  function openSettings() {
    $('photo-count').textContent = `${finds.size} photo${finds.size === 1 ? '' : 's'} saved on this device.`;
    show(settingsOverlay);
  }

  // ---------- WIRING ----------
  $('explore-card').addEventListener('click', () => { renderHunts(); go(huntsScreen); speak("Let's explore!"); });
  $('hunts-back').addEventListener('click', () => go(homeScreen, true));
  $('hunt-back').addEventListener('click', () => { renderHunts(); go(huntsScreen, true); });
  $('stickers-btn').addEventListener('click', () => { renderStickers(); go(stickersScreen); });
  $('stickers-back').addEventListener('click', () => { renderHunts(); go(huntsScreen, true); });
  $('parent-btn').addEventListener('click', openGate);
  $('gate-close').addEventListener('click', () => hide(gateOverlay));
  $('settings-close').addEventListener('click', () => hide(settingsOverlay));
  $('delete-all').addEventListener('click', async () => {
    if (!confirm('Delete all explorer photos and stickers from this device?')) return;
    await clearFinds();
    hide(settingsOverlay);
    renderHunts();
  });
  $('done-ok').addEventListener('click', () => { hide(doneOverlay); renderHunts(); go(huntsScreen, true); });
  $('done-stickers').addEventListener('click', () => { hide(doneOverlay); renderStickers(); go(stickersScreen); });
  itemOverlay.addEventListener('click', e => { if (e.target === itemOverlay && cur && cur.state !== 'earned') closeItem(); });

  loadFinds().then(renderHunts);
})();
