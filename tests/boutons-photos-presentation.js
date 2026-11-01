import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { renderBook } from '../src/ui/book.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';

const attendre = async fn => { const fin = performance.now() + 3000; while (performance.now() < fin) { if (fn()) return; await new Promise(r => setTimeout(r, 0)); } throw Error('Sélecteur attendu non ouvert'); };
const fichier = async () => { const c = document.createElement('canvas'); c.width = 32; c.height = 48; c.getContext('2d').fillRect(0, 0, 32, 48); return new File([await new Promise(r => c.toBlob(r, 'image/jpeg'))], 'photo.jpg', { type: 'image/jpeg' }); };

// Une panne de présentation après une transaction réussie ne doit pas offrir de la rejouer.
export async function runBoutonsPhotosLivrePresentationTests({ eq, ok }) {
  const native = HTMLInputElement.prototype.click, locale = getUiLocale();
  HTMLInputElement.prototype.click = function () { if (this.type !== 'file') return native.call(this); };
  setUiLocale('fr');
  try {
    for (const mode of ['recette', 'couverture']) await withRepo(async (repo, db) => {
      await db.mutate({ origin: 'remote', puts: { books: [{ id: 'presentation-book', title: 'Livre témoin' }], book_editions: [{ id: 'presentation-edition', book_id: 'presentation-book' }] } });
      let panne = true, commits = 0;
      const echouerPresentation = () => { if (panne) { panne = false; throw new Error('Présentation indisponible après commit'); } };
      const root = await renderBook({ id: 'presentation-edition' }, { nouveau: '1', panel: 'recette' }, await getData(true), {
        navigate: () => {}, toast: mode === 'recette' ? echouerPresentation : () => {}, refresh: mode === 'couverture' ? echouerPresentation : () => {}
      });
      document.body.append(root);
      const mutate = db.mutate;
      db.mutate = function (options, ...suite) { if (options.origin === 'local') commits++; return mutate.call(this, options, ...suite); };
      try {
        const zone = root.querySelector(mode === 'couverture' ? '.zone-couverture' : '[data-role=ajout-livre]');
        const b = [...zone.querySelectorAll('button')].find(n => n.textContent === 'Photographier'); b.focus(); b.click();
        await attendre(() => document.querySelector('input[type=file]'));
        const input = document.querySelector('input[type=file]');
        Object.defineProperty(input, 'files', { value: [await fichier()], configurable: true }); input.dispatchEvent(new Event('change'));
        await root.attendrePhotos();
        if (mode === 'recette') eq((await repo.all('scan_sessions')).length, 1, 'Photo présentation : le premier commit précède réellement la panne de notification');
        else {
          const edition = await repo.get('book_editions', 'presentation-edition');
          ok(!!edition.cover_sha256 && (await repo.getFile(edition.cover_sha256))?.blob instanceof Blob, 'Photo présentation couverture : octets et pointeur conservés avant le refus de rafraîchissement');
        }
        const retry = root.querySelector('[data-role=reessayer-photo-livre]');
        ok(!retry, `Photo présentation ${mode} : aucune proposition de recommencer une conservation réussie`);
        if (retry) { retry.click(); await root.attendrePhotos(); }
        if (mode === 'recette') {
          eq((await repo.all('scan_sessions')).length, 1, 'Photo présentation : reprise après erreur d’affichage sans séance dupliquée');
          eq((await repo.all('source_pages')).length, 1, 'Photo présentation : les pages conservées ne sont pas dupliquées');
        } else {
          eq(commits, 1, 'Photo présentation couverture : une seule transaction malgré le refus de rafraîchissement');
          ok(root.querySelector('[data-role=etat-photo-livre]').textContent.includes('conservés'), 'Photo présentation couverture : le message reconnaît la conservation réussie');
        }
      } finally {
        document.querySelector('input[type=file]')?.dispatchEvent(new Event('cancel')); await root.attendrePhotos(); db.mutate = mutate; root.dispose(); root.remove();
      }
    });
  } finally { HTMLInputElement.prototype.click = native; setUiLocale(locale); }
}
