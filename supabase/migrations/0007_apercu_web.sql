-- 0007 — le sixième outil de la passerelle, apercu-web (lot UI-2 « Aperçus des résultats web », spec 2026-10-23-experience-carnet § 6, D-UI-14).
-- Écrite à la main, comme 0004 et 0006 (hors du générateur et de --check). Le `check` de colonne du journal, tel que 0006 l'a laissé, ne connaît que
-- cinq outils : sans 0007, l'insert d'assistant_reserver('apercu-web') échoue en 23514, la réservation échoue, aucune ligne n'est écrite et la fonction
-- répond 502 à chaque demande d'aperçus — l'app montre alors les résultats sans image (comportement dégradé de D-UI-13, jamais une erreur bloquante).
-- DDL transactionnel : le drop et l'add tiennent dans UNE transaction, aucune fenêtre sans contrainte (un verrou de quelques millisecondes sur une petite
-- table). Rien d'autre ne change : ni table, ni fonction, ni privilège (la vue, assistant_reserver et les revoke de 0004 tiennent). La preuve 0006 devient
-- historique : rejouée après 0007, son 1.01 (cinq valeurs) rougit, c'est attendu.
begin;
alter table public.assistant_journal drop constraint assistant_journal_outil_check;
alter table public.assistant_journal add constraint assistant_journal_outil_check check (outil in ('recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web', 'apercu-web'));
commit;
