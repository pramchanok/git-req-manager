import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.gitlab-req-manager.app',
  productName: 'GitLab MR Manager',
  copyright: 'Copyright © 2025',
  directories: {
    output: 'release',
    buildResources: 'assets',
  },
  files: [
    'dist/**/*',
    'assets/**/*',
    'package.json',
  ],
  extraMetadata: {
    main: 'dist/main/index.js',
  },
  electronUpdaterCompatibility: '>=2.16',
  publish: {
    provider: 'github',
    owner: 'pramchanok',
    repo: 'git-req-manager',
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icon.ico',
  },
  mac: {
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    icon: 'assets/icon.png',
    category: 'public.app-category.developer-tools',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
}

export default config
