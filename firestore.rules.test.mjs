// Pruebas de `firestore.rules.proposed` contra el emulador oficial de Firestore.
//
//   npm i --no-save firebase-tools@13 @firebase/rules-unit-testing@3 firebase@10
//   echo '{"firestore":{"rules":"firestore.rules.proposed"},"emulators":{"firestore":{"port":8085},"ui":{"enabled":false}}}' > /tmp/fb.json
//   npx firebase emulators:exec --config /tmp/fb.json --project demo-budsin --only firestore "node firestore.rules.test.mjs"
//
// Cada prueba usa la misma forma de dato que escribe el sitio (app/src/lib/firebase.js, public/site.js,
// public/save-system.js, public/musica/index.html) y, además, los ataques que las reglas abiertas permiten hoy.
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, collection, increment, serverTimestamp, Timestamp } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-budsin', firestore: { rules: fs.readFileSync(new URL('./firestore.rules.proposed', import.meta.url), 'utf8') } });
const ADMIN = 'juvaldiviam@gmail.com';
const as = (uid, email, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const days = (n) => Timestamp.fromDate(new Date(Date.now() + n * 86400000));
let pass = 0, fail = 0;
async function t(name, expectation, fn) {
  try { await (expectation === 'ok' ? assertSucceeds(fn()) : assertFails(fn())); pass++; console.log('  ✅', name); }
  catch (e) { fail++; console.log('  ❌', name, '(se esperaba', expectation === 'ok' ? 'permitido' : 'DENEGADO', ')'); }
}
const seed = (fn) => env.withSecurityRulesDisabled(async (c) => fn(c.firestore()));
async function reset() {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'users/ana'), { email: 'ana@x.com', displayName: 'Ana', pro: false, createdAt: Timestamp.now() });
    await setDoc(doc(db, 'users/pro1'), { email: 'pro@x.com', displayName: 'Pro', pro: true, trialUsed: false, paidUntil: days(20), createdAt: Timestamp.now() });
    await setDoc(doc(db, 'users/old'), { email: 'old@x.com', displayName: 'Old', pro: true, trial: true, trialUsed: true, paidUntil: days(-2), createdAt: Timestamp.now() });
    await setDoc(doc(db, 'users/used'), { email: 'used@x.com', displayName: 'U', pro: false, trialUsed: true, createdAt: Timestamp.now() });
    await setDoc(doc(db, 'game_popularity/' + encodeURIComponent('/pacman.html')), { href: '/pacman.html', name: 'Pacman', hits: 10, updatedAt: Timestamp.now() });
    await setDoc(doc(db, 'game_requests/r1'), { gameName: 'X', gameUrl: 'u', description: '', uid: 'ana', email: 'ana@x.com', status: 'pending', createdAt: Timestamp.now() });
    await setDoc(doc(db, 'gamesaves/ana_pacman'), { userId: 'ana', gameName: 'pacman', data: '{}', updatedAt: Timestamp.now() });
    await setDoc(doc(db, 'music_profiles/ana/kv/likes'), { items: [], updatedAt: 1 });
    await setDoc(doc(db, 'game_leaderboards/pacman'), { gameName: 'Pacman', lastScore: 5, lastPlayer: 'A', updatedAt: Timestamp.now() });
  });
}

console.log('\n— users / Pro');
await reset();
await t('anónimo NO puede leer un usuario', 'fail', () => getDoc(doc(anon(), 'users/ana')));
await t('Ana lee su propio documento', 'ok', () => getDoc(doc(as('ana', 'ana@x.com'), 'users/ana')));
await t('Ana NO lee el de otra persona', 'fail', () => getDoc(doc(as('ana', 'ana@x.com'), 'users/pro1')));
await t('Ana NO puede listar todos los usuarios', 'fail', () => getDocs(collection(as('ana', 'ana@x.com'), 'users')));
await t('el admin lista todos los usuarios (panel)', 'ok', () => getDocs(collection(as('adm', ADMIN), 'users')));
await t('alta de Bea (ensureUserDoc: sin Pro)', 'ok', () => setDoc(doc(as('bea', 'bea@x.com'), 'users/bea'), { email: 'bea@x.com', displayName: 'Bea', pro: false, createdAt: serverTimestamp() }));
await t('ATAQUE: darse de alta ya con pro:true', 'fail', () => setDoc(doc(as('eve', 'eve@x.com'), 'users/eve'), { email: 'eve@x.com', displayName: 'Eve', pro: true, createdAt: serverTimestamp() }));
await t('ATAQUE: crear el documento de otra persona', 'fail', () => setDoc(doc(as('eve', 'eve@x.com'), 'users/ana2'), { email: 'eve@x.com', displayName: 'E', pro: false, createdAt: serverTimestamp() }));
await t('ATAQUE: alta con campos extra (isAdmin:true)', 'fail', () => setDoc(doc(as('eve', 'eve@x.com'), 'users/eve'), { email: 'eve@x.com', displayName: 'E', pro: false, isAdmin: true, createdAt: serverTimestamp() }));
await t('ATAQUE: ponerse Pro a pelo (pro:true sin prueba)', 'fail', () => updateDoc(doc(as('ana', 'ana@x.com'), 'users/ana'), { pro: true, paidUntil: days(3650) }));
await t('prueba gratuita de 7 días (activateTrial)', 'ok', () => updateDoc(doc(as('ana', 'ana@x.com'), 'users/ana'), { pro: true, trial: true, trialUsed: true, proSince: serverTimestamp(), paidUntil: days(7) }));
await reset();
await t('ATAQUE: prueba gratuita de 10 años', 'fail', () => updateDoc(doc(as('ana', 'ana@x.com'), 'users/ana'), { pro: true, trial: true, trialUsed: true, proSince: serverTimestamp(), paidUntil: days(3650) }));
await t('ATAQUE: repetir la prueba (trialUsed ya era true)', 'fail', () => updateDoc(doc(as('used', 'used@x.com'), 'users/used'), { pro: true, trial: true, trialUsed: true, proSince: serverTimestamp(), paidUntil: days(7) }));
await t('caducidad: el navegador quita el Pro vencido', 'ok', () => updateDoc(doc(as('old', 'old@x.com'), 'users/old'), { pro: false, trial: false, trialUsed: true, paidUntil: null }));
await t('ATAQUE: Ana edita a otra persona', 'fail', () => updateDoc(doc(as('ana', 'ana@x.com'), 'users/pro1'), { pro: false }));
await t('ATAQUE: borrar un usuario', 'fail', () => deleteDoc(doc(as('ana', 'ana@x.com'), 'users/ana')));
await t('admin: "Hacer Pro" a otra persona (setUserPro)', 'ok', () => updateDoc(doc(as('adm', ADMIN), 'users/ana'), { pro: true, trial: false, trialUsed: false, proSince: serverTimestamp(), paidUntil: days(35) }));
await t('admin: "Pagar este mes" (payMonth)', 'ok', () => updateDoc(doc(as('adm', ADMIN), 'users/pro1'), { pro: true, paidUntil: days(55) }));
await t('ATAQUE: correo de admin SIN verificar', 'fail', () => updateDoc(doc(as('fake', ADMIN, false), 'users/ana'), { pro: true, paidUntil: days(35) }));

console.log('\n— game_popularity (contador de clics)');
await reset();
const href = encodeURIComponent('/pacman.html');
const bump = (db, h, n = 1) => setDoc(doc(db, 'game_popularity/' + encodeURIComponent(h)), { href: h, name: 'Juego', hits: increment(n), updatedAt: serverTimestamp() }, { merge: true });
await t('anónimo lee el ranking', 'ok', () => getDocs(collection(anon(), 'game_popularity')));
await t('anónimo suma un clic (documento existente)', 'ok', () => bump(anon(), '/pacman.html'));
await t('anónimo suma un clic (juego nuevo)', 'ok', () => bump(anon(), '/nuevo.html'));
await t('ATAQUE: sumar 1000 clics de golpe', 'fail', () => bump(anon(), '/pacman.html', 1000));
await t('ATAQUE: restar clics', 'fail', () => bump(anon(), '/pacman.html', -5));
await t('ATAQUE: fijar hits a un número enorme', 'fail', () => setDoc(doc(anon(), 'game_popularity/' + href), { href: '/pacman.html', name: 'Pacman', hits: 999999, updatedAt: serverTimestamp() }, { merge: true }));
await t('ATAQUE: campo extra en el contador', 'fail', () => setDoc(doc(anon(), 'game_popularity/' + href), { href: '/pacman.html', name: 'P', hits: increment(1), updatedAt: serverTimestamp(), x: 1 }, { merge: true }));
await t('ATAQUE: borrar el contador', 'fail', () => deleteDoc(doc(anon(), 'game_popularity/' + href)));

console.log('\n— game_leaderboards (solo Pro envía)');
await reset();
const submit = async (db, score) => { const ref = doc(db, 'game_leaderboards/pacman'); await setDoc(ref, { gameName: 'Pacman', lastScore: score, lastPlayer: 'Pro', updatedAt: serverTimestamp() }, { merge: true }); await addDoc(collection(ref, 'scores'), { playerName: 'Pro', score: Number(score), timestamp: serverTimestamp() }); };
await t('cualquiera lee las tablas', 'ok', () => getDocs(collection(anon(), 'game_leaderboards/pacman/scores')));
await t('usuario Pro envía una puntuación', 'ok', () => submit(as('pro1', 'pro@x.com'), 1200));
await t('ATAQUE: usuario Free envía puntuación', 'fail', () => submit(as('ana', 'ana@x.com'), 1200));
await t('ATAQUE: anónimo envía puntuación', 'fail', () => submit(anon(), 1200));
await t('ATAQUE: puntuación con texto en vez de número', 'fail', () => addDoc(collection(as('pro1', 'pro@x.com'), 'game_leaderboards/pacman/scores'), { playerName: 'x', score: 'mucho', timestamp: serverTimestamp() }));
await t('ATAQUE: un Pro borra una puntuación', 'fail', async () => { const id = await seed(async (db) => (await addDoc(collection(db, 'game_leaderboards/pacman/scores'), { playerName: 'z', score: 1, timestamp: Timestamp.now() })).id); return deleteDoc(doc(as('pro1', 'pro@x.com'), 'game_leaderboards/pacman/scores/' + id)); });

console.log('\n— game_requests');
await reset();
const req = (uid, extra = {}) => ({ gameName: 'Juego X', gameUrl: 'https://x.com', description: 'porfa', uid, email: 'a@x.com', status: 'pending', createdAt: serverTimestamp(), ...extra });
await t('usuario envía una solicitud', 'ok', () => addDoc(collection(as('ana', 'ana@x.com'), 'game_requests'), req('ana')));
await t('solicitud anónima (como hace site.js)', 'ok', () => addDoc(collection(anon(), 'game_requests'), req('anonymous')));
await t('ATAQUE: solicitud ya "aprobada"', 'fail', () => addDoc(collection(as('ana', 'ana@x.com'), 'game_requests'), req('ana', { status: 'approved' })));
await t('ATAQUE: solicitud a nombre de otra persona', 'fail', () => addDoc(collection(as('eve', 'eve@x.com'), 'game_requests'), req('ana')));
await t('ATAQUE: un usuario lee las solicitudes ajenas', 'fail', () => getDocs(collection(as('ana', 'ana@x.com'), 'game_requests')));
await t('admin lista las solicitudes', 'ok', () => getDocs(collection(as('adm', ADMIN), 'game_requests')));
await t('admin cambia el estado (setRequestStatus)', 'ok', () => updateDoc(doc(as('adm', ADMIN), 'game_requests/r1'), { status: 'approved', reviewedAt: serverTimestamp() }));
await t('ATAQUE: un usuario aprueba su propia solicitud', 'fail', () => updateDoc(doc(as('ana', 'ana@x.com'), 'game_requests/r1'), { status: 'approved' }));

console.log('\n— gamesaves (guardado en la nube)');
await reset();
const save = (db, id) => setDoc(doc(db, 'gamesaves/' + id), { userId: id.split('_')[0], gameName: 'pacman', data: '{}', updatedAt: serverTimestamp() });
await t('Ana lee su guardado', 'ok', () => getDoc(doc(as('ana', 'ana@x.com'), 'gamesaves/ana_pacman')));
await t('Ana guarda otro juego', 'ok', () => save(as('ana', 'ana@x.com'), 'ana_tetris'));
await t('Ana guarda un fragmento (chunks)', 'ok', () => setDoc(doc(as('ana', 'ana@x.com'), 'gamesaves/ana_pacman/chunks/c0'), { i: 0, d: 'abc' }));
await t('Ana borra su guardado', 'ok', () => deleteDoc(doc(as('ana', 'ana@x.com'), 'gamesaves/ana_pacman')));
await reset();
await t('ATAQUE: leer el guardado de otra persona', 'fail', () => getDoc(doc(as('eve', 'eve@x.com'), 'gamesaves/ana_pacman')));
await t('ATAQUE: sobrescribir el guardado de otra persona', 'fail', () => save(as('eve', 'eve@x.com'), 'ana_pacman'));
await t('ATAQUE: fragmentos de otra persona', 'fail', () => setDoc(doc(as('eve', 'eve@x.com'), 'gamesaves/ana_pacman/chunks/c0'), { i: 0 }));
await t('ATAQUE: anónimo lee guardados', 'fail', () => getDoc(doc(anon(), 'gamesaves/ana_pacman')));
await t('ATAQUE: "ana" escribe en "anabel_pacman" (otro prefijo)', 'fail', () => save(as('ana', 'ana@x.com'), 'anabel_pacman'));
await t('ATAQUE: "anabel" escribe en "ana_pacman"', 'fail', () => save(as('anabel', 'anabel@x.com'), 'ana_pacman'));

console.log('\n— music_profiles (Budsin Music)');
await reset();
const ana = () => as('ana', 'ana@x.com');
await t('Ana sube sus ♥ (kv/likes)', 'ok', () => setDoc(doc(ana(), 'music_profiles/ana/kv/likes'), { items: [{ id: '1' }], updatedAt: 5 }));
await t('Ana crea una playlist', 'ok', () => setDoc(doc(ana(), 'music_profiles/ana/playlists/p1'), { name: 'Mi lista', tracks: [], updatedAt: 5 }));
await t('Ana lee sus playlists (cloudSync)', 'ok', () => getDocs(collection(ana(), 'music_profiles/ana/playlists')));
await t('Ana borra su playlist y sus datos (cloudWipe)', 'ok', () => deleteDoc(doc(ana(), 'music_profiles/ana/kv/likes')));
await t('ATAQUE: leer el perfil de música de otra persona', 'fail', () => getDoc(doc(as('eve', 'eve@x.com'), 'music_profiles/ana/kv/likes')));
await t('ATAQUE: escribir en el perfil de otra persona', 'fail', () => setDoc(doc(as('eve', 'eve@x.com'), 'music_profiles/ana/kv/likes'), { items: [], updatedAt: 9 }));
await t('ATAQUE: anónimo lee perfiles', 'fail', () => getDocs(collection(anon(), 'music_profiles/ana/playlists')));

console.log('\n— todo lo demás denegado');
await t('ATAQUE: escribir en una colección cualquiera', 'fail', () => setDoc(doc(as('ana', 'ana@x.com'), 'cualquier_cosa/x'), { a: 1 }));
await t('ATAQUE: leer una colección no listada', 'fail', () => getDocs(collection(as('adm', ADMIN), 'secretos')));

console.log(`\n${pass} correctas, ${fail} con fallo`);
await env.cleanup();
process.exit(fail ? 1 : 0);
