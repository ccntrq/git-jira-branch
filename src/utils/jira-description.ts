export const jiraDescriptionToText = (description: unknown): string => {
  if (typeof description === 'string') {
    return description;
  }

  if (description === null || description === undefined) {
    return '';
  }

  return adfNodeToText(description)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const adfNodeToText = (node: unknown): string => {
  if (typeof node === 'string') {
    return node;
  }

  if (!isAdfNode(node)) {
    return '';
  }

  if (typeof node.text === 'string') {
    return node.text;
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (node.type === 'date' && isAdfAttrs(node.attrs)) {
    if (typeof node.attrs.timestamp !== 'string') {
      return '';
    }
    const millis = Number(node.attrs.timestamp);
    return Number.isFinite(millis)
      ? new Date(millis).toISOString().slice(0, 10)
      : '';
  }

  if (!Array.isArray(node.content)) {
    return '';
  }

  const childText = node.content.map(adfNodeToText).filter(Boolean);
  switch (node.type) {
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
    case 'doc':
      return childText.join('\n');
    case 'blockquote':
    case 'heading':
    case 'listItem':
    case 'paragraph':
    case 'taskItem':
      return childText.join('').trimEnd();
    default:
      return childText.join('');
  }
};

interface AdfNode {
  readonly type?: unknown;
  readonly text?: unknown;
  readonly attrs?: unknown;
  readonly content?: unknown;
}

interface AdfAttrs {
  readonly timestamp?: unknown;
}

const isObject = (value: unknown): boolean =>
  typeof value === 'object' && value !== null;

const isAdfNode = (value: unknown): value is AdfNode => isObject(value);

const isAdfAttrs = (value: unknown): value is AdfAttrs => isObject(value);
