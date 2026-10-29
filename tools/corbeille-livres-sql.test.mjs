import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('L2 : migration 0009 générée et vérifiée sans réécrire 0008 ; altération détectée',async()=>{
  const {verifierCorbeilleLivresSQL}=await import('./corbeille-livres-sql.mjs');
  const root=mkdtempSync(join(tmpdir(),'mistu-l2-sql-'));
  try {
    mkdirSync(join(root,'supabase/migrations'),{recursive:true});
    const ancien=join(root,'supabase/migrations/0008_corbeille_recettes.sql');writeFileSync(ancien,'historique inchangé');
    verifierCorbeilleLivresSQL({root,check:false});verifierCorbeilleLivresSQL({root});
    assert.equal(readFileSync(ancien,'utf8'),'historique inchangé');
    const path=join(root,'supabase/migrations/0009_corbeille_livres.sql');writeFileSync(path,readFileSync(path,'utf8')+'-- altération\n');
    assert.throws(()=>verifierCorbeilleLivresSQL({root}),/non conforme/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
