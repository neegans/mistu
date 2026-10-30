export async function runL4BrouillonsListeTests({ eq, ok }) {
  let m;
  try { m = await import('../src/ui/brouillons-liste.js'); }
  catch (e) { ok(false, `L4 liste des brouillons indisponible : ${e.message}`); return; }
  const portee = { owner_id: null, database_name: 'test', library_epoch: 'epoque' };
  const ligne = (id, extra = {}) => ({ id, kind: 'recipe_version', titre: 'Ma recette', saved_at: '2026-10-29T23:00:00Z', revision: 3, etat: 'reprenable', entity_id: 'recette', raisons: [], ...extra });
  let rows = [ligne('brouillon', { titre: '<img src=x onerror=alert(1)>' }), ligne('ancien', { etat: 'detache' }), ligne('nouveau', { kind: 'recipe_new', entity_id: 'reserve' }), ligne('livre', { kind: 'book_metadata', edition_id: 'ed/1' })];
  const appels = [], service = {
    listerBrouillons: async args => { appels.push(['liste', args]); return { issue: 'ok', brouillons: rows }; },
    exporterTexteBrouillon: async args => { appels.push(['texte', args]); return { issue: 'ok', texte: 'Recette\nTexte conservé', nomFichier: 'ma-saisie.txt' }; },
    ecarterBrouillon: async args => { appels.push(['ecarter', args]); return { issue: 'refuse', raison: 'revision_changee' }; },
  };
  const telecharges = [];
  const root = await m.renderBrouillonsListe({ service, portee, confirmer: async () => true, telecharger: (blob, nom) => telecharges.push({ blob, nom }) });
  document.body.append(root);
  try {
    eq(root.querySelectorAll('[data-draft-id]').length, 4, 'L4 brouillons : liste réellement rendue');
    eq(root.querySelectorAll('img').length, 0, 'L4 brouillons : titres hostiles rendus en texte');
    ok(root.textContent.includes('<img src=x'), 'L4 brouillons : titre conservé lisible');
    const card = id => root.querySelector(`[data-draft-id="${id}"]`);
    ok(card('brouillon').querySelector('a')?.getAttribute('href').includes('/recipes/recette/edit?draft=brouillon'), 'L4 brouillons : reprise de la cible exacte');
    eq(card('ancien').querySelectorAll('a').length, 0, 'L4 brouillon détaché : récupération sans édition de la nouvelle bibliothèque');
    ok(card('nouveau').querySelector('a')?.getAttribute('href').startsWith('#/recipes/new?draft=nouveau'), 'L4 création : identifiant de brouillon dans le lien');
    ok(card('livre').querySelector('a')?.getAttribute('href').includes('/books/ed%2F1?panel=modifier&draft=livre'), 'L4 livre : édition encodée et formulaire demandé');
    card('ancien').querySelector('[data-action=exporter]').click();
    for (let i = 0; i < 50 && !telecharges.length; i++) await new Promise(r => setTimeout(r, 5));
    eq(telecharges.length, 1, 'L4 saisie détachée : export local possible');
    eq(await telecharges[0].blob.text(), 'Recette\nTexte conservé', 'L4 export : texte fourni par le service validé');
    card('brouillon').querySelector('[data-action=ecarter]').click();
    for (let i = 0; i < 50 && !appels.some(a => a[0] === 'ecarter'); i++) await new Promise(r => setTimeout(r, 5));
    await new Promise(r => setTimeout(r, 0));
    eq(appels.find(a => a[0] === 'ecarter')[1], { id: 'brouillon', portee, expectedRevision: 3 }, 'L4 écarter : révision affichée comparée');
    ok(card('brouillon'), 'L4 refus concurrent : brouillon toujours visible');
    ok(card('brouillon').querySelector('[role=status]')?.textContent, 'L4 refus concurrent : motif visible');
    service.ecarterBrouillon = async () => { rows = rows.filter(r => r.id !== 'brouillon'); return { issue: 'ok' }; };
    card('brouillon').querySelector('[data-action=ecarter]').click();
    for (let i = 0; i < 50 && card('brouillon'); i++) await new Promise(r => setTimeout(r, 5));
    eq(card('brouillon'), null, 'L4 écarter : liste relue après réussite seulement');
    eq(appels.filter(a => a[0] === 'texte').length, 1, 'L4 consulter une liste ne lit aucun texte de brouillon sans geste');
  } finally { root.remove(); }
  let courante = true, terminer;
  const attente = m.renderBrouillonsListe({ service: { listerBrouillons: () => new Promise(r => { terminer = r; }) }, portee, estCourante: () => courante });
  courante = false; terminer({ issue: 'ok', brouillons: [ligne('secret')] });
  const obsolete = await attente;
  eq(obsolete.querySelectorAll('[data-draft-id]').length, 0, 'L4 compte changé pendant lecture : aucun ancien titre rendu');
  const vide = await m.renderBrouillonsListe({ service: { listerBrouillons: async () => ({ issue: 'ok', brouillons: [] }) }, portee });
  ok(vide.hidden, 'L4 aucun brouillon : section absente sans prétendre à une erreur');
  const enAttente=[];
  const retards={listerBrouillons:()=>new Promise(r=>enAttente.push(r))};
  // Le même service peut recevoir deux notifications de stockage avant la fin de la première lecture.
  let premier=true;
  const avecRetard={listerBrouillons:()=>premier?(premier=false,Promise.resolve({issue:'ok',brouillons:[]})):retards.listerBrouillons()};
  const liste=await m.renderBrouillonsListe({service:avecRetard,portee});
  const lente=liste.recharger(),rapide=liste.recharger();
  enAttente[1]({issue:'ok',brouillons:[ligne('nouvelle')]});await rapide;
  enAttente[0]({issue:'ok',brouillons:[ligne('ancienne')]});await lente;
  eq([...liste.querySelectorAll('[data-draft-id]')].map(n=>n.dataset.draftId),['nouvelle'],'L4 lectures concurrentes : la plus ancienne ne vide pas la liste récente');
  const attendu={},corrompu=ligne('invalide',{etat:'invalide',revision:null,attendu});let abandon=null;
  const invalide=await m.renderBrouillonsListe({service:{listerBrouillons:async()=>({issue:'ok',brouillons:[corrompu]}),ecarterBrouillon:async p=>{abandon=p;return{issue:'refuse',raison:'revision_changee'};}},portee,confirmer:async()=>true});
  eq(invalide.querySelectorAll('a').length,0,'L4 format inconnu : aucune reprise vers un formulaire métier');
  invalide.querySelector('[data-action=ecarter]').click();
  for(let i=0;i<50&&!abandon;i++)await new Promise(r=>setTimeout(r,5));
  eq(abandon?.attendu,attendu,'L4 format inconnu : abandon de la copie exacte montrée, sans faire confiance à sa révision');
  const anonyme=await m.renderBrouillonsListe({service:{listerBrouillons:async()=>({issue:'ok',brouillons:[ligne('avant-compte',{etat:'anonyme'})]})},portee:{...portee,owner_id:'nouveau-compte'}});
  ok(anonyme.querySelector('a')?.getAttribute('href').includes('draft=avant-compte'),'L4 anonyme : accès à la revue explicite de la saisie du même appareil');
  ok(anonyme.textContent.includes('sans compte')&&anonyme.querySelector('a')?.textContent==='Revoir ce brouillon','L4 anonyme : origine et reprise volontaire nommées, sans publication annoncée');
}
