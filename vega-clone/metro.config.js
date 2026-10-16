const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = false

// Resolve `@/*` -> `luffy/src/*` (mirrors tsconfig.json paths).
// Metro ignores tsconfig paths, so without this the 23 files
// importing `@/storage/*`, `@/services/*`, `@/components/*` fail to bundle.
config.resolver.alias = {
  '@': path.resolve(projectRoot, 'src'),
}

module.exports = config
