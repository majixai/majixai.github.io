(function () {
  'use strict';

  const form = document.getElementById('request-form');
  const preview = document.getElementById('command-preview');
  const previewButton = document.getElementById('preview-button');
  const history = document.getElementById('history');

  const readForm = () => Object.fromEntries(new FormData(form).entries());

  const renderHistory = (items) => {
    history.innerHTML = '';
    if (!items.length) {
      history.innerHTML = '<p class="text-secondary mb-0">No requests saved yet.</p>';
      return;
    }

    items.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'history-item';
      article.innerHTML = `
        <div class="small text-secondary">${item.created_at || ''}</div>
        <code></code>
      `;
      article.querySelector('code').textContent = item.command || '';
      history.appendChild(article);
    });
  };

  const updatePreview = async () => {
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readForm()),
    });
    const data = await response.json();
    if (!response.ok) {
      preview.textContent = data.message || 'Unable to build preview.';
      return;
    }
    preview.textContent = data.command;
  };

  const saveRequest = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readForm()),
    });
    const data = await response.json();
    if (!response.ok) {
      preview.textContent = data.message || 'Unable to save request.';
      return;
    }
    preview.textContent = data.item.command;
    renderHistory(data.items || []);
  };

  previewButton.addEventListener('click', updatePreview);
  form.addEventListener('submit', saveRequest);
  form.addEventListener('input', () => {
    window.clearTimeout(window.__modelPreviewTimer);
    window.__modelPreviewTimer = window.setTimeout(updatePreview, 250);
  });

  updatePreview().catch(() => {});
})();
