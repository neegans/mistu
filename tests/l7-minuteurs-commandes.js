import { timerBlock } from '../src/ui/components.js';
const attendre = async f => { for (let i = 0; i < 100; i++) { if (f()) return; await new Promise(r => setTimeout(r, 5)); } throw Error('attente dépassée'); };
const bouton = (node, texte) => [...node.querySelectorAll('button')].find(b => b.textContent === texte);
export async function runL7MinuteursCommandesTests({ eq, ok }) {
  let quota = true; const demandes = [], ouvertures = [];
  const node = timerBlock(30, { seconds_max: 90, apple: true, onRequest: async (channel, secondes) => { demandes.push([channel, secondes]); if (quota) throw Error('quota'); return { id: 'demande-stable' }; }, onOpen: resultat => ouvertures.push(resultat) });
  document.body.append(node);
  try {
    const choix = node.querySelector('select'); choix.value = '90'; choix.dispatchEvent(new Event('change', { bubbles: true }));
    eq(node.querySelectorAll('a[href]').length, 0, 'L7 raccourci : choix seul ne rend pas un lien de lancement');
    const preparer = bouton(node, 'Préparer Raccourcis'); ok(!!preparer, 'L7 raccourci : geste de préparation distinct');
    if (preparer) {
      preparer.click(); await attendre(() => node.textContent.includes('n’a pas été enregistrée'));
      eq(node.querySelectorAll('a[href]').length, 0, 'L7 raccourci : quota ne laisse pas de lien prêt'); eq(choix.value, '90', 'L7 raccourci : quota garde durée choisie');
      quota = false; preparer.click(); await attendre(() => !!node.querySelector('a[href]'));
      eq(demandes, [['shortcut', 90], ['shortcut', 90]], 'L7 raccourci : réessai conserve channel et durée');
      const lien = node.querySelector('a[href]'); eq(new URL(lien.href).searchParams.get('text'), '90', 'L7 raccourci : lien réel porte durée conservée'); eq(lien.textContent, 'Ouvrir Raccourcis', 'L7 raccourci : second geste nommé'); eq(ouvertures.length, 0, 'L7 raccourci : préparation ne déclenche aucune ouverture');
      lien.addEventListener('click', event => event.preventDefault()); lien.click(); await attendre(() => ouvertures.length === 1); eq(ouvertures[0].id, 'demande-stable', 'L7 raccourci : clic séparé signale la demande conservée'); eq(demandes.length, 2, 'L7 raccourci : clic natif ne crée pas une seconde demande');
      choix.value = '30'; choix.dispatchEvent(new Event('change', { bubbles: true })); eq(node.querySelectorAll('a[href]').length, 0, 'L7 raccourci : changer durée invalide seulement le lien préparé');
    }
  } finally { node.dispose?.(); node.remove(); }
  {
    let finir; const attente = new Promise(r => { finir = r; }); let appels = 0;
    const node = timerBlock(20, { apple: true, onRequest: async () => { appels++; await attente; return { id: 'tardive' }; } }); document.body.append(node);
    try {
      const preparer = bouton(node, 'Préparer Raccourcis'); ok(!!preparer, 'L7 raccourci : durée unique prépare aussi avant lien');
      if (preparer) { preparer.click(); preparer.click(); eq(appels, 1, 'L7 raccourci : double clic, une demande'); node.dispose(); finir(); await new Promise(r => setTimeout(r, 0)); eq(node.querySelectorAll('a[href]').length, 0, 'L7 raccourci : résultat après dispose sans lien actif'); }
    } finally { finir(); node.dispose?.(); node.remove(); }
  }
}
