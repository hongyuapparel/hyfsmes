const COMPACT_TABLE_ROW_MIN_HEIGHT = 52
const COMPACT_TABLE_CELL_PADDING_Y = 1
const COMPACT_TABLE_CELL_PADDING_X = 3
const COMPACT_TABLE_IMAGE_BORDER = 1

const COMPACT_TABLE_IMAGE_SIZE = Math.max(
  24,
  COMPACT_TABLE_ROW_MIN_HEIGHT - COMPACT_TABLE_CELL_PADDING_Y * 2 - COMPACT_TABLE_IMAGE_BORDER * 2,
)

const COMPACT_TABLE_IMAGE_COLUMN_MIN_WIDTH =
  COMPACT_TABLE_IMAGE_SIZE + COMPACT_TABLE_CELL_PADDING_X * 2 + 12

export function useCompactTableStyle() {
  function compactHeaderCellStyle() {
    return { whiteSpace: 'nowrap' }
  }

  function compactCellStyle() {
    return {
      padding: `${COMPACT_TABLE_CELL_PADDING_Y}px ${COMPACT_TABLE_CELL_PADDING_X}px`,
      whiteSpace: 'nowrap',
    }
  }

  function compactRowStyle() {
    return { minHeight: `${COMPACT_TABLE_ROW_MIN_HEIGHT}px` }
  }

  return {
    compactHeaderCellStyle,
    compactCellStyle,
    compactRowStyle,
    compactImageSize: COMPACT_TABLE_IMAGE_SIZE,
    compactImageColumnMinWidth: COMPACT_TABLE_IMAGE_COLUMN_MIN_WIDTH,
  }
}
