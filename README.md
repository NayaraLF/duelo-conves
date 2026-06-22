# Batalha do Convés - Battle App 🎤

Aplicativo web projetado para facilitar o sorteio, chaveamento e gerenciamento de batalhas de rimas (MCs), com regras específicas e uma interface dinâmica e responsiva. Ideal para ser usado ao vivo durante os eventos.

## 🌟 Funcionalidades

### 1. Cadastro de MCs
* Adição rápida de participantes com validação (evita nomes duplicados).
* Limite máximo de até 22 MCs por torneio.
* Contador dinâmico e lista para remover/editar entradas.
* Botão para gerar o chaveamento habilitado apenas após o cadastro mínimo de 2 participantes.

### 2. Algoritmo de Chaveamento Inteligente
* Geração automática das chaves de batalha adaptada para números pares ou ímpares de participantes.
* **Regras Especiais:**
  * Tratamento para batalhas de **Trios** em rodadas para balancear o chaveamento em caso de números ímpares (maior que 3).
  * Chaves de avanço direto (**"Bye" / Direta**) caso necessário.
  * Garantia de que a **Grande Final será sempre 1v1** (sem trios na final).

### 3. Fase 1: Sorteio Ao Vivo
* Sorteio interativo e às cegas usando números, ideal para engajar o público ao vivo.
* **Painel de Referência (Cola):** Lista recolhível relacionando os nomes dos MCs aos números correspondentes.
* **Grade Numérica Interativa:** Botões para escolher os números disponíveis, bloqueando visualmente os já sorteados/usados.
* Construção das batalhas no card passo-a-passo (com possibilidade de anular sorteios errados antes de formar a batalha).
* Identificação clara se a batalha é um "1v1", "Trio" ou "Avanço Direto".

### 4. Torneio (Fase 2 em diante)
* Seleção do vencedor de cada batalha com apenas um toque no nome.
* Em batalhas de **Trio**:
  * É necessário selecionar 2 vencedores inicialmente para ir ao desempate, ou, dependendo da estrutura, apontar os finalistas.
  * Área exclusiva de desempate gerada na hora caso a votação peça.
* Bloqueios de segurança para só liberar a próxima fase após todos os duelos estarem com resultados definidos.

### 5. Consagração do Campeão e Chaveamento Visual
* Tela especial de celebração para revelar o grande campeão da edição.
* **Visualizador de Chaveamento:** Um modal contendo a árvore completa do torneio desenhada num `<canvas>`.
* **Download da Chave:** Botão para exportar o chaveamento desenhado como uma imagem (PNG) para compartilhar nas redes sociais ou guardar de histórico.
* Opção rápida de reiniciar o app para uma **Nova Batalha**.

### 6. Interface e Experiência do Usuário (UI/UX)
* Notificações (Toasts) amigáveis para erros (como limites atingidos ou nomes duplicados).
* Design adaptado e pensado com foco no fluxo real de um mestre de cerimônias conduzindo no celular/tablet.
* Transições contínuas e estilização fluida, garantindo que a tela nunca fique travada ou confusa.

---

## 🚀 Como Rodar o Projeto Localmente

O projeto é construído em HTML, CSS (Vanilla) e JavaScript puro (sem dependências externas de pacotes `npm`), focado em performance no navegador.

1. Faça o clone do repositório:
   ```bash
   git clone https://github.com/NayaraLF/duelo-conves.git
   ```
2. Entre na pasta do projeto:
   ```bash
   cd duelo-conves
   ```
3. Abra o arquivo `index.html` em seu navegador de preferência.
   * *Opcional:* Se preferir utilizar o Live Server (VSCode), basta clicar em "Go Live" com o arquivo `index.html` aberto.

## 🌐 Deploy

Como a aplicação é "client-side" puro (apenas arquivos estáticos de Frontend), você pode hospedá-la em serviços gratuitos em minutos:

* **GitHub Pages (Recomendado)**
  1. Vá até a aba "Settings" (Configurações) do repositório no GitHub.
  2. Acesse a seção "Pages" no menu lateral.
  3. Em "Source", selecione a branch principal (`main` ou `master`) e a pasta raiz (`/root`).
  4. Salve e o GitHub irá gerar um link público automaticamente.

* **Vercel / Netlify**
  1. Conecte sua conta do GitHub à Vercel ou Netlify.
  2. Importe este repositório `duelo-conves`.
  3. Não é necessário configurar nenhum "Build command" ou "Output directory" diferente dos padrões oferecidos.
  4. Confirme o deploy.