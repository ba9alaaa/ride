const OK = new Set(['visit', 'start', 'stage2', 'stage3', 'win', 'dm']);
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const clip = (s, n) => String(s || '').slice(0, n);

function iphoneModel(scr, dpr) {
  const [w, h] = String(scr || '').split('x').map(Number).sort((a, b) => a - b);
  if (!w || !h) return '';
  const key = `${w}x${h}@${Math.round(dpr || 3)}`;
  const map = {
    '440x956@3': 'iPhone 16 Pro Max / 17 Pro Max',
    '402x874@3': 'iPhone 16 Pro / 17 Pro',
    '430x932@3': 'iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus',
    '393x852@3': 'iPhone 14 Pro / 15 / 15 Pro / 16',
    '428x926@3': 'iPhone 12 Pro Max / 13 Pro Max / 14 Plus',
    '390x844@3': 'iPhone 12 / 12 Pro / 13 / 13 Pro / 14',
    '375x812@3': 'iPhone X / XS / 11 Pro / 12 mini / 13 mini',
    '414x896@3': 'iPhone XS Max / 11 Pro Max',
    '414x896@2': 'iPhone XR / 11',
    '375x667@2': 'iPhone SE / 8 / 7'
  };
  return map[key] ? `${map[key]} (${w}x${h})` : `iPhone (${w}x${h})`;
}

function device(b) {
  const ua = clip(b.ua, 300);
  const app = /Instagram/.test(ua) ? 'Instagram app'
    : /FBAN|FBAV/.test(ua) ? 'Facebook app'
    : /Snapchat/.test(ua) ? 'Snapchat app'
    : /CriOS|Chrome/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari' : 'Browser';

  if (/iPhone|iPad|iPod/.test(ua)) {
    const ios = ua.match(/OS (\d+[_\d]*)/);
    const ver = ios ? ' · iOS ' + ios[1].replace(/_/g, '.') : '';
    const name = /iPad/.test(ua) ? 'iPad' : iphoneModel(b.scr, b.dpr);
    return `${name}${ver} · ${app}`;
  }

  if (/Android/.test(ua)) {
    const andVer = ua.match(/Android\s+([0-9.]+)/);
    const ver = andVer ? ' ' + andVer[1] : '';
    const uaMdl = ua.match(/Android[^;]*;\s*([^;)]+)/);
    const rawMdl = clip(b.mdl, 40) || (uaMdl && uaMdl[1] !== 'K' ? uaMdl[1].trim() : '');
    return `Android${ver}${rawMdl ? ' (' + rawMdl + ')' : ''} · ${app}`;
  }

  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'PC';
  return `${os} · ${app}`;
}

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('ok');
  const origin = req.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== new URL(req.url).host) return new Response('no', { status: 403 }); }
    catch (e) { return new Response('no', { status: 403 }); }
  }
  let b;
  try { b = await req.json(); } catch (e) { return new Response('bad', { status: 400 }); }
  if (!b || !OK.has(b.e)) return new Response('bad', { status: 400 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return new Response('not configured', { status: 500 });

  const g = (context && context.geo) || {};
  const place = [g.city, g.subdivision && g.subdivision.name, g.country && g.country.name].filter(Boolean).join(', ') || 'unknown';
  const titles = {
    visit: '👀 New visit', start: '🏁 Game started', stage2: '🚦 Reached stage 2',
    stage3: '🔐 Reached stage 3', win: '🏆 WON', dm: '📩 Tapped the DM button'
  };

  const lines = ['<b>' + titles[b.e] + '</b>'];
  if (b.name) {
    const u = clip(b.name, 30).replace(/[^A-Za-z0-9._]/g, '');
    lines.push(u && u === clip(b.name, 30)
      ? 'Instagram: <a href="https://instagram.com/' + u + '">@' + u + '</a>'
      : 'Name: <b>' + esc(clip(b.name, 24)) + '</b>');
  }
  if (b.e === 'win') {
    const code = clip(b.code, 16), ver = clip(b.ver, 6);
    const n = parseInt(code.slice(5), 10);
    const valid = /^RIDE-\d{4}$/.test(code) && (n * 37 + 11) % 1000 === Number(ver);
    lines.push('Code: <code>' + esc(code) + '</code> · Verify: <code>' + esc(ver) + '</code> ' + (valid ? '✅ valid' : '⚠️ does not match'));
  }
  lines.push('Device: ' + esc(device(b)));
  lines.push('Place: ' + esc(place));
  lines.push('Time: ' + new Date().toLocaleString('en-GB', { timeZone: 'Asia/Amman' }));

  await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: lines.join('\n'), parse_mode: 'HTML' })
  });
  return new Response('ok');
};

export const config = { path: '/api/notify' };
