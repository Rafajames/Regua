// Leitor de comentários do técnico (sem IA, funciona offline).
// Separa o texto em frases e classifica cada uma como ação, causa, teste ou pendência.
// Nunca cria conteúdo: apenas reaproveita as frases escritas pelo técnico.

// Remove acentos mantendo o mesmo comprimento do texto (permite cortar o original pelas posições).
const fold = s => [...s].map(c => c.normalize('NFD')[0]).join('').toLowerCase();

const PATTERNS = {
  pending: /\b(aguardand|aguarda |pendent|pendencia|sera necessari|e necessari|necessario (realizar|trocar|substituir|adquirir|solicitar|agendar|retornar)|precisa(ra|mos)? (ser|de|realizar|trocar)|sera (realizad|feit|agendad|enviad|substituid|trocad|verificad)|retornar|retorno (do|da|ao)|agendad|depende d|dependencia|ainda nao|nao foi possivel|sem sucesso|em andamento|solicitad[oa]s? (a |o )?(compra|peca|troca|reposicao))/,
  test: /\b(testad|teste[s]? (realizad|de|feito|com)|realizad[oa]s? (o |os )?testes?|funcionando|funcionamento|funciona normal|voltou a funcionar|voltaram a funcionar|operando|operacional|normalizad|validad|confirmou|confirmaram|confirmad[oa] (o|a|pelo|pela) )/,
  cause: /\b(verificad[oa]s? que|constatad|identificad[oa]s? (que|o problema|a causa|defeito|falha)|o problema (era|estava|foi|e )|a causa|causad[oa]|devido|por conta d|em razao d|motivo|defeit|danificad|queimad|mau contato|mal conectad|desconectad|travad|corrompid|com falha|apresentava|apresentando|estava com|estavam com|sem (sinal|conexao|energia|toner|papel|rede))/,
  action: /\b(foi realizad|foram realizad|realizad[oa]s?|feit[oa]s?|efetuad|executad|substituid|trocad|instalad|reinstalad|configurad|reconfigurad|ajustad|limp[oa]|higienizad|atualizad|reiniciad|conectad|reconectad|removid|formatad|mapead|cadastrad|liberad|desbloquead|redefinid|resetad|aplicad|verificad|analisad|visita|fiz|realizei|troquei|instalei|configurei|ajustei|reiniciei|conectei|atualizei|limpei|substitui|removi|verifiquei)/
};

// Pontos de quebra: pontuação, quebras de linha e " e " / ", " antes de um novo verbo ou conector.
const NEXT = '(?:foi |foram |em seguida|apos|depois|realiz|substitu|troc|instal|reinstal|configur|reconfigur|ajust|reinici|conect|reconect|atualiz|limp|remov|formata|test|verific|constat|identific|aguard|sera |o usuario|a usuaria|o equipamento|o teste|ficou|esta funcionando|voltou|fiz |porem|mas |entretanto)';
const SPLIT = new RegExp('[.;!?\\n]+|,?\\s+e\\s+(?=' + NEXT + ')|,\\s+(?=' + NEXT + ')', 'g');

function sentences(text) {
  const original = String(text || '').replace(/\r\n?/g, '\n');
  const folded = fold(original);
  const out = [];
  let last = 0, m;
  SPLIT.lastIndex = 0;
  while ((m = SPLIT.exec(folded))) {
    out.push(original.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[0].length === 0) SPLIT.lastIndex++;
  }
  out.push(original.slice(last));
  return out.map(clean).filter(s => s.length >= 4);
}

function clean(s) {
  let t = String(s || '').trim()
    .replace(/^\d{1,2}\/\d{1,2}(\/\d{2,4})?\s*(às|as)?\s*/i, '')
    .replace(/^\d{1,2}[:h]\d{2}\s*[-–—:]?\s*/i, '')
    .replace(/^[-•*]\s*/, '')
    .replace(/^(e|então|entao|assim|depois disso|após isso|apos isso|em seguida|porém|porem|mas)\s*,?\s+/i, '')
    .trim();
  if (!t || /^(apos isso|após isso|depois disso|em seguida|então|entao|assim)[,.]?$/i.test(t)) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function classifySentence(sentence) {
  const f = fold(sentence);
  if (PATTERNS.pending.test(f)) return 'pending';
  let best = null, bestIndex = Infinity;
  for (const kind of ['test', 'cause', 'action']) {
    const m = f.match(PATTERNS[kind]);
    if (m && m.index < bestIndex) { best = kind; bestIndex = m.index; }
  }
  return best;
}

const join = (list, sep) => list.map(s => s.replace(/[.\s]+$/, '') + '.').join(sep);

/**
 * Extrai do comentário: action, cause, test e pending (strings, vazias quando não encontradas).
 * Ações ficam uma por linha; as demais em texto corrido.
 */
export function extractFromComments(text) {
  const groups = { action: [], cause: [], test: [], pending: [] };
  const unclassified = [];
  for (const s of sentences(text)) {
    const kind = classifySentence(s);
    if (kind) groups[kind].push(s); else unclassified.push(s);
  }
  return {
    action: join(groups.action, '\n'),
    cause: join(groups.cause, ' '),
    test: join(groups.test, ' '),
    pending: join(groups.pending, ' '),
    unclassified
  };
}
