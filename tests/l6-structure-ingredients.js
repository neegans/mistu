export async function runL6StructureIngredientsTests({eq,ok}) {
  const {lireStructureIngredients:lire,validerStructureIngredients:valider,remapperStructureIngredients:remapper,deplacerBlocIngredients:deplacer,transformerIngredientEnTitre:enTitre,transformerTitreEnIngredient:enIngredient}=await import('../src/domain/structure-ingredients.js');
  const ingredients=[{id:'i1',name_text:'Levain',quantity:{value:50},verification_state:'verified'},{id:'i2',name_text:'Pâte miso'},{id:'i3',name_text:'Sauce soja'}];
  const structure={format:1,blocks:[{kind:'heading',id:'h1',text:'Pour le pain'},{kind:'ingredient',ingredient_id:'i1'},{kind:'ingredient',ingredient_id:'i2'},{kind:'heading',id:'h2',text:'Finition'},{kind:'ingredient',ingredient_id:'i3'}]};
  eq(lire({ingredients}).etat,'legacy','L6 structure : aucun groupe inféré des noms culinaires');
  eq(lire({ingredients,ingredient_structure:null}).etat,'invalide','L6 structure : null présent n’est pas legacy');
  const v=valider(structure,ingredients);ok(v.ok,'L6 structure : groupes séparés valides');v.structure.blocks[0].text='ailleurs';eq(structure.blocks[0].text,'Pour le pain','L6 structure : résultat indépendant');
  eq(lire({ingredients,ingredient_structure:structure}).blocks,structure.blocks,'L6 structure : lecture conserve l’ordre et les identités');
  const invalides=[
    [{...structure,inconnu:true},'structure_invalide'],
    [{...structure,blocks:[...structure.blocks,{kind:'ingredient',ingredient_id:'i1'}]},'couverture_invalide'],
    [{...structure,blocks:structure.blocks.filter(x=>x.ingredient_id!=='i1')},'couverture_invalide'],
    [{...structure,blocks:structure.blocks.map(x=>x.ingredient_id==='i1'?{...x,ingredient_id:'etranger'}:x)},'couverture_invalide'],
    [{...structure,blocks:[structure.blocks[0],structure.blocks[2],structure.blocks[1],...structure.blocks.slice(3)]},'ordre_invalide'],
    [{...structure,blocks:structure.blocks.map(x=>x.id==='h1'?{...x,id:'i1'}:x)},'identites_invalides'],
    [{...structure,blocks:structure.blocks.map(x=>x.id==='h1'?{...x,quantity:1}:x)},'structure_invalide'],
    [{...structure,blocks:structure.blocks.map(x=>x.id==='h1'?{...x,text:''}:x)},'titre_invalide'],
    [{...structure,blocks:structure.blocks.map(x=>x.id==='h1'?{...x,text:'\ud800'}:x)},'titre_invalide'],
    [{...structure,blocks:structure.blocks.map(x=>x.id==='h1'?{...x,text:'😀'.repeat(301)}:x)},'bornes'],
  ];
  for(const [s,raison]of invalides)eq(valider(s,ingredients),{ok:false,raison},'L6 structure refuse '+raison);
  ok(valider({...structure,blocks:structure.blocks.map(x=>x.id==='h1'?{...x,text:'😀'.repeat(300)}:x)},ingredients).ok,'L6 structure : borne en points Unicode');
  ok(!valider(structure,[...ingredients,{...ingredients[0]}]).ok,'L6 structure : ingrédients dupliqués refusés');
  ok(!valider(structure,[{name_text:'ancien'},...ingredients.slice(1)]).ok,'L6 structure : ancienne ligne sans ID non réparée');
  ok(valider({format:1,blocks:[{kind:'heading',id:'h',text:'Sans aliment'}]},[]).ok,'L6 structure : groupe documentaire vide admis');
  const modele={metadata:{original_title:'Pain'},contenu:{ingredients,steps:[{id:'s1',text:'Cuire.\nPuis servir.'}],ingredient_structure:structure}};
  const moved=deplacer(modele,'i2',1);ok(moved.ok,'L6 structure : déplacement de bloc');eq(moved.modele.contenu.ingredient_structure.blocks.map(x=>x.id||x.ingredient_id),['h1','i1','h2','i2','i3'],'L6 structure : déplacement sans recréer ID');eq(moved.modele.contenu.ingredients,ingredients,'L6 structure : changement de groupe conserve ordre alimentaire exact');
  const group=deplacer(modele,'h2',-1,{groupe:true});eq(group.modele.contenu.ingredients.map(x=>x.id),['i3','i1','i2'],'L6 structure : groupe entier déplace aussi aliments');eq(group.modele.contenu.ingredient_structure.blocks.map(x=>x.id||x.ingredient_id),['h2','i3','h1','i1','i2'],'L6 structure : titre et descendants indivisibles');
  eq(deplacer(modele,'h1',-1).modele,modele,'L6 structure : bord sans mutation');eq(modele.contenu.ingredients,ingredients,'L6 structure : source immuable');
  const converted=enTitre(modele,'i1',{headingId:'h3',texte:'Levain'});ok(converted.ok,'L6 structure : transformation explicite admise');eq(converted.modele.contenu.ingredients.map(x=>x.id),['i2','i3'],'L6 structure : titre retiré des aliments');eq(ingredients[0].quantity,{value:50},'L6 structure : ancienne quantité conservée dans parent');
  const inverse=enIngredient(converted.modele,'h3',{ingredientId:'i4'});ok(inverse.ok,'L6 structure : inverse explicite admis');eq(inverse.modele.contenu.ingredients.map(x=>x.id),['i4','i2','i3'],'L6 structure : inverse remet aliment à place exacte');eq(inverse.modele.contenu.ingredients[0].quantity,null,'L6 structure : inverse ne devine pas une quantité');eq(inverse.modele.contenu.ingredients[0].verification_state,'to_verify','L6 structure : inverse reste à vérifier');
  eq(enTitre(modele,'i1',{headingId:'h2',texte:'Levain'}).ok,false,'L6 structure : transformation refuse collision');
  const after=ingredients.map(x=>({...x,id:'n'+x.id}));const remap=remapper(structure,ingredients,after,ingredients.map(x=>({avant:x.id,apres:'n'+x.id})));
  ok(remap.ok,'L6 structure : remap explicite complet');eq(remap.structure.blocks[0],structure.blocks[0],'L6 structure : remap conserve titre');eq(remap.structure.blocks[1].ingredient_id,'ni1','L6 structure : remap cite nouvel ID exact');ok(!remapper(structure,ingredients,after,[]).ok,'L6 structure : aucune similarité de nom pour remap');ok(!remapper(structure,ingredients,after,[{avant:'i1',apres:'ni1'},{avant:'i1',apres:'ni2'}]).ok,'L6 structure : mapping ambigu refusé');
  eq(modele.contenu.steps[0].text,'Cuire.\nPuis servir.','L6 structure : aucun reparse des étapes');
}
