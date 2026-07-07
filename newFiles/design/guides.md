# 背景
- 该页面是玩家阅读指引和规则的页面。
- 该页面的框架和元素固定，文案内容由外部json传入。

# 页面布局
- 参考icon/guides.jpg

# 页面元素
- mate:页面的title和description由json/guides.json传入。
- H1：由json/guides.json传入，页面顶部居中显示。
- 副文案：由json/guides.json传入，在H1下方式显示。
- 文章列表区，按两列三行显示6个文章列表卡片，每个卡片中包括：配图、标题、摘要以及continue reading的cat。在6张卡片下方，则是一个分页功能。每一页对以上6个文章进行切换。文章列表中的内容来自于content中的MDX文件。目前还没有录入MDX数据，模拟两条数据进行演示。
- Sections: Sections区域中，包括若干section，每个section中有标题和内容（H2）。文案由json/guides.json传入。



# 设计要求
- 对移动端支持友好。



