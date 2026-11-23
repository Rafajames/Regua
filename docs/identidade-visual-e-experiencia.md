# Identidade visual e experiência da Régua

## Direção visual
A Régua adota uma interface profissional, discreta e orientada ao trabalho diário, alinhada à família visual das aplicações do projeto: azul-petróleo/verde e branco, superfícies claras, tipografia de sistema, navegação consistente e componentes reutilizáveis.

## Princípios aplicados
- Hierarquia clara: títulos e ações principais aparecem antes de informações secundárias.
- Menos ruído: cores e componentes são usados quando ajudam a identificar uma ação, estado ou grupo.
- Consistência: navegação, botões, campos, cartões, alertas e estados seguem os mesmos tokens.
- Responsividade: navegação lateral em telas maiores e navegação horizontal compacta em celulares.
- Movimento funcional: transições curtas em navegação, foco, botões e cartões; sem animações decorativas contínuas.
- Acessibilidade: foco visível, contraste e respeito à preferência do sistema por movimento reduzido.
- Offline-first: recursos essenciais são armazenados pelo Service Worker; chamadas externas de IA não são interceptadas nem simuladas.

## Paleta
- Azul-petróleo profundo: #123B3A
- Verde principal: #16866B
- Fundo: #F4F8F6
- Superfície: #FFFFFF
- Verde suave: #EAF5F0
- Texto secundário: #62736F

## Créditos
Concepção e desenvolvimento: **Jamerson Rafael**.

## Referências consultadas
- Nielsen Norman Group — [8 Design Guidelines for Complex Applications](https://www.nngroup.com/articles/complex-application-design/): reduzir excesso visual, tornar informações importantes mais fáceis de localizar e apoiar fluxos de trabalho.
- National Center for State Courts — [A Guide to Data Dashboard Design](https://www.ncsc.org/sites/default/files/media/document/Dashboard-Design-Guide_0.pdf): navegação intuitiva, agrupamento lógico, rótulos claros e hierarquia.
- Chrome for Developers — [Motion, Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/motion): priorizar animações de opacidade/transformação, desempenho e respeito a movimento reduzido.
- Material Design — [Motion](https://m1.material.io/motion/material-motion.html): movimento rápido, coerente e informativo, não meramente decorativo.

## Limite de funcionamento offline
Depois que a página e os arquivos essenciais forem carregados e armazenados no cache, as funções locais podem ser abertas sem conexão. A primeira abertura exige internet. Solicitações aos provedores de IA exigem internet e são enviadas diretamente ao provedor escolhido.
---

## Revisão de 23/11/2026 — alinhamento às cores do MapTec · TJRR
Por decisão do autor, a Régua passou a usar a mesma paleta do MapTec · TJRR (Ache Aqui TJRR), para que as ferramentas do projeto formem uma família visual única. A paleta teal/verde acima fica registrada como histórico.

| Token | Valor | Uso |
|---|---|---|
| Navy | #0A2C63 | barra lateral, títulos, ícone |
| Navy 2 | #0D3A80 | estado hover de botões primários |
| Azul | #0B4FB0 | ações primárias, links, foco de campos |
| Azul suave | #E8F0FB | superfícies de destaque, chips |
| Linha azul | #CFE0F6 | bordas de campos |
| Fundo | #F3F6FB | fundo da aplicação |
| Texto | #14233D | texto principal |
| Texto secundário | #4A5B75 | descrições |
| Âmbar | #E08300 | acento (item ativo do menu, obrigatório, alertas) |
| Foco | #F2A33A | anel de foco acessível (igual ao MapTec) |

Cores semânticas adicionais (necessárias para o resultado dos critérios): verde #1D7A4A (atendido), âmbar (requer revisão) e vermelho #A31515 (não evidenciado — mesmo vermelho de erro do MapTec).

Mudanças de experiência desta revisão:
- CSS consolidado em `assets/styles.css` (antes havia três camadas sobrepostas no `index.html`, uma sobrescrevendo a outra).
- Pré-auditoria em duas colunas no desktop: formulário à esquerda e avaliação fixa à direita, atualizada enquanto se digita — reduz a rolagem para ver o resultado.
- Formulário organizado em três etapas (Abertura, Acompanhamento, Solução) e importação do WhatsApp recolhível.
- Ícones em SVG próprios no menu, estados vazios com orientação, diálogos nativos (`<dialog>`) para detalhes e confirmações.
- Animações curtas (entrada de páginas e cartões, anel de nota, carregamento de botões, pulso ao salvar), todas desativadas com `prefers-reduced-motion`.
