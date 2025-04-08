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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const StructureViewProvider_1 = require("./StructureViewProvider"); // Import the new provider
// --- Helper Functions ---
function escapePath(p) {
    // Escape single quotes for PowerShell strings and normalize path separators
    return p.replace(/'/g, "''").replace(/\//g, '\\');
}
// *** CORRECTED HELPER FUNCTION ***
function contentForHereString(lines) {
    // No escaping needed for literal Here-String content (@'...')
    return lines.join('\n');
}
// --- Main Activation Function ---
function activate(context) {
    console.log('Extension "gemini-structure-generator" is now active!');
    // --- Register the Webview View Provider ---
    const provider = new StructureViewProvider_1.StructureViewProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(StructureViewProvider_1.StructureViewProvider.viewType, provider));
    // --- Register the command that the Webview will call ---
    context.subscriptions.push(vscode.commands.registerCommand('gemini-structure-generator.processPastedJson', async (rawJsonString) => {
        // Get the current workspace folder
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open. Please open the folder where you want to generate the structure.');
            return;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const jsonFilePath = path.join(workspaceRoot, 'conteudo.json');
        // --- Clean the input string ---
        let cleanedJsonString = rawJsonString.trim();
        cleanedJsonString = cleanedJsonString.replace(/^\s*```(?:json)?\s*\n?/, '');
        cleanedJsonString = cleanedJsonString.replace(/\n?\s*```\s*$/, '');
        try {
            // 1. Parse the CLEANED JSON first
            let data;
            try {
                data = JSON.parse(cleanedJsonString);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Invalid JSON format after cleaning fences: ${error instanceof Error ? error.message : String(error)}`);
                return; // Stop processing
            }
            // 2. Write the CLEANED string to file AFTER successful parse
            try {
                fs.writeFileSync(jsonFilePath, cleanedJsonString, 'utf-8');
                vscode.window.showInformationMessage('conteudo.json has been updated/created.');
            }
            catch (writeError) {
                vscode.window.showErrorMessage(`Failed to write to conteudo.json: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
                // return; // Consider stopping
            }
            // 3. Generate and Execute PowerShell Script, passing extensionPath
            await generateAndExecuteScript(data, workspaceRoot, context.extensionPath); // Pass extensionPath
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error processing structure generation: ${error instanceof Error ? error.message : String(error)}`);
            console.error("Structure Generation Error:", error);
        }
    }));
}
// --- Function to Generate and Execute the Script ---
// Added extensionPath parameter
async function generateAndExecuteScript(data, workspaceRoot, extensionPath) {
    let baseDir = '';
    let errorOverlayFinalPath = '';
    // --- Determine Base Directory from commands ---
    if (data.comando_no_terminal && Array.isArray(data.comando_no_terminal)) {
        const mkdirRegex = /^\s*mkdir\s+["']?([^"']+)["']?/;
        for (const cmd of data.comando_no_terminal) {
            const match = cmd.match(mkdirRegex);
            if (match && match[1]) {
                baseDir = match[1];
                break;
            }
        }
    }
    if (!baseDir) {
        vscode.window.showWarningMessage('Could not determine base directory from "comando_no_terminal". error-overlay.js might be placed incorrectly if not created by commands.');
    }
    errorOverlayFinalPath = path.join(workspaceRoot, baseDir, 'error-overlay.js');
    // --- Read Error Overlay Content from src/texto.txt ---
    let errorOverlaySourceContent = '';
    try {
        const templatePath = path.join(extensionPath, 'src', 'texto.txt');
        errorOverlaySourceContent = fs.readFileSync(templatePath, 'utf-8');
    }
    catch (readError) {
        vscode.window.showErrorMessage(`Failed to read src/texto.txt: ${readError instanceof Error ? readError.message : String(readError)}`);
        return;
    }
    // --- Prepare PowerShell Script Lines ---
    const scriptLines = [];
    let terminal;
    // --- Add Structure Commands ---
    if (data.comando_no_terminal && Array.isArray(data.comando_no_terminal) && data.comando_no_terminal.length > 0) {
        scriptLines.push('# --- Executing Structure Commands from JSON ---');
        data.comando_no_terminal.forEach(cmd => {
            if (typeof cmd === 'string') {
                if (!cmd.includes('error-overlay.js')) {
                    scriptLines.push(cmd);
                }
                else {
                    console.log(`Skipping command that might interfere with error-overlay.js creation: ${cmd}`);
                }
            }
        });
        scriptLines.push('');
    }
    else {
        if (!baseDir) {
            vscode.window.showWarningMessage('No structure commands found and base directory could not be determined.');
        }
    }
    // --- Add Content Writing Commands for PARTE N ---
    scriptLines.push('# --- Writing File Contents (PARTE N) ---');
    let contentCommandsAdded = false;
    for (const key in data) {
        if (key.startsWith("PARTE ") && key !== "PARTE ESTRUTURAL") {
            const parte = data[key];
            if (parte && typeof parte === 'object' && !Array.isArray(parte) && parte.arquivo && Array.isArray(parte.codigo)) {
                const filePath = path.join(workspaceRoot, parte.arquivo);
                if (path.normalize(filePath).toLowerCase() === path.normalize(errorOverlayFinalPath).toLowerCase()) {
                    console.log(`Skipping PARTE entry for error-overlay.js, will be handled later.`);
                    continue;
                }
                // *** USE CORRECTED HELPER FUNCTION ***
                const fileContent = contentForHereString(parte.codigo);
                scriptLines.push(`$content = @'\n${fileContent}\n'@`);
                scriptLines.push(`Set-Content -Path '${escapePath(filePath)}' -Value $content -Encoding UTF8 -ErrorAction Stop`);
                scriptLines.push('');
                contentCommandsAdded = true;
            }
            else if (key !== "texto_final" && key !== "comando_no_terminal") {
                vscode.window.showWarningMessage(`Invalid format or missing data for ${key} in conteudo.json. Skipping content write.`);
            }
        }
    }
    // --- Add Content Writing Command for error-overlay.js (using content from texto.txt) ---
    scriptLines.push('');
    scriptLines.push('# --- Writing error-overlay.js ---');
    const errorOverlayDir = path.dirname(errorOverlayFinalPath);
    scriptLines.push(`New-Item -Path '${escapePath(errorOverlayDir)}' -ItemType Directory -ErrorAction SilentlyContinue | Out-Null`);
    // Use content read from the source file directly
    // *** NO LONGER NEED TO ESCAPE HERE EITHER ***
    scriptLines.push(`$errorOverlayContent = @'\n${errorOverlaySourceContent.trim()}\n'@`);
    scriptLines.push(`Set-Content -Path '${escapePath(errorOverlayFinalPath)}' -Value $errorOverlayContent -Encoding UTF8 -ErrorAction Stop`);
    scriptLines.push('');
    // --- Execute Script in Terminal ---
    const commandsToExecute = scriptLines.filter(line => line && line.trim() && !line.trim().startsWith('#'));
    if (commandsToExecute.length > 0) {
        terminal = vscode.window.terminals.find(t => t.name === "Structure Generator");
        if (!terminal || terminal.exitStatus !== undefined) {
            terminal = vscode.window.createTerminal({
                name: "Structure Generator",
                shellPath: "powershell.exe"
            });
        }
        terminal.show();
        terminal.sendText(`cd '${escapePath(workspaceRoot)}'`);
        scriptLines.forEach(line => {
            if (line && line.trim()) {
                terminal?.sendText(line);
            }
        });
        vscode.window.showInformationMessage('Structure generation commands sent to terminal.');
    }
    else {
        vscode.window.showErrorMessage('No structure or content commands were generated to execute.');
    }
}
// --- Deactivation Function (keep as before) ---
function deactivate() { }
//# sourceMappingURL=extension.js.map