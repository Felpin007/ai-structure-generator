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
    static viewType = 'geminiStructureView'; // Must match the view ID in package.json
    _view;
    constructor(_extensionUri, _context // Pass context if needed for state
    ) {
        this._extensionUri = _extensionUri;
        this._context = _context;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from our extension's directory.
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'generateStructure':
                    // Send the pasted content to the extension's main logic
                    vscode.commands.executeCommand('gemini-structure-generator.processPastedJson', message.text);
                    return;
                case 'showError':
                    vscode.window.showErrorMessage(message.text);
                    return;
            }
        }, undefined, this._context.subscriptions);
    }
    // Optional: Add a method to send messages to the webview if needed later
    // public sendMessage(message: any) {
    //     if (this._view) {
    //         this._view.webview.postMessage(message);
    //     }
    // }
    _getHtmlForWebview(webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        // const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <!--
                    Use a content security policy to only allow loading images from https or from our extension directory,
                    and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Structure Generator Input</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 10px;
                        height: 100vh;
                        display: flex;
                        flex-direction: column;
                    }
                    textarea {
                        flex-grow: 1; /* Take remaining height */
                        width: calc(100% - 20px); /* Full width minus padding */
                        margin-bottom: 10px;
                        border: 1px solid var(--vscode-input-border);
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                        padding: 5px;
                        resize: none; /* Disable manual resize */
                    }
                    button {
                        padding: 8px 15px;
                        cursor: pointer;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: 1px solid var(--vscode-button-border);
                        border-radius: 3px;
                        align-self: flex-start; /* Align button to the left */
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    label {
                        display: block;
                        margin-bottom: 5px;
                        font-size: 0.9em;
                    }
                </style>
            </head>
            <body>
                <label for="jsonInput">Paste JSON content here:</label>
                <textarea id="jsonInput" placeholder='Paste the JSON structure here...\n{\n  "comando_no_terminal": [\n    "mkdir my-project",\n    "cd my-project",\n    ...\n  ],\n  "PARTE 1": {\n    "arquivo": "my-project/file.txt",\n    "codigo": [\n      "Line 1",\n      "Line 2"\n    ]\n  },\n  ...\n}'></textarea>
                <button id="generateButton">Generate Structure</button>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const generateButton = document.getElementById('generateButton');
                    const jsonInput = document.getElementById('jsonInput');

                    generateButton.addEventListener('click', () => {
                        const text = jsonInput.value;
                        if (text && text.trim().length > 0) {
                            try {
                                // Basic validation: Check if it's likely JSON
                                JSON.parse(text); 
                                vscode.postMessage({
                                    command: 'generateStructure',
                                    text: text
                                });
                            } catch (e) {
                                vscode.postMessage({
                                    command: 'showError',
                                    text: 'Invalid JSON pasted: ' + (e instanceof Error ? e.message : String(e))
                                });
                            }
                        } else {
                             vscode.postMessage({
                                command: 'showError',
                                text: 'Please paste JSON content into the text area.'
                            });
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}
exports.StructureViewProvider = StructureViewProvider;
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=StructureViewProvider.js.map