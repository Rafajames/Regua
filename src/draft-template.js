// Modelo de redação determinístico da Régua.
// Funciona sem internet e sem IA: usa somente o que o técnico registrou.
// Quando falta informação, insere marcadores [CONFIRMAR: ...] em vez de inventar.

export const DEFAULT_SIGNATURE = 'Jamerson Rafael\nAnalista de Field Service';

export const SATISFACTION_SURVEY =
  'Após o término do chamado, será encaminhado ao(à) senhor(a) um e-mail contendo uma pesquisa de satisfação, com o intuito de avaliar o atendimento prestado.';

const PENDING_PATTERN = /(aguardando|pendente|pend[eê]ncia|terceiro|depend[eê]ncia|retorno do|agendad|em andamento|não (foi )?conclu)/i;
const CLOSURE_PATTERN = /(encerro o chamado|chamado (foi |será |sera )?encerrado|encerramento do chamado|finalizo o chamado|chamado (foi )?finalizado)/i;

const clean = value => String(value ?? '').replace(/\r\n?/g, '\n').trim();

export function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'bom dia';
  if (hour < 18) return 'boa tarde';
  return 'boa noite';
}

export function hasPendingSignals(...texts) {
  return PENDING_PATTERN.test(texts.map(clean).join(' '));
}

function formatProcedures(action) {
  const lines = clean(action)
    .split(/\n|;\s*/)
    .map(line => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean);
  if (!lines.length) return '[CONFIRMAR: informar o procedimento realizado]';
  return lines.map(line => '- ' + line.replace(/\.?$/, '.')).join('\n');
}

function formatSignature(signature) {
  const lines = clean(signature || DEFAULT_SIGNATURE).split('\n').map(l => l.trim()).filter(Boolean);
  return lines.join('\n\n');
}

/**
 * Monta o texto no padrão de referência sem IA.
 * O encerramento só é declarado quando o técnico confirma que o chamado está apto
 * e não há pendência registrada.
 */
export function buildStandardDraft({ action = '', cause = '', test = '', notes = '', comments = '', closureConfirmed = false, signature = DEFAULT_SIGNATURE, date = new Date() } = {}) {
  const warnings = [];
  const pending = clean(notes);
  const pendingDetected = hasPendingSignals(notes, comments);
  const canClose = closureConfirmed && !pendingDetected;

  if (!clean(action)) warnings.push('Ação realizada não informada: o texto contém marcador [CONFIRMAR].');
  if (closureConfirmed && pendingDetected) warnings.push('Há indícios de pendência nos comentários ou observações. O encerramento não foi incluído; revise antes de encerrar.');
  if (!closureConfirmed) warnings.push('Encerramento não confirmado pelo técnico: o texto não declara o chamado encerrado.');

  const parts = [
    `Prezado(a) Sr(a), ${greetingFor(date)}!`,
    'Conforme solicitado, o seguinte procedimento foi realizado:',
    formatProcedures(action)
  ];
  if (clean(cause)) parts.push('Causa identificada: ' + clean(cause).replace(/\.?$/, '.'));
  if (clean(test)) parts.push('Validação: ' + clean(test).replace(/\.?$/, '.'));

  if (canClose) {
    parts.push('Sendo assim, encerro o chamado.');
    parts.push(SATISFACTION_SURVEY);
  } else if (pending) {
    parts.push('Pendência: ' + pending.replace(/\.?$/, '.'));
    parts.push('O atendimento permanece em andamento até a conclusão da pendência informada.');
  } else if (!closureConfirmed) {
    parts.push('[CONFIRMAR: informar se o atendimento foi concluído ou qual é o próximo passo]');
  }

  parts.push('Qualquer dúvida, estaremos à disposição.');
  parts.push('Atenciosamente,');
  parts.push(formatSignature(signature));

  return { draft: parts.join('\n\n'), warnings, closureIncluded: canClose };
}

/**
 * Verifica se um texto (gerado por IA ou editado) declara encerramento sem confirmação.
 */
export function checkClosureClaims(draft, closureConfirmed) {
  const warnings = [];
  if (!closureConfirmed && CLOSURE_PATTERN.test(String(draft || ''))) {
    warnings.push('O texto declara encerramento, mas o técnico não confirmou que o chamado está apto. Remova ou ajuste essa frase antes de copiar.');
  }
  const placeholders = (String(draft || '').match(/\[CONFIRMAR:[^\]]*\]/g) || []).length;
  if (placeholders) warnings.push(`O texto possui ${placeholders} marcador(es) [CONFIRMAR] que precisam ser preenchidos.`);
  return warnings;
}
