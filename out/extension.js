"use strict";
// extension.ts (Modificado)
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const StructureViewProvider_1 = require("./StructureViewProvider");
// --- Helper Functions (Manter como antes) ---
function escapePath(p) {
    // Normaliza para barras invertidas e escapa apóstrofos para PowerShell
    const normalized = p.replace(/\//g, '\\');
    // Garante que não comece com \ se for relativo, pois será juntado com workspaceRoot
    const relativePath = normalized.startsWith('\\') ? normalized.substring(1) : normalized;
    return relativePath.replace(/'/g, "''");
}
function contentForHereString(lines) {
    // Junta as linhas para o Here-String do PowerShell. NENHUM escape extra é necessário aqui.
    // Apenas precisamos garantir que a string não contenha '@ sozinhos em uma linha,
    // o que é raro em código, mas pode acontecer. Por segurança, podemos substituir,
    // embora seja um caso extremo. Vamos manter simples por enquanto.
    return lines.join('\n');
}
// --- Nova Função de Parsing ---
function parseCustomFormat(inputText) {
    const operations = [];
    // Regex para encontrar <comando>...</comando> OU <codigo ref="...">...</codigo>
    // g = global, i = case-insensitive (para tags), s = dotall (. corresponde a newline)
    const tagRegex = /<comando>(.*?)<\/comando>|<codigo ref="(.*?)">(.*?)<\/codigo>/gis;
    let match;
    // Limpa o início opcional "PARA CRIAÇÃO/EDIÇÃO" etc.
    let relevantText = inputText.split(/^-{5,}\s*$/m).pop() || inputText; // Pega a parte depois da última linha '----'
    relevantText = relevantText.replace(/<texto>.*?<\/texto>/gis, '');
    while ((match = tagRegex.exec(relevantText)) !== null) {
        if (match[1] !== undefined) { // É um <comando>
            const command = match[1].trim();
            if (command) { // Evita adicionar comandos vazios
                operations.push({ type: 'command', value: command });
            }
        }
        else if (match[2] !== undefined && match[3] !== undefined) { // É um <codigo>
            const filePath = match[2].trim();
            // Divide o conteúdo em linhas, tratando diferentes tipos de newline
            const codeContent = match[3].trim().split(/\r?\n/);
            if (filePath) { // Garante que o path não está vazio
                operations.push({ type: 'code', value: filePath, content: codeContent });
            }
        }
    }
    // Poderíamos adicionar aqui um log ou tratamento se nenhuma operação for encontrada
    if (operations.length === 0) {
        console.warn("Nenhuma operação <comando> ou <codigo> encontrada no input.");
        vscode.window.showWarningMessage("Nenhuma operação <comando> ou <codigo> válida encontrada no texto fornecido.");
    }
    return operations;
}
// --- Main Activation Function ---
function activate(context) {
    console.log('Extension "ai-structure-generator" (adaptado) is now active!');
    // --- Register the Webview View Provider ---
    const provider = new StructureViewProvider_1.StructureViewProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(StructureViewProvider_1.StructureViewProvider.viewType, provider));
    // --- Register the command (renomeado para refletir a mudança) ---
    context.subscriptions.push(vscode.commands.registerCommand('ai-structure-generator.processPastedStructure', async (rawInputText) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Nenhuma pasta de workspace aberta. Abra a pasta onde deseja gerar a estrutura.');
            return;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        // Opcional: Salvar o texto bruto recebido
        const rawInputPath = path.join(workspaceRoot, 'last_structure_input.txt');
        // --- Limpar o input (remover fences se ainda usados por acidente) ---
        let cleanedInput = rawInputText.trim();
        cleanedInput = cleanedInput.replace(/^\s*```.*\s*\n?/, ''); // Remove ```tipo no início
        cleanedInput = cleanedInput.replace(/\n?\s*```\s*$/, ''); // Remove ``` no final
        try {
            // 1. Parse o texto com o novo formato
            const operations = parseCustomFormat(cleanedInput);
            if (operations.length === 0) {
                // Mensagem já mostrada pelo parser, mas podemos evitar continuar
                return;
            }
            // 2. Opcional: Escrever o texto bruto recebido
            try {
                fs.writeFileSync(rawInputPath, cleanedInput, 'utf-8');
                vscode.window.showInformationMessage('last_structure_input.txt foi atualizado/criado.');
            }
            catch (writeError) {
                vscode.window.showErrorMessage(`Falha ao escrever em last_structure_input.txt: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
                // Continuar mesmo assim? Ou retornar? Decidi continuar.
            }
            // 3. Gerar e Executar Script PowerShell com base nas operações
            await generateAndExecuteScript(operations, workspaceRoot);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Erro ao processar geração de estrutura: ${error instanceof Error ? error.message : String(error)}`);
            console.error("Structure Generation Error:", error);
        }
    }));
}
// --- Function to Generate and Execute the Script ---
async function generateAndExecuteScript(operations, workspaceRoot) {
    const scriptLines = [];
    let terminal;
    scriptLines.push('# --- Executando Operações de Estrutura e Conteúdo ---');
    scriptLines.push('');
    operations.forEach((op, index) => {
        if (op.type === 'command') {
            scriptLines.push(`# Comando ${index + 1}`);
            scriptLines.push(op.value); // Adiciona o comando diretamente
            scriptLines.push('');
        }
        else if (op.type === 'code' && op.content) {
            // Trata caminhos relativos corretamente a partir do workspaceRoot
            const filePath = path.join(workspaceRoot, op.value); // op.value é o path do <codigo ref="...">
            const fileDir = path.dirname(filePath);
            scriptLines.push(`# Escrevendo Arquivo ${index + 1}: ${op.value}`);
            // Garante que o diretório existe ANTES de tentar escrever o arquivo
            scriptLines.push(`New-Item -Path '${escapePath(fileDir)}' -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null`); // -Force para não dar erro se já existir
            const fileContent = contentForHereString(op.content);
            scriptLines.push(`$content = @'\n${fileContent}\n'@`);
            // Usar escapePath no caminho final do arquivo
            scriptLines.push(`Set-Content -Path '${escapePath(filePath)}' -Value $content -Encoding UTF8 -Force -ErrorAction Stop`); // -Force para sobrescrever se existir
            scriptLines.push('');
        }
    });
    // --- Execute Script in Terminal ---
    // Filtrar linhas vazias ou comentários para verificar se há algo a executar
    const commandsToExecute = scriptLines.filter(line => line && line.trim() && !line.trim().startsWith('#'));
    if (commandsToExecute.length > 0) {
        terminal = vscode.window.terminals.find(t => t.name === "Structure Generator");
        if (!terminal || terminal.exitStatus !== undefined) {
            terminal = vscode.window.createTerminal({
                name: "Structure Generator",
                shellPath: "powershell.exe",
                // cwd: workspaceRoot // Definir o diretório de trabalho inicial
            });
        }
        terminal.show();
        // Garante que estamos no diretório correto do workspace antes de executar
        // Usa escapePath aqui também para o caminho do workspace
        terminal.sendText(`cd '${escapePath(workspaceRoot)}'`);
        // Envia cada linha do script gerado para o terminal
        scriptLines.forEach(line => {
            if (line.trim()) { // Evita enviar linhas totalmente vazias
                terminal?.sendText(line);
            }
        });
        vscode.window.showInformationMessage('Comandos de geração de estrutura enviados ao terminal.');
    }
    else {
        vscode.window.showWarningMessage('Nenhum comando ou operação de escrita de arquivo foi gerado para executar.');
    }
}
// --- Deactivation Function (keep as before) ---
function deactivate() { }
//# sourceMappingURL=extension.js.map