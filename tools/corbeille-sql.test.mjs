import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifierCorbeilleSQL} from './corbeille-sql.mjs';

test('L1 : générateur écrit, vérifie puis refuse une migration altérée',()=>{
  const root=mkdtempSync(join(tmpdir(),'mistu-l1-sql-'));
  try {
    mkdirSync(join(root,'supabase/migrations'),{recursive:true});
    verifierCorbeilleSQL({root,check:false});verifierCorbeilleSQL({root});
    const path=join(root,'supabase/migrations/0008_corbeille_recettes.sql');
    writeFileSync(path,readFileSync(path,'utf8')+'-- altération\n');
    assert.throws(()=>verifierCorbeilleSQL({root}),/non conforme/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
