// Aplica o tema antes da primeira pintura para evitar o "piscar" do tema claro.
(function () {
  var mode = 'system';
  try { mode = localStorage.getItem('regua-theme') || 'system'; } catch (e) { /* armazenamento bloqueado */ }
  var dark = mode === 'dark' || (mode === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
