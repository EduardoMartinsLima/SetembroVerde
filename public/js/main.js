// Helpers compartilhados pelas páginas da Trilha da Inclusão CAR.
// Nenhum dado pessoal é coletado: não há nome, e-mail, matrícula ou login.

async function enviarParticipacao(endpoint, payload, { onSucesso, onErro } = {}) {
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(dados.erro || 'Não foi possível enviar. Tente novamente.');
    onSucesso && onSucesso(dados);
  } catch (err) {
    onErro && onErro(err.message || 'Não foi possível enviar. Tente novamente.');
  }
}

function configurarCompartilhar(botaoId) {
  const botao = document.getElementById(botaoId);
  if (!botao) return;
  botao.addEventListener('click', async () => {
    const dados = { title: document.title, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(dados); } catch { /* usuário cancelou */ }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        botao.textContent = 'Link copiado!';
        setTimeout(() => (botao.textContent = 'Compartilhar'), 2000);
      } catch {
        window.prompt('Copie o link da página:', window.location.href);
      }
    }
  });
}
