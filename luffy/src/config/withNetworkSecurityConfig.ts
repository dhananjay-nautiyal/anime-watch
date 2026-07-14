import { withAndroidManifest, AndroidConfig, withDangerousMod, type ConfigPlugin } from '@expo/config-plugins'
import path from 'path'
import fs from 'fs'

const withNetworkSecurityConfig: ConfigPlugin<{ filePath?: string }> = (config, { filePath } = {}) => {
  config = withAndroidManifest(config, async manifestConfig => {
    const manifest = manifestConfig.modResults
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest)
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config'
    return manifestConfig
  })

  config = withDangerousMod(config, [
    'android',
    async config => {
      const srcPath = filePath
        ? path.resolve(config.modRequest.projectRoot, filePath)
        : path.join(config.modRequest.projectRoot, 'src', 'config', 'network_security_config.xml')
      const destDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml')
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }
      fs.copyFileSync(srcPath, path.join(destDir, 'network_security_config.xml'))
      return config
    },
  ])

  return config
}

export default withNetworkSecurityConfig
