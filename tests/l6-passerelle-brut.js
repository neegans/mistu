// Corps HTTP factices uniquement : la récupération garde des octets, jamais une reconstruction du texte décodé.
export async function runL6PasserelleBrutTests({ eq, ok }) {
  const { appelerAssistant, LIMITES_PASSERELLE } = await import('../src/domain/passerelle.js');
  const encoder = new TextEncoder();
  const config = { url: 'https://passerelle.example.invalid', anonKey: 'publique-factice' };
  const session = { access_token: 'session-factice' };
  const options = { config, session, captureReponse: true };
  const captures = [];
  const lancer = async (response, extra = {}) => {
    const r = await appelerAssistant('creation', {}, { ...options, fetch: async () => response, ...extra });
    if (extra.captureReponse !== false) captures.push(r);
    return r;
  };
  const octets = r => r.reponseBrute instanceof Uint8Array ? [...r.reponseBrute] : null;
  const texte = '{"content":[{"type":"text","text":"Huile végétale — 20 à 25 min"}]}';
  const bytes = encoder.encode(texte);

  {
    const r = await lancer(new Response(bytes));
    eq([r.statut, r.raison, r.corps?.content?.[0]?.text], [200, null, 'Huile végétale — 20 à 25 min'], 'L6 brut : le JSON valide conserve le résultat normal');
    eq(octets(r), [...bytes], 'L6 brut : les octets UTF-8 exacts accompagnent le succès');
    eq(Object.keys(r).sort(), ['corps', 'ecrite', 'quota', 'raison', 'reponseBrute', 'statut'], 'L6 brut : aucun en-tête ou contexte de session ne sort avec le corps');
  }
  for (const corps of ['texte avant ```', '{"content":', '', '[]', 'null']) {
    const raw = encoder.encode(corps), r = await lancer(new Response(raw));
    eq([r.raison, r.corps, octets(r)], ['reponse_illisible', null, [...raw]], 'L6 brut : corps complet illisible récupérable sans faux succès : ' + JSON.stringify(corps));
  }
  {
    const invalide = new Uint8Array([123, 34, 120, 34, 58, 34, 0xff, 34, 125]);
    const r = await lancer(new Response(invalide));
    eq(octets(r), [...invalide], 'L6 brut : UTF-8 invalide conservé sans caractère de remplacement dans la récupération');
    eq([r.raison, r.corps], ['reponse_illisible', null], 'L6 brut : UTF-8 invalide ne devient pas une proposition décodée fictive');
  }
  {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]);
    const r = await lancer(new Response(bom));
    eq([r.raison, octets(r)], [null, [...bom]], 'L6 brut : le BOM reste dans les octets même si le décodage JSON le retire');
  }
  {
    let i = 0;
    const stream = new ReadableStream({ pull(c) { if (i === bytes.length) c.close(); else c.enqueue(bytes.slice(i, ++i)); } });
    const r = await lancer(new Response(stream));
    eq([r.raison, octets(r)], [null, [...bytes]], 'L6 brut : les caractères multioctets coupés entre chunks restent exacts');
  }
  {
    let textes = 0, buffers = 0;
    const r = await lancer({ status: 200, body: null, arrayBuffer: async () => { buffers++; return bytes.slice().buffer; }, text: async () => { textes++; return 'autre texte'; } });
    eq([r.raison, octets(r), buffers, textes], [null, [...bytes], 1, 0], 'L6 brut : repli arrayBuffer exact, aucune reconstruction depuis text()');
    const seulBuffer = await lancer({ status: 200, arrayBuffer: async () => bytes.slice().buffer });
    eq([seulBuffer.raison, octets(seulBuffer)], [null, [...bytes]], 'L6 brut : une réponse avec arrayBuffer seul est lisible');
  }
  {
    const r = await lancer({ status: 200, text: async () => texte });
    eq([r.raison, r.reponseBrute], [null, null], 'L6 brut : ancien double text() lisible mais aucun faux corps HTTP reconstitué');
    const normal = await lancer(new Response(bytes), { captureReponse: false });
    eq([normal.raison, Object.hasOwn(normal, 'reponseBrute')], [null, false], 'L6 brut : sans capture, contrat historique inchangé');
  }
  for (const [status, raison] of [[400, 'requete'], [401, 'non_connecte'], [403, 'serveur'], [429, 'quota'], [502, 'serveur'], [204, 'serveur']]) {
    const r = await lancer(new Response(status === 204 ? null : 'CORPS-ERREUR-PRIVE', { status, headers: { 'x-prive': 'ENTETE-PRIVE' } }));
    eq([r.raison, r.corps, r.reponseBrute], [raison, null, null], 'L6 brut : aucun corps d’erreur exposé pour HTTP ' + status);
    ok(!JSON.stringify(r).includes('PRIVE'), 'L6 brut : en-tête et message serveur non relayés pour HTTP ' + status);
  }
  {
    const r = await lancer(new Response(bytes), { corpsMax: bytes.length });
    eq([r.raison, r.reponseBrute?.byteLength], [null, bytes.length], 'L6 brut : borne en octets exacte acceptée');
    const trop = await lancer(new Response(bytes), { corpsMax: bytes.length - 1 });
    eq([trop.raison, trop.reponseBrute], ['reponse_illisible', null], 'L6 brut : un octet de trop refuse le corps entier, sans préfixe');
  }
  {
    let appels = 0, annulations = 0, index = 0;
    const stream = new ReadableStream({ pull(c) { appels++; c.enqueue(bytes.slice(index, index += 10)); }, cancel() { annulations++; } });
    const r = await lancer(new Response(stream), { corpsMax: 20 });
    eq([r.raison, r.reponseBrute, annulations], ['reponse_illisible', null, 1], 'L6 brut : un flux dépassant la borne est annulé et n’est pas récupéré partiellement');
    ok(appels < 7, 'L6 brut : le corps trop grand n’est pas tiré jusqu’à la fin');
  }
  {
    const maximum = LIMITES_PASSERELLE.corps;
    const limite = await lancer(new Response(new Uint8Array(maximum)));
    eq([limite.raison, limite.reponseBrute?.byteLength], ['reponse_illisible', maximum], 'L6 brut : 2 Mio exacts restent récupérables même sans JSON');
    ok(limite.reponseBrute instanceof Uint8Array && limite.reponseBrute.every(x => x === 0), 'L6 brut : les octets nuls ne sont ni échappés ni perdus dans le transport');
    const large = await lancer(new Response(new Uint8Array(maximum + 1)), { corpsMax: maximum * 2 });
    eq([large.raison, large.reponseBrute], ['reponse_illisible', null], 'L6 brut : augmenter corpsMax ne contourne pas le plafond de récupération de 2 Mio');
    const bufferLarge = await lancer({ status: 200, arrayBuffer: async () => new Uint8Array(33).buffer }, { corpsMax: 32 });
    eq([bufferLarge.raison, bufferLarge.reponseBrute], ['reponse_illisible', null], 'L6 brut : le repli arrayBuffer contrôle lui aussi sa taille effective');
  }
  {
    let annulations = 0, lectures = 0;
    const lecteur = { read: async () => ++lectures === 1 ? { value: new Uint8Array(LIMITES_PASSERELLE.corps + 1), done: false } : { done: true }, cancel: async () => { annulations++; } };
    const r = await lancer({ status: 200, body: { getReader: () => lecteur } }, { corpsMax: NaN });
    eq([r.raison, r.reponseBrute, lectures, annulations], ['reponse_illisible', null, 1, 1], 'L6 brut : une borne non numérique ne désactive pas l’arrêt du flux au plafond');
  }
  {
    const c = new AbortController(); let depart = 0;
    c.abort();
    const r = await lancer(null, { signal: c.signal, fetch: async () => { depart++; return new Response(bytes); } });
    eq([r.raison, r.reponseBrute, depart], ['annule', null, 0], 'L6 brut : abandon avant départ sans appel ni récupération fictive');
  }
  {
    const c = new AbortController(); let n = 0;
    const r = await lancer({ status: 200, body: { getReader: () => ({ read: async () => { if (n++ === 0) return { value: bytes, done: false }; c.abort(); return { done: true }; } }) } }, { signal: c.signal });
    eq([r.raison, r.corps, octets(r)], ['annule', null, [...bytes]], 'L6 brut : annulation après lecture complète garde la réponse payée sans l’annoncer réussie');
  }
  {
    let n = 0;
    const r = await lancer({ status: 200, body: { getReader: () => ({ read: async () => { if (n++ === 0) return { value: bytes.slice(0, 4), done: false }; throw Error('MESSAGE-PRIVE'); } }) } });
    eq([r.raison, r.reponseBrute, JSON.stringify(r).includes('PRIVE')], ['reseau', null, false], 'L6 brut : rupture pendant le flux n’expose ni préfixe ni erreur réseau brute');
  }
  {
    const r = await lancer(null, { fetch: async () => { throw Error('MESSAGE-PRIVE'); } });
    eq([r.raison, r.reponseBrute], ['reseau', null], 'L6 brut : échec réseau conserve la classification et une récupération absente');
    const absent = await lancer(null, { session: null });
    eq([absent.raison, absent.reponseBrute], ['non_connecte', null], 'L6 brut : absence de session sans récupération');
  }
  ok(captures.every(r => Object.hasOwn(r, 'reponseBrute') && (r.reponseBrute === null || r.reponseBrute instanceof Uint8Array)), 'L6 brut : récupération explicitement présente ou absente sur chaque issue, jamais undefined');
}
