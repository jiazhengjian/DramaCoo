# 前端设计规范

版本日期为 2026-09-24。适用项目为 `DramaCoo`，前端位于 `frontend`。视觉参照为[即梦公开首页](https://jimeng.jianying.com/ai-tool/home)。本文件规定本项目要采用的统一规则；它不代表全部规则已经在代码中落实或通过验收。

## 1. 范围、证据与结论等级

本轮是 AIGC 创作工具的界面规范研究，重点为用户能看到和操作的页面结构、组件及反馈状态。参考站的模型调用、账号数据、计费、生成质量与内部架构不在本轮取证范围内。未登录，不读取浏览器凭证，不触发生成、发布、充值或删除。

结论使用以下标记，后续代码和验收记录沿用。

| 标记 | 含义 | 能支持的说法 |
| --- | --- | --- |
| F，参考事实 | 公开 HTML/CSS 中的明确规则，或公开页面实际渲染与交互结果 | “参考 CSS 定义为……”或“在该视口测得……” |
| A，项目采用 | 本项目决定实施的值或行为，可能复用参考事实，也可能是业务适配 | “本项目采用……” |
| I，合理推断 | 根据多个事实推测，但未完成直接观察 | 必须保留“推断”字样 |
| U，尚未确认 | 缺乏页面或代码证据 | 不得写成参考事实或验收通过 |

CSS 中有定义不等于所有页面均使用该定义。参考站的不同版本组件、营销弹层和独立工具页面可能覆盖全局规则。截图仅代表记录中的日期、视口和无登录状态。

### 1.1 证据索引

| ID | 来源与定位 | 已证明的范围 | 限制 |
| --- | --- | --- | --- |
| E01 | [公开首页 HTML](https://jimeng.jianying.com/ai-tool/home)，`/tmp/jimeng-reference.html`，`body[lv-theme]` | 本次响应使用 `lv-theme="dark"`、`lv-theme-version="2.0"` | 不证明其他账号或路由默认主题 |
| E02 | E01 内嵌 `<style>`，提取于 `/tmp/jimeng-inline.css`；暗色变量作用域、`:root .lv-*`、`.sidebar-*` | v2 色彩、覆盖后的组件样式、侧栏、标题、断点与部分动效 | 非 CSSOM 全局审计；继承和页面覆盖仍需运行验证 |
| E03 | [Home.9dad45b2c8.css](https://lf3-lv-buz.vlabstatic.com/obj/image-lvweb-buz/ies/dreamina/web/jimeng/static/css/async/Home.9dad45b2c8.css)，`/tmp/jimeng-home.css`；`.header-JA7Wae`、`.home-header-ot_ZdL`、`.button-TZ_2iZ`、`.input-group-KuXhIU` | 首页标题、入口卡片、搜索及布局样式 | 含其他场景规则，不一概采用 |
| E04 | [lv-components.ed9c88eb12.css](https://lf3-lv-buz.vlabstatic.com/obj/image-lvweb-buz/ies/dreamina/web/jimeng/static/css/lv-components.ed9c88eb12.css)，`/tmp/jimeng-lv-components.css`；`.lv-btn-size-*`、`.lv-input*`、`.lv-modal*`、`.lv-spin*` | 基础组件尺寸、可用状态和默认规则 | E02 的 v2 覆盖优先；旧配色不能直接视作当前首页配色 |
| E05 | [lv-secondary-components.faed323a7c.css](https://lf3-lv-buz.vlabstatic.com/obj/image-lvweb-buz/ies/dreamina/web/jimeng/static/css/async/lv-secondary-components.faed323a7c.css)，`/tmp/jimeng-lv-secondary.css`；`.lv-input-tag*` | 复合输入 disabled/error/readonly 等状态存在 | 不能证明本次首页正在显示这些状态 |
| E06 | [HomeCreate.c5ff9b223e.css](https://lf3-lv-buz.vlabstatic.com/obj/image-lvweb-buz/ies/dreamina/web/jimeng/static/css/async/HomeCreate.c5ff9b223e.css)，`/tmp/jimeng-homecreate.css` | 创作页搜索与局部按钮覆盖 | 仅用于交叉核对 |
| E07 | [首屏截图](docs/evidence/阶段3-设计规范统一/参考-即梦桌面初始.png)，独立、无登录 Chrome，1440×960、DPR 1、深色偏好 | 首次访问出现活动介绍弹层；公共页面可实际渲染 | 活动弹层不是本项目需要复制的业务功能 |
| E08 | [侧栏展开](docs/evidence/阶段3-设计规范统一/参考-即梦侧栏展开.png)、[测量记录](docs/evidence/阶段3-设计规范统一/参考-即梦侧栏测量.json) | 展开宽度、顶部品牌行与收起入口、条目尺寸 | 无登录桌面状态；营销横幅可能改变绝对纵坐标 |
| E09 | [侧栏收起](docs/evidence/阶段3-设计规范统一/参考-即梦侧栏收起.png)、[展开入口悬停](docs/evidence/阶段3-设计规范统一/参考-即梦展开按钮悬停.png)、[重新展开](docs/evidence/阶段3-设计规范统一/参考-即梦侧栏重新展开.png) | 实测收起宽64px，品牌区40×40，hover图标16×16，点击后恢复240px | 同时核对 E08 的 JSON，不能只看截图猜测尺寸 |
| E10 | 用户本次明确要求 | 导航删项、工作室命名、历史模块移除、指定页面左上标题 | 优先于参考站的信息架构和文案 |
| E11 | [首页组件实际测量](docs/evidence/阶段3-设计规范统一/参考-即梦首页组件测量.json)，当前 `h1.title-SZtLfF.domestic-FMSZNV` 与主输入父容器 | 当前主标题30/38/600；输入外层圆角24、内层padding16；生成模式按钮有局部渐变覆盖 | 与 E03 的24px旧标题规则冲突，当前渲染结果优先 |
| E12 | [收起导航提示截图](docs/evidence/阶段3-设计规范统一/参考-即梦收起导航提示.png)，E08 JSON 的 `navTooltip` | tooltip实测背景#333、圆角8、padding8×16、文字12/20/400 | 测得图标右侧间距4px，仅证明该导航提示 |
| E13 | [参数浮层截图](docs/evidence/阶段3-设计规范统一/参考-即梦参数浮层.png)、[参数浮层实际测量](docs/evidence/阶段3-设计规范统一/参考-即梦参数浮层测量.json)，点击已有“自动”触发器 | popover背景#262626、圆角16、padding16、阴影0 8px 56px黑色24%；只打开，未选择参数 | DPR1下computed边框为1px，与E02的0.5px声明并列记录；不推定所有参数菜单尺寸相同 |
| C01 | [globals.css](frontend/app/globals.css)、[AppShell.tsx](frontend/components/AppShell.tsx)、[Overlay.tsx](frontend/components/ui/Overlay.tsx) | 本项目当前语义样式、侧栏偏好、移动抽屉和共享浮层实现 | 这是项目代码证据，用于核对A采用值，不是参考站事实或浏览器验收通过证明 |

原始文件 SHA-256，供重新获取时识别内容变更。

```text
E01  3b4d024a4aee3b578d5883df924a05a68699702c25111a2b184c047f32fe40f3
E02  f27b9da4ad6dd974150b7dde8ff8e098ed1cce2d9b5d7e6a13edd58a24df0e89
E03  84eddcc9ac448bc055acf1a2a08a0b89556b1662cea8ab2ec34b92f590cbad39
E04  0b9dc49da07af7a96328dc0138247f8f0ae046b7c568f4819d3e860ef228b3ea
E05  7e4c1d4dc12130d54a7a24b0f5c8e378d6b7dd24a593cf5d7011b9b3eda5d18e
E06  3a63427e047b59e76953737f8571a30b6d90e0a5257a907565fea51c91c656db
```

### 1.2 冲突处理

E04 的旧基础库定义过青色主按钮、12px modal/popover、6px tooltip。E02 的当前 v2 规则明确覆盖为白色主按钮、16px modal/popover、8px tooltip。本项目采用 E02 的 v2 规则，E04 仅补充未被覆盖的尺寸和状态定义。不得把两套规则混合后仍声称是同一版即梦。

E03 中另一版首页标题规则是24/32/600、顶部padding100px，但 E11 当前实际渲染的标题是30/38/600、居中。保留此冲突，不能用旧CSS选择器描述当前H1。本项目工作室采用30/38/600居中标题；用户要求临时工作台、动作迁移、设置与项目库采用左上角标题，这些普通工具页采用24/32/600左对齐结构。普通工具页字级属于 A，依据 E03 的紧凑标题规则，而非当前首页H1实测。E03、E10、E11。

E11 当前“生成/画布”模式分段控件中，“生成”选中态在白色基础上叠加轻微暖色至浅蓝的渐变；当前主创作输入采用半透明暗灰渐变。它们是局部创作组件覆盖，不代表全部主按钮或普通表单都使用渐变。当前主输入外圆角24px、外层padding1px、内层padding16px已实际测得。

## 2. 全局视觉原则

采用中性暗色页面、浅灰表面、细描边、白色主动作和少量蓝色焦点/链接。内容依靠间距、字号与背景层级建立主次，不以大面积彩色渐变或厚阴影建立层级。应用自身名称、业务文案和合法已有素材保持本项目身份，不复制参考站标识、活动内容或用户作品。

所有应用页面、对话框、菜单、空状态、错误状态和加载状态引用同一语义 token。页面组件不得自行引入一套“差不多”的灰色、圆角、字重或按钮尺寸。特殊业务组件使用语义变体，不能以局部全局选择器覆盖所有 `button`、`input`、`textarea`。

## 3. 色彩 token

以下是 F/E02 的暗色基础值，A 在同语义下采用对应值；具体组件的组合与已记录差异见第6节。标准表单使用白色4%背景，创作主输入使用下表的半透明输入渐变，不能把后者推及所有input。八位十六进制的后两位为 alpha，必须保留透明度；不能以不透明灰色代替。例如白色 70% 在不同表面上的结果不同于固定 `#b2b2b2`。

| 语义 | 参考 token | F / A 值 | 用途 |
| --- | --- | --- | --- |
| 页面底色 | `--bg-body` | `#121212` | 所有页面主背景 |
| 侧栏底色 | `--component-sidenav` | `#171717` | 展开侧栏 |
| 表面 | `--bg-surface` | `#1a1a1a` | 面板、卡片、对话框 |
| 下拉浮层 | `--bg-dropdown-menu` | `#262626` | dropdown、popover |
| 高位浮层 | `--bg-float` | `#333333` | toast、tooltip |
| 一级块 default / hover / pressed | `--bg-block-primary-*` | `#ffffff14` / `#ffffff1f` / `#ffffff29` | 次按钮、明显交互表面 |
| 二级块 default / hover / pressed | `--bg-block-secondary-*` | `#ffffff0a` / `#ffffff14` / `#ffffff1f` | 导航、弱表面 |
| 主文字 | `--text-primary` | `#ffffff` | 标题、主要内容 |
| 次文字 | `--text-secondary` | `#ffffffb2` | 描述、正文辅助信息 |
| 第三级文字 | `--text-tertiary` | `#ffffff99` | 次要标签、弱图标 |
| 占位文字 | `--text-placeholder` | `#ffffff59` | placeholder；不用于主要说明 |
| 禁用文字 | `--text-disabled` | `#ffffff33` | 不可用控件 |
| 链接 | `--text-link` | `#8ac7e5` | 可点击文本 |
| 主描边 | `--stroke-primary` | `#ffffff14` | 面板、输入边界 |
| 次描边 | `--stroke-secondary` | `#ffffff0a` | 分隔线、弱边界 |
| 浮层描边 | `--stroke-tertiary` | `#ccddff14` | dropdown / popover |
| 强调 default / hover / pressed | `--brand-main-*` | `#009efa` / `#0099f2` / `#0091e5` | 焦点、少量强调 |
| 强调块 default / hover / pressed | `--brand-main-block-*` | `#008ee51f` / `#008ee529` / `#008ee514` | 需要强调的选项背景 |
| 错误 | `--functional-error` | `#ff3355` | 错误图标、错误边框 |
| 警告 | `--functional-warning` | `#ffa21e` | 需要注意的状态 |
| 成功 | `--functional-success` | `#009efa` | 参考站成功色为蓝色，配合文字/图标使用 |
| 输入表面 | `--component-input-bg` | `#222222b8` | 创作输入的暗色层 |
| 输入渐变起止 | `--component-input-bg-start/end` | `#1a1a1ab8` / `#2a2a2ab8` | 仅复杂创作输入容器允许使用 |
| 输入分区 | `--component-input-bg-tab` | `#0000004d` | 输入内模式分区 |
| 蒙层 30 / 60 / 80 | `--bg-mask-*` | `#0000004d` / `#00000099` / `#000000cc` | 默认 modal 使用 60% |

状态横幅的错误/警告/成功浅底采用对应功能色的 `14` alpha（约8%），边框采用 `40` alpha（约25%），是 A 的项目规则；当前材料未证明即梦对所有横幅采用此比例。成功、错误、警告均须同时有文字或图标，不能仅靠颜色区分。

## 4. 文字、图标、间距和圆角

### 4.1 字体与字级

F/E02 的字体栈包含 `CapCut Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Arial, sans-serif`，数字另有 Montserrat，首页标题使用专用字体。A 使用系统中文字体栈 `-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif`，不额外下载参考站专用字体。字体轮廓不保证像素级一致，字体许可和当前设备字体渲染未确认。

| 层级 | 项目采用字号 / 行高 / 字重 | 依据 |
| --- | --- | --- |
| 工作室主标题 | 30 / 38 / 600 | F/E11 当前首页H1；A 居中 |
| 普通工具页大标题 | 24 / 32 / 600 | F/E03 的另一版标题字级；A 左对齐，与项目库统一 |
| 面板标题 | 16 / 24 / 500 | F/E02 对话框标题；A 用于面板 |
| 主要正文与表单 | 14 / 22 / 400 | F/E02 modal 内容；与紧凑表单统一 |
| 导航 | 14 / 20 / 500 | A/C01；F/E02 `.navigation-item-zRsSwH` 为14/22/500 |
| 默认按钮 | 14 / 20 / 500 | 尺寸 F/E04；行高和字重 A 统一 |
| 次级控件、tab | 13 / 20 / 500 | F/E02 tab 为 13px/500；行高 A |
| 辅助标签 | 12 / 18 / 400 | A，保留紧凑密度，不用于长正文 |
| tooltip | 12 / 20 / 400 | F/E02、E12实际测量 |

标题与说明之间采用 8px，说明使用次文字。禁止无业务原因的大段全大写、字距拉宽和多级粗体。图标沿用项目现有图标库，统一线性风格，默认 16px，导航 20px，状态图标 20px；这些图标尺寸是 A，不是对即梦所有图标的测量结论。

### 4.2 间距

A 基础间距序列为 `4, 8, 12, 16, 20, 24, 32, 40, 64`px。4 用于紧密菜单项，8 用于图文与标题说明，12 用于控件内横向空间，16 用于卡片内部分区，24 用于普通面板与弹窗，32 用于区块间隔，40 用于宽屏页面外边距。E02/E03 中确实出现 4/8/12/16/20/24/32/40，但该完整序列是项目整理，不宣称参考站拥有同名统一 spacing scale。

### 4.3 圆角和阴影

| 场景 | A 值 | 参考依据 |
| --- | --- | --- |
| 小标记 / badge | 6px | A；E03局部badge为4px，本项目统一为6px |
| 收起按钮 | 6px | E02 `.sidebar-toggle-oxA94U` |
| button / input / nav / tooltip | 8px | E02 / E04 |
| 通用分段控件选中底 | 8px | E02 全局 tab ink |
| 参考首页局部 tab 选中底 | 10px | F/E02 局部覆盖；仅对应本项目同类变体时采用，不代表通用分段控件 |
| 内嵌缩略图 / 图片 | 8px | A，避免卡片内部重复大圆角 |
| modal / popover / 常规卡片 / 外层媒体卡 | 16px | E02 / E03 |
| 创作主输入容器 / 入口大卡 | 24px | F/E11主输入实测、E03入口卡 |
| 圆形按钮 / pill | 9999px | A，仅明确需要圆形或胶囊时 |
| dropdown / tooltip 阴影 | `0 8px 56px 0 #0000003d` | F/E02 `--shadow-dropdown-menu` |
| modal 阴影 | `0 8px 20px -4px rgba(8,12,20,.12)` | F/E02 `:root .lv-modal` |
| 常驻面板阴影 | 无 | A，以表面/描边区分 |

禁止普通卡片默认抬升、按钮大阴影，或同类组件无语义依据地混用8/10/12px圆角。首页局部10px tab应是命名变体，通用分段控件仍为8px。

## 5. 布局与侧栏

### 5.1 页面结构

A 每个普通页面使用 `应用外壳 → 页面容器 → PageHeader → 业务内容`。临时工作台、动作迁移、设置和项目库共用左上大标题与描述，页面级操作可置于标题区右侧，小屏换行。工作室的主标题采用30/38居中，创作输入容器内padding16；标题居中仅影响文字排列，不能引入另一套页面宽度。

本轮 A 采用以下横向布局硬规则，取代上一轮页面1400px、工作室1200px、创作输入1010px上限与各自居中的规则。这是本项目统一布局的决定，不是即梦参考站的新增测量结论。E02/E03中的原始局部padding和居中布局事实保持不变。

1. `.xyq-main`是唯一页面frame，以其可用`clientWidth`作为本页宽度基准，不使用`window.innerWidth`或`100vw`替代。侧栏展开、收起或移动抽屉改变可用空间后，所有页面内容继续使用同一frame。
2. 唯一横向间距变量为`--layout-gutter`，视口宽度≥1024px时40px，768–1023px时24px，<768px时16px。PageHeader、页面正文、工作流TopBar、底部actions、工作室composer和inspiration均使用该变量，并共享左右两条边线。
3. 所有页面级容器使用剩余主区全宽，不得设置独立`max-width`、`max-w-*`、`mx-auto`或自动横向外边距。外层padding只能施加一次，不能父容器和子容器叠加同一gutter。工作室输入卡外边缘与灵感区、普通页面主内容对齐，不再以1010px上限单独居中。
4. 段落、卡片内部说明、媒体预览或弹窗可以因可读性设置局部最大宽度，但其父页面frame及区块外边缘不得移动。组件内部16px/24px等padding不属于页面gutter，验收时不把输入文字起点与输入卡外边缘混为一谈。
5. 工作流header和footer处于同一frame，使用sticky与共享横向间距，不使用相对viewport的`fixed left`定位，也不保留fixed头部专用spacer。正文、header和actions必须随同一可用宽度变化，不各自计算侧栏偏移。

普通页面保留上40px、下64px和标题区至正文32px的纵向节奏；横向始终引用`--layout-gutter`。工作室和编辑器可以拥有不同的纵向留白，但不得改变横向基线。标题区不使用独立底色、边框或毛玻璃条。

### 5.1.1 滚动条与弹窗的布局约束

A `.xyq-main`是唯一页面级scrollport，使用`scrollbar-gutter:stable`。Home、普通页面和各工作流阶段不能再各自建立互不一致的页面级纵向滚动条；header、正文、sticky footer共享同一scrollport可用宽度。段落编辑器、长菜单、时间轴、媒体列表及对话框内部可以保留局部滚动，它们不得改变页面frame。

页面在loading、empty、error、短内容和长内容之间切换时，滚动条占位保持稳定。modal打开/关闭可以暂停背景滚动，但不能移除或重复添加页面gutter，不得使`.xyq-main.clientWidth`或背景内容左右边线发生变化。禁止假设滚动条永远覆盖在内容上，也禁止把6px写死为所有系统的实际占位；应以scrollport的实际clientWidth验证。

A/C01 本轮实现将页面级滚动统一到`.xyq-main`，所有页面横向基线采用40/24/16px规则。客户端页面路由（含查询参数）变化时，主滚动区立即回到顶部；工作流的session或activeStage变化时同样回到顶部，包含没有路由变化的自动阶段切换。同一页面、同一阶段内的数据刷新不触发滚动重置，不能因为轮询、状态更新或新增结果把正在阅读的用户拉回顶部。

工作流通过`ResizeObserver`读取当前sticky头部和底部操作区的实际高度，写入`--layout-sticky-header`与`--layout-sticky-footer`。主滚动区的`scroll-padding-block`分别采用头部高度加16px、底部高度加16px，使键盘聚焦或滚动定位的内容避开固定在滚动区边缘的控件。320px等窄屏下，顶部和底部操作控件允许换行；高度变化后须重新测量，不能用桌面固定高度推算。阶段或状态变化引入的新操作区也必须被观察。

### 5.1.2 几何验收公式

以`.xyq-main`的边界矩形`frameRect`、`clientLeft`、`clientWidth`和当前`--layout-gutter`值`g`计算：

```text
expectedLeft  = frameRect.left + main.clientLeft + g
expectedRight = frameRect.left + main.clientLeft + main.clientWidth - g
```

页面标题/内容区、TopBar内部控制区、actions内部控制区、composer外边框和inspiration区块，均需按各自真实内容边界核对这两条线。对于自身带页面padding的容器，应测量其padding内边界；对于已经位于页面padding内的整宽卡片，应测量卡片外边框，避免重复加gutter。每个边界与目标值的误差不得超过1 CSS px，同一页各基线之间误差也不得超过1 CSS px。

同时记录页面frame的宽度、各目标边界、实际左右padding、scrollWidth/clientWidth及滚动位置。只看CSS声明相等或只看截图没有横向溢出，均不能证明基线对齐。

### 5.2 侧栏结构和折叠

| 项目 | F 参考事实 | A 项目采用 |
| --- | --- | --- |
| 展开 / 收起宽度 | 240px / 64px，E02；两种状态均由 E08/E09 实测 | 240px / 64px |
| 展开背景 | `#171717` | 同值 |
| 收起背景与分隔 | `#121212`，右侧 inset 1px 次描边 | 同值 |
| 侧栏 padding | `14px 12px 12px` | 同值 |
| 品牌行 | 高 40px，logo 图 40px，品牌文本与 logo gap4 | 保留本项目品牌，行高40、展开logo28、图文gap8；收起触发区内logo32 |
| 展开时收起入口 | 品牌行右侧 28×28，圆角6；透明背景；文字色 tertiary，hover 主文字 | 尺寸同参考，默认文字白70%，hover白色且白12%底；有 `aria-label="收起侧边栏"` |
| 收起时展开入口 | logo 区 40×40；hover/focus 时 logo 淡出、16px 展开图标出现；单独右侧 toggle 隐藏 | 40×40按钮内32px自有logo与16px展开图标；有 `aria-label="展开侧边栏"` |
| 导航区 | column，gap4；距品牌行 gap32 | 同值 |
| 展开条目 | 高36、横向padding8、图文gap8、圆角8 | 同值 |
| 收起条目 | 36×36，居中，横向margin2、padding6 | 同值，并有 tooltip |
| 选中 / hover / pressed | 二级块 hover 8%白 / 8%白 / 12%白 | 同值，`aria-current="page"` |

A 导航默认使用白70%文字，选中/hover使用白色；当前导航14/20与参考14/22有所区别。任务中心展开时放在侧栏下方，收起时以图标打开300px宽浮层；设置菜单宽208px，提供配置入口和已有清缓存操作。业务操作不由视觉参照自动新增。

菜单仅保留本项目实际支持的入口。用户要求的“文艺短视频”“数字人口播”从侧边入口移除；`drama coo` / `dramacoo` 的该导航字段改为“工作室”。工作室右侧底部“历史记录”模块移除。该要求不授权清空已有业务数据。E10。

侧栏的折叠是当前用户界面状态，不影响业务数据与当前路由。A/C01 桌面偏好通过本地存储和仅保存布尔值的首屏偏好cookie同步；768px及以上默认展开或恢复用户偏好，没有在986px自动折叠。767px及以下以关闭的抽屉开始，不把移动抽屉开关覆盖桌面偏好。参考站是否以何种存储方式持久化该偏好为 U。

## 6. 组件及全状态

### 6.1 按钮

F/E04有固定36px默认按钮。A/C01通用按钮采用height与min-height36、上下padding0、横padding16、1px透明边框、14/20/500、圆角8、图文gap8；以border-box保持36px高度。紧凑变体height与min-height32、上下padding0、横padding12、文字12/18。按钮正文尽量使用明确动词。

| 类型 / 状态 | 背景 | 文字 / 边框 | 依据 |
| --- | --- | --- | --- |
| 主按钮 default | `#fafafa` | `#1a1a1a`，无边框 | F/E02 |
| 主按钮 hover | `#d9d9d9` | 同 default | F/E02 |
| 主按钮 pressed | `#b2b2b2` | 同 default | F/E02 |
| 主按钮 disabled | `#ffffff29` | `#ffffff33`，opacity1 | F/E02，A/C01同值 |
| 次按钮 default / hover / pressed | `#ffffff14` / `#ffffff1f` / `#ffffff29` | `#fafafa` | F/E02 |
| 次按钮 disabled | `#ffffff14` | `#ffffff33` | F/E02 |
| 文字按钮 default / hover / pressed | 透明；hover可用二级块背景 | `#ffffff99` / `#ffffffd9` / `#ffffff7a` | 文字色 F/E02；hover背景 A |
| 危险确认按钮 | default `#ff3355`，hover `#ff5c77`，pressed `#e52e4d` | 白文字；同时有动作文字 | A/C01，独立于普通主动作；hover/pressed为项目扩展值 |
| focus-visible | 保留该类型背景 | 2px `#009efa` 外轮廓，offset3 | A/C01；参考侧栏使用 2px/offset1 |
| loading | 保留原宽度与类型背景 | 16px spinner + “处理中”等真实状态 | A；参考存在 loading 样式 E02/E04 |

loading 状态不能重复提交，按钮应保持布局宽度，不用整页闪烁表示请求。disabled 不响应 hover/active，不使用父容器整体透明度反复叠加。无需为对齐样式改变现有确认和业务逻辑。

### 6.2 Input / Textarea / Select

A/C01 标准输入采用min-height36、圆角8、上下padding8、横padding12。正常正文继承约14/22；带`.ui-control`时为14/20，因此输入最终高度随内容与变体约38–40px，不能统一声称固定40px。紧凑搜索外框固定36px、输入文字13px。E04标准input有36px尺寸，E03搜索为33px；项目这些组合属于明确适配。

| 状态 | A 行为与样式 | 依据 / 边界 |
| --- | --- | --- |
| default | `.ui-input`使用白4%表面、1px主描边、主文字、占位文字 | A/C01；原生select使用surface背景 |
| hover | 保持表面，边框至白16% | A/C01，参考部分基础输入hover为品牌边框，首页搜索另有无边框覆盖 |
| focus | `.ui-input`为1px强调蓝边框；键盘focus-visible为2px蓝outline、offset3，无通用16%蓝ring | A/C01；各既有编辑器局部focus样式另核对 |
| filled | 保留正常表面，输入文本使用主文字 | A |
| disabled | 原表面、禁用文字，不可编辑；不响应hover/focus | 状态机制 F/E04，颜色 A/E02 |
| readonly | 允许选择复制，不能修改；不显示输入焦点强调 | 状态机制 F/E04；不能与disabled混淆 |
| invalid | 错误色边框，下方错误说明与图标；`aria-invalid` | 机制 F/E04，反馈文案和无障碍 A |
| loading | 非破坏性保留输入；旁侧显示请求状态 | A；按业务决定是否临时禁用提交 |

textarea采用同一表面和语义状态，高度由业务编辑区决定，不设所有页面统一的96px最小值。A工作室主输入文字16/26、最小高88px；参考E11编辑内容为14/24。创作外容器最小高172px、圆角24、内部padding16，使用135度暗灰渐变；宽度由第5.1节页面基线确定，不设置独立最大宽度或横向居中外边距。工作室容器聚焦时加强边框，内部输入无重复outline。表单label不能仅用placeholder代替。输入错误说明不得只显示颜色，也不得回显内部堆栈或敏感值。

### 6.3 Tabs 与分段控件

F/E02 全局tabs为高36、横padding20、gap8、文字13px/500，active白8%背景、圆角8。A/C01 通用`.ui-segmented`采用外壳圆角12、padding4、gap4；内部按钮min-height32、padding6×12、圆角8、文字13/20，default次文字，hover白文字与白4%底，selected白文字与白8%底。E02首页10px选中底及E11“生成/画布”的9999px渐变胶囊是参考局部变体，不能据此声称当前所有分段控件使用该值。

A/C01 当前通用分段筛选使用原生按钮与`aria-pressed`，通过Tab/Enter/Space操作；不冒称已实现tablist的方向键与Home/End状态机。若业务组件确为tabpanel切换，应使用对应tab语义并独立验证。页面路由导航仍使用链接。

### 6.4 Modal / Dialog

F/E02 modal背景`#1a1a1a`、圆角16、60%黑蒙层；header与footer padding24，正文左右padding24，内容14/22，标题16/24/500，关闭图标20px并有8px内边距。E04基础宽480px，E02删除确认局部宽510px。A/C01普通弹窗宽`min(480px,100%)`，素材选择680px、图片预览1100px；桌面蒙层padding24，因此最大可用宽为视口减48px；移动padding16，最大可用宽为视口减32px。项目关闭按钮32×32、图标18px。

A/C01 标题左对齐，关闭按钮右上，底部操作右对齐、gap8。桌面header padding24，body/footer为`0 24px 24px`；767px以下header padding20，body/footer为`0 20px 20px`。20属于项目间距序列，明确用作移动弹窗内容间距。dialog内容滚动，最大高度桌面`calc(100dvh - 48px)`、移动`calc(100dvh - 32px)`；背景锁定滚动且遵守第5.1.1节，不能改变页面scrollport的稳定gutter。共享Dialog实现首个控件聚焦、Tab焦点约束、最上层Escape、蒙层关闭和焦点返回；业务方仍需确认未保存内容语义。这是本项目代码行为，不证明参考站所有弹窗行为相同。

A/C01 本轮Dialog以`.ui-dialog`作为弹窗内部唯一scrollport，使用`overflow-y:auto`和`scrollbar-gutter:stable`；header/body/footer共享其可用宽度，body不另建纵向滚动区，header与footer在该滚动区内sticky。`ResizeObserver`测量真实头尾高度并更新`--dialog-header-height`、`--dialog-footer-height`，`scroll-padding-block`分别为头部高度加8px和底部高度加8px。窄屏操作换行或描述变长后，滚动留白随实际高度更新，键盘焦点不能被头尾遮挡；背景页面仍保持原滚动位置与横向基线。

### 6.5 Popover / Dropdown / Menu

F/E02为`#262626`、16px圆角、0.5px`#ccddff14`边框、dropdown阴影；F/E04 popover通用padding16。E13真实参数浮层核对了背景、圆角、padding与阴影，DPR1下computed边框为1px；源码声明和渲染量化结果均保留。A/C01浮层CSS声明同样为0.5px，默认菜单容器padding8，不能将参考表单popover的16px套到所有菜单。菜单项min-height36、padding8×12、圆角8、图文gap8；default透明、hover白12%，当前无独立pressed配色。表单型变体采用集数面板padding16、生成配置padding12，须由具体调用点的语义类启用，不能只声明一个未引用的CSS类便认定已采用。

A/C01浮层与触发器相距8px，视口安全边距12px，通用最大宽为`calc(100vw - 24px)`；没有统一180px最小宽或360px最大宽。设置菜单208px、任务中心300px，其他宽度由业务变体设置。共享Popover按上下可用空间翻转、按左右边界平移，监听触发器/面板尺寸、窗口resize和scroll，长列表内部滚动。点击外部、Escape关闭，Tab到达边界关闭并回到触发控件；选中是否关闭由单选/多选语义决定。触发器提供`aria-expanded`和适当的`aria-haspopup`。

### 6.6 Tooltip

F/E02与E12实测均为`#333`背景、白色文字、8px圆角、padding8px16px、12px/20px/400；E02定义dropdown阴影。A/C01侧栏提示采用同值、距图标右侧4px，hover/focus-visible延迟300ms显示、150ms透明度过渡、最大宽280px并允许换行。主导航、任务中心与设置的侧栏tooltip统一由侧栏容器处理Escape隐藏并保留焦点，在下一次鼠标进入/聚焦时恢复。导航链接本身保留可访问名称，提示文字`aria-hidden`以免重复朗读。此处记录项目采用行为，实际键盘路径是否通过仍以本轮验收为准；参考站是否所有tooltip支持延迟、换行与Escape仍为U。

### 6.7 Card / Empty / Loading / Error / Toast

| 类型 | A 规范 | 参考事实 |
| --- | --- | --- |
| 内容卡片 | surface背景、16px圆角、可选1px主描边、padding24；内容gap16；默认无阴影 | E02 常规16px卡片；padding为项目统一值 |
| 功能入口大卡 | 24px圆角、padding16、标题14/500、描述12/400 | E03 入口卡片还定义高76px，本项目仅同类卡采用固定76px |
| 空状态 | 低强调图标、标题、1段说明、最多1个主动作；不虚构历史、素材或成功结果 | E04 有empty图标48px与描述14px；项目布局/文案是A |
| 初始加载 | skeleton形状匹配真实内容，背景白8%，不能模拟已有真实资产 | E03有卡片skeleton与白8%背景 |
| 局部加载 | 共用`.ui-loading`大状态图标32px；按钮可用16pxspinner，保留已有内容并说明当前动作 | E04参考spin为20px；项目尺寸是A |
| 进度 | 仅展示后端真实进度；未知时显示不确定进度，不生成假百分比 | A |
| 可恢复错误 | 错误图标+可理解原因+现有重试动作；保留用户输入与已有结果 | A；功能错误色来自E02 |
| toast | `#333`、白文字、12px圆角、图文gap12、padding12×16；顶部24px居中，栈宽上限440px/视口减32px | 背景F/E02；尺寸与布局A/C01 |
| disabled / unavailable | 禁用文字+原因提示，不能只有灰色；提交条件不满足时解释缺少什么 | A |

每种异步操作必须区分 idle、loading、success、error；只有对应数据确实存在才展示success。生成、保存、删除等业务行为和错误处理不属于本轮可随意改写的视觉范围。

## 7. 响应式与动效

F/E02 的侧栏响应式规则在 `max-width:986px` 使用64px宽度。参考站的素材瀑布流另有810/1279/1536等断点，它们不直接适用于本项目表单和编辑器。公开移动端完整布局仍需另行观察。

| 视口 | A 项目规则 | 验收重点 |
| --- | --- | --- |
| ≥1024px | 恢复桌面偏好，默认240px/可收64px；`--layout-gutter:40px`；标题操作可同排 | 标题、header/body/footer与卡片共用左右基线 |
| 768–1023px | 保持同一桌面偏好，不在986px强制收起；`--layout-gutter:24px`；标题操作分行 | 收起/展开两态都使用同一24px间距 |
| <768px | 240px抽屉默认关闭；顶部导航条高48px，菜单按钮32×32；`--layout-gutter:16px`；普通页上下padding24/40px | 不强留64px侧栏占用窄屏，遮罩关闭、焦点返回 |
| 320–430px | 标题操作换行；输入/按钮可满行；modal留16px安全边距 | 无页面级横向溢出，核心操作可触达 |

移动端抽屉与768px断点为A的项目适配，并非即梦实测。当前移动菜单视觉/点击尺寸32px，44px触摸扩展尚非实现事实。工作室页面不设独立最大宽度，宽屏上下padding64px、移动上下32px，左右统一使用`--layout-gutter`；移动标题从30/38降至24/32。灵感卡片在1103px以下由3列变2列，在480px以下变1列，其区块边界不能随列数变化。侧栏切换不应使编辑内容丢失。复杂表格或时间轴如必须横向滚动，应将滚动限制在自身区域。

F/E02交互颜色过渡约100–120ms，侧栏收起约300ms、展开部分规则520ms，存在`prefers-reduced-motion`覆盖。A普通hover/focus过渡150ms，侧栏宽度/主内容位移及移动抽屉200ms，展开入口logo淡出150ms；工作流header/footer随所属frame联动，不允许保留另一套fixed-left时长。侧栏tooltip延迟300ms出现、过渡150ms。骨架pulse为1.6s。在`prefers-reduced-motion:reduce`下过渡/动画时长压至0.01ms、动画迭代1次，不复制复杂活动动效。

## 8. 可访问性与交互边界

本节是 A 的项目要求，不表示已对即梦做过完整可访问性审计。

- 所有可操作元素使用原生按钮、链接或正确表单元素；无名称图标按钮必须有可访问名称。当前导航使用 `aria-current`，展开器使用 `aria-expanded`。
- 页面按标题层级组织，PageHeader保留一个主标题；输入有label，说明/错误用 `aria-describedby` 关联。
- 键盘焦点可见且不被overflow裁剪。模态/浮层打开、关闭和焦点返回完整；禁用控件不出现可点击假象。
- 主文本、描述、表单值在真实背景上检查对比度；disabled与placeholder的低对比色不能用于正文。若为可读性调整参考值，须记录为项目采用差异。
- 状态变化用合适的 `role="status"` / `aria-live="polite"`，阻断错误采用明确通知。避免为每次spinner帧变化播报。
- 所有鼠标hover信息同时支持键盘；移动触摸操作不依赖hover。小视觉图标可通过透明点击区域扩大到44px。
- 图片替代文本描述资产或用途；装饰图标从辅助技术读取中隐藏。长文本可换行，200%缩放下核心功能可用。

## 9. 前端落地约束与验收

本规范进入前端时统一放入全局语义token和可复用组件，兼容现有 `--lp-*` 变量可通过映射完成。页面代码优先表达布局与业务，不重复写颜色常量、shadow字符串和任意圆角。主按钮、输入、PageHeader、tabs、dialog、popover、tooltip、empty/error/loading至少共享同一组基础规则。

验收覆盖工作室、项目库、临时工作台、动作迁移、设置，以及现有工作流各阶段、素材选择、预览和确认浮层。任何仅访问得到的遗留页面也应使用同一视觉语言；是否移除其路由另按业务要求判断。

| 检查 | 完成证据 |
| --- | --- |
| 颜色、字级、间距、圆角 | 页面截图与computed style核对；不只查看变量声明 |
| 左上标题结构与页面间距 | 按第5.1.2节测量标题、正文、TopBar、actions、composer和inspiration左右基线；每边误差≤1 CSS px |
| 侧栏240/64与导航删改 | 展开、收起、hover、键盘focus截图；菜单文字检查 |
| 按钮/输入各状态 | default/hover/focus/pressed/disabled/loading/error实际组件展示或业务路径 |
| Modal/Popover/Tooltip | 打开、关闭、边界定位、Escape、焦点返回与滚动检查 |
| 响应式与滚动条 | 宽度320/390/768/1024/1512/1920px逐一测量；记录`.xyq-main.clientWidth`与稳定gutter，不仅检查横向溢出 |
| 动效与可访问性 | reduced-motion、键盘走查、可访问名称、文本对比度 |
| 业务完整性 | 原有正常/失败流程及相关测试通过，不以假数据替代验证 |

### 9.1 横向基线的必检矩阵

A间距验收覆盖工作室、项目库、素材库、临时工作台、动作迁移、设置、旧流水线入口、全部工作流阶段，以及路由loading/error/not-found。每个适用场景必须包含：

- 视口宽320、390、768、1024、1512、1920 CSS px。768px及以上分别验证侧栏展开与收起；移动验证抽屉关闭、打开、关闭后的恢复。
- loading、empty、error、long四种内容状态；它们应使用相同页面frame，不因占位组件或错误分支改变gutter。
- 页面滚动到顶端和底端，检查sticky header/footer、正文和动作区仍共享左右基线；长表格/时间轴的局部横向滚动不得扩展页面frame。
- modal打开前、打开时、关闭后的背景边界和`.xyq-main.clientWidth`；上述值变化不得超过1 CSS px。Popover和tooltip不得扩大页面scrollWidth。
- 有实际占位滚动条和覆盖式滚动条的适用运行环境；记录环境，不把当前系统没有占位当作跨环境验证。
- 侧栏动画期间及最终稳定态，header/body/footer随同一frame变化；不能以动画结束后的单张截图掩盖独立定位的中途错位。
- 通过真实侧栏链接、工作流阶段按钮执行客户端导航；目的页面/阶段的主滚动位置应回到顶部。同一阶段的数据刷新应保留当前位置，并单独覆盖running状态的操作区变化。
- 320px窄屏控件换行后，检查页面及Dialog的实测头尾高度、scroll-padding和键盘焦点可见性；首尾内容不得被sticky操作区遮挡。

几何记录需给出预期左右边界、实测值、误差与状态标识，配合关键截图。任何目标边界误差大于1 CSS px，都应记录为未通过并继续修复，不能以“没有横向溢出”替代该检查。

上一轮主要采用截图与不溢出检查，这不足以证明页面之间、同页header/body/footer之间已对齐。上一轮截图不能作为本轮几何矩阵通过的替代证据。本文件是规范与参考证据，不充当代码测试报告；实现、测试数、生产构建、业务重启恢复和最终验收以本轮证据包实际结果为准。

### 9.2 本轮布局审计入口

A/C01 前端`npm run test:layout`运行`scripts/layout-audit.mjs`，用本机Chrome与隔离样例检查几何边界、主滚动区、sticky头尾、弹窗/抽屉开关和客户端导航。默认`UI_BASE_URL=http://127.0.0.1:3004`；3005等独立预览可显式覆盖。脚本拦截API请求，阻止非GET请求和外部网络请求，不将样例当作真实模型结果。

默认矩阵按6种宽度×2种侧栏状态×（8个普通页面场景＋6个工作流阶段×短/长2种内容）设计，共240个矩阵场景；移动端的两种侧栏状态指抽屉开/关。此外单独检查navigation与running状态。240仅说明矩阵覆盖规模，不是已通过数；额外检查数量、断言数量及通过结果必须读取本次实际报告后记录。

运行命令、报告与截图参数见[前端README](frontend/README.md)。本轮交付路径为`docs/evidence/阶段3-布局对齐/验收说明.md`；该验收说明记录实际执行环境、通过/失败与未覆盖项，不能用上一轮规范统一证据代替。

## 10. 已知差异与未确认项

1. 系统字体替代参考站专用字体，字形与排版可能有细小差异；项目采用值已明确。
2. 普通工具页左上24/32标题、表单min-height36及各业务高度、badge6px、辅助文字12/18、内嵌图片8px、移动抽屉、当前导航点击尺寸、焦点/ARIA规则、部分状态横幅是项目适配，不是即梦全部实测值。工作室30/38居中标题和创作输入24px圆角则由E11直接测得。
3. 未登录态无法证明登录后所有工具、素材详情和编辑器的布局；本轮不进入账号或付费流程取证。
4. HTML/CSS同时含新旧主题与页面局部覆盖，本文以当前v2覆盖为主；参考站更新后需要重新核对证据，不能只根据文件名认为永久一致。
5. 参考站公共页面可能有营销横幅、引导弹层和作品流。它们只用于观察现有组件，不属于本项目自动新增范围。
6. 当前参考截图不能替代本项目验收截图。未实际打开的 error/loading/disabled 状态只证明CSS定义或项目规范，不能标注“实测通过”。
7. 本次“更多设置”点击/悬停均未观察到设置菜单展开，不将相关尝试截图用作popover成功证据。popover的真实证据为E13“自动”生成偏好浮层，tooltip的真实证据为E12收起导航提示。
8. 本轮无页面级max-width/居中外边距、40/24/16横向gutter、唯一页面scrollport和≤1px几何标准均为项目采用规则；不宣称即梦全站具有完全相同的frame、断点或滚动结构。
