// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { formatLine, getLineType, getParams, updateParams } from './formatting';

function getTabSize(): number {
    const tabSizeOrAuto = vscode.window.activeTextEditor?.options.tabSize ?? 4;
    return typeof tabSizeOrAuto === 'string' ? 4 : tabSizeOrAuto;
}

function getLineWhitespaceCount(line: string, tabSize: number = getTabSize()): number {
    return /^(\s*)\S/.exec(line)?.[1]?.replaceAll("\t", " ".repeat(tabSize)).length ?? 0;
}

function findSectionEnd(document: vscode.TextDocument, lineRangeStart: number): number {

	const tabSize = getTabSize();

	const leadingWhitespaceCount = getLineWhitespaceCount(document.lineAt(lineRangeStart).text, tabSize);
	const lineType = getLineType(document.lineAt(lineRangeStart).text);

	for (var lineRangeEnd = lineRangeStart; lineRangeEnd < document.lineCount; lineRangeEnd++) {
		const line = document.lineAt(lineRangeEnd);
		// if (line.isEmptyOrWhitespace) { continue; }
		if (getLineWhitespaceCount(line.text, tabSize) !== leadingWhitespaceCount) { break; }
		if (!getLineType(line.text)) { continue; }
		if (getLineType(line.text) !== lineType) { break; }
	}

	return lineRangeEnd;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(['asm', 'masm', 'mips', 'nasm'], {
		provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
			let edits: vscode.TextEdit[] = [];

			let lineRangeStart = 0;

			while (lineRangeStart < document.lineCount) {

				while (lineRangeStart < document.lineCount && !getLineType(document.lineAt(lineRangeStart).text)) { lineRangeStart++; }
				if (lineRangeStart >= document.lineCount) { break; }

				const lineRangeEnd = findSectionEnd(document, lineRangeStart);
				let line = document.lineAt(lineRangeStart);
				const lineType = getLineType(line.text);

				if(!lineType) {
					console.warn(`Could not identify line \"${line.text}\" despite being identified as a valid line! Skipping to line ${lineRangeEnd}...`);
					lineRangeStart = lineRangeEnd;
					continue;
				}

				function printCouldNotMatchWarning() {
					console.warn(`Could not match line \"${line.text}\" to type ${lineType}!`);
				}

				// Calculate lengths
				let params = getParams(line.text, lineType);

				if(!params) {
					console.warn(`Could not identify line \"${line.text}\" despite being identified as a valid line! Skipping to line ${lineRangeEnd}...`);
					lineRangeStart = lineRangeEnd;
					continue;
				}

				for (let i = lineRangeStart + 1; i < lineRangeEnd; i++) {

					line = document.lineAt(i);
					if (!getLineType(line.text)) { continue; }

					let nParams = getParams(line.text, lineType);

					if(!nParams) {
						printCouldNotMatchWarning();
						continue;
					}

					updateParams(params, nParams);

				}

				// Apply Formatting
				for (let i = lineRangeStart; i < lineRangeEnd; i++) {
					line = document.lineAt(i);
					if (!getLineType(line.text)) { continue; }

					let formattedLine = formatLine(line.text, lineType, params);

					if (formattedLine && line.text !== formattedLine) { edits.push(vscode.TextEdit.replace(line.range, formattedLine)); }
				}

				lineRangeStart = lineRangeEnd;

			}

			return edits;
		}
	}));

}

// this method is called when your extension is deactivated
export function deactivate() { }
