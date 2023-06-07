// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// For simplicity, we only support spaces between tokens, so we don't use \s
const valueRegex = /((?:[^\s;]|.+(?=[^ ;]))+)/;
const commentRegex = / *;?(.*)/;
const defineRegex = RegExp(/^(\s*)%define *(\S+) */.source + valueRegex.source+ commentRegex.source);
const labelRegex = RegExp(/^(\s*)(\S+) +(db|dw|dd|dq|equ) +/.source + valueRegex.source + commentRegex.source);
const instructionRegex = /([^\s;]+) +([^\s;]+)(?! *,)/; // This is slightly different than the regex on the following line
const commandRegex = RegExp(/^(\s*)([^\s;]+(?: +[^\s;]+(?! *,)))/.source + ("(?: +" + valueRegex.source + ("(?: *, *" + valueRegex.source + ")?)?")) + commentRegex.source);
const validLineRegex = RegExp(`^(?:${defineRegex.source}|${labelRegex.source}|${commandRegex.source})$`);

enum LineType { define, label, command }

function getLineWhitespaceCount(line: string, tabSize: number): number {
	return validLineRegex.exec(line)?.[0].replaceAll("\t", " ".repeat(tabSize)).length ?? 0;
}

function getLineType(line: string): LineType | undefined {
	if (defineRegex.test(line)) { return LineType.define; }
	if (labelRegex.test(line)) { return LineType.label; }
	if (commandRegex.test(line)) { return LineType.command; }
	return undefined;
}

function findSectionEnd(document: vscode.TextDocument, lineRangeStart: number): number {

	const tabSizeOrAuto = vscode.window.activeTextEditor?.options.tabSize ?? 4;
	const tabSize = typeof tabSizeOrAuto === 'string' ? 4 : tabSizeOrAuto;

	const leadingWhitespaceCount = getLineWhitespaceCount(document.lineAt(lineRangeStart).text, tabSize);
	const lineType = getLineType(document.lineAt(lineRangeStart).text);

	for (var lineRangeEnd = lineRangeStart; lineRangeEnd < document.lineCount; lineRangeEnd++) {
		const line = document.lineAt(lineRangeEnd);
		if (!validLineRegex.test(line.text)) { continue; }
		if (getLineWhitespaceCount(line.text, tabSize) !== leadingWhitespaceCount) { break; }
		if (getLineType(line.text) !== lineType) { break; }
	}

	return lineRangeEnd;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(['asm', 'masm', 'nasm'], {
		provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
			let edits: vscode.TextEdit[] = [];

			let lineRangeStart = 0;

			while (lineRangeStart < document.lineCount) {

				while (!validLineRegex.test(document.lineAt(lineRangeStart).text)) { lineRangeStart++; }
				if (lineRangeStart >= document.lineCount) { break; }

				const lineRangeEnd = findSectionEnd(document, lineRangeStart);
				let line = document.lineAt(lineRangeStart);
				const lineType = getLineType(line.text);

				function printCouldNotMatchWarning() { console.warn(`Could not match line \"${line.text}\" to expected regex ${lineType}!`); }

				let nameLength = 0;
				let typeLength = 0;
				let valueLength = 0;
				let instructionLength = 0;
				let singleOperandLength = 0;
				let operand1Length = 0;
				let operand2Length = 0;
				let lineLength = 0;

				// Calculate all of the above lengths (if applicable)
				{
					switch (lineType) {
						case LineType.define: {
							const match = defineRegex.exec(line.text);
							if (match === null) { printCouldNotMatchWarning(); continue; }

							nameLength = match[2].length;
							valueLength = match[3].length;

							lineLength = `%define ${match[2]} ${match[3]}`.length;
							break;
						}

						case LineType.label: {
							const match = labelRegex.exec(line.text);
							if (match === null) { printCouldNotMatchWarning(); continue; }

							nameLength = match[2].length;
							typeLength = match[3].length;
							valueLength = match[4].length;

							lineLength = `${match[2]} ${match[3]} ${match[4]}`.length;
							break;
						}

						case LineType.command: {
							const match = commandRegex.exec(line.text);
							if (match === null) { printCouldNotMatchWarning(); continue; }

							instructionLength = match[2].length;

							if(match[4] === undefined) {
								singleOperandLength = match[3]?.length ?? 0;
							} else {
								operand1Length = match[3]?.length ?? 0;
								operand2Length = match[4].length ?? 0;
							}

							if(match[3] === undefined) {
								lineLength = match[2].length;
							} else if(match[4] === undefined) {
								lineLength = `${match[2]} ${match[3]}`.length;
							} else {
								lineLength = `${match[2]} ${match[3]}, ${match[4]}`.length;
							}

							break;
						}

						default: {
							console.warn(`Could not identify line \"${line.text}\" despite being identified as a valid line! Skipping to line ${lineRangeEnd}...`);
							lineRangeStart = lineRangeEnd;
							continue;
						}
					}

					for (let i = lineRangeStart + 1; i < lineRangeEnd; i++) {

						line = document.lineAt(i);
						if(!validLineRegex.test(line.text)) { continue; }

						switch (lineType) {
							case LineType.define: {
								const match = defineRegex.exec(line.text);
								if (match === null) { printCouldNotMatchWarning(); continue; }

								nameLength = Math.max(nameLength, match[2].length);
								valueLength = Math.max(valueLength, match[3].length);

								lineLength = Math.max(lineLength, `%define ${match[2]} ${match[3]}`.length);
								break;
							}

							case LineType.label: {
								const match = labelRegex.exec(line.text);
								if (match === null) { printCouldNotMatchWarning(); continue; }

								nameLength = Math.max(nameLength, match[2].length);
								typeLength = Math.max(typeLength, match[3].length);
								valueLength = Math.max(valueLength, match[4].length);

								lineLength = Math.max(lineLength, `${match[2]} ${match[3]} ${match[4]}`.length);
								break;
							}

							case LineType.command: {
								const match = commandRegex.exec(line.text);
								if (match === null) { printCouldNotMatchWarning(); continue; }

								instructionLength = Math.max(instructionLength, match[2].length);

								if(match[4] === undefined) {
									singleOperandLength = Math.max(singleOperandLength, match[3]?.length ?? 0);
								} else {
									operand1Length = Math.max(operand1Length, match[3]?.length ?? 0);
									operand2Length = Math.max(operand2Length, match[4].length ?? 0);
								}

								if(match[3] === undefined) {
									lineLength = Math.max(lineLength, match[2].length);
								} else if(match[4] === undefined) {
									lineLength = Math.max(lineLength, `${match[2]} ${match[3]}`.length);
								} else {
									lineLength = Math.max(lineLength, `${match[2]} ${match[3]}, ${match[4]}`.length);
								}

								break;
							}

							default: {
								printCouldNotMatchWarning();
								continue;
							}
						}

					}
				}

				// Apply the calculated lengths
				{
					function getConditionalValue(sectionLength: number, prevValue: string, match: string | undefined, hasComma: boolean = false): string {
						return match === undefined ? "" : `${" ".repeat(sectionLength - prevValue.length + 1)}${match}`;
					}

					for(let i = lineRangeStart; i < lineRangeEnd; i++) {
						line = document.lineAt(i);
						if(!validLineRegex.test(line.text)) { continue; }

						switch (lineType) {
							case LineType.define: {
								const match = defineRegex.exec(line.text);
								if (match === null) { printCouldNotMatchWarning(); continue; }

								var formattedLine = `${match[1]}%define ${match[2]}${" ".repeat(nameLength - match[2].length + 1)}${match[3]}`;

								formattedLine += getConditionalValue(lineLength, formattedLine.substring(match[1].length), match[4]);

								break;
							}

							case LineType.label: {
								const match = labelRegex.exec(line.text);
								if (match === null) { printCouldNotMatchWarning(); continue; }

								var formattedLine = `${match[1]}${match[2]}${" ".repeat(nameLength - match[2].length + 1)}${match[3]}${" ".repeat(typeLength - match[3].length + 1)}${match[4]}`;

								formattedLine += getConditionalValue(lineLength, formattedLine.substring(match[1].length), match[5]);

								break;
							}

							case LineType.command: {
								const match = commandRegex.exec(line.text);
								if (match === null) { printCouldNotMatchWarning(); continue; }

								function addSpaceToConditionalValue(val: string): string { return val === undefined ? "" : `${val} `; }
								function formatInstruction(cmd: string): string {
									const parsedInstruction = instructionRegex.exec(cmd);
									return parsedInstruction === null ? cmd : `${parsedInstruction[1]} ${parsedInstruction[2]}`;
								}

								var formattedLine = `${match[1]}${formatInstruction(match[2])}${getConditionalValue(nameLength, match[2], match[3])}${getConditionalValue(operand1Length, match[3], match[4], true)}`;

								formattedLine += getConditionalValue(lineLength, formattedLine.substring(match[1].length), match[5]);

								break;
							}

							default: {
								printCouldNotMatchWarning();
								continue;
							}
						}

						if(line.text !== formattedLine) { edits.push(vscode.TextEdit.replace(line.range, formattedLine)); }
					}
				}

				lineRangeStart = lineRangeEnd;

			}

			return edits;
		}
	}));

}

// this method is called when your extension is deactivated
export function deactivate() { }
