import { describe, expect, it } from 'vitest'
import { buildFileTree, getFilePathsInTreeOrder } from './pathTree'

describe('file tree ordering', () => {
  it('returns the same file order used by the rendered sidebar', () => {
    const apiOrder = [
      'Modules/WorkFromHome/Routes/web.php',
      'Modules/Room/Http/Controllers/RoomEventController.php',
      'app/Models/LE_OT_REQUEST.php',
    ]

    const tree = buildFileTree(apiOrder, new Set(), new Map())

    expect(getFilePathsInTreeOrder(tree)).toEqual([
      'app/Models/LE_OT_REQUEST.php',
      'Modules/Room/Http/Controllers/RoomEventController.php',
      'Modules/WorkFromHome/Routes/web.php',
    ])
  })
})
