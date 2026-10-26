const LEAD_ENDPOINT = 'https://lead-relay.leestygpt.workers.dev/lead/X4EAVX633J';

(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // burger
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  burger?.addEventListener('click', () => {
    const open = burger.classList.toggle('is-open');
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
  });
  nav?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    burger.classList.remove('is-open');
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }));

  // smooth anchors
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href.length <= 1) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  // ---------- form -> Cloudflare Worker -> Telegram ----------
  const form = document.getElementById('leadForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    const payload = {};
    new FormData(form).forEach((v, k) => { payload[k] = v; });
    if (payload._gotcha) return;
    if (!payload.name || !payload.contact) {
      btn.textContent = 'Укажите имя и способ связи';
      setTimeout(() => { btn.textContent = orig; }, 2600);
      return;
    }
    if (!payload.consent) {
      btn.textContent = 'Нужно согласие на обработку данных';
      setTimeout(() => { btn.textContent = orig; }, 2600);
      return;
    }
    delete payload.consent;
    btn.disabled = true;
    btn.textContent = 'Отправляем...';
    try {
      const resp = await fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      btn.textContent = 'Заявка отправлена';
      form.reset();
    } catch (err) {
      console.error(err);
      btn.textContent = 'Не удалось отправить, повторите';
    } finally {
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 3200);
    }
  });

  // ---------- reveal (once) for [data-reveal], slips and sheet ----------
  const revealIO = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }) : null;
  const revealables = document.querySelectorAll('[data-reveal], .slip, .sheet');
  document.querySelectorAll('.slip__rows').forEach((ul) => {
    [...ul.querySelectorAll('[data-reveal]')].forEach((li, i) => li.style.setProperty('--i', i));
  });
  revealables.forEach((el, i) => {
    if (el.matches('[data-reveal]') && !el.style.getPropertyValue('--i')) el.style.setProperty('--i', (i % 3));
    revealIO ? revealIO.observe(el) : el.classList.add('is-in');
  });

  // ---------- lines that rise on scroll ----------
  (() => {
    const els = [...document.querySelectorAll('[data-lines]')];
    if (!els.length || !revealIO || reduce) return;
    const restore = (el) => { el.textContent = el.dataset.text; el.classList.remove('is-split', 'is-in'); };
    const split = (el) => {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      el.dataset.text = text;
      el.textContent = '';
      const words = text.split(' ').map((word) => {
        const s = document.createElement('span');
        s.style.display = 'inline-block';
        s.textContent = word;
        el.append(s, ' ');
        return s;
      });
      const lines = [];
      for (const w of words) {
        const last = lines.at(-1);
        if (last && Math.abs(last.top - w.offsetTop) < 4) last.words.push(w.textContent);
        else lines.push({ top: w.offsetTop, words: [w.textContent] });
      }
      el.textContent = '';
      lines.forEach((line, i) => {
        const mask = document.createElement('span');
        const inner = document.createElement('span');
        mask.className = 'line';
        inner.style.setProperty('--i', i);
        inner.textContent = line.words.join(' ');
        mask.append(inner);
        el.append(mask, ' ');
      });
      el.classList.add('is-split');
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        e.target.classList.add('is-in');
        const last = e.target.querySelector('.line:last-of-type > span');
        last?.addEventListener('transitionend', () => restore(e.target), { once: true });
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    (document.fonts?.ready || Promise.resolve()).then(() => els.forEach((el) => { split(el); io.observe(el); }));
    let width = innerWidth;
    addEventListener('resize', () => {
      if (innerWidth === width) return;
      width = innerWidth;
      els.filter((el) => el.matches('.is-split:not(.is-in)')).forEach((el) => { io.unobserve(el); restore(el); split(el); io.observe(el); });
    });
  })();

  // ---------- ink fill ----------
  (() => {
    if (!CSS.supports('animation-timeline: view()') || reduce) return;
    document.querySelectorAll('[data-fill]').forEach((el) => {
      const words = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      words.forEach((word, i) => {
        const s = document.createElement('span');
        s.textContent = word;
        el.append(s, i < words.length - 1 ? ' ' : '');
      });
      el.classList.add('is-filling');
    });
  })();

  // ---------- zigzag edges of printed slips ----------
  const zig = () => {
    document.querySelectorAll('[data-zig]').forEach((el) => {
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return;
      const n = Math.max(8, Math.round(w / 16));
      const d = 8;
      const both = el.classList.contains('sheet');
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(`${(i * w / n).toFixed(1)}px ${both ? (i % 2 ? d : 0) : 0}px`);
      for (let i = n; i >= 0; i--) pts.push(`${(i * w / n).toFixed(1)}px ${h - (i % 2 ? 0 : d)}px`);
      el.style.clipPath = `polygon(${pts.join(',')})`;
    });
  };
  zig();
  addEventListener('load', zig);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(zig);
    document.querySelectorAll('[data-zig]').forEach((el) => ro.observe(el));
  }

  // ---------- first 48 hours: the live thing ----------
  (() => {
    const range = document.getElementById('scrub');
    const num = document.getElementById('scrubNum');
    const slip = document.getElementById('slipHours');
    if (!range || !num || !slip) return;
    const rows = [...slip.querySelectorAll('.slip__row')];
    const set = (v) => {
      num.textContent = v;
      range.value = v;
      rows.forEach((r) => r.classList.toggle('is-on', Number(r.dataset.h) <= v));
    };
    let touched = false;
    range.addEventListener('input', () => { touched = true; set(Number(range.value)); });
    range.addEventListener('pointerdown', () => { touched = true; });
    if (reduce || !('IntersectionObserver' in window)) { set(48); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const start = performance.now(), dur = 6200;
      set(0);
      const tick = (t) => {
        if (touched) return;
        const p = Math.min(1, (t - start) / dur);
        set(Math.round(48 * p));
        if (p < 1) requestAnimationFrame(tick);
      };
      setTimeout(() => requestAnimationFrame(tick), 700);
    }, { threshold: 0.35 });
    io.observe(slip);
  })();

  // ---------- held picture, passing captions ----------
  (() => {
    const root = document.querySelector('.steps');
    if (!root || !('IntersectionObserver' in window)) return;
    const items = [...root.querySelectorAll('.steps__item')];
    const pictures = [...root.querySelectorAll('.steps__pictures img')];
    const count = root.querySelector('.steps__count');
    const show = (i) => {
      items.forEach((el, k) => el.classList.toggle('is-active', k === i));
      pictures.forEach((el, k) => {
        el.classList.toggle('is-on', k === i);
        if (k === i) el.loading = 'eager';
      });
      if (count) count.textContent = `${['Москва', 'Великий Новгород', 'Санкт-Петербург'][i]}, ${i + 1} из ${items.length}`;
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) show(items.indexOf(e.target));
    }, { rootMargin: '-45% 0px -45% 0px' });
    items.forEach((el) => io.observe(el));
    show(0);
  })();
})();
