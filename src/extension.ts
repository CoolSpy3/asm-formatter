// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const validLineRegex = /^(\s*)(?:(\S+)(\s+)(db|dw|dd|dq|equ)(\s+)\S.*|(\S+),(\s*)(?:,(\s*)([^;]+\S)(\s*);.*))/;
const labelRegex = /^(\s*)(\S+)(\s+)(db|dw|dd|dq|equ)(\s+)\S.*/;
const commandRegex = /^(\s*)(\S+),(\s*)(?:,(\s*)([^;]+\S)(\s*);.*)/;

function findSectionEnd(document: vscode.TextDocument, lineRangeStart: number): number {

	while (!validLineRegex.test(document.lineAt(lineRangeStart).text)) lineRangeStart++;

	const tabSizeOrAuto = vscode.window.activeTextEditor?.options.tabSize ?? 4;
	const tabSize = typeof tabSizeOrAuto === 'string' ? 4 : tabSizeOrAuto;

	const leadingWhitespaceCount = validLineRegex.exec(document.lineAt(lineRangeStart).text)?.[0].replaceAll("\t", " ".repeat(tabSize)).length ?? 0;

	let lineRangeEnd = lineRangeStart;

	while (lineRangeEnd < document.lineCount) {
		let line = document.lineAt(lineRangeEnd);
		if (line.text.trim() == "") {
			break;
		}
		lineRangeEnd++;
	}

	return lineRangeEnd;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let providerRegistration = vscode.languages.registerDocumentFormattingEditProvider(['asm', 'masm', 'nasm'], {
		provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
			let edits: vscode.TextEdit[] = [];

			let lineRangeStart = 0;

			while (lineRangeStart < document.lineCount) {

				let lineRangeEnd = findSectionEnd(document, lineRangeStart);

			}

			return edits;
		}
	});

	context.subscriptions.push(providerRegistration);
}

// this method is called when your extension is deactivated
export function deactivate() { }
