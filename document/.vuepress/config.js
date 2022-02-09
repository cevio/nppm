const { resolve } = require('path');
module.exports = {
  title: 'NPPM',
  base: '/nppm/',
  description: 'Node Private Package Manager',
  dest: resolve(__dirname, '../../docs'),
  evergreen: true,
  themeConfig: {
    lastUpdated: true,
    smoothScroll: true,
    nextLinks: true,
    prevLinks: true,
    nav: [
      { text: '主页', link: '/' },
      { text: '指南', link: '/guider' },
      { text: '配置', link: '/setting' },
      { text: '插件', link: '/plugin' },
    ],
    sidebar: [
      '/',
      '/guider.md',
      '/setting.md',
      '/plugin.md',
    ],
    // 假定是 GitHub. 同时也可以是一个完整的 GitLab URL
    repo: 'cevio/nppm',
    // 自定义仓库链接文字。默认从 `themeConfig.repo` 中自动推断为
    // "GitHub"/"GitLab"/"Bitbucket" 其中之一，或是 "Source"。
    repoLabel: 'Github',
    // 假如文档不是放在仓库的根目录下：
    docsDir: 'document',
    // 假如文档放在一个特定的分支下：
    docsBranch: 'master',
    // 默认是 false, 设置为 true 来启用
    editLinks: true,
    // 默认为 "Edit this page"
    editLinkText: '帮助我们改善此页面！'
  }
}