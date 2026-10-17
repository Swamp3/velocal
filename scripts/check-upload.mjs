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
// TARGETS="http://localhost:3000/api,https://velocal.cc/api".
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

const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>
<trkpt lat="52.5" lon="13.4"><ele>40</ele></trkpt>
<trkpt lat="52.51" lon="13.41"><ele>45</ele></trkpt>
<trkpt lat="52.52" lon="13.42"><ele>50</ele></trkpt>
</trkseg></trk></gpx>`;

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

  const form = new FormData();
  form.append('file', new Blob([gpx], { type: 'application/gpx+xml' }), 'check.gpx');
  const upload = await call(base, `/routes/${id}/files`, {
    method: 'POST',
    headers: auth,
    body: form,
  });
  console.log(`upload gpx     ${upload.status}  ${upload.status === 201 ? 'OK' : upload.text}`);

  await call(base, `/routes/${id}`, { method: 'DELETE', headers: auth });
}
console.log('\nDone. Compare the "upload gpx" line of each target.');
