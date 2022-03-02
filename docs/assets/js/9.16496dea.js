(window.webpackJsonp=window.webpackJsonp||[]).push([[9],{194:function(t,a,s){"use strict";s.r(a);var r=s(6),e=Object(r.a)({},(function(){var t=this,a=t.$createElement,s=t._self._c||a;return s("ContentSlotsDistributor",{attrs:{"slot-key":t.$parent.slotKey}},[s("h1",{attrs:{id:"关于nppm的前世今生"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#关于nppm的前世今生"}},[t._v("#")]),t._v(" 关于NPPM的前世今生")]),t._v(" "),s("p",[t._v("NPM私有源仓库，早在2019年我发布了第一个版本到现在，不断总结NPM的API后编写了这套轻量的，符合国内一般公司内部使用的程序。它经历了以下的周期：")]),t._v(" "),s("ol",[s("li",[s("a",{attrs:{href:"https://github.com/cevio/cpm",target:"_blank",rel:"noopener noreferrer"}},[t._v("CPM"),s("OutboundLink")],1),t._v(" 2019年发布")]),t._v(" "),s("li",[s("a",{attrs:{href:"https://github.com/nilppm/npm",target:"_blank",rel:"noopener noreferrer"}},[t._v("NILPPM"),s("OutboundLink")],1),t._v(" 2019年发布")]),t._v(" "),s("li",[s("a",{attrs:{href:"https://github.com/flowxjs/npm",target:"_blank",rel:"noopener noreferrer"}},[t._v("FLOWX-NPM"),s("OutboundLink")],1),t._v(" 2020年发布")]),t._v(" "),s("li",[s("a",{attrs:{href:"https://github.com/cevio/nppm",target:"_blank",rel:"noopener noreferrer"}},[t._v("NPPM"),s("OutboundLink")],1),t._v(" 2022年发布")])]),t._v(" "),s("p",[t._v("期间不断与"),s("a",{attrs:{href:"https://github.com/cnpm/cnpm",target:"_blank",rel:"noopener noreferrer"}},[t._v("cnpm"),s("OutboundLink")],1),t._v("的原作者"),s("a",{attrs:{href:"https://github.com/fengmk2",target:"_blank",rel:"noopener noreferrer"}},[t._v("苏千"),s("OutboundLink")],1),t._v("交流，给我提供了很多思路和文档，让我可以对NPM Registry有更深入的了解。")]),t._v(" "),s("p",[t._v("有别于CNPM的是，NPPM采用非同步模块的方式，在国内，鉴于网络情况，通过配置registry集合即可以快速无缝切换到各种模块私有/公有源进行模块信息读取，比如说淘宝源（速度已经够快），我们的目标仅仅是对私有内部模块的管理，职责非常明确，而公有模块，交给各大公有源处理。")]),t._v(" "),s("p",[t._v("NPPM的特点是：")]),t._v(" "),s("ol",[s("li",[s("strong",[t._v("简易部署：")]),t._v(" 一键安装、一键升级，可视化安装本服务，提供丰富的后台配置，即改即生效。")]),t._v(" "),s("li",[s("strong",[t._v("轻量服务：")]),t._v(" 专注于提供私有模块管理服务，不参杂其他NPM实时同步功能，保障系统稳定与轻量。")]),t._v(" "),s("li",[s("strong",[t._v("兼容性强：")]),t._v(" 兼容NPM默认登录方式和第三方登录方式，同时兼容NPM不同版本的API。")]),t._v(" "),s("li",[s("strong",[t._v("插件化强：")]),t._v(" 提供强大的插件嵌入功能和服务事件功能，供开发者自定义企业级应用功能。")])]),t._v(" "),s("h2",{attrs:{id:"安装"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#安装"}},[t._v("#")]),t._v(" 安装")]),t._v(" "),s("p",[t._v("如果公司内部使用私有源，那么必定看中的是安装方便与升级方便的能力。NPPM为了解决这个问题，我们采用命令式安装方式，因为NPM原本就提供了命令安装能力，那么如果我们将这套程序做成NPM包，同时使用命令启动，那么，恰好能够完美解决这个痛点。")]),t._v(" "),s("blockquote",[s("p",[t._v("安装前需要准备一个数据库和一个redis，数据库可以是"),s("code",[t._v("mysql")]),t._v(" "),s("code",[t._v("postgres")]),t._v(" "),s("code",[t._v("mongodb")]),t._v("等等，在可视化安装时候可以选择不同的支持的数据库类型。"),s("strong",[t._v("注意：不支持winow服务器")])])]),t._v(" "),s("h3",{attrs:{id:"直接启动"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#直接启动"}},[t._v("#")]),t._v(" 直接启动")]),t._v(" "),s("p",[t._v("不用clone仓库也不用修改任何代码，直接通过以下命令启动：")]),t._v(" "),s("div",{staticClass:"language-bash extra-class"},[s("pre",{pre:!0,attrs:{class:"language-bash"}},[s("code",[t._v("$ "),s("span",{pre:!0,attrs:{class:"token function"}},[t._v("npm")]),t._v(" i -g @nppm/npm "),s("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# 安装命令")]),t._v("\n$ "),s("span",{pre:!0,attrs:{class:"token builtin class-name"}},[t._v("cd")]),t._v(" "),s("span",{pre:!0,attrs:{class:"token operator"}},[t._v("<")]),t._v("dictionary"),s("span",{pre:!0,attrs:{class:"token operator"}},[t._v(">")]),t._v(" "),s("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# 需要确定一个目录来存放资源")]),t._v("\n$ nppm --port"),s("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),s("span",{pre:!0,attrs:{class:"token number"}},[t._v("3000")]),t._v(" "),s("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# 启动服务")]),t._v("\n")])])]),s("h3",{attrs:{id:"进程守护"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#进程守护"}},[t._v("#")]),t._v(" 进程守护")]),t._v(" "),s("p",[t._v("当然如果希望进程守护，比如使用PM2来管理，我们可以通过以下命令启动：")]),t._v(" "),s("div",{staticClass:"language-bash extra-class"},[s("pre",{pre:!0,attrs:{class:"language-bash"}},[s("code",[t._v("$ "),s("span",{pre:!0,attrs:{class:"token function"}},[t._v("npm")]),t._v(" i -g @nppm/npm pm2 "),s("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# 安装命令")]),t._v("\n$ "),s("span",{pre:!0,attrs:{class:"token builtin class-name"}},[t._v("cd")]),t._v(" "),s("span",{pre:!0,attrs:{class:"token operator"}},[t._v("<")]),t._v("dictionary"),s("span",{pre:!0,attrs:{class:"token operator"}},[t._v(">")]),t._v(" "),s("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# 需要确定一个目录来存放资源")]),t._v("\n$ pm2 start nppm -- --port"),s("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),s("span",{pre:!0,attrs:{class:"token number"}},[t._v("3000")]),t._v(" "),s("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# 启动服务")]),t._v("\n")])])]),s("h3",{attrs:{id:"服务配置"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#服务配置"}},[t._v("#")]),t._v(" 服务配置")]),t._v(" "),s("p",[t._v("当服务启动以后，你可以在"),s("code",[t._v("<dictionary>")]),t._v("在看到2个文件")]),t._v(" "),s("ul",[s("li",[s("code",[t._v("<dictionary>/nppm-production.log")]),t._v(" 日志文件")]),t._v(" "),s("li",[s("code",[t._v("<dictionary>/package.json")]),t._v(" 项目信息文件，插件安装信息会存放在这个文件内。")])]),t._v(" "),s("p",[t._v("然后，你可以通过一下命令打开安装")]),t._v(" "),s("div",{staticClass:"language-bash extra-class"},[s("pre",{pre:!0,attrs:{class:"language-bash"}},[s("code",[t._v("$ "),s("span",{pre:!0,attrs:{class:"token function"}},[t._v("open")]),t._v(" http://127.0.0.1:3000\n")])])]),s("p",[t._v("之后就是安装可视化配置完毕即可使用。在命令行上指定当前registry地址即可，比如：")]),t._v(" "),s("div",{staticClass:"language-bash extra-class"},[s("pre",{pre:!0,attrs:{class:"language-bash"}},[s("code",[t._v("$ "),s("span",{pre:!0,attrs:{class:"token function"}},[t._v("npm")]),t._v(" login --registry"),s("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v("http://127.0.0.1:3000\n")])])]),s("p",[t._v("安装完毕后请前往 "),s("code",[t._v("/admin/settings")]),t._v(" 路由设置整站。")]),t._v(" "),s("h2",{attrs:{id:"升级"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#升级"}},[t._v("#")]),t._v(" 升级")]),t._v(" "),s("p",[t._v("采用NPM包模式，那么我们很轻松进行整站升级：")]),t._v(" "),s("div",{staticClass:"language-bash extra-class"},[s("pre",{pre:!0,attrs:{class:"language-bash"}},[s("code",[t._v("$ "),s("span",{pre:!0,attrs:{class:"token function"}},[t._v("npm")]),t._v(" i -g @nppm/npm@"),s("span",{pre:!0,attrs:{class:"token operator"}},[t._v("<")]),t._v("version"),s("span",{pre:!0,attrs:{class:"token operator"}},[t._v(">")]),t._v(" "),s("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# 你可以指定升级版本")]),t._v("\n")])])]),s("p",[t._v("然后重启服务：")]),t._v(" "),s("div",{staticClass:"language-bash extra-class"},[s("pre",{pre:!0,attrs:{class:"language-bash"}},[s("code",[t._v("$ nppm --port"),s("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),s("span",{pre:!0,attrs:{class:"token number"}},[t._v("3000")]),t._v("\n")])])]),s("h2",{attrs:{id:"管理员"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#管理员"}},[t._v("#")]),t._v(" 管理员")]),t._v(" "),s("p",[t._v("本系统第一个用户将默认为管理员，可以管理整站设置。当然，第一个管理员也可以通过"),s("code",[t._v("npm login")]),t._v("命令直接在命令行登录。")]),t._v(" "),s("p",[t._v("管理员权限：")]),t._v(" "),s("ol",[s("li",[t._v("发布、管理任意私有包")]),t._v(" "),s("li",[t._v("管理整站配置")])]),t._v(" "),s("p",[t._v("当然，你也可以通过管理员账号对任意其他登录账号设置为管理员，以便多管理存在。")]),t._v(" "),s("h2",{attrs:{id:"登录模式"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#登录模式"}},[t._v("#")]),t._v(" 登录模式")]),t._v(" "),s("p",[t._v("我们默认提供NPM登录方式，用户名和密码登录。但是我们可以通过安装提供的插件来扩展第三方登录，比如"),s("code",[t._v("@nppm/dingtalk")]),t._v("使用钉钉登录，"),s("code",[t._v("@nppm/qywx")]),t._v("，使用企业微信登录。当然你也可以根据文档扩展第三方登录供公司内部使用。")]),t._v(" "),s("h2",{attrs:{id:"数据统计"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#数据统计"}},[t._v("#")]),t._v(" 数据统计")]),t._v(" "),s("ul",[s("li",[t._v("你可以在首页实时看到当前系统的各种数据，包含用户数、模块数、版本数以及下载次数等等。")]),t._v(" "),s("li",[t._v("我们也提供了最新更新的模块数据，以便大家查看更新私有模块。")]),t._v(" "),s("li",[t._v("我们也会输出各种数据榜单，供内部统计使用。包含日榜、周榜、月榜等等。")])]),t._v(" "),s("h2",{attrs:{id:"贡献代码-提问"}},[s("a",{staticClass:"header-anchor",attrs:{href:"#贡献代码-提问"}},[t._v("#")]),t._v(" 贡献代码/提问")]),t._v(" "),s("p",[t._v("你可以通过以下方式clone仓库提交PR来贡献代码：")]),t._v(" "),s("div",{staticClass:"language-bash extra-class"},[s("pre",{pre:!0,attrs:{class:"language-bash"}},[s("code",[t._v("$ "),s("span",{pre:!0,attrs:{class:"token function"}},[t._v("git")]),t._v(" clone git@github.com:cevio/nppm.git\n")])])]),s("p",[t._v("如果有任何问题，请前往 "),s("a",{attrs:{href:"https://github.com/cevio/nppm/issues",target:"_blank",rel:"noopener noreferrer"}},[t._v("https://github.com/cevio/nppm/issues"),s("OutboundLink")],1)])])}),[],!1,null,null,null);a.default=e.exports}}]);