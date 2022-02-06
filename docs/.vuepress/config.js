module.exports = {
  title: 'NPPM',
  base: '/docs',
  description: 'Node Private Package Manager',
  evergreen: true,
  themeConfig: {
    nextLinks: true,
    prevLinks: true,
    nav: [
      { text: '主页', link: '/' },
      { text: '指南', link: '/guider' },
      { text: '配置', link: '/setting' },
      { text: '插件', link: '/plugin' },
      { text: 'Github', link: 'https://github.com/cevio/nppm', target:'_blank', rel:'' }
    ],
    sidebar: [
      '/',
      '/guider.md',
      '/setting.md',
      '/plugin.md',
    ]
  }
}