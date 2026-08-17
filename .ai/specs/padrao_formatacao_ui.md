# Padrão de Formatação e Estilização de UIs - Gestor de Obras

Este documento estabelece as diretrizes de design, tokens de estilização e melhores práticas visuais que devem ser seguidas em todas as interfaces do **Gestor de Obras**, alinhadas com o design system corporativo focado em relatórios e painéis operacionais.

---

## 1. Tokens de Arredondamento (Border Radius)

Para garantir uma interface profissional, corporativa e sóbria, limitamos o uso de cantos excessivamente arredondados:

| Elemento | Classe Tailwind | Utilização |
| :--- | :--- | :--- |
| **Painéis & Cards Principais** | `rounded-md` | Contêineres de conteúdo, painéis de controle, formulários e cartões informativos. |
| **Campos de Input & Selects** | `rounded-md` | Caixas de texto, seletores suspensos e inputs de formulário. |
| **Botões & Ações** | `rounded-md` | Botões de ação primária, secundária e botões utilitários. |
| **Badges & Tags Pequenas** | `rounded-md` ou `rounded` | Selos indicadores de status, severity ou tipo de faturamento. |

> [!IMPORTANT]
> **Evitar:** O uso de classes como `rounded-2xl`, `rounded-3xl` ou `rounded-xl` em contêineres principais, pois quebram a consistência do design system administrativo.

---

## 2. Sombras (Box Shadow)

Sombras devem ser discretas para evitar poluição visual e cansaço cognitivo durante a leitura de relatórios extensos:

*   **Padrão para Cards e Painéis:** `shadow-2xs` (sombra extremamente sutil).
*   **Modais e Gavetas Suspensas (Sobreposições):** `shadow-md` ou `shadow-lg` com fundo semi-transparente fosco (`bg-slate-900/60` ou `backdrop-blur-sm`).

---

## 3. Diretrizes de Bordas (Borders)

As bordas definem os limites dos dados e devem possuir cores sólidas para garantir acessibilidade e legibilidade:

*   **Tema Claro (Padrão):** `border border-slate-200`. Evitar variações de opacidade como `border-slate-200/80` que dificultam o contraste.
*   **Tabelas e Listas:** `divide-y divide-slate-200` com borda externa `border border-slate-200`.

---

## 4. Paleta de Cores e Semântica de Feedback

As cores seguem uma lógica semântica rígida ligada aos resultados operacionais das obras:

| Significado | Cor Tailwind | Aplicação no Dashboard / DRE |
| :--- | :--- | :--- |
| **Primário/Destaque** | Azul Gestor (`#005daa` / `bg-[#eff6ff]`) | Cabeçalhos, botões principais, links de navegação. |
| **Sucesso / Operação Saudável** | Verde (`emerald-500` / `bg-emerald-50`) | Lançamentos pagos, homologado ativo, receita líquida. |
| **Alerta / Margem Curta** | Laranja (`amber-500` / `bg-amber-50`) | Faturamentos pendentes, cmv no limite, auditoria necessária. |
| **Erro / Atraso** | Vermelho (`red-500` / `bg-red-50`) | Lançamentos rejeitados, certidões expiradas, atraso físico. |
| **Processamento / Tecnologia** | Roxo/Índigo (`indigo-600` / `bg-indigo-50`) | Sincronizações, logs e visualização de token. |

---

## 5. Diretrizes de Tipografia

*   **Títulos e Destaques Premium:** Fonte `Inter` ou `Outfit` com peso extra-negrito (`font-black` ou `font-extrabold`).
*   **Textos de Suporte e Explicações:** `Inter` com peso regular/médio, tamanho de fonte confortável (`text-xs` ou `text-sm`).
*   **Dados e Métricas Monetárias (DRE/Fórmulas):** Sempre formatados com fonte monoespaçada (`font-mono`) e peso negrito para facilitar a comparação visual em colunas.

---

---

## 7. Diretrizes de Layout e Navegação Retrátil (Sidebar)

O menu de navegação lateral (`Sidebar.tsx`) deve seguir padrões rigorosos de transição e responsividade:

*   **Larguras Padrão**:
    *   **Expandido:** `w-64` (`256px`).
    *   **Colapsado:** `w-20` (`80px`).
*   **Transição Suave:** `transition-all duration-300` aplicada tanto no container da `aside` quanto no container de conteúdo principal (`App.tsx`).
*   **Acessibilidade e Tooltips:** No modo colapsado, todo botão deve manter `title="..."` preenchido com a ação do botão (ex: "Suporte", "Logout", "Novo Chamado") e ocultar o texto descritivo via `!isCollapsed`.
*   **Alinhamento de Ícones:** No modo colapsado, usar `justify-center p-3` para manter os ícones perfeitamente centralizados vertical e horizontalmente.
*   **Botão de Alternância (Toggle):** Posicionado com `absolute -right-3 top-6`, formato circular (`rounded-full w-6 h-6`), sombra sutil e borda alinhada com o divisor do menu (`border-[#c0c7d6]`).
