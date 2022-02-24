const plugins = ['dingtalk', 'wechatwork'];
const path = require('path');
const fs = require('fs');
plugins.forEach(plugin => {
  const filename = path.resolve(__dirname, '..', 'packages', plugin, 'package.json');
  const value = require(filename);
  if (value.plugin_configs) {
    value.plugin_configs.forEach(config => {
      if (typeof config.value === 'string') {
        config.value = config.default || null;
      } else if (typeof config.value === 'number') {
        config.value = config.default || 0;
      } else if (typeof config.value === 'boolean') {
        config.value = config.default || false;
      }
    })
    fs.writeFileSync(filename, JSON.stringify(value, null, 2), 'utf8')
    console.log('+', path.relative(process.cwd(), filename))
  }
})