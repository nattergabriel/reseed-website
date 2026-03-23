import './style.css';

// --- Types ---

interface TermLine {
  type: 'cmd' | 'out' | 'blank';
  text?: string;
}

// --- Constants ---

const TYPING_SPEED = 45;
const TYPING_JITTER = 30;
const CMD_PAUSE = 500;
const OUT_PAUSE = 120;
const BLANK_PAUSE = 80;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TERMINAL_SCRIPT: TermLine[] = [
  { type: 'cmd', text: 'reseed init ~/skills' },
  { type: 'out', text: 'Initialized library at ~/skills' },
  { type: 'blank' },
  { type: 'cmd', text: 'reseed install acme/agent-toolkit' },
  { type: 'out', text: 'Fetched 3 skills from acme/agent-toolkit' },
  { type: 'out', text: '  code-review  testing  debugging' },
  { type: 'blank' },
  { type: 'cmd', text: 'reseed add code-review testing' },
  { type: 'out', text: 'Added 2 skills to .agents/skills/' },
  { type: 'blank' },
  { type: 'cmd', text: 'reseed sync' },
  { type: 'out', text: 'Synced 2 skills' },
];

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initTerminal();
  initCopyButton();
  initDotGrid();
  initNavScroll();
});

// --- Scroll Reveal ---

function initScrollReveal() {
  const els = document.querySelectorAll<HTMLElement>('.reveal');

  if (REDUCED_MOTION) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -32px 0px' },
  );

  els.forEach((el) => observer.observe(el));
}

// --- Terminal Animation ---

function initTerminal() {
  const body = document.getElementById('terminal');
  if (!body) return;

  const terminal = body.closest('.terminal');
  if (!terminal) return;

  if (REDUCED_MOTION) {
    renderTerminalStatic(body);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        runTerminal(body);
      }
    },
    { threshold: 0.25 },
  );

  observer.observe(terminal);
}

function renderTerminalStatic(container: HTMLElement) {
  for (const line of TERMINAL_SCRIPT) {
    if (line.type === 'blank') {
      container.appendChild(makeBlankLine());
    } else if (line.type === 'cmd') {
      const el = document.createElement('div');
      el.className = 'term-line';
      el.innerHTML = `<span class="term-prompt">$ </span><span class="term-text">${escapeHtml(line.text ?? '')}</span>`;
      container.appendChild(el);
    } else {
      const el = document.createElement('div');
      el.className = 'term-line term-output';
      el.textContent = line.text ?? '';
      container.appendChild(el);
    }
  }
  appendIdleCursor(container);
}

async function runTerminal(container: HTMLElement) {
  await wait(400);

  for (const line of TERMINAL_SCRIPT) {
    if (line.type === 'blank') {
      container.appendChild(makeBlankLine());
      await wait(BLANK_PAUSE);
    } else if (line.type === 'cmd') {
      await typeCommand(container, line.text ?? '');
      await wait(CMD_PAUSE);
    } else {
      appendOutput(container, line.text ?? '');
      await wait(OUT_PAUSE);
    }
    container.scrollTop = container.scrollHeight;
  }

  appendIdleCursor(container);
}

async function typeCommand(container: HTMLElement, text: string) {
  const line = document.createElement('div');
  line.className = 'term-line';

  const prompt = document.createElement('span');
  prompt.className = 'term-prompt';
  prompt.textContent = '$ ';

  const cmd = document.createElement('span');
  cmd.className = 'term-text';

  const cursor = document.createElement('span');
  cursor.className = 'term-cursor';

  line.append(prompt, cmd, cursor);
  container.appendChild(line);

  for (const char of text) {
    cmd.textContent += char;
    await wait(TYPING_SPEED + Math.random() * TYPING_JITTER);
  }

  cursor.remove();
}

function appendOutput(container: HTMLElement, text: string) {
  const line = document.createElement('div');
  line.className = 'term-line term-output';
  line.textContent = text;
  container.appendChild(line);
}

function makeBlankLine(): HTMLElement {
  const line = document.createElement('div');
  line.className = 'term-line term-blank';
  return line;
}

function appendIdleCursor(container: HTMLElement) {
  const line = document.createElement('div');
  line.className = 'term-line';

  const prompt = document.createElement('span');
  prompt.className = 'term-prompt';
  prompt.textContent = '$ ';

  const cursor = document.createElement('span');
  cursor.className = 'term-cursor';

  line.append(prompt, cursor);
  container.appendChild(line);
}

// --- Copy Button ---

function initCopyButton() {
  const btn = document.querySelector<HTMLButtonElement>('.copy-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy ?? '';
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 2000);
    } catch {
      // Clipboard API not available — fail silently
    }
  });
}

// --- Dot Grid ---

function initDotGrid() {
  const el = document.getElementById('dot-grid') as HTMLCanvasElement | null;
  if (!el || REDUCED_MOTION || window.matchMedia('(hover: none)').matches) return;

  const canvas = el;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const SPACING = 30;
  const DOT_SIZE = 1.2;
  const MOUSE_RADIUS = 120;
  const PUSH_FORCE = 24;
  const RETURN_SPEED = 0.06;
  const PUSH_SPEED = 0.15;
  const DOT_COLOR = 'rgba(28, 25, 23, 0.1)';

  const mouse = { x: -1000, y: -1000 };
  let dots: { ox: number; oy: number; x: number; y: number }[] = [];
  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    dots = [];
    const cols = Math.ceil(w / SPACING) + 1;
    const rows = Math.ceil(h / SPACING) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * SPACING;
        const y = r * SPACING;
        dots.push({ ox: x, oy: y, x, y });
      }
    }
  }

  function draw() {
    ctx!.clearRect(0, 0, w, h);
    ctx!.fillStyle = DOT_COLOR;

    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      const dx = dot.ox - mouse.x;
      const dy = dot.oy - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MOUSE_RADIUS) {
        const force = (1 - dist / MOUSE_RADIUS) * PUSH_FORCE;
        const angle = Math.atan2(dy, dx);
        dot.x += (dot.ox + Math.cos(angle) * force - dot.x) * PUSH_SPEED;
        dot.y += (dot.oy + Math.sin(angle) * force - dot.y) * PUSH_SPEED;
      } else {
        dot.x += (dot.ox - dot.x) * RETURN_SPEED;
        dot.y += (dot.oy - dot.y) * RETURN_SPEED;
      }

      ctx!.beginPath();
      ctx!.arc(dot.x, dot.y, DOT_SIZE, 0, Math.PI * 2);
      ctx!.fill();
    }

    requestAnimationFrame(draw);
  }

  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  window.addEventListener('resize', resize);

  resize();
  draw();
}

// --- Nav Scroll ---

function initNavScroll() {
  const nav = document.querySelector<HTMLElement>('.nav');
  if (!nav) return;

  window.addEventListener(
    'scroll',
    () => {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    },
    { passive: true },
  );
}

// --- Helpers ---

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
