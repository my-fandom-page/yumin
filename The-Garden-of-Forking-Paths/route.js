(() => {
  const choice = document.querySelector('.route-option.dormant');
  const result = document.getElementById('missed-route');

  if (!choice || !result) return;

  choice.addEventListener('click', () => {
    const opening = choice.getAttribute('aria-expanded') !== 'true';
    choice.setAttribute('aria-expanded', String(opening));
    result.hidden = !opening;

    if (opening && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
})();
