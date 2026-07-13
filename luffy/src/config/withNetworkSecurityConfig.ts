import { withAndroidManifest, withProjectBuildGradle, type ConfigPlugin } from '@expo/config-plugins'
import path from 'path'

const withNetworkSecurityConfig: ConfigPlugin<{ filePath?: string }> = (config, { filePath } = {}) => {
  const srcPath = filePath || path.join('src', 'config', 'network_security_config.xml')

  config = withAndroidManifest(config, async manifestConfig => {
    const manifest = manifestConfig.modResults
    const application = manifest.manifest.application?.[0]

    if (application) {
      application.$['android:networkSecurityConfig'] = '@xml/network_security_config'
    }

    return manifestConfig
  })

  config = withProjectBuildGradle(config, async gradleConfig => {
    const buildGradle = gradleConfig.modResults
    const content = buildGradle.contents

    const resourceStmt = `copy {
      from '${srcPath}'
      into 'src/main/res/xml/'
    }`

    if (!content.includes('network_security_config')) {
      const preBuildBlock = content.includes('preBuild') 
        ? content 
        : content.replace(/(android\s*\{)/, 'preBuild.doLast {\n    $1')
      gradleConfig.modResults.contents = preBuildBlock
    }

    return gradleConfig
  })

  return config
}

export default withNetworkSecurityConfig
