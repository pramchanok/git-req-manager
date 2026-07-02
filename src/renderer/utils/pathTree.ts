export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
  isViewed?: boolean
  additions?: number
  deletions?: number
}

export function buildFileTree(
  filePaths: string[],
  viewedPaths: Set<string>,
  statsMap: Map<string, { additions: number; deletions: number }>
): FileTreeNode[] {
  const root: FileTreeNode[] = []

  for (const path of filePaths) {
    const parts = path.split('/')
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      let existingNode = currentLevel.find((n) => n.name === part)

      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          isDirectory: !isFile,
          ...(isFile
            ? {
                isViewed: viewedPaths.has(path),
                additions: statsMap.get(path)?.additions ?? 0,
                deletions: statsMap.get(path)?.deletions ?? 0,
              }
            : { children: [] }),
        }
        currentLevel.push(existingNode)
      }

      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children
      }
    }
  }

  // Sort: directories first, then files alphabetically
  const sortTree = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
    nodes.forEach((node) => {
      if (node.children) sortTree(node.children)
    })
  }

  sortTree(root)
  return root
}
