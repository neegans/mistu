// Filet de secours si le module de tests ne charge pas, sorti de index.html (durcissement : aucun script inline, spec § 6.2).
window.addEventListener('error', (e) => { document.getElementById('out').innerHTML = '<div class="ko">Erreur de chargement : ' + e.message + '</div>'; });
