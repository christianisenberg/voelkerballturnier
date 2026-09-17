// Klassische Skripte funktionieren auch beim direkten Öffnen von index.html.
(() => {
  const message = () => {
    if (document.documentElement.dataset.appReady === 'true') return;
    const status = document.getElementById('connection');
    if (status) status.textContent = 'Die App konnte nicht gestartet werden. Bitte das vollständige App-Paket entpacken und index.html erneut öffnen. Bei einer Online-Seite bitte alle Dateien aus docs hochladen und die Seite neu laden.';
  };
  window.addEventListener('error', message, true);
  window.addEventListener('unhandledrejection', message);
  window.addEventListener('load', message, {once:true});
  setTimeout(message, 6000);
})();
