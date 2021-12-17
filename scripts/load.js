const argvs = process.argv.slice(2);
const [pkg, file, ...params] = argvs;

if (!pkg) throw new Error('缺少项目名');

const path = require('path');
const fs = require('fs');

const pkgPath = path.resolve(__dirname, '..', 'packages', pkg, 'src', file || 'index.ts');
if (!fs.existsSync(pkgPath)) throw new Error('找不到项目启动文件：' + pkgPath);

const { spawnSync } = require('child_process');

spawnSync('ts-node', [pkgPath, ...params], {
  cwd: path.dirname(pkgPath),
  stdio: 'inherit',
});