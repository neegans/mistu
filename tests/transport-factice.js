// Transport scripté pour la suite L3 : chaque appel consomme la réponse suivante de sa liste ; au-delà, la dernière
// est répétée. `lire` est scripté par table : { books: [[lignes page 1], [lignes page 2]] }. Tout appel est journalisé.
export function creerTransportFactice({ pousser = [], lire = {} } = {}) {
  const journal = [];
  const filesLire = Object.fromEntries(Object.entries(lire).map(([t, pages]) => [t, [...pages]]));
  let iPousser = 0;
  return {
    journal,
    async pousser(rows) {
      journal.push({ appel: 'pousser', rows: structuredClone(rows) });
      const r = pousser[Math.min(iPousser, pousser.length - 1)] || { reponse: { server_time: new Date().toISOString(), accepted: rows.map(({ store, id }) => ({ store, id })), adjusted: [], rejected: [] } };
      iPousser += 1;
      return { reponse: r.reponse ? structuredClone(r.reponse) : null, erreur: r.erreur || null };
    },
    async lire(table, apres, limite = 1000) {
      journal.push({ appel: 'lire', table, apres, limite });
      const pages = filesLire[table] || [];
      const page = pages.length ? pages.shift() : [];
      if (page && page.erreur) return { lignes: null, erreur: page.erreur };
      return { lignes: structuredClone(page.filter((l) => l.server_seq > apres).slice(0, limite)), erreur: null };
    },
  };
}
