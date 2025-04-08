// error-overlay.js (v3 - Depuração Adicional)
(() => {
    'use strict';

    const OVERLAY_ID = 'error-overlay-container';
    const STYLES_ID = 'error-overlay-styles';

    // --- Estilos CSS (Idênticos) ---
    const CSS_STYLES = `
        #${OVERLAY_ID} {
            position: fixed; bottom: 0; left: 0; right: 0; max-height: 35vh;
            overflow-y: auto; background-color: rgba(40, 0, 0, 0.92); color: #ffdddd;
            padding: 0; font-family: 'Consolas', 'Courier New', Courier, monospace;
            font-size: 13px; line-height: 1.4; z-index: 2147483647;
            border-top: 3px solid #ff4444; display: none; /* Começa escondido */
            box-shadow: 0 -2px 10px rgba(0,0,0,0.5);
        }
        #${OVERLAY_ID} * { box-sizing: border-box; }
        #${OVERLAY_ID} .error-controls {
            background-color: rgba(0, 0, 0, 0.4); padding: 8px 12px;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #555; position: sticky; top: 0; z-index: 1; /* Garante que controles fiquem sobre a lista */
        }
        #${OVERLAY_ID} .error-controls span { font-weight: bold; color: #ff8888; }
        #${OVERLAY_ID} button {
            background-color: #555; color: white; border: none; padding: 5px 10px;
            cursor: pointer; font-size: 0.9em; border-radius: 3px; margin-left: 8px;
            transition: background-color 0.2s ease;
        }
        #${OVERLAY_ID} button.copy-btn { background-color: #007bff; }
        #${OVERLAY_ID} button.copy-btn:hover { background-color: #0056b3; }
        #${OVERLAY_ID} button.clear-btn { background-color: #ffc107; color: #333; }
        #${OVERLAY_ID} button.clear-btn:hover { background-color: #e0a800; }
        #${OVERLAY_ID} button.close-btn { background-color: #dc3545; }
        #${OVERLAY_ID} button.close-btn:hover { background-color: #c82333; }
        #${OVERLAY_ID} .error-list {
            padding: 10px 12px;
        }
        #${OVERLAY_ID} pre {
            white-space: pre-wrap; word-wrap: break-word; margin: 8px 0; padding: 8px;
            background-color: rgba(0, 0, 0, 0.3); border-left: 3px solid #ff4444;
            color: #f8f8f2;
        }
        #${OVERLAY_ID} pre:first-child { margin-top: 0; }
        #${OVERLAY_ID} pre:last-child { margin-bottom: 0; }
    `;

    // --- Variáveis do Módulo ---
    let errorOverlay = null; // Será o elemento DOM
    let errorListContainer = null; // Será o elemento DOM
    let copyButton = null; let clearButton = null; let closeButton = null;
    let errorCountSpan = null; // Será o elemento DOM
    const originalConsoleError = console.error;
    let displayedErrors = [];
    let errorCounter = 0;
    let isOverlayReady = false;
    let queuedErrors = [];

    // --- Funções ---

    function injectCSS() { /* ... (igual) ... */
        if (document.getElementById(STYLES_ID)) return;
        const styleElement = document.createElement('style');
        styleElement.id = STYLES_ID;
        styleElement.textContent = CSS_STYLES;
        (document.head || document.documentElement).appendChild(styleElement);
    }
    function formatArguments(args) { /* ... (igual) ... */
        return args.map(arg => {
             if (arg instanceof Error) { return `Error: ${arg.message}\nStack:\n${arg.stack || '(no stack trace)'}`; }
             else if (typeof arg === 'object' && arg !== null) {
                 try {
                     const cache = new Set();
                     return JSON.stringify(arg, (key, value) => {
                         if (typeof value === 'object' && value !== null) { if (cache.has(value)) { return '[Circular Reference]'; } cache.add(value); }
                         return value;
                     }, 2);
                 } catch (e) { return Object.prototype.toString.call(arg); }
             } else if (typeof arg === 'function') { return arg.toString(); }
             else { return String(arg); }
         }).join(' ');
    }

    /** Adiciona a mensagem ao DOM do overlay. */
    function _displayErrorInOverlay(formattedMessage) {
        originalConsoleError(`ErrorOverlay: Tentando exibir no overlay. isOverlayReady=${isOverlayReady}`); // <-- NOVO LOG

        // Re-busca os elementos do DOM como segurança extra
        const currentOverlay = document.getElementById(OVERLAY_ID);
        const currentListContainer = currentOverlay ? currentOverlay.querySelector('.error-list') : null;

        if (!currentOverlay || !currentListContainer) {
            originalConsoleError("ErrorOverlay: Falha CRÍTICA ao exibir - Elementos do overlay não encontrados no DOM neste momento.");
            // Adiciona de volta à fila se possível, talvez o DOM mude? (Pouco provável)
            if (!isOverlayReady) queuedErrors.unshift(formattedMessage);
            return;
        }
         // Atualiza referências globais se necessário (geralmente não precisa, mas por segurança)
         errorOverlay = currentOverlay;
         errorListContainer = currentListContainer;


        originalConsoleError(`ErrorOverlay: Overlay encontrado: ${errorOverlay.id}. Container da lista encontrado: ${errorListContainer.className}`); // <-- NOVO LOG

        const errorElement = document.createElement('pre');
        errorElement.textContent = formattedMessage;

        try {
            errorListContainer.appendChild(errorElement);
             originalConsoleError("ErrorOverlay: Elemento <pre> adicionado ao container da lista."); // <-- NOVO LOG
            displayedErrors.push(formattedMessage);

            // Atualiza contador
            errorCounter++;
            if (errorCountSpan) { // errorCountSpan é definido em createErrorOverlay
                errorCountSpan.textContent = `(${errorCounter} Erro${errorCounter > 1 ? 's' : ''})`;
            } else {
                 // Tenta buscar o span do contador novamente se a referência global falhou
                 const currentControls = errorOverlay.querySelector('.error-controls');
                 if(currentControls) errorCountSpan = currentControls.querySelector('span > span');
                 if(errorCountSpan) errorCountSpan.textContent = `(${errorCounter} Erro${errorCounter > 1 ? 's' : ''})`;
            }


            // Garante que o overlay esteja visível
            const currentDisplay = window.getComputedStyle(errorOverlay).display;
            originalConsoleError(`ErrorOverlay: Estilo display atual: ${currentDisplay}`); // <-- NOVO LOG
            if (currentDisplay === 'none') {
                 errorOverlay.style.display = 'block';
                 originalConsoleError("ErrorOverlay: Definido display para 'block'."); // <-- NOVO LOG
            } else {
                 originalConsoleError("ErrorOverlay: Display já era diferente de 'none'."); // <-- NOVO LOG
            }


            // Rola para o final
            requestAnimationFrame(() => {
                // Usa scrollHeight do container PAI (o overlay)
                errorOverlay.scrollTop = errorOverlay.scrollHeight;
                 originalConsoleError("ErrorOverlay: Rolagem para o final solicitada."); // <-- NOVO LOG
            });

        } catch (appendError) {
            originalConsoleError("ErrorOverlay: ERRO ao tentar adicionar <pre> ao container da lista:", appendError);
        }
    }

    function copyErrorsToClipboard() { /* ... (igual) ... */
        if (displayedErrors.length === 0) { showTemporaryButtonText(copyButton, "Nenhum erro"); return; }
        const allErrorsText = displayedErrors.join('\n\n=====================\n\n');
        navigator.clipboard.writeText(allErrorsText)
            .then(() => showTemporaryButtonText(copyButton, 'Copiado!'))
            .catch(err => { originalConsoleError('Erro ao copiar:', err); showTemporaryButtonText(copyButton, 'Falha'); });
    }
    function clearDisplayedErrors() { /* ... (igual) ... */
        if (!errorListContainer) return;
        errorListContainer.innerHTML = ''; displayedErrors = []; errorCounter = 0;
        if (errorCountSpan) errorCountSpan.textContent = '(0 Erros)';
        showTemporaryButtonText(clearButton, 'Limpado!');
    }
    function showTemporaryButtonText(button, text, duration = 1500) { /* ... (igual) ... */
        if (!button) return; // Adiciona verificação
        const originalText = button.textContent; button.textContent = text; button.disabled = true;
        setTimeout(() => { button.textContent = originalText; button.disabled = false; }, duration);
    }

    /** Cria e injeta os elementos do overlay no DOM. */
    function createErrorOverlay() {
        if (document.getElementById(OVERLAY_ID)) {
            // Se já existe, apenas pega as referências e garante que está pronto
             errorOverlay = document.getElementById(OVERLAY_ID);
             errorListContainer = errorOverlay.querySelector('.error-list');
             const controlsDiv = errorOverlay.querySelector('.error-controls');
             if(controlsDiv){
                 copyButton = controlsDiv.querySelector('.copy-btn');
                 clearButton = controlsDiv.querySelector('.clear-btn');
                 closeButton = controlsDiv.querySelector('.close-btn');
                 errorCountSpan = controlsDiv.querySelector('span > span');
                 // Reanexa listeners caso o script tenha recarregado? (Melhor evitar recarregar)
             }
            if (!isOverlayReady) { // Só processa a fila se não estava pronto antes
                isOverlayReady = true;
                processQueuedErrors();
            }
            return; // Já existe
        }

        // Cria os elementos
        errorOverlay = document.createElement('div'); errorOverlay.id = OVERLAY_ID;
        const controlsDiv = document.createElement('div'); controlsDiv.className = 'error-controls';
        const titleSpan = document.createElement('span'); titleSpan.innerHTML = 'Erros na Página <span>(0 Erros)</span>';
        errorCountSpan = titleSpan.querySelector('span'); // Pega referência

        const buttonGroup = document.createElement('div');
        copyButton = document.createElement('button'); copyButton.textContent = 'Copiar Tudo'; copyButton.className = 'copy-btn'; copyButton.title = 'Copiar todos os erros';
        clearButton = document.createElement('button'); clearButton.textContent = 'Limpar'; clearButton.className = 'clear-btn'; clearButton.title = 'Limpar lista de erros';
        closeButton = document.createElement('button'); closeButton.textContent = 'Fechar'; closeButton.className = 'close-btn'; closeButton.title = 'Esconder painel';

        copyButton.addEventListener('click', copyErrorsToClipboard);
        clearButton.addEventListener('click', clearDisplayedErrors);
        closeButton.addEventListener('click', () => { if (errorOverlay) errorOverlay.style.display = 'none'; });

        buttonGroup.appendChild(copyButton); buttonGroup.appendChild(clearButton); buttonGroup.appendChild(closeButton);
        controlsDiv.appendChild(titleSpan); controlsDiv.appendChild(buttonGroup);

        errorListContainer = document.createElement('div'); errorListContainer.className = 'error-list';

        errorOverlay.appendChild(controlsDiv); errorOverlay.appendChild(errorListContainer);

        // Adiciona ao body
        if (document.body) {
             document.body.appendChild(errorOverlay);
             originalConsoleError("ErrorOverlay: Elementos criados e adicionados ao DOM."); // Log original mantido
             isOverlayReady = true; // <-- MARCA COMO PRONTO AQUI
             processQueuedErrors(); // Processa erros que chegaram antes
        } else {
            originalConsoleError("ErrorOverlay: document.body não encontrado, adiando criação final.");
            document.addEventListener('DOMContentLoaded', () => {
                 if (!document.getElementById(OVERLAY_ID) && document.body) { // Verifica de novo
                    document.body.appendChild(errorOverlay);
                    originalConsoleError("ErrorOverlay: Elementos adicionados ao DOM após DOMContentLoaded.");
                    isOverlayReady = true; // <-- MARCA COMO PRONTO AQUI TAMBÉM
                    processQueuedErrors();
                 } else if (document.getElementById(OVERLAY_ID)) {
                      originalConsoleError("ErrorOverlay: Elemento já existia no DOMContentLoaded.");
                      if(!isOverlayReady){ // Garante que esteja pronto e processe a fila se ainda não estava
                          isOverlayReady = true;
                          processQueuedErrors();
                      }
                 }
            });
        }
    }

    function processQueuedErrors() {
        if (!isOverlayReady) return;
        originalConsoleError(`ErrorOverlay: Processando ${queuedErrors.length} erros enfileirados.`); // <-- NOVO LOG
        while (queuedErrors.length > 0) {
            const msg = queuedErrors.shift();
            _displayErrorInOverlay(msg); // Chama a função que agora tem mais logs
        }
    }

    function init() { /* ... (praticamente igual, só ajusta o console.error) ... */
        if (window.__errorOverlayInitialized) return;
        injectCSS();

        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            createErrorOverlay();
        } else {
             document.addEventListener('DOMContentLoaded', createErrorOverlay);
        }

        // Sobrescreve console.error
        console.error = (...args) => {
            // Log original SEMPRE PRIMEIRO
            originalConsoleError.apply(console, args);

            const formattedMessage = formatArguments(args);

            if (isOverlayReady) {
                originalConsoleError("ErrorOverlay: Chamando _displayErrorInOverlay diretamente."); // <-- NOVO LOG
                _displayErrorInOverlay(formattedMessage);
            } else {
                originalConsoleError("ErrorOverlay: Overlay não pronto, adicionando erro à fila."); // <-- NOVO LOG
                queuedErrors.push(formattedMessage);
            }
        };

        // Captura erros globais (igual)
        window.addEventListener('error', (event) => { /* ... */
            if (event.error && event.error.__alreadyLoggedByOverlay) return;
             let errorMsg = `Erro Global Não Tratado:\n  Mensagem: ${event.message}`;
             if(event.filename) errorMsg += `\n  Arquivo: ${event.filename}:${event.lineno || '?'}:${event.colno || '?'}`;
             if (event.error) { errorMsg += `\n  Tipo: ${event.error.name || '(desconhecido)'}`; console.error(errorMsg, event.error); try { event.error.__alreadyLoggedByOverlay = true; } catch(e) {} }
             else { console.error(errorMsg); }
        });
        // Captura rejeições de Promises (igual)
        window.addEventListener('unhandledrejection', (event) => { /* ... */
             if (event.reason && event.reason.__alreadyLoggedByOverlay) return;
            let reasonMsg = "Rejeição de Promise Não Tratada:\n  Motivo: ";
            console.error(reasonMsg, event.reason);
            if (event.reason instanceof Error) { try { event.reason.__alreadyLoggedByOverlay = true; } catch(e) {} }
        });

        originalConsoleError("ErrorOverlay module inicializado e pronto."); // Log original mantido
        window.__errorOverlayInitialized = true;
    }

    // --- Executa a inicialização ---
    init();

})();
