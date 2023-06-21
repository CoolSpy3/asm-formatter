
export enum LineType { define, label, instruction }

export function getLineType(line: string): LineType | undefined {
    if (isDefine(line)) { return LineType.define; }
    if (isLabel(line)) { return LineType.label; }
    if (isInstruction(line)) { return LineType.instruction; }
    return undefined;
}

export function isDefine(line: string): boolean {
    return getDefineParams(line) !== undefined;
}

export function isLabel(line: string): boolean {
    return getLabelParams(line) !== undefined;
}

export function isInstruction(line: string): boolean {
    return getInstructionParams(line) !== undefined;
}

export function getParams(line: string, type: LineType): number[] | undefined {
    switch (type) {
        case LineType.define: return getDefineParams(line);
        case LineType.label: return getLabelParams(line);
        case LineType.instruction: return getInstructionParams(line);
        default: return undefined;
    }
}

export function getDefineParams(line: string): number[] | undefined {
    let params = [-1, -1, -1];
    return formatDefine(line, params) ? params : undefined;
}

export function getLabelParams(line: string): number[] | undefined {
    let params = [-1, -1, -1, -1];
    return formatLabel(line, params) ? params : undefined;
}

export function getInstructionParams(line: string): number[] | undefined {
    let params = [-1, -1, -1, -1, -1];
    return formatInstruction(line, params) ? params : undefined;
}

export function formatLine(line: string, type: LineType, params: number[]): string | undefined {
    switch (type) {
        case LineType.define: return formatDefine(line, params);
        case LineType.label: return formatLabel(line, params);
        case LineType.instruction: return formatInstruction(line, params);
        default: return undefined;
    }
}

export function formatDefine(line: string, params: number[]): string | undefined {
    let match = /^(\s*)%define\s+(\S+)\s+(\S.*)/.exec(line);
    if (!match) { return undefined; }

    let whitespace = match[1];

    let value = '';
    let escaped = false;
    let quotationMark = '';

    for (let char of match[3]) {
        if (escaped) { escaped = false; }
        if (char === '\\') { escaped = true; }
        if (char === ';' && quotationMark.length === 0) { break; }
        if ((char === '`' || char === "'" || char === '"') && (char === quotationMark || quotationMark.length === 0)) {
            if (quotationMark.length === 0) { quotationMark = char; }
            else { quotationMark = ''; }
        }
        value += char;
    }
    let comment = match[3].substring(value.length);
    value = value.trim();

    if (params[0] === -1) { params[0] = match[2].length; }
    if (params[1] === -1) { params[1] = value.length; }
    params[2] = '%define '.length + params[0] + 1 + params[1];

    return `${whitespace}${applyComment(`%define ${match[2]}${spacedValue(value, params[0], match[2])}`, params[2], comment)}`;
}

export function formatLabel(line: string, params: number[]): string | undefined {
    let match = /^(\s*)(?:((?:times\s+)?\S+)\s+)?(d[bwdq]|equ)\s+(\S.*)/.exec(line);
    if (!match) { return undefined; }

    let whitespace = match[1];

    let value = '';
    let escaped = false;
    let quotationMark = '';

    for (let char of match[4]) {
        if (escaped) { escaped = false; }
        if (char === '\\') { escaped = true; }
        if (char === ';' && quotationMark.length === 0) { break; }
        if ((char === '`' || char === "'" || char === '"') && (char === quotationMark || quotationMark.length === 0)) {
            if (quotationMark.length === 0) { quotationMark = char; }
            else { quotationMark = ''; }
        }
        value += char;
    }
    let comment = match[4].substring(value.length);
    value = value.trim();

    let name = match[2] === undefined ? '' : match[2];

    if (params[0] === -1) { params[0] = name.length; }
    if (params[1] === -1) { params[1] = match[3].length; }
    if (params[2] === -1) { params[2] = value.length; }
    params[3] = params[0] + (params[0] === 0 ? 0 : 1) + params[1] + 1 + params[2];

    if(name.length === 0) {
        return `${whitespace}${applyComment(`${match[3]}${spacedValue(value, params[0] === 0 ? params[1] : params[0] + 1 + params[1], match[3])}`, params[3], comment)}`;
    } else {
        return `${whitespace}${applyComment(`${name}${spacedValue(match[3], params[0], name)}${spacedValue(value, params[1], match[3])}`, params[3], comment)}`;
    }
}

export function formatInstruction(line: string, params: number[]): string | undefined {
    let whitespace = /^(\s*)/.exec(line)?.[1] ?? '';
    line = line.substring(whitespace.length);

    let match = /^(lock|repe?|repne)\s+(\S.*)/.exec(line);
    if (match) {
        var prefix = `${match[1]} `;
        line = match[2];
    } else {
        var prefix = '';
    }

    match = /^(\S+)\s+(\S.*)/.exec(line);
    if (!match) { return undefined; }
    let instruction = `${prefix}${match[1]}`;
    line = match[2];

    if (instruction.includes('[') || instruction.includes('%') || instruction.includes(';') || /^(?:d[bwdq]|equ)$/.test(instruction)) { return undefined; }

    function readOperand(): string | undefined {
        match = /^(byte|[dq]?word|short)\s+(\S.*)/.exec(line);
        if (match) {
            var size = `${match[1]} `;
            line = match[2];
        } else {
            var size = '';
        }

        let operand = '';
        let bracketed = false;
        let escaped = false;
        let quotationMark = '';

        for (let char of line) {
            if (escaped) { escaped = false; }
            if (char === '\\') { escaped = true; }
            if (char === '[') { bracketed = true; }
            if (char === ']' && quotationMark.length === 0) { bracketed = false; }
            if (char === ',' && !bracketed && quotationMark.length === 0) { break; }
            if (char === ';' && quotationMark.length === 0) { break; }
            if ((char === '`' || char === "'" || char === '"') && (char === quotationMark || quotationMark.length === 0)) {
                if (quotationMark.length === 0) { quotationMark = char; }
                else { quotationMark = ''; }
            }
            if (char === ',' && quotationMark.length === 0) { break; }
            operand += char;
        }
        line = line.substring(operand.length);
        return `${size}${operand.trim()}`;
    }

    let operand1 = readOperand();
    if (operand1 === undefined) {
        var operand2: string | undefined = undefined;
    } else {
        match = /^\s*,\s*(\S.*)/.exec(line);
        if (match) {
            line = match[1];
            var operand2 = readOperand();
        } else {
            var operand2: string | undefined = undefined;
        }
    }

    let comment = line.trimStart();
    if (comment.length > 0 && comment[0] !== ';') { return undefined; }

    if (params[0] === -1) { params[0] = instruction.length; }
    if (params[1] === -1 && operand1 !== undefined && operand2 === undefined) { params[1] = operand1?.length ?? 0; }
    if (params[2] === -1 && operand2 !== undefined) { params[2] = operand1?.length ?? 0; }
    if (params[3] === -1 && operand2 !== undefined) { params[3] = operand2?.length ?? 0; }
    params[4] = Math.max(params[0] + (params[1] <= 0 ? 0 : 1 + params[1]), params[0] + (params[2] <= 0 ? 0 : 1 + params[2]) + (params[3] <= 0 ? 0 : 2 + params[3]));

    return `${whitespace}${applyComment(`${instruction}${operand1 ? spacedValue(operand1, params[0], instruction) : ''}${operand2 ? `,${spacedValue(operand2, params[operand2 === undefined ? 1 : 2], operand1 ?? '')}` : ''}`, params[4], comment)}`;
}

export function updateParams(params: number[], newParams: number[]) {
    if (params.length !== newParams.length) {
        throw new Error('The two params arrays must have the same length');
    }

    for (let i = 0; i < params.length; i++) {
        params[i] = Math.max(params[i], newParams[i]);
    }
}

function spacedValue(value: string, sectionLength: number, prevValue: string): string {
    return `${" ".repeat(sectionLength - prevValue.length + 1)}${value}`;
}

function applyComment(line: string, lineLength: number, comment: string): string {
    return `${line}${comment.trim().length > 0 ? spacedValue(comment, lineLength, line) : ''}`;
}
