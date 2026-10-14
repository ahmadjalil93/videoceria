(() => {
  const $ = (id) => document.getElementById(id);
  const video = $('video'), empty = $('empty'), nowTitle = $('nowTitle');
  const playBtn = $('playBtn'), prevBtn = $('prevBtn'), nextBtn = $('nextBtn');
  const seek = $('seek'), curTime = $('curTime'), durTime = $('durTime');
  const volume = $('volume'), muteBtn = $('muteBtn'), loopBtn = $('loopBtn');
  const playlistEl = $('playlist'), fileInput = $('fileInput');
  const lockBtn = $('lockBtn'), unlockBtn = $('unlockBtn'), toastEl = $('toast');

  const VIDEO_EXT = /\.(mp4|mkv|webm|avi|mov|m4v)$/i;
  const HOLD_MS = 2000;

  let list = [];        // { name, url }
  let idx = -1;         // indeks video yang sedang aktif
  let loopAll = true;   // ulangi playlist dari awal setelah video terakhir
  let seeking = false;
  let errorStreak = 0;
  let locked = false;
  let toastTimer;

  /* ---------- Helper ---------- */
  const fmt = (s) => {
    if (!isFinite(s)) return '0:00';
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const ss = String(sec).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  };
  const fill = (el) => {
    const pct = ((el.value - el.min) / (el.max - el.min || 1)) * 100;
    el.style.setProperty('--p', pct + '%');
  };
  const toast = (msg, ms = 2500) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  };

  /* ---------- Playlist ---------- */
  function addFiles(files) {
    const all = Array.from(files || []);
    const ok = all.filter((f) => VIDEO_EXT.test(f.name) || f.type.startsWith('video/'));
    if (!ok.length) { if (all.length) toast('😕 Itu bukan file video'); return; }
    const startAt = list.length;
    ok.forEach((f) => list.push({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) }));
    if (ok.length < all.length) toast(`✅ ${ok.length} video ditambahkan (${all.length - ok.length} file dilewati)`);
    else toast(`✅ ${ok.length} video ditambahkan`);
    if (idx === -1) playIndex(startAt); else render();
  }

  function playIndex(i) {
    if (i < 0 || i >= list.length) return;
    idx = i;
    video.src = list[i].url;
    video.play().catch(() => {});
    render();
  }

  function next(auto = false) {
    if (!list.length) return;
    if (idx + 1 < list.length) return playIndex(idx + 1);
    if (loopAll) {
      if (list.length === 1) { video.currentTime = 0; video.play().catch(() => {}); return; }
      return playIndex(0);
    }
    if (auto) { video.pause(); toast('🎉 Semua video sudah selesai!'); }
  }

  function prev() {
    if (!list.length) return;
    if (video.currentTime > 3) { video.currentTime = 0; return; }
    playIndex(idx > 0 ? idx - 1 : list.length - 1);
  }

  function removeAt(i) {
    URL.revokeObjectURL(list[i].url);
    list.splice(i, 1);
    if (!list.length) return resetPlayer();
    if (i === idx) playIndex(Math.min(i, list.length - 1));
    else { if (i < idx) idx--; render(); }
  }

  function resetPlayer() {
    list.forEach((v) => URL.revokeObjectURL(v.url));
    list = []; idx = -1;
    video.pause();
    video.removeAttribute('src');
    video.load();
    seek.value = 0; fill(seek);
    curTime.textContent = durTime.textContent = '0:00';
    render();
  }

  function render() {
    playlistEl.textContent = '';
    list.forEach((v, i) => {
      const li = document.createElement('li');
      li.className = 'item' + (i === idx ? ' active' : '');
      li.dataset.i = i;

      const pick = document.createElement('button');
      pick.className = 'pick';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = i === idx ? '▶' : i + 1;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = v.name;
      pick.append(num, name);

      const del = document.createElement('button');
      del.className = 'del';
      del.title = 'Hapus dari daftar';
      del.textContent = '✕';

      li.append(pick, del);
      playlistEl.appendChild(li);
    });
    const has = idx >= 0;
    empty.classList.toggle('hidden', has);
    nowTitle.classList.toggle('hidden', !has);
    nowTitle.textContent = has ? '🎬 ' + list[idx].name : '';
    const active = playlistEl.querySelector('.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  playlistEl.addEventListener('click', (e) => {
    const li = e.target.closest('.item');
    if (!li) return;
    const i = Number(li.dataset.i);
    if (e.target.closest('.del')) removeAt(i); else playIndex(i);
  });

  /* ---------- Tombol tambah, hapus semua ---------- */
  const openPicker = () => fileInput.click();
  $('addBtn').addEventListener('click', openPicker);
  $('emptyAdd').addEventListener('click', openPicker);
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  $('clearBtn').addEventListener('click', () => { if (list.length) resetPlayer(); });

  /* ---------- Drag & drop ---------- */
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); if (!locked) { dragDepth++; document.body.classList.add('dragging'); } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dragging'); });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('dragging');
    if (!locked) addFiles(e.dataTransfer.files);
  });

  /* ---------- Kontrol pemutar ---------- */
  const togglePlay = () => {
    if (idx === -1) return list.length ? playIndex(0) : openPicker();
    video.paused ? video.play().catch(() => {}) : video.pause();
  };
  playBtn.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', () => next(false));

  video.addEventListener('play', () => { playBtn.textContent = '⏸️'; });
  video.addEventListener('pause', () => { playBtn.textContent = '▶️'; });
  video.addEventListener('playing', () => { errorStreak = 0; });
  video.addEventListener('ended', () => next(true));

  video.addEventListener('loadedmetadata', () => {
    seek.max = video.duration || 0;
    durTime.textContent = fmt(video.duration);
  });
  video.addEventListener('timeupdate', () => {
    if (seeking) return;
    seek.value = video.currentTime;
    curTime.textContent = fmt(video.currentTime);
    fill(seek);
  });
  seek.addEventListener('input', () => { seeking = true; curTime.textContent = fmt(seek.value); fill(seek); });
  seek.addEventListener('change', () => { video.currentTime = Number(seek.value); seeking = false; });

  volume.addEventListener('input', () => { video.volume = Number(volume.value); video.muted = video.volume === 0; syncVolume(); });
  muteBtn.addEventListener('click', () => { video.muted = !video.muted; syncVolume(); });
  function syncVolume() {
    muteBtn.textContent = video.muted || video.volume === 0 ? '🔇' : video.volume < 0.5 ? '🔉' : '🔊';
    volume.value = video.muted ? 0 : video.volume;
    fill(volume);
  }
  video.volume = Number(volume.value);
  syncVolume();

  loopBtn.addEventListener('click', () => {
    loopAll = !loopAll;
    loopBtn.classList.toggle('on', loopAll);
    loopBtn.textContent = '🔁 Ulang Semua: ' + (loopAll ? 'Aktif' : 'Mati');
  });

  // Jika video gagal diputar (mis. codec tidak didukung), lewati ke video berikutnya
  video.addEventListener('error', () => {
    if (idx < 0 || !video.getAttribute('src')) return;
    errorStreak++;
    toast('😕 Video ini tidak bisa diputar (format/codec tidak didukung)', 3000);
    if (errorStreak < list.length) setTimeout(() => next(false), 1500);
    else toast('Tidak ada video yang bisa diputar. Coba ubah ke format MP4 (H.264).', 4000);
  });

  /* ---------- Child lock ---------- */
  function setLock(on) {
    locked = on;
    document.body.classList.toggle('locked', on);
    unlockBtn.classList.toggle('hidden', !on);
    document.body.classList.remove('dragging');
    if (document.activeElement) document.activeElement.blur();
    if (on) toast('🔒 Layar terkunci. Tahan tombol di pojok kanan atas 2 detik untuk membuka.', 4000);
    else toast('🔓 Kunci dibuka');
  }
  lockBtn.addEventListener('click', () => setLock(true));

  let holdTimer;
  const cancelHold = () => { clearTimeout(holdTimer); unlockBtn.classList.remove('holding'); };
  unlockBtn.addEventListener('pointerdown', () => {
    unlockBtn.classList.add('holding');
    holdTimer = setTimeout(() => { cancelHold(); setLock(false); }, HOLD_MS);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => unlockBtn.addEventListener(ev, cancelHold));

  /* ---------- Keyboard & lainnya ---------- */
  window.addEventListener('keydown', (e) => {
    // Cadangan untuk orang tua: Ctrl+Shift+L = kunci / buka kunci
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); setLock(!locked); return; }
    if (locked) { e.preventDefault(); return; }
    switch (e.key) {
      case ' ': e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); break;
      case 'ArrowLeft': video.currentTime = Math.max(0, video.currentTime - 5); break;
      case 'ArrowUp': e.preventDefault(); video.muted = false; video.volume = Math.min(1, video.volume + 0.1); syncVolume(); break;
      case 'ArrowDown': e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); syncVolume(); break;
      case 'n': case 'N': next(false); break;
      case 'p': case 'P': prev(); break;
    }
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  render();
})();
