import {el} from '../src/core/dom.js';
import {segmented,field} from '../src/ui/components.js';

export async function runL9LisibiliteTests({ok,eq}) {
  const feuille=el('link',{rel:'stylesheet',href:new URL('../styles.css',import.meta.url).href});
  await new Promise((resolve,reject)=>{feuille.onload=resolve;feuille.onerror=reject;document.head.append(feuille);});
  try {
  const racine=el('section',{style:{width:'240px'}},
    el('button',{class:'btn small'},'Modifier'),
    segmented([{value:'a',label:'Une option'},{value:'b',label:'Une autre'}],'a',()=>{}),
    el('div',{class:'row'},el('div',{class:'repas-planification stack'},field('Jour',el('input',{type:'date',value:'2026-10-30'})))));
  document.body.append(racine);
  const taille=document.documentElement.style.fontSize;
  try {
    const petit=racine.querySelector('.btn.small').getBoundingClientRect();
    ok(petit.height>=44&&petit.width>=44,'L9 : petite commande reste une cible44px');
    ok([...racine.querySelectorAll('.segmented button')].every(n=>n.getBoundingClientRect().height>=44),'L9 : sélecteurs offrent une cible44px');
    document.documentElement.style.fontSize='200%';
    const date=racine.querySelector('input'),cadre=racine.getBoundingClientRect();
    ok(date.getBoundingClientRect().right<=cadre.right+.5,'L9 : jour natif tient dans sa colonne à texte200%');
    eq(date.value,'2026-10-30','L9 : contrainte de largeur conserve le jour civil');
  } finally {document.documentElement.style.fontSize=taille;racine.remove();}

  const couleurs=[['Texte','.muted','var(--paper)',4.5],['Avertissement','.status.warn','var(--warn-bg)',4.5],['Bouton','.btn.primary','var(--action)',4.5],['Information','.btn.sage','var(--accent-bg)',4.5]];
  const luminance=s=>{const v=s.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
  for(const [nom,classes,fond,seuil]of couleurs){
    const node=el('span',{class:classes.slice(1).replaceAll('.',' '),style:{background:fond}},nom);document.body.append(node);
    try {const css=getComputedStyle(node),a=luminance(css.color),b=luminance(css.backgroundColor),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);ok(ratio>=seuil,`L9 : contraste réel ${nom} atteint${seuil}:1`);}finally{node.remove();}
  }
  } finally {feuille.remove();}
}
