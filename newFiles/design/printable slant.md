# 背景
- 该页面是提供玩家打印题目的页面。
- 该页面的框架和元素固定，文案内容由外部json传入。

# 页面布局
- 参考icon/printable slant.jpg

# 页面元素
- mate:页面的title和description由json/printable slant.json传入。
- 打印区：打印区分为左右两块。
-- 左侧为打印预览区，显示系统生成题目的预览图。而打印页面的设置包括四部分：顶部（约占页面高度10%）是TITLE，文案为"Play Slant Daily"，中上是题目区（约占页面高度60%），中下是TIP区(约占20%)，这里会显示3条解题的TIP。底部（10%）显示网站域名，日期和一句话简单。其中域名和一句话文案由json/printable slant.json传入。日期则是打印生成的日期。
-- 右侧为设置区，设置区上方是H2和内容区，H2和内容区的文案内容由json传入。中间是两排三个CAT，第一排左边是”选择打印尺寸“，可选项包括US Letter和A4；右边为“是否打印解“，若玩家选是，则在生成打印时，会生成两页，第一页是不带解的题目。第二页是带解的题目。第二排Act是选择难度，分别是easy/medium/hard三个难度可选。每当玩家点击任一难度时，打印预览中的题目都会重新加载，而加载策略则是根据选择的难度，在题库中随机选题。
- sections:sections区域中，由若干个section构成，每个Scetion中，包括一个标题（H2）和一段内容。sections中的内容由json/printable slant.json传入。

# 设计要求
- 对移动端支持友好。



