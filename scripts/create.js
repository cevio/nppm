const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const childprocess = require('child_process');
const prompt = inquirer.createPromptModule();

prompt([
  {
    type: 'input',
    name: 'project',
    message: '请输入模块名称'
  },
  {
    type: 'confirm',
    name: 'bin',
    message: '是否生成bin.ts文件？'
  }
]).then(data => {
  const dir = createProjectDir(data.project);
  createTypeScriptConfigFile(dir);
  createPackageFile(dir, data.project, data.bin);
  createReadme(dir, data.project);
  const src = createDir(dir, 'src');
  createIndexFile(src, data.project);
  if (data.bin) createBinScript(src);
  childprocess.spawn('lerna', ['bootstrap'], {
    stdio: 'inherit'
  });
});

function createProjectDir(name) {
  const dir = path.resolve(process.cwd(), 'packages', name);
  fs.mkdirSync(dir);
  return dir;
}

function createBinScript(src) {
  const template = `#!/usr/bin/env node
  import { PM2 } from '@node/com.toolkit';
  import { resolve } from 'path';
  const { name, version } = require('../package.json');
  const pm2 = new PM2();
  pm2.bootstrap({
    name, version,
    file: resolve(__dirname, './index'),
    args: [],
    namespace: 'service'
  });`;
  fs.writeFileSync(path.resolve(src, 'bin.ts'), template, 'utf8');
}

function createTypeScriptConfigFile(dir) {
  const template = {
    "extends": "../../tsconfig.json",
    "extendsExact": true,
    "compilerOptions": {
      "declaration": true,
      "outDir": "dist",
    },
    "include": ["src"]
  }
  fs.writeFileSync(path.resolve(dir, 'tsconfig.json'), JSON.stringify(template, null, 2), 'utf8');
}

function createPackageFile(dir, project, bin) {
  const template = {
    "name": "@nppm/" + project,
    "version": "1.0.0",
    "description": "node private package manager:" + project,
    "author": "shenyunjie ",
    "homepage": "https://github.com/cevio/nppm/tree/master/packages/" + project,
    "license": "MIT",
    "main": "dist/index.js",
    "keywords": [
      "npm"
    ],
    "directories": {
      "lib": "src"
    },
    "files": [
      "dist"
    ],
    "scripts": {
      "build": "rm -rf ./dist && tsc",
    },
    "publishConfig": {
      "access": "public"
    }
  }
  if (bin) {
    template.bin = {
      [project]: "./dist/bin.js"
    }
    template.dependencies = {
      "@nppm/toolkit": "^1.0.0",
    }
  }
  fs.writeFileSync(path.resolve(dir, 'package.json'), JSON.stringify(template, null, 2), 'utf8');
}

function createReadme(dir, project) {
  const template = `# \`@nppm/${project}\`

  > TODO: description
  
  ## Usage
  
  \`\`\`
  const container = require('@nppm/${project}');
  
  // TODO: DEMONSTRATE API
  \`\`\``;
  fs.writeFileSync(path.resolve(dir, 'README.md'), template, 'utf8');
}

function createDir(dir, name) {
  const _dir = path.resolve(dir, name);
  fs.mkdirSync(_dir);
  return _dir;
}

function createIndexFile(src, project) {
  fs.writeFileSync(path.resolve(src, 'index.ts'), `export const abc = 1;`, 'utf8');
}