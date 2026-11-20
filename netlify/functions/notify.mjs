const OK = new Set(['visit', 'start', 'stage2', 'stage3', 'win', 'dm']);
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const clip = (s, n) => String(s || '').slice(0, n);

function device(ua) {
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'Mac'
    : /Linux/.test(ua) ? 'Linux' : 'Unknown';
  const m = ua.match(/Android[^;]*;\s*([^;)]+)/);
  const model = m ? m[1].trim() : '';
  const app = /Instagram/.test(ua) ? 'Instagram app'
    : /FBAN|FBAV/.test(ua) ? 'Facebook app'
    : /CriOS|Chrome/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari' : 'Browser';
  return os + (model ? ' (' + model + ')' : '') + ' · ' + app;
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
  const place = [g.city, g.country && g.country.name].filter(Boolean).join(', ') || 'unknown';
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
  lines.push('Device: ' + esc(device(clip(b.ua, 300))));
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
