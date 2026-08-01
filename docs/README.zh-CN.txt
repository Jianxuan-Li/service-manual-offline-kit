TIS Page Saver — 安装与使用
================================

功能
----
在 Toyota TIS (techinfo.toyota.com) 的任意手册页面上,点一下工具栏图标,
把当前正在看的那一页保存为"自包含 HTML"(所有插图内嵌为 base64),
完全离线可看。想要 PDF 就用浏览器打开保存的文件后 Cmd+P → 另存为 PDF。

安装 (Chrome)
-------------
1. 解压这个文件夹到任意固定位置(别放临时目录,删了插件就失效)
2. Chrome 地址栏输入: chrome://extensions
3. 右上角打开「开发者模式 (Developer mode)」
4. 点「加载已解压的扩展程序 (Load unpacked)」→ 选择这个文件夹
5. (可选) 点拼图图标把 TIS Page Saver 固定到工具栏

使用
----
1. 登录 TIS,打开任意一篇手册文档(比如 PARKING BRAKE: DISASSEMBLY)
2. 等页面完全加载(能看到正文和插图)
3. 点工具栏上的红色图标
4. 图标显示 "..." = 正在抓取(内嵌图片需要几秒)
   图标显示 "OK"  = 已下载,文件在  下载/TIS/  文件夹里
   图标显示 "ERR" = 失败(看下方"常见问题")
   图标显示 "!"   = 当前页不是 TIS 网站

保存路径按 TIS 左侧目录树分层建文件夹,顶层是十个大分区之一
(general / brake / engine_hybrid_system / suspension / ...),
下面跟标题里冒号分隔的各级,最后一段是文件名:

  Title: PARKING BRAKE: PARKING BRAKE SYSTEM: ADJUSTMENT; 2007 MY GS450H
    -> TIS/brake/parking_brake/parking_brake_system/adjustment.html

  Title: INTRODUCTION: HOW TO USE THIS MANUAL: GENERAL INFORMATION; ...
    -> TIS/general/introduction/how_to_use_this_manual/general_information.html

加了顶层分区之后,不同大章里的同名节点(比如 General 下的 INTRODUCTION
和其它分区下的 INTRODUCTION)就不会再撞到一起。相邻重复的层级会自动
合并,所以 BRAKE 分区下的 BRAKE 组不会变成 brake/brake/。

图标状态:
  OK   = 目录来自左侧导航树(最准)
  OK*  = 没读到导航树,用标题+分区对照表推的(黄色徽章)
  ERR  = 失败

重复保存同一页会「直接覆盖」旧文件,不会生成 (1)(2)。所以图没存全的
页面,在线重存一次就自动修好,不用手动删。

整理已下载的旧文件:
  node reorg-existing.js ~/Downloads/TIS --dry    先看一遍
  node reorg-existing.js ~/Downloads/TIS          实际执行
认不出分区的会放进 _unsorted/,不会被瞎归类。

常见问题")
   图标显示 "!"   = 当前页不是 TIS 网站

保存路径自动按手册页标题分层建文件夹。标题里分号(;)后面的车型年份
部分会被丢掉,冒号(:)分隔的每一段变成一层目录,最后一段是文件名:

  Title: PARKING BRAKE: PARKING BRAKE SYSTEM: ADJUSTMENT; 2007 MY GS450H [...]
    → 下载/TIS/parking_brake/parking_brake_system/adjustment.html

  Title: REAR DISC BRAKE: REAR DISC BRAKE CALIPER ASSEMBLY: REMOVAL; ...
    → 下载/TIS/rear_disc_brake/rear_disc_brake_caliper_assembly/removal.html

这样一个总成的 COMPONENTS / REMOVAL / INSTALLATION / ADJUSTMENT 会自动
归到同一个文件夹里,整个文件夹拷到手机就是一本离线分册。

重复保存同一页会「直接覆盖」旧文件,不会生成 (1)(2)。所以图没存全的
页面,在线重存一次就自动修好,不用手动删。

常见问题
--------
- ERR 且页面刚打开: 手册内容是分帧异步加载的,等插图显示出来再点。
- ERR 且反复失败: 刷新页面 (Cmd+R) 等加载完再点一次。
  (TIS 的查看器偶尔会有内容帧空载的情况,刷新即可解决)
- 下载的文件打开没有图: 保存时网络中断导致个别图片内嵌失败,
  重新在线打开该页再存一次。

离线使用建议
------------
把 下载/TIS/ 里的 HTML 传到手机(AirDrop / 数据线),手机浏览器
直接打开即可,地下车库无信号也能看。

注意
----
TIS 内容是付费订阅的版权材料,仅限个人维修参考,请勿分发。

设置页面
--------
右键点工具栏图标 → 「选项 (Options)」,可以改:
1. Save folder — 保存目录,默认 TIS。可以写多层,比如 cars/gs450h
2. Overwrite existing files — 重复保存直接覆盖(建议开)
3. Ask where to save each time — 每次弹系统保存框,可以存到硬盘任意位置

注意: Chrome 插件只能往「下载目录」里写文件,这是浏览器的限制,不是插件
的问题。想彻底换位置有三个办法:
  a) 在设置页里指定一个好记的子目录
  b) 勾上「Ask where to save each time」,每次自己选路径
  c) 去 chrome://settings/downloads 改 Chrome 自己的下载目录(影响所有下载)

macOS 上还有个更省事的办法: 把 下载/TIS 拖到 Finder 侧边栏收藏,
或者建个替身放桌面:
  ln -s ~/Downloads/TIS ~/Documents/GS450h
