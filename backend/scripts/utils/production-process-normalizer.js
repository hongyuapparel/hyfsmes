const LABELS = {
  CUT: '\u88c1\u5e8a',
  SEW: '\u8f66\u7f1d',
  TAIL: '\u5c3e\u90e8',
  PACK: '\u5305\u88c5',
  IRON: '\u5927\u70eb',
  CHECK: '\u67e5\u8d27',
  TRIM: '\u526a\u7ebf',
  PROD: '\u6210\u54c1',
  HOOD: '\u6210\u54c1\u536b\u8863',
  SPEC: '\u4e13\u673a',
  HAND: '\u624b\u5de5',
  SPREAD: '\u62c9\u5e03',
  MARKER: '\u6392\u551b',
  PRECUT: '\u9884\u88c1',
  CUTTING: '\u88c1\u526a',
  PIECE: '\u88c1\u7247',
  TAG: '\u540a\u724c',
  WASH: '\u6d17\u6c34\u551b',
};

function cleanText(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text.toUpperCase() === 'NULL') return '';
  return text;
}

function splitJobTypeParts(jobType) {
  return cleanText(jobType)
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean);
}

function leafJobType(jobType, department = '') {
  const parts = splitJobTypeParts(jobType);
  if (!parts.length) return cleanText(department);
  return parts[parts.length - 1];
}

function containsAny(text, candidates) {
  return candidates.some((candidate) => text.includes(candidate));
}

function detectDepartment({ workClass = '', workName = '', groupName = '', processesName = '', currentJobType = '' }) {
  const workClassText = cleanText(workClass);
  const workNameText = cleanText(workName);
  const groupText = cleanText(groupName);
  const processText = cleanText(processesName);
  const leafText = leafJobType(currentJobType, workClassText);

  if ([LABELS.CUT, LABELS.SEW, LABELS.TAIL].includes(workClassText)) return workClassText;

  if (groupText === LABELS.CUT || leafText === LABELS.CUT) return LABELS.CUT;

  if ([LABELS.TAIL, LABELS.PACK, LABELS.IRON, LABELS.CHECK, LABELS.TRIM, LABELS.PROD, LABELS.HOOD].includes(groupText)) {
    return LABELS.TAIL;
  }

  if ([LABELS.TAIL, LABELS.PACK, LABELS.IRON, LABELS.CHECK, LABELS.TRIM, LABELS.PROD, LABELS.HOOD].includes(leafText)) {
    return LABELS.TAIL;
  }

  if ([LABELS.SPEC, LABELS.HAND].includes(groupText) && (!workClassText || workClassText === LABELS.TAIL)) {
    return LABELS.TAIL;
  }

  if ([LABELS.SPEC, LABELS.HAND].includes(leafText) && (!workClassText || workClassText === LABELS.TAIL)) {
    return LABELS.TAIL;
  }

  const merged = [workClassText, workNameText, groupText, leafText, processText].filter(Boolean).join(' ');

  if (containsAny(merged, [LABELS.CUT, LABELS.SPREAD, LABELS.MARKER, LABELS.PRECUT, LABELS.CUTTING, LABELS.PIECE])) {
    return LABELS.CUT;
  }

  if (containsAny(merged, [LABELS.TAIL, LABELS.PACK, LABELS.IRON, LABELS.CHECK, LABELS.TRIM, LABELS.PROD, LABELS.TAG, LABELS.WASH])) {
    return LABELS.TAIL;
  }

  return LABELS.SEW;
}

function normalizeJobLeaf({ groupName = '', workName = '', department = '', currentJobType = '' }) {
  const groupText = cleanText(groupName);
  if (groupText) return groupText;

  const workText = cleanText(workName);
  if (workText) return workText;

  const currentLeaf = leafJobType(currentJobType, department);
  if (currentLeaf) return currentLeaf;

  return cleanText(department);
}

function buildJobTypePath(department, leafName) {
  const departmentText = cleanText(department);
  const leafText = cleanText(leafName) || departmentText;
  return `${departmentText} > ${leafText}`;
}

module.exports = {
  LABELS,
  buildJobTypePath,
  cleanText,
  detectDepartment,
  leafJobType,
  normalizeJobLeaf,
  splitJobTypeParts,
};
