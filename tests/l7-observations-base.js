import { Database } from '../src/core/db.js';

export async function runL7ObservationsBaseTests({eq,ok}) {
  const {signalerCommit,observerBase}=await import('../src/core/observations-base.js');
  const tour=async()=>{await Promise.resolve();await Promise.resolve();};
  const canaux=[];
  const creerCanal=nom=>{
    const c={nom,messages:[],ferme:false,postMessage(message){this.messages.push(message);},close(){this.ferme=true;},addEventListener(type,fn){this[type]=fn;},removeEventListener(type,fn){if(this[type]===fn)delete this[type];}};
    canaux.push(c);return c;
  };
  const base={name:'l7-observer',stores:{cook_sessions:{},timer_launches:{},recipes:{}}}, autre={...base,name:'autre-base'};
  let courante=true;const changements=[];
  const stop=observerBase({base,estCourante:()=>courante,surChangement:info=>changements.push(info),creerCanal});
  eq(changements.length,0,'L7 observations : abonnement sans faux changement');
  signalerCommit(autre,['cook_sessions']);await tour();eq(changements.length,0,'L7 observations : base étrangère ignorée');
  signalerCommit(base,['timer_launches']);signalerCommit(base,['cook_sessions','timer_launches']);await tour();
  eq(changements.length,1,'L7 observations : écritures du même tour regroupées');
  eq(changements[0]?.magasins,['cook_sessions','timer_launches'],'L7 observations : magasins distincts sans contenu métier');
  eq(changements[0]?.base,base,'L7 observations : référence locale de base conservée');
  ok(canaux[0].messages.every(m=>Object.keys(m).sort().join(',')==='format,magasins'),'L7 observations : aucune recette, propriétaire ou preuve envoyée au canal');
  const avant=canaux[0].messages.length;
  canaux[0].message?.({data:{format:1,magasins:['timer_launches']}});await tour();
  eq(changements.length,2,'L7 observations : réception interonglets déclenche une relecture');
  eq(canaux[0].messages.length,avant,'L7 observations : pas de boucle de retransmission');
  for(const data of [null,{},[],{format:2,magasins:['recipes']},{format:1,magasins:['inconnu']},{format:1,magasins:['recipes'],row:{id:'intrus'}},{format:1,magasins:'recipes'},{format:1,magasins:Array(201).fill('recipes')}])canaux[0].message?.({data});
  await tour();eq(changements.length,2,'L7 observations : messages mal formés ignorés');
  courante=false;signalerCommit(base,['recipes']);canaux[0].message?.({data:{format:1,magasins:['recipes']}});await tour();
  eq(changements.length,2,'L7 observations : portée périmée sans notification');
  courante=true;signalerCommit(base,['recipes']);stop();await tour();
  eq(changements.length,2,'L7 observations : travail différé ignoré après destruction');
  ok(canaux[0].ferme&&!canaux[0].message,'L7 observations : canal et listener libérés');
  stop();signalerCommit(base,['recipes']);await tour();eq(changements.length,2,'L7 observations : destruction idempotente');
  const sans=[];const stopSans=observerBase({base,surChangement:i=>sans.push(i),creerCanal:()=>{throw Error('indisponible');}});
  signalerCommit(base,['recipes']);await tour();eq(sans.length,1,'L7 observations : mutations locales observées sans BroadcastChannel');stopSans();
  let n=0;const stopErreur=observerBase({base,surChangement:()=>{n++;throw Error('vue détruite');},creerCanal:()=>null});
  signalerCommit(base,['recipes']);await tour();eq(n,1,'L7 observations : exception de vue ne rejette pas un commit');stopErreur();

  const db=new Database('l7-observations-'+crypto.randomUUID(),1,{rows:{keyPath:'id'}});const traces=[];
  const stopDb=observerBase({base:db,surChangement:async info=>traces.push({magasins:info.magasins,rows:await db.getAll('rows')}),creerCanal:()=>null});
  try {
    await db.put('rows',{id:'a',value:1});await tour();for(let i=0;i<10&&!traces.length;i++)await new Promise(r=>setTimeout(r,5));
    eq(traces[0]?.rows,[{id:'a',value:1}],'L7 observations : écriture effectivement lisible avant notification');
    const avantRefus=traces.length;
    try{await db.mutate({puts:{rows:[{id:'b',value:2}]},conditions:{rows:[{key:'a',absente:true}]}});}catch{}
    await tour();eq(traces.length,avantRefus,'L7 observations : transaction annulée sans notification');
    eq(await db.get('rows','b'),undefined,'L7 observations : transaction annulée sans effet partiel');
    await db.mutate({conditions:{rows:[{key:'a',fusion:c=>({...c,value:3})}]}});await tour();for(let i=0;i<10&&traces.length===avantRefus;i++)await new Promise(r=>setTimeout(r,5));
    eq(traces.at(-1)?.rows,[{id:'a',value:3}],'L7 observations : fusion conditionnée notifiée après commit');
    const avantLecture=traces.length;
    await db.mutate({conditions:{rows:[{key:'a',fusion:()=>null}]}});await tour();
    eq(traces.length,avantLecture,'L7 observations : garde sans écriture ne fabrique aucun changement');
  }finally{stopDb();db.idb?.close();indexedDB.deleteDatabase(db.name);}
}
