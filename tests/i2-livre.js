import { withRepo } from './sync-fixture.js';

const ISBN = '9781837836222';
const SOURCE = 'https://editeur.example/livre/trinity';
const source = { href: SOURCE, hote: 'editeur.example', titre: 'Trinity' };
const valeur = (value) => ({ value, sources: [SOURCE], uncertain: false });
const candidate = () => ({ fields: { title: valeur('Trinity: The Cookbook'), author: valeur('Adam Byatt'), isbn: valeur(ISBN), year: valeur(2026) },
  cuisine_facets: { styles: [valeur('Cuisine de restaurant')] }, tags: [valeur('Pains')] });

export async function runI2LivreTests({ eq, ok }) {
  const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js'); const ancienneLangue = getUiLocale(); setUiLocale('fr');
  try {
  const run = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, `I2 livre — ${nom} : ${e.message}`); } };
  await run('validation bibliographique et sources', async () => {
    const B = await import('../src/domain/livre-bibliographie.js');
    const lire = (c, extra = {}) => B.validerBibliographie({ candidates: [c] }, { sources: [source], isbn: ISBN, maintenant: '2026-10-28T12:00:00Z', ...extra });
    const bon = lire(candidate());
    eq(bon.candidates.length, 1, 'I2 : candidate sourcée conservée');
    eq(bon.candidates[0].fields.title, 'Trinity: The Cookbook', 'I2 : titre principal conservé');
    eq(bon.candidates[0].fields.language, '', 'I2 : langue inconnue vide');
    eq(bon.candidates[0].provenance.title.sources[0].href, SOURCE, 'I2 : source du champ issue du résultat brut');
    const faux = candidate(); faux.fields.title.sources = ['https://invente.example/titre'];
    eq(lire(faux).candidates.length, 0, 'I2 : titre sans source brute refusé');
    const hostile = candidate(); hostile.fields.description = valeur('<img onerror="alert(1)">'); hostile.fields.publisher = valeur('https://pirate.example');
    eq(lire(hostile).candidates[0].fields.publisher, '', 'I2 : aucune adresse dans les métadonnées');
    eq(lire({ ...candidate(), fields: { ...candidate().fields, year: valeur('2026') } }).candidates[0].fields.year, '', 'I2 : année mal typée écartée');
    const mauvais = candidate(); mauvais.fields.isbn = valeur('9781837836223');
    eq(lire(mauvais).candidates.length, 0, 'I2 : ISBN invalide jamais réparé');
    eq(lire(candidate(), { indices: { title: 'Autre livre', author: 'Autre auteur' } }).candidates[0].conflict, true, 'I2 : contradiction titre/auteur visible');
    const duplique = candidate(); duplique.tags.push(valeur('pains'));
    eq(lire(duplique).candidates[0].fields.tags, ['Pains'], 'I2 : suggestions dédoublonnées');
  });
  await run('corrections et reprise', async () => {
    const B = await import('../src/domain/livre-bibliographie.js');
    const c = B.validerBibliographie({ candidates: [candidate()] }, { sources: [source], isbn: ISBN }).candidates[0];
    let d = B.brouillonLivre();
    d = B.modifierChampLivre(d, 'title', 'Mon titre');
    d = B.modifierChampLivre(d, 'author', '');
    d = B.appliquerCandidateLivre(d, c);
    eq([d.fields.title, d.fields.author, d.fields.isbn], ['Mon titre', '', ISBN], 'I2 : correction et effacement gagnent sur la réponse');
    eq(Object.keys(d.proposals).sort(), ['author', 'title'], 'I2 : valeurs en conflit proposées séparément');
    const relu = B.brouillonLivre(JSON.parse(JSON.stringify(d)));
    eq([relu.fields.title, relu.touched.author], ['Mon titre', true], 'I2 : reprise conserve texte et champ vidé');
  });
  await run('suggestions incertaines et conflit repris', async () => {
    const B = await import('../src/domain/livre-bibliographie.js');
    const raw = candidate(); raw.tags = [{ ...valeur('Sans gluten'), uncertain: true }, valeur('Pains')];
    raw.cuisine_facets.origines = [{ ...valeur('Cuisine française'), uncertain: true }];
    const validated = B.validerBibliographie({ candidates: [raw] }, { sources: [source], isbn: ISBN, indices: { title: 'Autre livre', author: 'Autre auteur' } });
    const draft = B.appliquerCandidateLivre(B.brouillonLivre(), validated.candidates[0]);
    eq(draft.fields.tags, ['Pains'], 'I2 : seule la suggestion certaine remplit les mots-clés');
    eq(draft.fields.cuisine_facets.origines, [], 'I2 : origine incertaine reste vide');
    raw.tags.reverse();
    const reverse = B.validerBibliographie({ candidates: [raw] }, { sources: [source], isbn: ISBN });
    eq(B.appliquerCandidateLivre(B.brouillonLivre(), reverse.candidates[0]).fields.tags, ['Pains'], 'I2 : ordre des suggestions sans effet sur les valeurs certaines');
    const reprise = B.relireRechercheLivre({ ...validated, indices: { title: 'Autre livre', author: 'Autre auteur' } }, { isbn: ISBN });
    eq(reprise.candidates[0].conflict, true, 'I2 : contradiction identité toujours explicite à la reprise');
  });
  await run('données reçues et complément concurrent', async () => {
    const B = await import('../src/domain/livre-bibliographie.js'); const P = await import('../src/domain/livre-parcours.js');
    eq(B.brouillonLivre(null).fields.title, '', 'I2 : brouillon nul reçu traité comme vide');
    await withRepo(async (repo) => {
      const book = { id: repo.newId('bk'), title: 'Livre', author: 'Auteur' };
      const edition = { id: repo.newId('ed'), book_id: book.id, unit_convention_id: 'us' };
      await repo.saveBatch({ books: [book], book_editions: [edition] }, { conditions: { book_editions: [{key:edition.id,absente:true}] } });
      const base = P.brouillonDepuisEdition(book, edition); const d = B.modifierChampLivre(base, 'convention', 'metric');
      const row = P.fabriquerImportLivre({ id: repo.newId('imp'), deviceId: repo.deviceId(), brouillon: d }); await repo.save('imports', row);
      await repo.save('book_editions', { ...edition, unit_convention_id: 'imperial' });
      let conflict = false; try { await P.enregistrerLivreI2({ importId: row.id, brouillon: d, base }, { repo }); } catch (e) { conflict = e instanceof P.ConflitLivre && e.fields.includes('convention'); }
      eq(conflict, true, 'I2 : convention changée ailleurs exige un choix');
      eq((await repo.get('imports', row.id)).status, 'a_lancer', 'I2 : conflit ne ferme pas le brouillon');
      const tags = B.modifierChampLivre(base, 'tags', ['Pains']);
      await P.enregistrerLivreI2({ importId: row.id, brouillon: tags, base }, { repo });
      eq((await repo.get('books', book.id)).tags, ['Pains'], 'I2 : ancien champ absent accepte son premier complément');
      eq((await repo.get('book_editions', edition.id)).unit_convention_id, 'imperial', 'I2 : complément préserve la modification étrangère');
    });
  });
  await run('résultat payé récupéré sans nouvelle requête', async () => {
    const B = await import('../src/domain/livre-bibliographie.js'); const P = await import('../src/domain/livre-parcours.js');
    const { renderLivreSansSaisieRoute } = await import('../src/ui/livre-sans-saisie.js');
    await withRepo(async (repo) => {
      const d = B.modifierChampLivre(B.brouillonLivre(), 'isbn', ISBN);
      const row = P.fabriquerImportLivre({ id: repo.newId('imp'), deviceId: repo.deviceId(), brouillon: d });
      row.status = 'a_verifier'; row.resultat = { format: 1, web: B.validerBibliographie({ candidates: [candidate()] }, { sources: [source], isbn: ISBN }) };
      await repo.save('imports', row); let appels = 0;
      const root = await renderLivreSansSaisieRoute({}, { import: row.id }, { books: [] }, { repo, remplacerAdresse: () => {}, fetch: async () => { appels++; throw new Error('interdit'); } });
      try { eq(root.querySelector('[name=title]').value, 'Trinity: The Cookbook', 'I2 : résultat payé avant fermeture récupéré dans la fiche'); eq(appels, 0, 'I2 : récupération sans appel'); await root.attendreEcritures(); }
      finally { root.dispose(); root.remove(); }
    });
  });
  await run('choix d’édition durable', async () => {
    const B = await import('../src/domain/livre-bibliographie.js'); const P = await import('../src/domain/livre-parcours.js');
    const { renderLivreSansSaisieRoute } = await import('../src/ui/livre-sans-saisie.js');
    await withRepo(async (repo) => {
      const row = P.fabriquerImportLivre({ id: repo.newId('imp'), deviceId: repo.deviceId(), brouillon: B.brouillonLivre() });
      const other = candidate(); other.fields.title = valeur('Trinity, autre édition');
      row.status = 'a_verifier'; row.resultat = { format: 1, web: B.validerBibliographie({ candidates: [candidate(), other] }, { sources: [source] }) }; await repo.save('imports', row);
      const deps = { repo, remplacerAdresse: () => {}, fetch: async () => { throw new Error('aucun appel permis'); } };
      const root = await renderLivreSansSaisieRoute({}, { import: row.id }, { books: [] }, deps);
      try {
        root.querySelector('[data-role=candidate-1]').click(); await root.attendreEcritures();
        ok([...root.querySelectorAll('small')].filter(n => n.textContent === 'Suggestion de classement').length >= 2, 'I2 : mots-clés et cuisines préremplis sont explicitement présentés comme suggestions');
      }
      finally { root.dispose(); root.remove(); }
      const reprise = await renderLivreSansSaisieRoute({}, { import: row.id }, { books: [] }, deps);
      try { eq(reprise.querySelectorAll('[data-role^=candidate-]').length, 0, 'I2 : choix d’édition conservé à la reprise'); eq(reprise.querySelector('[name=title]').value, 'Trinity, autre édition', 'I2 : fiche choisie retrouvée'); await reprise.attendreEcritures(); }
      finally { reprise.dispose(); reprise.remove(); }
    });
  });
  await run('véritable recherche Web obligatoire', async () => {
    const B = await import('../src/domain/livre-bibliographie.js');
    const response = (content, stop_reason = 'end_turn') => new Response(JSON.stringify({ content, stop_reason, model: 'test', usage: {} }), { status: 200 });
    const args = { isbn: ISBN, session: { access_token: 'fixture', user: { id: 'fixture' } } };
    const config = { url: 'https://assistant.example', anonKey: 'publique-factice' };
    let appels = 0;
    const fetch = async (_url, init) => { appels++; const req = JSON.parse(init.body); eq(req.outil, 'recherche-web', 'I2 : outil existant recherche-web'); return response([{ type: 'text', text: JSON.stringify({ candidates: [candidate()] }) }]); };
    const sans = await B.rechercherLivreWeb(args, { fetch, config, enLigne: () => true });
    eq(sans.raison, 'pas_cherche', 'I2 : réponse de mémoire refusée');
    eq(appels, 1, 'I2 : un POST seulement');
    const trouve = await B.rechercherLivreWeb(args, { config, enLigne: () => true, fetch: async () => response([
      { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: SOURCE, title: 'Trinity' }] },
      { type: 'text', text: JSON.stringify({ candidates: [candidate()] }) },
    ]) });
    eq(trouve.candidates.length, 1, 'I2 : résultat recherché et sourcé accepté');
    const coupe = await B.rechercherLivreWeb(args, { config, enLigne: () => true, fetch: async () => response([], 'max_tokens') });
    eq(coupe.raison, 'interrompu', 'I2 : réponse coupée non complète');
  });
  await run('lecture de couverture enrichie', async () => {
    const { validerIndicesLivre } = await import('../src/domain/llm.js');
    const lu = validerIndicesLivre({ title: 'Trinity: The Cookbook', authors: ['Adam Byatt'], isbn: ISBN, summary: 'Pains et desserts', related_titles: ['Trinity: The Repertoire'], rotation: 90 });
    eq([lu.title, lu.isbn, lu.related_titles, lu.rotation], ['Trinity: The Cookbook', ISBN, ['Trinity: The Repertoire'], 90], 'I2 : livre principal, ISBN, complément et rotation séparés');
    eq(validerIndicesLivre({ title: 'Trinity', isbn: '90000' }).isbn, null, 'I2 : code de prix écarté');
    eq(validerIndicesLivre({ isbn: ISBN }).isbn, ISBN, 'I2 : ISBN seul lisible au dos utilisable comme indice');
  });
  await run('brouillon et fiche atomique', async () => {
    const P = await import('../src/domain/livre-parcours.js');
    const B = await import('../src/domain/livre-bibliographie.js');
    await withRepo(async (repo) => {
      let draft = B.modifierChampLivre(B.brouillonLivre(), 'title', 'Trinity');
      draft = B.modifierChampLivre(draft, 'isbn', ISBN);
      const row = P.fabriquerImportLivre({ id: repo.newId('imp'), deviceId: repo.deviceId(), brouillon: draft });
      await repo.save('imports', row);
      const ed = await P.enregistrerLivreI2({ importId: row.id, brouillon: draft }, { repo });
      eq((await repo.get('imports', row.id)).status, 'enregistre', 'I2 : fiche et journal fermés ensemble');
      eq((await repo.get('book_editions', ed.id)).isbn, ISBN, 'I2 : édition exacte enregistrée');
      const bis = await P.enregistrerLivreI2({ importId: row.id, brouillon: draft }, { repo });
      eq(bis.id, ed.id, 'I2 : reprise de l’enregistrement idempotente');
      eq((await repo.all('book_editions')).length, 1, 'I2 : aucune deuxième édition');
    });
  });
  await run('écran ISBN puis Web, correction et reprise', async () => {
    const { renderLivreSansSaisieRoute } = await import('../src/ui/livre-sans-saisie.js');
    await withRepo(async (repo) => {
      let calls = 0, release;
      const attendre = async (fn) => { for (let i = 0; i < 200; i++) { if (fn()) return; await new Promise((r) => setTimeout(r, 5)); } throw new Error('attente dépassée'); };
      const config = { url: 'https://assistant.example', anonKey: 'publique-factice' };
      const session = { access_token: 'fixture', user: { id: 'fixture' } };
      const fetch = async (_url, init) => { calls++;
        if (!init?.body) return new Response('{}', { status: 200 });
        await new Promise((r) => { release = r; });
        return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: SOURCE, title: 'Trinity' }] }, { type: 'text', text: JSON.stringify({ candidates: [candidate()] }) }] }), { status: 200 });
      };
      const deps = { repo, fetch, config, sessionAssistant: async () => session, enLigne: () => true, navigate: () => {}, toast: () => {}, remplacerAdresse: () => {} };
      const ctx = { books: [], sync: { user: { id: 'fixture' } } };
      const root = await renderLivreSansSaisieRoute({}, {}, ctx, deps); document.body.append(root);
      try {
        const isbn = root.querySelector('[name=isbn]'); isbn.value = ISBN; isbn.dispatchEvent(new Event('input'));
        root.querySelector('[data-role=identifier-livre]').click();
        await attendre(() => !!release);
        root.querySelector('[data-role=saisir-livre]').click();
        const titre = root.querySelector('[name=title]'); titre.value = 'Titre corrigé'; titre.dispatchEvent(new Event('input'));
        release(); await attendre(() => !root.etatRoute().busy); await root.attendreEcritures();
        eq(calls, 2, 'I2 écran : catalogue sans résultat puis exactement un appel Web');
        eq(root.querySelector('[name=title]').value, 'Titre corrigé', 'I2 écran : réponse tardive ne remplace pas la correction');
        ok(root.textContent.includes('Autre proposition'), 'I2 écran : remplacement proposé explicitement');
        const id = root.etatRoute().importId; root.dispose(); root.remove();
        const reprise = await renderLivreSansSaisieRoute({}, { import: id }, ctx, deps); document.body.append(reprise);
        eq(reprise.querySelector('[name=title]').value, 'Titre corrigé', 'I2 écran : brouillon repris avec correction');
        eq(calls, 2, 'I2 écran : reprise sans nouvel appel');
        reprise.dispose(); reprise.remove();
      } finally { root.dispose(); root.remove(); }
    });
  });
  await run('annulation et double tape catalogue', async () => {
    const { renderLivreSansSaisieRoute } = await import('../src/ui/livre-sans-saisie.js');
    await withRepo(async (repo) => {
      let calls = 0, resolve;
      const wait = async (test) => { for (let i = 0; i < 200; i++) { if (test()) return; await new Promise((r) => setTimeout(r, 5)); } throw new Error('attente dépassée'); };
      const root = await renderLivreSansSaisieRoute({}, {}, { books: [] }, { repo, enLigne: () => true, remplacerAdresse: () => {}, toast: () => {},
        fetch: async () => { calls++; return new Promise((r) => { resolve = r; }); } }); document.body.append(root);
      try {
        const isbn = root.querySelector('[name=isbn]'); isbn.value = ISBN; isbn.dispatchEvent(new Event('input'));
        const button = root.querySelector('[data-role=identifier-livre]'); button.click(); button.click();
        await wait(() => !!resolve); eq(calls, 1, 'I2 écran : double tape = un catalogue');
        root.querySelector('[data-role=annuler-livre]').click(); resolve(new Response('{}')); await wait(() => !root.etatRoute().busy);
        eq(root.etatRoute().busy, false, 'I2 écran : annulation libère les gestes');
        await root.attendreEcritures();
        eq((await repo.get('imports', root.etatRoute().importId)).appels, 0, 'I2 écran : catalogue annulé = aucun appel assistant compté');
      } finally { root.dispose(); root.remove(); }
    });
  });
  await run('photo réelle, lecture puis recherche sans troisième appel', async () => {
    const { renderLivreSansSaisieRoute } = await import('../src/ui/livre-sans-saisie.js');
    const { imageDe } = await import('./couverture-fixture.js');
    await withRepo(async (repo) => {
      const photo = await imageDe(); const outils = [];
      const wait = async (test) => { for (let i = 0; i < 300; i++) { if (test()) return; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée'); };
      const root = await renderLivreSansSaisieRoute({}, {}, { books: [], sync: { user: { id: 'fixture' } } }, { repo, enLigne: () => true, remplacerAdresse: () => {}, toast: () => {},
        sessionAssistant: async () => ({ access_token: 'fixture', user: { id: 'fixture' } }), pickFiles: async () => [photo], config: { url: 'https://assistant.example', anonKey: 'publique-factice' },
        fetch: async (_url, init) => {
          const body = JSON.parse(init.body); outils.push(body.outil);
          const content = body.outil === 'extraction'
            ? [{ type: 'text', text: JSON.stringify({ title: 'Trinity: The Cookbook', authors: ['Adam Byatt'], isbn: ISBN, related_titles: ['Trinity: The Repertoire'], rotation: 0 }) }]
            : [{ type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: SOURCE, title: 'Trinity' }] }, { type: 'text', text: JSON.stringify({ candidates: [candidate()] }) }];
          return new Response(JSON.stringify({ content, stop_reason: 'end_turn' }), { status: 200 });
        } }); document.body.append(root);
      try {
        root.querySelector('[data-role=image-livre]').click();
        await wait(() => outils.length === 2 && !root.etatRoute().busy); await root.attendreEcritures();
        eq(outils, ['extraction', 'recherche-web'], 'I2 photo : une lecture puis un Web, sans catalogue ou lecture supplémentaire');
        eq(root.querySelector('[name=title]').value, 'Trinity: The Cookbook', 'I2 photo : titre principal');
        const id = root.etatRoute().importId; const saved = await repo.get('imports', id);
        eq(saved.appels, 2, 'I2 photo : deux appels effectivement partis comptés');
        ok(!!(await repo.getFile(saved.source_photo_sha256))?.blob, 'I2 photo : image conservée avant la lecture');
        ok(root.textContent.includes('Trinity: The Repertoire'), 'I2 photo : complément mentionné séparément');
      } finally { root.dispose(); root.remove(); }
    });
  });
  await run('anciens gestes livre, provenance et écritures concurrentes', async () => {
    const { renderBook } = await import('../src/ui/book.js');
    await withRepo(async (repo, db) => {
      const p = { origin: 'web', retrieved_at: '2026-10-28T12:00:00Z', sources: [source], uncertain: false };
      const livre = { id: 'livre_anciens_gestes', title: 'Titre avant', author: 'Auteur avant', cuisines: [], tags: [], metadata_provenance: { title: p, author: p } };
      const edition = { id: 'edition_anciens_gestes', book_id: livre.id, publisher: 'Éditeur', year: 2020, language: 'fr', cover_sha256: 'a'.repeat(64), metadata_provenance: { publisher: p } };
      await repo.saveBatch({ books: [livre], book_editions: [edition] }, { conditions: { book_editions: [{key:edition.id,absente:true}] } });
      const ctxDe = (book, ed, cups = false) => ({ books: [book], booksById: new Map([[book.id, book]]), book_editions: [ed], editionsById: new Map([[ed.id, ed]]),
        recipes: cups ? [{ id: 'recette_tasse', edition_id: ed.id, original_title: 'Recette', availability: 'reference_only' }] : [],
        recipe_versions: cups ? [{ id: 'version_tasse', recipe_id: 'recette_tasse', ingredients: [{ unit_id: 'cup' }] }] : [], source_documents: [], source_pages: [], rediscovery_prefs: [], docsByRecipe: new Map(), scan_sessions: [], settings: {} });
      const wait = async (test) => { for (let n = 0; n < 150; n++) { if (await test()) return; await new Promise((r) => setTimeout(r, 5)); } throw new Error('écriture attendue'); };
      const mutate = db.mutate.bind(db); const propre = Object.hasOwn(db, 'mutate'), precedente = db.mutate;
      let injection = null;
      db.mutate = async (op) => { const injecter = injection; if (injecter && (op.puts?.book_editions || op.conditions?.book_editions || op.puts?.books || op.conditions?.books)) { injection = null; await injecter(); } return mutate(op); };
      const glisser = (b, ed) => { injection = async () => { await mutate({ puts: { ...(b ? { books: [{ ...(await db.get('books', livre.id)), ...b }] } : {}), ...(ed ? { book_editions: [{ ...(await db.get('book_editions', edition.id)), ...ed }] } : {}) }, origin: 'local' }); }; };
      try {
        const fiche = await renderBook({ id: edition.id }, {}, ctxDe(livre, edition));
        const titre = [...fiche.querySelectorAll('label.field')].find((f) => f.querySelector('span')?.textContent === 'Titre').querySelector('input');
        titre.value = 'Titre corrigé'; titre.dispatchEvent(new Event('input'));
        glisser({ author: 'Auteur reçu', description: 'Résumé reçu', personal_notes: 'Note concurrente' }, { source_photo_sha256: 'b'.repeat(64), description_locale: 'Détail reçu' });
        [...fiche.querySelectorAll('button')].find((b) => b.textContent === 'Enregistrer').click();
        await wait(async () => (await db.get('books', livre.id)).title === 'Titre corrigé');
        const b = await db.get('books', livre.id), ed = await db.get('book_editions', edition.id);
        eq(b.metadata_provenance.title.origin, 'manual', 'I2 ancien formulaire : titre modifié devient manuel');
        eq(b.metadata_provenance.author, p, 'I2 ancien formulaire : provenance non modifiée conservée');
        eq([b.author, b.description, b.personal_notes, ed.source_photo_sha256, ed.description_locale], ['Auteur reçu', 'Résumé reçu', 'Note concurrente', 'b'.repeat(64), 'Détail reçu'], 'I2 ancien formulaire : seuls champs saisis changés, champs concurrents préservés en transaction');
        const rapide = await renderBook({ id: edition.id }, {}, ctxDe(b, ed, true));
        const convention = rapide.querySelector('.card.warn select'); const choix = [...convention.options].find((o) => o.value)?.value;
        glisser(null, { source_photo_sha256: 'c'.repeat(64), publisher: 'Éditeur concurrent', description_locale: 'Seconde note' });
        convention.value = choix; convention.dispatchEvent(new Event('change'));
        await wait(async () => (await db.get('book_editions', edition.id)).unit_convention_id === choix);
        const apresConvention = await db.get('book_editions', edition.id);
        eq([apresConvention.source_photo_sha256, apresConvention.publisher, apresConvention.description_locale], ['c'.repeat(64), 'Éditeur concurrent', 'Seconde note'], 'I2 raccourci convention : photo source et métadonnées concurrentes survivent');
        const couverture = await renderBook({ id: edition.id }, {}, ctxDe(b, apresConvention));
        glisser(null, { source_photo_sha256: 'd'.repeat(64), description_locale: 'Troisième note' });
        [...couverture.querySelectorAll('button')].find((bouton) => bouton.textContent === 'Retirer').click();
        await wait(async () => (await db.get('book_editions', edition.id)).cover_sha256 === null);
        const retiree = await db.get('book_editions', edition.id);
        eq([retiree.source_photo_sha256, retiree.description_locale, retiree.unit_convention_id], ['d'.repeat(64), 'Troisième note', choix], 'I2 retirer couverture : seul le pointeur décoratif change en transaction');
      } finally { if (propre) db.mutate = precedente; else delete db.mutate; }
    });
  });
  } finally { setUiLocale(ancienneLangue); }
}
