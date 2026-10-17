// Finds out where file uploads break: straight at the backend, through the frontend
// server, or through the public address (Caddy). Run it inside the backend container so it
// reaches all three the way the app does:
//
//   docker compose -f docker-compose.prod.yml exec -T \
//     -e EMAIL=test@example.com -e PASSWORD='...' backend \
//     node --input-type=module - < scripts/check-upload.mjs
//
// Use a throw-away account. The script creates a route "upload-check", uploads a tiny GPX
// file to it and deletes the route again. Override the places to test with
// TARGETS="http://localhost:3000/api,https://velocal.cc/api". It uploads files of several sizes
// (SIZES, in bytes, default 2 KB, 300 KB, 3 MB), because limits in a proxy often show up only
// for bigger files.
const email = process.env.EMAIL;
const password = process.env.PASSWORD;
const targets = (
  process.env.TARGETS ??
  'http://localhost:3000/api,http://frontend:80/api,https://velocal.cc/api'
).split(',');

if (!email || !password) {
  console.error('Set EMAIL and PASSWORD (a throw-away account).');
  process.exit(2);
}

const sizes = (process.env.SIZES ?? '2000,300000,3000000').split(',').map(Number);

/** A valid GPX file of roughly `bytes` bytes. */
function makeGpx(bytes) {
  const head = '<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>\n';
  const tail = '</trkseg></trk></gpx>';
  let body = '';
  let i = 0;
  while (head.length + body.length + tail.length < bytes || i < 3) {
    body += `<trkpt lat="${(52.5 + i * 0.0001).toFixed(6)}" lon="${(13.4 + i * 0.0001).toFixed(6)}"><ele>${40 + (i % 20)}</ele></trkpt>\n`;
    i += 1;
  }
  return head + body + tail;
}

async function call(base, path, init = {}) {
  try {
    const res = await fetch(`${base}${path}`, init);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, text: text.slice(0, 200).replace(/\s+/g, ' '), json };
  } catch (err) {
    return { status: 0, text: `${err.cause?.code ?? err.cause?.message ?? err.message}` };
  }
}

for (const base of targets) {
  console.log(`\n== ${base}`);
  const login = await call(base, '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  console.log(`login          ${login.status}`);
  if (login.status !== 201 && login.status !== 200) {
    console.log(`  ${login.text}`);
    continue;
  }
  const token = login.json?.accessToken;
  const auth = { authorization: `Bearer ${token}` };

  const route = await call(base, '/routes', {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'upload-check' }),
  });
  console.log(`create route   ${route.status}`);
  if (route.status !== 201) {
    console.log(`  ${route.text}`);
    continue;
  }
  const id = route.json?.id;

  for (const size of sizes) {
    const gpx = makeGpx(size);
    const form = new FormData();
    form.append('file', new Blob([gpx], { type: 'application/gpx+xml' }), 'check.gpx');
    const upload = await call(base, `/routes/${id}/files`, {
      method: 'POST',
      headers: auth,
      body: form,
    });
    const label = `${Math.round(gpx.length / 1000)} KB`.padEnd(8);
    console.log(`upload ${label}  ${upload.status}  ${upload.status === 201 ? 'OK' : upload.text}`);
  }

  await call(base, `/routes/${id}`, { method: 'DELETE', headers: auth });
}
console.log('\nDone. Compare the "upload" lines of each target.');
