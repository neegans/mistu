-- 0006 — le quatrième outil de la passerelle, lecture-web (lot B « Recette web complète », spec 2026-10-19-recette-web § 3.7, § 6.4).
-- Écrite à la main, comme 0004 (hors du générateur). Le `check` de colonne de 0004 ne connaît que trois outils : sans 0006,
-- assistant_reserver('lecture-web') échoue en 23514 et la fonction répond 502 à chaque lecture web. La contrainte admet CINQ valeurs : la
-- cinquième, image-web, sert le lot F, qui n'écrira aucune migration (R-B-6 = R-F-1) ; OUTILS (logique.js) n'en porte que quatre, et une
-- valeur admise de plus dans un check est inoffensive tant qu'OUTILS ne la porte pas. Rien d'autre ne change :
-- ni table, ni fonction, ni privilège (la vue, assistant_reserver et les revoke de 0004 tiennent).
begin;
alter table public.assistant_journal drop constraint assistant_journal_outil_check;
alter table public.assistant_journal add constraint assistant_journal_outil_check check (outil in ('recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web'));
commit;
