
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructureViewProvider = void 0;
const vscode = __importStar(require("vscode"));
class StructureViewProvider {
    _extensionUri;
    _context;
    static viewType = 'geminiStructureView';
    _view;
    constructor(_extensionUri, _context) {
        this._extensionUri = _extensionUri;
        this._context = _context;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'generateStructure':
                    vscode.commands.executeCommand('ai-structure-generator.processPastedStructure', message.text);
                    return;
                case 'showError':
                    vscode.window.showErrorMessage(message.text);
                    return;
            }
        }, undefined, this._context.subscriptions);
    }
    _getHtmlForWebview(webview) {
        const nonce = getNonce();
        const placeholder = `Cole a estrutura aqui... Exemplo:

PARTE ESTRUTURAL:
<texto>Aqui está a estrutura base:</texto>
<estrutura>
.
├── css/
│   └── style.css
└── index.html
</estrutura>

<comando>mkdir css</comando>

<codigo ref="./index.html">
<!DOCTYPE html>
<html>
...
</html>
</codigo>

<codigo ref="./css/style.css">
body {
  margin: 0;
}
</codigo>
`;
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Structure Generator Input</title>
                <style>
                    /* Estilos gerais */
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 10px;
                        height: 100vh;
                        display: flex;
                        flex-direction: column;
                        box-sizing: border-box; /* Inclui padding na altura total */
                    }
                    label {
                        display: block;
                        margin-bottom: 5px;
                        font-size: 0.9em;
                        flex-shrink: 0; /* Não permite que o label encolha */
                    }
                    textarea {
                        flex-grow: 1; /* Tenta crescer para preencher o espaço */
                        width: calc(100% - 12px); /* Largura total menos borda */
                        margin-bottom: 10px;
                        border: 1px solid var(--vscode-input-border);
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                        padding: 5px;
                        resize: none;
                        white-space: pre; /* Preserva espaços/quebras de linha no placeholder */
                        overflow-y: auto; /* Adiciona barra de rolagem vertical se necessário */

                        /* *** NOVO: Limita a altura máxima *** */
                        max-height: 90vh; /* Limita a altura a 70% da altura da viewport */
                        /* Ou use um valor fixo se preferir, ex: max-height: 500px; */
                        /* Removemos flex-shrink:0 para permitir encolher se necessário */
                    }
                    button {
                        padding: 8px 15px;
                        cursor: pointer;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: 1px solid var(--vscode-button-border);
                        border-radius: 3px;
                        align-self: flex-start;
                        flex-shrink: 0; /* Não permite que o botão encolha */
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <label for="structureInput">Cole o texto da estrutura aqui:</label>
                <textarea id="structureInput" placeholder="${placeholder.replace(/"/g, '"')}"></textarea>
                <button id="generateButton">Generate Structure</button>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const generateButton = document.getElementById('generateButton');
                    const structureInput = document.getElementById('structureInput');

                    generateButton.addEventListener('click', () => {
                        const text = structureInput.value;
                        if (text && text.trim().length > 0) {
                            vscode.postMessage({
                                command: 'generateStructure',
                                text: text
                            });
                        } else {
                             vscode.postMessage({
                                command: 'showError',
                                text: 'Por favor, cole o texto da estrutura na área designada.'
                            });
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}
exports.StructureViewProvider = StructureViewProvider;
// Função getNonce permanece a mesma
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=StructureViewProvider.js.map