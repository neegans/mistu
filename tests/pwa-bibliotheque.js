import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { renderListeBibliotheque } from '../src/ui/bibliotheque-liste.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';

const ids = root => [...root.querySelectorAll('.bibliotheque-item')].map(n => n.dataset.recette);
const visibles = root => [...root.querySelectorAll('.selection-recette input:checked')].map(n => n.value);
const visible = node => !!node?.getClientRects().length;
const changer = (node, value) => { node.value = value; node.dispatchEvent(new Event(node.type === 'search' ? 'input' : 'change', {bubbles:true})); };
const layout = win => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));

// Un vrai viewport enfant, sans script inline ni srcdoc : les mêmes nœuds traversent les deux largeurs.
async function cadre() {
  const frame = document.createElement('iframe');
  frame.title = 'Bibliothèque mobile de test';
  frame.style.cssText = 'width:375px;height:667px;border:0';
  frame.src = 'about:blank';
  const charge = new Promise((resolve,reject) => {
    const timer = setTimeout(() => { frame.onload = null; reject(Error('Cadre bibliothèque non chargé')); },15000);
    frame.onload = () => { clearTimeout(timer); frame.onload = null; resolve(); };
  });
  document.body.append(frame);
  try {
    await charge;
    const doc = frame.contentDocument, css = doc.createElement('link');
    css.rel = 'stylesheet'; css.href = new URL('../styles.css',import.meta.url).href;
    await new Promise((resolve,reject) => {
      const finir = error => { clearTimeout(timer); css.onload = css.onerror = null; error ? reject(error) : resolve(); };
      const timer = setTimeout(() => finir(Error('Styles bibliothèque non chargés')),15000);
      css.onload = () => finir(); css.onerror = () => finir(Error('Styles bibliothèque indisponibles'));
      doc.head.append(css);
    });
    return frame;
  } catch(error) { frame.remove(); throw error; }
}

export async function runPwaBibliothequeTests({eq,ok}) {
  const locale = getUiLocale(); setUiLocale('fr');
  try { await withRepo(async(repo,db) => {
    await db.mutate({origin:'remote',puts:{
      books:[{id:'pwa-livre',title:'Livre tactile'},{id:'pwa-autre',title:'Autre livre'}],
      book_editions:[{id:'pwa-edition',book_id:'pwa-livre'},{id:'pwa-autre-edition',book_id:'pwa-autre'}],
      recipes:[
        {id:'pwa-z',original_title:'Zulu',availability:'reference_only',edition_id:'pwa-edition',printed_page:21,updated_at:'2026-10-31T12:00:00.000Z'},
        {id:'pwa-a',original_title:'Alpha',availability:'reference_only',edition_id:'pwa-edition',printed_page:4,updated_at:'2026-10-30T12:00:00.000Z'},
        {id:'pwa-b',original_title:'Beta',availability:'reference_only',edition_id:'pwa-autre-edition',updated_at:'2026-10-29T12:00:00.000Z'}
      ]
    }});
    const ctx = await getData(true), frame = await cadre(), win = frame.contentWindow, doc = frame.contentDocument;
    try {
      const root = await renderListeBibliotheque(ctx); doc.body.append(root); await layout(win);
      const avant = await db.getSnapshot(), search = root.querySelector('[name=q]'), tri = root.querySelector('[name=tri]'), presentation = root.querySelector('[name=presentation]'), mode = root.querySelector('[data-role=mode-selection]');
      const toggle = root.querySelector('[data-role=affichage-selection]'), groupe = root.querySelector('.bibliotheque-options');
      ok(visible(search), 'PWA bibliothèque : recherche directement visible sur téléphone');
      ok(visible(toggle) && toggle.textContent === 'Affichage et sélection', 'PWA bibliothèque : entrée explicite des commandes secondaires');
      eq(toggle?.getAttribute('aria-expanded') ?? null, 'false', 'PWA bibliothèque : volet initialement fermé et annoncé');
      ok(!!groupe?.id && toggle?.getAttribute('aria-controls') === groupe.id, 'PWA bibliothèque : bouton relié au vrai groupe de commandes');
      ok(!visible(tri) && !visible(presentation) && !visible(mode), 'PWA bibliothèque : commandes secondaires repliées sur téléphone');
      ok((toggle?.getBoundingClientRect().height ?? 0) >= 44, 'PWA bibliothèque : ouverture tactile de 44 pixels minimum');
      eq(ids(root), ['pwa-z','pwa-a','pwa-b'], 'PWA bibliothèque : les résultats restent présents avant ouverture');
      toggle?.click(); await layout(win);
      eq(toggle?.getAttribute('aria-expanded') ?? null, 'true', 'PWA bibliothèque : ouverture annoncée');
      ok(visible(tri) && visible(presentation) && visible(mode), 'PWA bibliothèque : tri présentation et sélection deviennent accessibles');
      changer(tri,'titre'); await root.attendreAffichage();
      eq(ids(root), ['pwa-a','pwa-b','pwa-z'], 'PWA bibliothèque : le vrai tri reste opérant');
      changer(presentation,'liste'); await root.attendreAffichage();
      ok(!!root.querySelector('.bibliotheque-liste'), 'PWA bibliothèque : la présentation en liste reste opérante');
      mode.click(); await root.attendreAffichage();
      root.querySelector('[data-role=selectionner-affiches]').click(); await root.attendreAffichage();
      eq(visibles(root), ['pwa-a','pwa-b','pwa-z'], 'PWA bibliothèque : les captures de sélection réelles sont conservées');
      const items = [...root.querySelectorAll('.bibliotheque-item')];
      toggle?.click(); await layout(win);
      eq([toggle?.getAttribute('aria-expanded') ?? null,visible(tri)], ['false',false], 'PWA bibliothèque : fermeture effective sans redessiner les résultats');
      eq(visibles(root), ['pwa-a','pwa-b','pwa-z'], 'PWA bibliothèque : fermer le volet conserve la sélection');
      toggle?.click(); await layout(win);
      tri.focus(); frame.style.width = '1280px'; await layout(win);
      ok(!visible(toggle) && visible(tri) && visible(presentation) && visible(mode), 'PWA bibliothèque : commandes directes sur ordinateur');
      ok(doc.activeElement === tri, 'PWA bibliothèque : le focus du tri reste sur le même contrôle au passage ordinateur');
      frame.style.width = '375px'; await layout(win);
      ok(doc.activeElement === tri && visible(tri), 'PWA bibliothèque : le volet ouvert et son focus survivent au retour téléphone');
      ok(root.querySelector('[name=tri]') === tri && root.querySelector('[name=presentation]') === presentation && root.querySelector('[data-role=mode-selection]') === mode, 'PWA bibliothèque : aucun contrôle remplacé lors des changements de largeur');
      ok(items.every((item,i) => root.querySelectorAll('.bibliotheque-item')[i] === item), 'PWA bibliothèque : aucune carte remplacée par le volet ou le redimensionnement');
      eq([tri.value,presentation.value,visibles(root)], ['titre','liste',['pwa-a','pwa-b','pwa-z']], 'PWA bibliothèque : valeurs et sélection inchangées après aller-retour');
      toggle?.click(); frame.style.width = '1280px'; await layout(win);
      ok(visible(tri) && visible(presentation) && visible(mode), 'PWA bibliothèque : ordinateur garde ses commandes même si le volet mobile était fermé');
      frame.style.width = '375px'; await layout(win);
      ok(!visible(tri) && visible(search), 'PWA bibliothèque : retour téléphone retrouve le volet fermé et la recherche directe');
      changer(search,'Beta'); await root.attendreAffichage();
      eq(ids(root), ['pwa-b'], 'PWA bibliothèque : recherche utilisable avec commandes fermées');
      eq([visibles(root),root.querySelector('.bibliotheque-selection').hidden], [[],true], 'PWA bibliothèque : la recherche conserve la règle existante de fin de sélection');
      eq(await db.getSnapshot(), avant, 'PWA bibliothèque : affichage tri et sélection ne modifient aucune donnée locale');
      const livre = await renderListeBibliotheque(ctx,{editionId:'pwa-edition',route:'/books/pwa-edition'}); doc.body.append(livre);
      const ouvrirLivre = livre.querySelector('[data-role=affichage-selection]'); ouvrirLivre?.click(); await layout(win);
      ok(!!ouvrirLivre && ouvrirLivre.getAttribute('aria-controls') !== toggle?.getAttribute('aria-controls'), 'PWA bibliothèque : chaque liste contrôle son propre volet');
      changer(livre.querySelector('[name=tri]'),'page'); await livre.attendreAffichage();
      eq(ids(livre), ['pwa-a','pwa-z'], 'PWA bibliothèque : le tri par page et la portée du livre restent exacts');
      eq([livre.querySelector('[name=editionId]'),livre.querySelector('[name=tri]').value], [null,'page'], 'PWA bibliothèque : le livre ne propose pas de sortir de sa portée');
    } finally { frame.remove(); }
  }); } finally { setUiLocale(locale); }
}
