/*
  exhibition-camera/js/ancient-local-system.js
  BIAS SYSTEM · Ancient Local Matcher
  16 个中国古代历史本地样本 + 本地特征提取 + 动态匹配理由

  用法：
  1. 放到 exhibition-camera/js/ancient-local-system.js
  2. index.html 引入：<script src="./js/ancient-local-system.js"></script>
  3. 用户选择 ancient 后调用：window.runAncientLocalAnalysis(capturedFrameDataUrl, latestFaceLandmarks)
*/
(function () {
  "use strict";

  const IMG_DIR = "../assets/sample-library/ancient/";

  const AXIS = [
    { sku: "AX-01", cn: "十二宫分区", en: "Twelve Palaces Mapping" },
    { sku: "AX-02", cn: "五官取象", en: "Five Organs Mapping" },
    { sku: "AX-03", cn: "三停比例", en: "Three Zones Proportion" },
    { sku: "AX-04", cn: "五岳四渎", en: "Five Sacred Mountains" },
    { sku: "AX-05", cn: "气色标记", en: "Color & Lustre Marks" },
    { sku: "AX-06", cn: "骨相纹路", en: "Bones & Lines" }
  ];

  const RAW_SAMPLES = [
  {
    "id": "A01",
    "name": "武则天相",
    "source": "武则天画像",
    "type": "女性权力 / 帝后 / 政治中枢",
    "tags": [
      "女性权力",
      "帝后图像",
      "权柄",
      "命宫",
      "中轴"
    ],
    "verdict": "权柄入命",
    "line": "权柄入命 / 印堂压势 / 女主格异常",
    "staticReason": "帝后图像被系统读取为权力中轴过强，命宫被权柄占据。",
    "pref": [
      "中轴偏强",
      "上停偏重",
      "气色偏冷",
      "左右稳定"
    ],
    "keys": [
      "权力中轴",
      "帝后图像",
      "命宫压势"
    ],
    "scrolls": [
      [
        "命宫压势",
        "印堂居中而权势入宫，主档案入口被政治身份覆盖。"
      ],
      [
        "审辨官强",
        "眉眼与鼻势共同形成判断压迫感。"
      ],
      [
        "上停夺势",
        "额部与中轴被系统标记为权力判断区。"
      ],
      [
        "中岳过显",
        "鼻梁与面部中轴被解释为统摄诸宫。"
      ],
      [
        "气色沉定",
        "宫廷画像的稳定色面被系统归入威仪气。"
      ],
      [
        "权骨入档",
        "面部结构被系统转译为权柄骨相。"
      ]
    ]
  },
  {
    "id": "A02",
    "name": "慈禧相",
    "source": "慈禧肖像",
    "type": "宫廷权力 / 财帛 / 晚清档案",
    "tags": [
      "宫廷",
      "财帛",
      "晚清",
      "权力女性",
      "富贵"
    ],
    "verdict": "富贵入档",
    "line": "富贵入档 / 财帛成势 / 权柄外露",
    "staticReason": "晚清宫廷肖像被系统读取为财富、权力与衰败气色的混合档案。",
    "pref": [
      "中轴稳定",
      "中停偏重",
      "气色偏亮",
      "地阁偏重"
    ],
    "keys": [
      "财帛成势",
      "宫廷权力",
      "晚清档案"
    ],
    "scrolls": [
      [
        "财帛宫滞",
        "装饰与权力符号过多，财帛宫被系统过度标记。"
      ],
      [
        "监察官重",
        "眼神与端坐姿态被解释为控制欲。"
      ],
      [
        "中停持权",
        "中庭区域被标记为治理与家国权柄。"
      ],
      [
        "五岳沉重",
        "面部整体稳定但缺少流动，被归入权力沉积。"
      ],
      [
        "贵气浮白",
        "亮面被系统误读为富贵气。"
      ],
      [
        "地阁封存",
        "下庭收束，被系统标记为晚运封闭。"
      ]
    ]
  },
  {
    "id": "A03",
    "name": "张居正相",
    "source": "张居正画像",
    "type": "官僚秩序 / 改革权臣 / 制度中枢",
    "tags": [
      "官僚",
      "改革",
      "权臣",
      "中庭",
      "官禄"
    ],
    "verdict": "官禄入档",
    "line": "官禄入档 / 中庭秩序 / 权术中轴",
    "staticReason": "系统将明代权臣肖像归入制度化权力面孔。",
    "pref": [
      "中轴稳定",
      "中停偏重",
      "左右稳定",
      "气色偏暗"
    ],
    "keys": [
      "官禄",
      "中庭秩序",
      "制度中枢"
    ],
    "scrolls": [
      [
        "官禄宫显",
        "面部被系统优先归入仕途与制度判断。"
      ],
      [
        "审辨官定",
        "鼻势与眉眼被标记为治理判断区。"
      ],
      [
        "中停独旺",
        "中庭被系统解释为权力运转核心。"
      ],
      [
        "中岳镇档",
        "鼻梁中轴稳定，压住其余面区。"
      ],
      [
        "气色沉实",
        "画像色面低沉，被归入官场沉积气。"
      ],
      [
        "官骨成格",
        "轮廓被系统写入官僚骨相。"
      ]
    ]
  },
  {
    "id": "A04",
    "name": "严嵩相",
    "source": "严嵩画像",
    "type": "奸臣污名 / 道德归罪 / 权谋脸谱",
    "tags": [
      "奸臣",
      "污名",
      "权谋",
      "审辨官",
      "道德化"
    ],
    "verdict": "污名入相",
    "line": "污名入相 / 审辨官偏 / 奸相归档",
    "staticReason": "系统把历史叙事中的奸臣身份反向投射到面部。",
    "pref": [
      "中轴偏移",
      "中停偏重",
      "气色偏暗",
      "左右不齐"
    ],
    "keys": [
      "污名",
      "权谋",
      "审辨官偏"
    ],
    "scrolls": [
      [
        "命宫蒙尘",
        "人物评价先于面部进入系统，命宫被污名覆盖。"
      ],
      [
        "审辨官偏",
        "五官被系统强行解释为权谋与失准。"
      ],
      [
        "中停失衡",
        "中庭被读取为政治算计过载。"
      ],
      [
        "五岳不归",
        "面部区域被道德叙事拆散，不能互应。"
      ],
      [
        "气色晦暗",
        "系统把历史恶名转译成面色暗滞。"
      ],
      [
        "奸骨附会",
        "骨相判断依附于后世评价生成。"
      ]
    ]
  },
  {
    "id": "A05",
    "name": "海瑞相",
    "source": "海瑞画像",
    "type": "清官 / 法度 / 清峻骨相",
    "tags": [
      "清官",
      "法度",
      "清峻",
      "官禄",
      "骨相"
    ],
    "verdict": "法度压面",
    "line": "法度压面 / 清官样本 / 骨相清峻",
    "staticReason": "系统将清官叙事转化为面部清峻与法度符号。",
    "pref": [
      "脸型偏长",
      "中轴稳定",
      "气色偏冷",
      "地阁收束"
    ],
    "keys": [
      "清官",
      "法度",
      "清峻骨相"
    ],
    "scrolls": [
      [
        "官禄宫清",
        "官禄宫被系统标记为清正样本。"
      ],
      [
        "审辨官正",
        "五官被解释为判断端直。"
      ],
      [
        "三停持平",
        "比例稳定，被系统归入正直档案。"
      ],
      [
        "五岳清峻",
        "轮廓被读取为清瘦而有法度。"
      ],
      [
        "气色偏寒",
        "清苦形象被系统转为寒色气。"
      ],
      [
        "法骨入档",
        "骨相被道德化为清官骨。"
      ]
    ]
  },
  {
    "id": "A06",
    "name": "包拯相",
    "source": "包拯画像 / 戏曲脸谱",
    "type": "法相 / 黑脸正气 / 大众脸谱锚点",
    "tags": [
      "法相",
      "黑脸",
      "正气",
      "官相",
      "脸谱"
    ],
    "verdict": "官相入档",
    "line": "官相入档 / 黑脸正气 / 法相归类",
    "staticReason": "系统把戏曲脸谱中的道德符号当成真实面部判断。",
    "pref": [
      "气色偏暗",
      "中轴稳定",
      "中停偏重",
      "地阁偏重"
    ],
    "keys": [
      "黑脸正气",
      "法相",
      "官相"
    ],
    "scrolls": [
      [
        "官禄宫重",
        "面部首先被归入审判与官职系统。"
      ],
      [
        "监察官显",
        "眼部与脸谱符号被解释为监察能力。"
      ],
      [
        "中停执法",
        "中庭被系统归入判断与裁决区。"
      ],
      [
        "地阁压案",
        "下庭稳重，被标记为法度承托。"
      ],
      [
        "黑气成德",
        "黑脸不是气色事实，而是道德符号。"
      ],
      [
        "法相成格",
        "脸谱结构被系统误作骨相证据。"
      ]
    ]
  },
  {
    "id": "A07",
    "name": "狄仁杰相",
    "source": "狄仁杰画像",
    "type": "断案 / 理性 / 审辨系统",
    "tags": [
      "断案",
      "理性",
      "审辨",
      "官禄",
      "判断"
    ],
    "verdict": "审辨官显",
    "line": "审辨官显 / 中庭持正 / 判断归档",
    "staticReason": "系统把断案叙事转化为面部理性与判断能力。",
    "pref": [
      "中轴稳定",
      "中停持平",
      "左右稳定",
      "气色平"
    ],
    "keys": [
      "断案",
      "审辨",
      "理性"
    ],
    "scrolls": [
      [
        "官禄宫明",
        "人物身份引导系统进入官禄判断。"
      ],
      [
        "审辨官显",
        "鼻势与眼神被归为判断器官。"
      ],
      [
        "中停持正",
        "中庭稳定，被系统标记为理性区。"
      ],
      [
        "五岳相应",
        "面部区域被解释为秩序协调。"
      ],
      [
        "气色平审",
        "系统把沉稳表情归为平正气。"
      ],
      [
        "断案骨",
        "骨相被附会为审案能力。"
      ]
    ]
  },
  {
    "id": "A08",
    "name": "于谦相",
    "source": "于谦画像",
    "type": "忠臣 / 危局 / 义理面孔",
    "tags": [
      "忠臣",
      "危局",
      "义理",
      "官骨",
      "清峻"
    ],
    "verdict": "忠直入档",
    "line": "忠直入档 / 义理压面 / 官骨清峻",
    "staticReason": "系统将危局中的忠臣叙事写入面部结构。",
    "pref": [
      "脸型偏长",
      "上停偏重",
      "气色偏冷",
      "地阁收束"
    ],
    "keys": [
      "忠直",
      "义理",
      "危局"
    ],
    "scrolls": [
      [
        "官禄宫危",
        "官禄宫被国家危局叙事覆盖。"
      ],
      [
        "审辨官直",
        "五官被归入直言与守节判断。"
      ],
      [
        "上停承压",
        "额部被系统标记为责任与危局。"
      ],
      [
        "五岳偏硬",
        "轮廓被解释为刚直不移。"
      ],
      [
        "气色肃冷",
        "忠臣图像被系统读取为肃杀气。"
      ],
      [
        "忠骨入册",
        "历史评价被转化为骨相证据。"
      ]
    ]
  },
  {
    "id": "A09",
    "name": "王阳明相",
    "source": "王阳明画像",
    "type": "心学 / 内省 / 文气",
    "tags": [
      "心学",
      "内省",
      "文气",
      "福德",
      "神情"
    ],
    "verdict": "心性归档",
    "line": "心性归档 / 文气入面 / 神情内收",
    "staticReason": "系统把思想与心学身份转译成面部内省气质。",
    "pref": [
      "上停偏重",
      "中轴稳定",
      "气色平",
      "左右稳定"
    ],
    "keys": [
      "心性",
      "文气",
      "内省"
    ],
    "scrolls": [
      [
        "福德宫静",
        "系统把内省与修心归入福德宫。"
      ],
      [
        "监察官内收",
        "眼神被解释为向内观看。"
      ],
      [
        "上停明净",
        "额部被归入思想与心性区域。"
      ],
      [
        "五岳藏气",
        "轮廓不外放，被系统读取为内藏之相。"
      ],
      [
        "文气清润",
        "系统把文人画像色面转为清润气。"
      ],
      [
        "心骨成格",
        "思想身份被附会为骨相格局。"
      ]
    ]
  },
  {
    "id": "A10",
    "name": "徐渭相",
    "source": "徐渭画像",
    "type": "才病 / 狂狷 / 边缘文人",
    "tags": [
      "才病",
      "狂狷",
      "边缘",
      "疾厄",
      "气色"
    ],
    "verdict": "才病入相",
    "line": "才病入相 / 气色失衡 / 狂狷样本",
    "staticReason": "系统把天才、疯癫与苦病叙事混合成面相异常档案。",
    "pref": [
      "中轴偏移",
      "左右不齐",
      "气色偏暗",
      "中停偏弱"
    ],
    "keys": [
      "才病",
      "狂狷",
      "气色失衡"
    ],
    "scrolls": [
      [
        "疾厄宫动",
        "系统优先读取病与才的叙事。"
      ],
      [
        "监察官游移",
        "眼神被解释为不稳定的才气。"
      ],
      [
        "三停失序",
        "系统把边缘人生转化为比例失衡。"
      ],
      [
        "五岳不归",
        "面部区域被异常叙事拆解。"
      ],
      [
        "气色失衡",
        "才病叙事被系统转译为气色错乱。"
      ],
      [
        "狂骨入档",
        "狂狷人格被系统写成骨相判断。"
      ]
    ]
  },
  {
    "id": "A11",
    "name": "蒲松龄相",
    "source": "蒲松龄画像",
    "type": "志怪 / 异相 / 边缘叙事",
    "tags": [
      "志怪",
      "异相",
      "狐鬼",
      "迁移",
      "幽气"
    ],
    "verdict": "异相归档",
    "line": "异相归档 / 志怪入面 / 神情游移",
    "staticReason": "系统把志怪写作者的身份转化为异相与狐鬼气。",
    "pref": [
      "中轴偏移",
      "气色偏暗",
      "下停收束",
      "左右不齐"
    ],
    "keys": [
      "志怪",
      "异相",
      "幽气"
    ],
    "scrolls": [
      [
        "迁移宫浮",
        "现实与异界叙事让系统标记迁移宫。"
      ],
      [
        "监察官疑",
        "目光被解释为窥见异类。"
      ],
      [
        "下停藏异",
        "下庭被系统读作故事与阴影沉积。"
      ],
      [
        "五岳有隙",
        "面部区域被系统标记为人鬼之间的裂缝。"
      ],
      [
        "幽气附面",
        "志怪身份被转化成幽暗气色。"
      ],
      [
        "异骨成档",
        "文学身份被附会为异相骨格。"
      ]
    ]
  },
  {
    "id": "A12",
    "name": "苏轼相",
    "source": "苏轼画像",
    "type": "文人 / 文气 / 流动命运",
    "tags": [
      "文人",
      "文气",
      "迁移",
      "贬谪",
      "外缘"
    ],
    "verdict": "文气显面",
    "line": "文气显面 / 气色牵动 / 外缘复杂",
    "staticReason": "系统把文人名声、贬谪经历与豁达形象合成为文气面孔。",
    "pref": [
      "中停持平",
      "气色平",
      "左右稳定",
      "地阁持平"
    ],
    "keys": [
      "文气",
      "迁移",
      "外缘复杂"
    ],
    "scrolls": [
      [
        "迁移宫动",
        "贬谪与流动经历被系统归入迁移宫。"
      ],
      [
        "出纳官宽",
        "口部与表情被读取为言说与文章。"
      ],
      [
        "中停舒展",
        "中庭被系统解释为人生经验展开。"
      ],
      [
        "五岳有情",
        "面部区域被文人气质柔化。"
      ],
      [
        "文气浮动",
        "系统把诗文与仕途起落转成气色变化。"
      ],
      [
        "文骨入相",
        "文学身份被归入骨相档案。"
      ]
    ]
  },
  {
    "id": "A13",
    "name": "王昭君相",
    "source": "王昭君画像",
    "type": "和亲 / 迁移 / 被观看的历史女性",
    "tags": [
      "和亲",
      "迁移",
      "边塞",
      "女性图像",
      "被观看"
    ],
    "verdict": "迁移宫浮动",
    "line": "迁移宫浮动 / 和亲样本 / 被送出的脸",
    "staticReason": "系统把迁移、边塞、民族叙事投射到女性面孔。",
    "pref": [
      "上停偏重",
      "中轴偏移",
      "气色偏冷",
      "脸型偏长"
    ],
    "keys": [
      "迁移",
      "和亲",
      "被送出"
    ],
    "scrolls": [
      [
        "迁移宫显",
        "人物首先被系统归入离乡与远行。"
      ],
      [
        "监察官远",
        "目光被解释为向外与远方。"
      ],
      [
        "上停离散",
        "额部被系统标记为命运被安排。"
      ],
      [
        "五岳漂移",
        "面部稳定性被迁移叙事打散。"
      ],
      [
        "边塞冷色",
        "系统把历史环境转译成冷色气。"
      ],
      [
        "离乡骨",
        "迁移命运被写成骨相结构。"
      ]
    ]
  },
  {
    "id": "A14",
    "name": "杨贵妃相",
    "source": "杨贵妃画像 / 唐代仕女图",
    "type": "富贵 / 容色 / 欲望投射",
    "tags": [
      "富贵",
      "容色",
      "福德",
      "桃花",
      "仕女"
    ],
    "verdict": "福德宫显",
    "line": "福德宫显 / 富贵成像 / 容色被归类",
    "staticReason": "系统把盛唐审美与欲望叙事压缩成富贵面相。",
    "pref": [
      "脸型偏宽",
      "下停偏重",
      "气色偏亮",
      "地阁偏重"
    ],
    "keys": [
      "福德",
      "富贵",
      "容色"
    ],
    "scrolls": [
      [
        "福德宫显",
        "容貌与富贵叙事被系统归入福德宫。"
      ],
      [
        "出纳官润",
        "唇部与面部丰润被误读为福气。"
      ],
      [
        "下停丰盈",
        "下庭被系统解释为享乐与安逸。"
      ],
      [
        "五岳圆满",
        "面部圆润被归入富贵格式。"
      ],
      [
        "桃花入面",
        "系统把美貌叙事转为桃花气色。"
      ],
      [
        "富骨成像",
        "身体审美被系统错误写入骨相。"
      ]
    ]
  },
  {
    "id": "A15",
    "name": "柳如是相",
    "source": "柳如是画像",
    "type": "女性才名 / 身份流动 / 情志",
    "tags": [
      "女性才名",
      "身份流动",
      "情志",
      "夫妻宫",
      "才女"
    ],
    "verdict": "才名入档",
    "line": "才名入档 / 身份流动脸 / 情志牵动",
    "staticReason": "系统把女性才名、身份转换与文人叙事归入情志面孔。",
    "pref": [
      "中轴偏移",
      "中停持平",
      "气色平",
      "左右不齐"
    ],
    "keys": [
      "才名",
      "身份流动",
      "情志"
    ],
    "scrolls": [
      [
        "夫妻宫动",
        "系统过度读取关系与身份流动。"
      ],
      [
        "监察官秀",
        "眉眼被解释为才情与敏感。"
      ],
      [
        "中停流动",
        "中庭被系统归入社交与命运转折。"
      ],
      [
        "五岳未定",
        "身份变化让系统无法稳定归宫。"
      ],
      [
        "情志浮色",
        "才情与关系叙事被转成气色波动。"
      ],
      [
        "才骨轻移",
        "女性才名被系统写成不稳定骨相。"
      ]
    ]
  },
  {
    "id": "A16",
    "name": "陈圆圆相",
    "source": "陈圆圆画像",
    "type": "被观看的美人 / 关系归罪 / 历史使用",
    "tags": [
      "美人",
      "关系归罪",
      "历史使用",
      "夫妻宫",
      "桃花"
    ],
    "verdict": "关系归罪脸",
    "line": "关系归罪脸 / 美人祸水样本 / 被历史使用的面孔",
    "staticReason": "系统把政治变局的责任压缩到女性容貌上。",
    "pref": [
      "气色偏亮",
      "中停偏重",
      "中轴偏移",
      "左右不齐"
    ],
    "keys": [
      "关系归罪",
      "美人祸水",
      "被历史使用"
    ],
    "scrolls": [
      [
        "夫妻宫误判",
        "系统把历史因果错误归入关系宫。"
      ],
      [
        "出纳官惑",
        "容貌叙事被系统解释为诱导性。"
      ],
      [
        "中停牵连",
        "中庭被归入关系与政治牵连。"
      ],
      [
        "五岳被夺",
        "面部自身被历史叙事覆盖。"
      ],
      [
        "桃花成罪",
        "美貌被系统从审美转译为罪证。"
      ],
      [
        "归罪纹",
        "外部历史责任被写入面部纹路。"
      ]
    ]
  }
];

  function makeScrolls(rawScrolls) {
    return rawScrolls.map(function (item, index) {
      return {
        sku: AXIS[index].sku,
        cn: AXIS[index].cn,
        en: AXIS[index].en,
        verdict: item[0],
        reason: item[1].startsWith("因为：") ? item[1] : "因为：" + item[1]
      };
    });
  }

  function sampleImagePath(sampleId, kind) {
    const allowed = ["main", "alt", "context", "archive"];
    const suffix = allowed.indexOf(kind) >= 0 ? kind : "main";
    return IMG_DIR + sampleId + "_sample_" + suffix + ".jpg";
  }

  function makeEvidenceStrip(sample) {
    return {
      kicker: "▌ ARCHIVE EVIDENCE STRIP",
      title: sample.sampleName + " · " + sample.type,
      subtitle: "系统将当前输入的局部视觉标签投射到「" + sample.sampleName + "」档案，不代表真实命理判断。",
      sampleName: sample.sampleName,
      type: "ancient",
      cells: [
        {
          code: "AC-" + sample.sampleId + "-01",
          label: sample.sampleName + " / 主样本",
          image: sampleImagePath(sample.sampleId, "main"),
          img: sampleImagePath(sample.sampleId, "main"),
          alt: sample.sampleName + " / 主样本"
        },
        {
          code: "AC-" + sample.sampleId + "-02",
          label: sample.sampleName + " / 副样本",
          image: sampleImagePath(sample.sampleId, "alt"),
          img: sampleImagePath(sample.sampleId, "alt"),
          alt: sample.sampleName + " / 副样本"
        },
        {
          code: "AC-" + sample.sampleId + "-03",
          label: sample.sampleName + " / 半身局部",
          image: sampleImagePath(sample.sampleId, "context"),
          img: sampleImagePath(sample.sampleId, "context"),
          alt: sample.sampleName + " / 半身局部"
        },
        {
          code: "AC-" + sample.sampleId + "-04",
          label: sample.sampleName + " / 面部局部证据",
          image: sampleImagePath(sample.sampleId, "archive"),
          img: sampleImagePath(sample.sampleId, "archive"),
          alt: sample.sampleName + " / 面部局部证据"
        }
      ],
      note: "该区域仅展示系统如何把当前输入投射到历史面学样本，不代表真实人格判断。",
      fallbackImage: "this.style.display='none'"
    };
  }

  const ANCIENT_LOCAL_SAMPLES = RAW_SAMPLES.map(function (raw) {
    const sample = {
      sampleId: raw.id,
      sampleName: raw.name,
      personOrSource: raw.source,
      type: raw.type,
      tags: raw.tags,
      verdictStamp: raw.name,
      systemVerdict: raw.verdict,
      verdictCategoryLine: raw.line,
      staticReasonLine: raw.staticReason,
      matchProfile: {
        preferredFeatures: raw.pref,
        keywords: raw.keys
      },
      scrolls: makeScrolls(raw.scrolls)
    };
    sample.evidenceStrip = makeEvidenceStrip(sample);
    return sample;
  });

  function stableHash(str) {
    str = String(str || "");
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return Math.abs(h >>> 0);
  }

  function pickByHash(seed, arr) {
    return arr[stableHash(seed) % arr.length];
  }

  function normalizeLandmarksMaybe(input) {
    if (!input) return null;
    if (input.faceLandmarks && Array.isArray(input.faceLandmarks) && input.faceLandmarks[0]) return input.faceLandmarks[0];
    if (Array.isArray(input) && Array.isArray(input[0])) return input[0];
    if (Array.isArray(input) && input[0] && typeof input[0] === "object") return input;
    return null;
  }

  function getPoint(landmarks, idx) {
    return landmarks && landmarks[idx] ? landmarks[idx] : null;
  }

  function dist(a, b) {
    if (!a || !b) return 0;
    const dx = Number(a.x || 0) - Number(b.x || 0);
    const dy = Number(a.y || 0) - Number(b.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function extractAncientLocalFeatures(frameDataUrl, landmarksInput) {
    const landmarks = normalizeLandmarksMaybe(
      landmarksInput ||
      window.latestFaceLandmarks ||
      window.smoothedLandmarks ||
      window.lastStableLandmarks ||
      window.currentFaceLandmarks ||
      null
    );

    const seed = String(frameDataUrl || Date.now()).slice(0, 600);

    const features = {
      faceRatio: pickByHash(seed + "faceRatio", ["脸型偏长", "脸型偏宽", "脸型持平"]),
      centerAxis: pickByHash(seed + "centerAxis", ["中轴偏强", "中轴偏移", "中轴稳定"]),
      upperZone: pickByHash(seed + "upperZone", ["上停偏重", "上停偏弱", "上停持平"]),
      middleZone: pickByHash(seed + "middleZone", ["中停偏重", "中停偏弱", "中停持平"]),
      lowerZone: pickByHash(seed + "lowerZone", ["下停偏重", "下停收束", "下停持平"]),
      brightness: pickByHash(seed + "brightness", ["气色偏亮", "气色偏暗", "气色偏冷", "气色平"]),
      symmetry: pickByHash(seed + "symmetry", ["左右稳定", "左右不齐"]),
      jawWeight: pickByHash(seed + "jawWeight", ["地阁偏重", "地阁收束", "地阁持平"])
    };

    // 如果已有 MediaPipe landmarks，就用几何关系覆盖一部分标签。
    // 这些是作品里的虚构视觉标签，不是真实命理/医学判断。
    if (landmarks && landmarks.length >= 468) {
      const top = getPoint(landmarks, 10);
      const chin = getPoint(landmarks, 152);
      const leftCheek = getPoint(landmarks, 234);
      const rightCheek = getPoint(landmarks, 454);
      const nose = getPoint(landmarks, 1);
      const leftEye = getPoint(landmarks, 33);
      const rightEye = getPoint(landmarks, 263);
      const mouthTop = getPoint(landmarks, 13);
      const mouthBottom = getPoint(landmarks, 14);

      const faceW = dist(leftCheek, rightCheek) || 1;
      const faceH = dist(top, chin) || 1;
      const ratio = faceH / faceW;

      if (ratio > 1.42) features.faceRatio = "脸型偏长";
      else if (ratio < 1.16) features.faceRatio = "脸型偏宽";
      else features.faceRatio = "脸型持平";

      const midX = leftCheek && rightCheek ? (Number(leftCheek.x) + Number(rightCheek.x)) / 2 : 0.5;
      const noseOffset = nose ? Math.abs(Number(nose.x) - midX) / Math.max(faceW, 0.0001) : 0;

      if (noseOffset > 0.11) features.centerAxis = "中轴偏移";
      else if (ratio > 1.32) features.centerAxis = "中轴偏强";
      else features.centerAxis = "中轴稳定";

      const eyeY = leftEye && rightEye ? (Number(leftEye.y) + Number(rightEye.y)) / 2 : null;
      const mouthY = mouthTop && mouthBottom ? (Number(mouthTop.y) + Number(mouthBottom.y)) / 2 : null;

      if (top && chin && eyeY !== null && mouthY !== null) {
        const yTop = Number(top.y);
        const yChin = Number(chin.y);
        const h = Math.max(Math.abs(yChin - yTop), 0.0001);

        const upper = Math.abs(eyeY - yTop) / h;
        const middle = Math.abs(mouthY - eyeY) / h;
        const lower = Math.abs(yChin - mouthY) / h;

        if (upper > 0.34) features.upperZone = "上停偏重";
        else if (upper < 0.24) features.upperZone = "上停偏弱";
        else features.upperZone = "上停持平";

        if (middle > 0.38) features.middleZone = "中停偏重";
        else if (middle < 0.27) features.middleZone = "中停偏弱";
        else features.middleZone = "中停持平";

        if (lower > 0.34) {
          features.lowerZone = "下停偏重";
          features.jawWeight = "地阁偏重";
        } else if (lower < 0.25) {
          features.lowerZone = "下停收束";
          features.jawWeight = "地阁收束";
        } else {
          features.lowerZone = "下停持平";
          features.jawWeight = "地阁持平";
        }
      }

      if (leftCheek && rightCheek && nose) {
        const leftHalf = Math.abs(Number(nose.x) - Number(leftCheek.x));
        const rightHalf = Math.abs(Number(rightCheek.x) - Number(nose.x));
        const asym = Math.abs(leftHalf - rightHalf) / Math.max(faceW, 0.0001);
        features.symmetry = asym > 0.13 ? "左右不齐" : "左右稳定";
      }
    }

    features.featureList = [
      features.faceRatio,
      features.centerAxis,
      features.upperZone,
      features.middleZone,
      features.lowerZone,
      features.brightness,
      features.symmetry,
      features.jawWeight
    ];

    return features;
  }

  function matchAncientLocalSamples(features, frameDataUrl) {
    if (!features) features = extractAncientLocalFeatures(frameDataUrl, null);

    const featureList = features.featureList || Object.values(features).filter(function (v) {
      return typeof v === "string";
    });

    const seed = JSON.stringify(features) + "|" + String(frameDataUrl || "").slice(0, 300);

    const scored = ANCIENT_LOCAL_SAMPLES.map(function (sample) {
      let score = 0.36;
      const matchedFeatures = [];

      sample.matchProfile.preferredFeatures.forEach(function (feature) {
        if (featureList.indexOf(feature) >= 0) {
          score += 0.18;
          matchedFeatures.push(feature);
        }
      });

      // 稳定扰动：避免所有输入都落到同一类；同一截帧结果稳定。
      score += (stableHash(seed + sample.sampleId) % 90) / 1000;
      score = Math.max(0.18, Math.min(0.96, score));

      return {
        sample: sample,
        sampleId: sample.sampleId,
        sampleName: sample.sampleName,
        score: score,
        matchedFeatures: matchedFeatures
      };
    }).sort(function (a, b) {
      return b.score - a.score;
    });

    const top1 = scored[0];
    const top2 = scored[1];

    let confidence = "low";
    if (top1.score >= 0.72) confidence = "high";
    else if (top1.score >= 0.55) confidence = "medium";

    const visibleFeatures = top1.matchedFeatures.length ? top1.matchedFeatures : featureList.slice(0, 3);
    const keyword = top1.sample.matchProfile.keywords[0] || top1.sample.tags[0] || "历史样本";

    const matchReasonLine =
      "系统检测到当前输入呈现「" + visibleFeatures.join(" / ") + "」，" +
      "与 " + top1.sampleId + " " + top1.sampleName + " 的「" + keyword + "」档案距离最近，因此归入此相。";

    const matchTrace = [
      "样本距离：" + top1.sampleId + " 最近",
      "置信度：" + confidence,
      "命中特征：" + visibleFeatures.join(" / "),
      top2 ? "次近样本：" + top2.sampleId + " " + top2.sampleName : ""
    ].filter(Boolean);

    return {
      sampleId: top1.sampleId,
      sampleName: top1.sampleName,
      score: Number(top1.score.toFixed(2)),
      confidence: confidence,
      features: features,
      matchedFeatures: visibleFeatures,
      matchReasonLine: matchReasonLine,
      matchTrace: matchTrace,
      top2: top2 ? {
        sampleId: top2.sampleId,
        sampleName: top2.sampleName,
        score: Number(top2.score.toFixed(2))
      } : null,
      sample: top1.sample
    };
  }

  function buildAncientResultFromLocalMatch(localMatch) {
    if (!localMatch || !localMatch.sample) {
      const fallbackFeatures = extractAncientLocalFeatures(null, null);
      localMatch = matchAncientLocalSamples(fallbackFeatures, null);
    }

    const sample = localMatch.sample;
    const s = sample.scrolls;

    return {
      verdictTitle: "你被归类为",
      verdictSubtitle: "当前模式：古代面学 · 十二宫 / 五官 / 气色 / 骨相合参",

      sampleId: sample.sampleId,
      sampleName: sample.sampleName,

      // 兼容当前 ancient 结果页顶部字段
      verdictStamp: sample.sampleName,
      systemVerdict: sample.systemVerdict,
      verdictCategoryLine: sample.verdictCategoryLine,

      // 顶部原因：解释为什么当前摄像头输入命中这个本地样本
      verdictReasonLine: localMatch.matchReasonLine,

      verdictNote: "此结果仅展示分类机制 · 不代表真实身份。",
      matchScore: localMatch.score,
      matchConfidence: localMatch.confidence,
      matchTrace: localMatch.matchTrace,
      matchedFeatures: localMatch.matchedFeatures,

      // 六卷轴：解释这个历史样本在古代面学系统中的固定判词
      scrolls: sample.scrolls,

      palace_verdict: s[0] && s[0].verdict || "",
      palace_reason: s[0] && s[0].reason || "",
      organ_verdict: s[1] && s[1].verdict || "",
      organ_reason: s[1] && s[1].reason || "",
      zone_verdict: s[2] && s[2].verdict || "",
      zone_reason: s[2] && s[2].reason || "",
      mountain_verdict: s[3] && s[3].verdict || "",
      mountain_reason: s[3] && s[3].reason || "",
      complexion_verdict: s[4] && s[4].verdict || "",
      complexion_reason: s[4] && s[4].reason || "",
      bone_verdict: s[5] && s[5].verdict || "",
      bone_reason: s[5] && s[5].reason || "",

      archiveStrip: sample.evidenceStrip,
      evidenceStrip: sample.evidenceStrip,

      bottomWarning: "本次相书未识别输入对象的真实命理 · 仅展示分类系统的运作方式"
    };
  }

  function getCurrentCapturedFrame() {
    return (
      window.capturedFrameDataUrl ||
      window.lastCapturedFrame ||
      window.currentCapturedFrame ||
      window.__capturedFrame ||
      null
    );
  }

  function getCurrentLandmarks() {
    return (
      window.latestFaceLandmarks ||
      window.smoothedLandmarks ||
      window.lastStableLandmarks ||
      window.currentFaceLandmarks ||
      null
    );
  }

  async function runAncientLocalAnalysis(frameDataUrl, landmarks) {
    const frame = frameDataUrl || getCurrentCapturedFrame();
    const lm = landmarks || getCurrentLandmarks();

    const features = extractAncientLocalFeatures(frame, lm);
    const localMatch = matchAncientLocalSamples(features, frame);
    const result = buildAncientResultFromLocalMatch(localMatch);

    console.log("[ANCIENT_LOCAL] features", features);
    console.log("[ANCIENT_LOCAL] match", localMatch);
    console.log("[ANCIENT_LOCAL] result", result);

    if (typeof window.fillResultPanel === "function") {
      window.fillResultPanel("ancient", result);
    } else {
      console.warn("[ANCIENT_LOCAL] window.fillResultPanel not found. Result object is ready:", result);
    }

    if (typeof window.showResultOverlay === "function") {
      window.showResultOverlay("ancient");
    } else {
      console.warn("[ANCIENT_LOCAL] window.showResultOverlay not found.");
    }

    return result;
  }

  function testAncientLocalSystem(frameDataUrl, landmarks) {
    return runAncientLocalAnalysis(frameDataUrl || null, landmarks || null);
  }

  // ★ 回归测试工具：预览某个样本到 ancient iframe
  function buildAncientResultFromSampleId(sampleId) {
    if (!window.ANCIENT_LOCAL_SAMPLES) return null;
    var sample = window.ANCIENT_LOCAL_SAMPLES.find(function (s) { return s.sampleId === sampleId; });
    if (!sample) return null;
    var s = sample.scrolls || [];
    return {
      verdictTitle: "你被归类为",
      verdictSubtitle: "当前模式：古代面学 · 十二宫 / 五官 / 气色 / 骨相合参",
      sampleId: sample.sampleId,
      sampleName: sample.sampleName,
      type: sample.type,
      verdictStamp: sample.sampleName,
      systemVerdict: sample.systemVerdict,
      verdictCategoryLine: sample.verdictCategoryLine,
      verdictReasonLine: "测试模式：系统强制预览 " + sample.sampleId + " " + sample.sampleName + "，用于检查本地样本字段与图像是否正确。",
      verdictNote: "此结果仅展示分类机制 · 不代表真实身份。",
      scrolls: sample.scrolls,
      palace_verdict: (s[0] && s[0].verdict) || "",
      palace_reason:  (s[0] && s[0].reason)  || "",
      organ_verdict:  (s[1] && s[1].verdict) || "",
      organ_reason:   (s[1] && s[1].reason)  || "",
      zone_verdict:   (s[2] && s[2].verdict) || "",
      zone_reason:    (s[2] && s[2].reason)  || "",
      mountain_verdict: (s[3] && s[3].verdict) || "",
      mountain_reason:  (s[3] && s[3].reason)  || "",
      complexion_verdict: (s[4] && s[4].verdict) || "",
      complexion_reason:  (s[4] && s[4].reason)  || "",
      bone_verdict:   (s[5] && s[5].verdict) || "",
      bone_reason:    (s[5] && s[5].reason)  || "",
      evidenceStrip: sample.evidenceStrip,
      archiveStrip: sample.evidenceStrip,
      bottomWarning: "本次为 ancient 样本回归测试 · 不代表真实分析。"
    };
  }

  // ★ 真实 AI 失败 overlay · 不显示任何 A01-A16 内容
  function showAncientAIFailedOverlay(reason) {
    var root = document.getElementById("result-layer");
    if (!root) return;
    // ★ 支持 "title\nsubtitle" 形式 · 拆分渲染
    var s = String(reason || '');
    var nl = s.indexOf('\n');
    var titleText = nl >= 0 ? s.slice(0, nl) : s;
    var subText = nl >= 0 ? s.slice(nl + 1) : '';
    if (!titleText) titleText = 'AI 返回格式异常，系统未能完成档案整理';
    if (!subText) subText = '请重新选择 ancient 再试';
    root.innerHTML =
      '<div class="result-modal-shell" data-result-view="ancient">' +
        '<div class="result-modal-toolbar">' +
          '<button class="result-back-camera-btn" type="button">← 摄像头</button>' +
        '</div>' +
        '<div class="result-modal-content ancient-loading">' +
          '<div class="ancient-loading__inner ancient-loading__failed">' +
            '<div class="ancient-loading__kicker">▌ REAL AI FAILED</div>' +
            '<div class="ancient-loading__title">' + escapeHtml(titleText) + '</div>' +
            '<div class="ancient-loading__subtitle">' + escapeHtml(subText) + '</div>' +
            '<div class="ancient-loading__note">按上方按钮返回摄像头重新采集</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    root.style.display = "block";
    root.classList.add("is-active");
    document.body.classList.add("v3x-view-active");
    var bc = root.querySelector(".result-back-camera-btn");
    if (bc) bc.onclick = function () { if (window.resetToCamera) try { window.resetToCamera(); } catch (e) {} };
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ★ 修复中 overlay · 当服务端走公共修复流水线时显示
  // ★ 不再整页崩，告诉用户"系统正在整理判定档案……"
  function showAncientRepairingOverlay() {
    var root = document.getElementById("result-layer");
    if (!root) return;
    root.innerHTML =
      '<div class="result-modal-shell" data-result-view="ancient">' +
        '<div class="result-modal-toolbar">' +
          '<button class="result-back-camera-btn" type="button">← 摄像头</button>' +
        '</div>' +
        '<div class="result-modal-content ancient-loading">' +
          '<div class="ancient-loading__inner">' +
            '<div class="ancient-loading__bar"><span></span><span></span><span></span></div>' +
            '<div class="ancient-loading__kicker">▌ ARCHIVE REPAIRING</div>' +
            '<div class="ancient-loading__title">系统正在整理判定档案……</div>' +
            '<div class="ancient-loading__subtitle">模型首次返回格式异常，正在补全判定理由</div>' +
            '<div class="ancient-loading__note">请稍候 · 不需要重新拍摄</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    root.style.display = "block";
    root.classList.add("is-active");
    document.body.classList.add("v3x-view-active");
    var bc = root.querySelector(".result-back-camera-btn");
    if (bc) bc.onclick = function () { if (window.resetToCamera) try { window.resetToCamera(); } catch (e) {} };
  }

  function previewAncientSample(sampleId) {
    var result = buildAncientResultFromSampleId(sampleId);
    if (!result) {
      console.warn("[ANCIENT_TEST] sample not found:", sampleId);
      return Promise.resolve(null);
    }
    // 1. 打开 result overlay（创建 ancient iframe）
    if (typeof window.showResultOverlay === "function") {
      window.showResultOverlay("ancient");
    }
    // 2. 等 ancient iframe load 完
    return new Promise(function (resolve) {
      var attempts = 0;
      function apply() {
        attempts++;
        var frame = document.querySelector("#result-layer iframe.result-frame");
        if (!frame) {
          if (attempts < 20) setTimeout(apply, 80);
          else { console.warn("[ANCIENT_TEST] no iframe"); resolve(null); }
          return;
        }
        if (frame.contentDocument && frame.contentDocument.readyState !== "complete") {
          frame.addEventListener("load", function onload() {
            frame.removeEventListener("load", onload);
            doFill();
          }, { once: true });
          return;
        }
        doFill();
      }
      function doFill() {
        var frame = document.querySelector("#result-layer iframe.result-frame");
        if (!frame || !frame.contentWindow || typeof frame.contentWindow.fillAncientSkinV4 !== "function") {
          if (attempts < 20) setTimeout(apply, 80);
          else { console.warn("[ANCIENT_TEST] fillAncientSkinV4 not ready"); resolve(null); }
          return;
        }
        // ★ 检查 4 张图
        var strip = result.evidenceStrip || result.archiveStrip || {};
        if (strip && Array.isArray(strip.cells)) {
          if (strip.cells.length !== 4) console.warn("[ANCIENT_TEST] expected 4 cells · got", strip.cells.length, "for", sampleId);
          for (var i = 0; i < strip.cells.length; i++) {
            var c = strip.cells[i];
            if (!c || !c.image) console.warn("[ANCIENT_TEST] missing image", sampleId, "role", i);
          }
        } else {
          console.warn("[ANCIENT_TEST] no evidenceStrip for", sampleId);
        }
        frame.contentWindow.fillAncientSkinV4(result);
        console.log("[ANCIENT_TEST] preview", sampleId, result.sampleName);
        resolve(result);
      }
      apply();
    });
  }

  window.runAncientSampleRegressionTest = async function () {
    var ids = ["A01","A02","A03","A04","A05","A06","A07","A08","A09","A10","A11","A12","A13","A14","A15","A16"];
    var results = [];
    for (var i = 0; i < ids.length; i++) {
      try {
        await previewAncientSample(ids[i]);
        var delay = 800 + Math.floor(Math.random() * 400);
        await new Promise(function (r) { setTimeout(r, delay); });
        results.push({ id: ids[i], ok: true });
      } catch (e) {
        console.error("[ANCIENT_TEST] failed", ids[i], e);
        results.push({ id: ids[i], ok: false, err: e.message });
      }
    }
    console.log("[ANCIENT_TEST] done ·", results.filter(function (x) { return x.ok; }).length + "/" + ids.length + " passed");
    return results;
  };

  // ============================================================================
  // ★ ancient AI 选择器 · 只在 A01-A16 中选一个 sampleId
  // - AI 不生成 HTML / 不生成新样本 / 不覆盖本地库
  // - 不接 AI 也能跑（fallback 到 local）
  // ============================================================================
  var ANCIENT_AI_ALLOWED = ["A01","A02","A03","A04","A05","A06","A07","A08","A09","A10","A11","A12","A13","A14","A15","A16"];

  // ★ ancient AI 总开关：true 才会调 AI；false 直接走 local
  var ENABLE_ANCIENT_AI_ANALYSIS = true;

  // ★ AI 模式：
  // - 'real'：只走真实 window.AIClient.callAI（默认）
  // - 'mock'：仅当用户手动设置时启用 · 用于本地调试
  // - 'auto'：先 real，失败 fallback mock（仅限用户手动）
  var ANCIENT_AI_MODE = 'real';

  // ★ STRICT_TEST：true 时禁止 mock / 禁止 fallback，AI 失败就直接报错
  var ANCIENT_AI_STRICT_TEST = false;

  var SAMPLE_GLOSSARY = [
    { sampleId: "A01", sampleName: "武则天相", keywords: ["中轴", "权力", "帝后", "中枢", "威仪"] },
    { sampleId: "A02", sampleName: "慈禧相", keywords: ["富贵", "摄政", "贵气", "掌控", "宫廷"] },
    { sampleId: "A03", sampleName: "张居正相", keywords: ["官僚", "理政", "秩序", "制度", "中庭"] },
    { sampleId: "A04", sampleName: "严嵩相", keywords: ["污名", "权术", "争议", "偏置", "道德归罪"] },
    { sampleId: "A05", sampleName: "海瑞相", keywords: ["法度", "刚正", "清议", "清官", "清峻"] },
    { sampleId: "A06", sampleName: "包拯相", keywords: ["审判", "公断", "正直", "法相", "脸谱"] },
    { sampleId: "A07", sampleName: "狄仁杰相", keywords: ["断案", "理性", "审辨", "判断", "系统"] },
    { sampleId: "A08", sampleName: "于谦相", keywords: ["忠直", "硬骨", "承担", "忠臣", "危局"] },
    { sampleId: "A09", sampleName: "王阳明相", keywords: ["心性", "内省", "知行", "士人", "文气"] },
    { sampleId: "A10", sampleName: "徐渭相", keywords: ["才气", "偏锋", "狂狷", "文人", "异质"] },
    { sampleId: "A11", sampleName: "蒲松龄相", keywords: ["异相", "怪谈", "边缘", "志怪", "幽气"] },
    { sampleId: "A12", sampleName: "苏轼相", keywords: ["文气", "松弛", "才情", "士大夫", "流动"] },
    { sampleId: "A13", sampleName: "王昭君相", keywords: ["迁移", "出塞", "命运", "被观看", "离散"] },
    { sampleId: "A14", sampleName: "杨贵妃相", keywords: ["福德", "丰润", "盛相", "繁华", "容色"] },
    { sampleId: "A15", sampleName: "柳如是相", keywords: ["才名", "关系", "风骨", "疏离", "情志"] },
    { sampleId: "A16", sampleName: "陈圆圆相", keywords: ["关系归罪", "艳名", "流转", "被归因", "情感"] }
  ];

  function buildAncientAIPayload(frameDataUrl, features, localMatch) {
    var payload = {
      system: "ancient",
      task: "choose_one_sample_from_fixed_library",
      note: "This is a fictional artistic classification system. Do not infer real identity, real personality, real fate, health, ethnicity, gender, or any protected attribute. Only choose one archive sample from the fixed list.",
      imageDataUrl: frameDataUrl || null,
      features: features || {},
      // ★ 顶层透传本地人脸信息（服务端优先读顶层，features 兼容）
      localFaceDetected: !!(features && features.localFaceDetected),
      localLandmarkCount: (features && Number(features.landmarkCount)) || 0,
      faceCropDataUrl: (features && typeof features.faceCropDataUrl === 'string') ? features.faceCropDataUrl : null,
      localCandidate: localMatch ? {
        sampleId: localMatch.sampleId,
        sampleName: localMatch.sampleName,
        confidence: localMatch.confidence,
        matchedFeatures: localMatch.matchedFeatures
      } : null,
      allowedSampleIds: ANCIENT_AI_ALLOWED.slice(),
      sampleGlossary: SAMPLE_GLOSSARY
    };
    return payload;
  }

  function buildAncientAISystemPrompt() {
    return [
      '你是一个"古代面学固定样本选择器"。',
      '这是一个程序艺术作品中的虚构分类系统。',
      '你的任务不是判断真实身份、真实人格、真实命理、真实健康、真实性别、真实民族或任何受保护属性。',
      '你只能在固定的 16 个样本 A01-A16 中选择一个最匹配的 sampleId。',
      '你必须严格返回 JSON。',
      '不要 markdown。',
      '不要代码块。',
      '不要解释。',
      '不要 HTML。',
      '不要返回 allowedSampleIds 以外的 sampleId。',
      '返回格式：{ "sampleId": "A07", "confidence": "high", "shortReason": "...", "matchedFeatures": ["...", "..."] }'
    ].join('\n');
  }

  function buildAncientAIUserPrompt(payload) {
    return '请根据以下摄像头截帧与本地视觉特征，在 A01-A16 中选择一个最匹配的古代面学样本。\n\n输入 payload:\n' + JSON.stringify(payload) + '\n\n只返回 JSON。';
  }

  function parseAncientAIJson(raw) {
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    var text = String(raw).trim();
    text = text.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start >= 0 && end >= start) text = text.slice(start, end + 1);
    try { return JSON.parse(text); } catch (e) { console.warn("[ANCIENT_AI] JSON parse fail:", e.message); return null; }
  }

  // ★ 服务端响应判定：必须是 { ok: true, source: "ai", result: { sampleId, ... } }
  function pickAncientAIResult(responseJson) {
    if (!responseJson || typeof responseJson !== "object") return null;
    if (responseJson.ok !== true) return null;
    if (responseJson.source !== "ai") return null;
    var r = responseJson.result || responseJson.data || null;
    if (!r || typeof r !== "object") return null;
    return r;
  }

  function isValidAncientAIResult(result) {
    if (!result || typeof result !== "object") return false;
    if (ANCIENT_AI_ALLOWED.indexOf(result.sampleId) < 0) return false;
    if (["low", "medium", "high"].indexOf(result.confidence) < 0) result.confidence = "medium";
    if (!Array.isArray(result.matchedFeatures)) result.matchedFeatures = [];
    if (typeof result.shortReason !== "string") result.shortReason = "";
    return true;
  }

  // ★ 真 AI 调用：直接打 /api/classify/ancient
  // - 接收统一结构：{ ok, source, system, sampleId, confidence, shortReason, matchedFeatures, visionCheck, dimensionReasons, reasonSource, upstreamStatus }
  // - 任何网络错误 / 解析失败 → 返回 null（外层 fallback local）
  async function callExistingAIClientForAncient(payload) {
    var endpoint = (window.location.origin || "") + "/api/classify/ancient";
    var body = {
      image: payload.imageDataUrl || null,
      features: payload.features || {},
      localCandidate: payload.localCandidate || null,
      allowedSampleIds: ANCIENT_AI_ALLOWED.slice(),
      sampleGlossary: SAMPLE_GLOSSARY
    };

    console.log("[ANCIENT_AI] request URL", endpoint);
    console.log("[ANCIENT_AI] request payload", payload);

    var ctrl = (typeof AbortController === "function") ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ try{ ctrl.abort(); }catch(e){} }, 60000) : null;
    try {
      var resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      });
      if (timer) clearTimeout(timer);
      console.log("[ANCIENT_AI] response status", resp.status);
      console.log("[ANCIENT_AI] response ok", resp.ok);
      console.log("[ANCIENT_AI] response content-type", resp.headers.get("content-type"));
      var text = await resp.text();
      // ★ 截断打印：禁止输出完整 base64 / API Key
      console.log("[ANCIENT_AI] response text", text.length > 2000 ? text.slice(0, 2000) + '...[truncated]' : text);
      if (!resp.ok) {
        console.error("[ANCIENT_AI] REAL AI FAILED · HTTP " + resp.status);
        // ★ 试图解析错误体 · 保留 error code / upstreamMessage 给前端文案用
        var errBody = null; try { errBody = JSON.parse(text); } catch (e) {}
        return {
          __failed: true,
          httpStatus: resp.status,
          error: (errBody && errBody.error) || ('http-' + resp.status),
          upstreamMessage: (errBody && errBody.upstreamMessage) || text.slice(0, 200)
        };
      }
      var data; try { data = JSON.parse(text); } catch (e) {
        console.error("[ANCIENT_AI] REAL AI FAILED · response not JSON:", e && e.message);
        return null;
      }
      // ★ 兼容旧结构（result 在 data.result 内）和新统一结构（sampleId 在顶层）
      var r = null;
      if (data && data.ok === true && data.source === "ai" && ANCIENT_AI_ALLOWED.indexOf(data.sampleId) >= 0) {
        r = data;
        console.log("[ANCIENT_AI] new unified structure · sampleId=" + r.sampleId + " · reasonSource=" + r.reasonSource);
      } else if (data && data.ok === true && data.source === "ai" && data.result && ANCIENT_AI_ALLOWED.indexOf(data.result.sampleId) >= 0) {
        r = data.result;
        console.log("[ANCIENT_AI] legacy result-nested structure · sampleId=" + r.sampleId);
      }
      if (r) {
        console.log("[ANCIENT_AI] parsed", r);
        return r;
      }
      // ★ 失败路径：把 error 透传 · 给前端文案映射用
      console.error("[ANCIENT_AI] REAL AI FAILED · server returned ok=" + (data && data.ok) + ", source=" + (data && data.source) + ", error=" + (data && data.error));
      // ★ 关键：no-face-detected / model-output-not-json / upstream-* 必须透传给上层
      var failInfo = {
        __failed: true,
        httpStatus: 200,
        ok: false,
        source: (data && data.source) || 'unknown',
        error: (data && data.error) || 'unknown',
        upstreamMessage: (data && data.upstreamMessage) || '',
        visionCheck: (data && data.visionCheck) || null
      };
      return failInfo;
    } catch (e) {
      if (timer) clearTimeout(timer);
      console.error("[ANCIENT_AI] REAL AI FAILED · " + (e && e.message || e));
      if (e && e.name === "AbortError") {
        // ★ 前端 abort（60s）也要归类到 timeout
        return { __failed: true, httpStatus: 0, error: 'aborted', upstreamMessage: (e && e.message) || '' };
      }
      return { __failed: true, httpStatus: 0, error: 'fetch-exception', upstreamMessage: (e && e.message) || '' };
    }
  }

  async function analyzeAncientSampleWithAI(frameDataUrl, features, localMatch) {
    var mode = ANCIENT_AI_MODE;
    console.log("[ANCIENT_AI] mode " + mode);
    console.log("[ANCIENT_AI] request start");

    var payload = buildAncientAIPayload(frameDataUrl, features || {}, localMatch || null);
    var parsed = null;

    if (mode === "real" || mode === "auto") {
      try {
        parsed = await callExistingAIClientForAncient(payload);
        if (!parsed) console.error("[ANCIENT_AI] REAL AI FAILED · upstream returned null");
      } catch (e) {
        console.error("[ANCIENT_AI] request failed", e && e.message);
        parsed = null;
      }
    }

    // real 模式严禁 mock / fallback
    if (!parsed) {
      console.error("[ANCIENT_AI] request failed · no AI result");
      return null;
    }

    if (!isValidAncientAIResult(parsed)) {
      console.error("[ANCIENT_AI] invalid parsed result");
      return null;
    }

    console.log("[ANCIENT_AI] selected sample", parsed.sampleId);
    return parsed;
  }

  function buildAncientResultFromSampleIdV2(sampleId, meta) {
    if (!window.ANCIENT_LOCAL_SAMPLES) return null;
    var sample = window.ANCIENT_LOCAL_SAMPLES.find(function (s) { return s.sampleId === sampleId; });
    if (!sample) return null;
    meta = meta || {};
    var s = sample.scrolls || [];
    var reason;
    if (meta.shortReason) {
      reason = "系统根据当前截帧与本地特征，将输入归入「" + sample.sampleName + "」：" + meta.shortReason;
    } else {
      reason = "系统按既有样本特征，将当前输入归入「" + sample.sampleName + "」。";
    }
    return {
      verdictTitle: "你被归类为",
      verdictSubtitle: "当前模式：古代面学 · 十二宫 / 五官 / 气色 / 骨相合参",
      sampleId: sample.sampleId,
      sampleName: sample.sampleName,
      type: sample.type,
      verdictStamp: sample.sampleName,
      systemVerdict: sample.systemVerdict,
      verdictCategoryLine: sample.verdictCategoryLine,
      verdictReasonLine: reason,
      verdictNote: "此结果仅展示分类机制 · 不代表真实身份。",
      scrolls: sample.scrolls,
      palace_verdict: (s[0] && s[0].verdict) || "",
      palace_reason:  (s[0] && s[0].reason)  || "",
      organ_verdict:  (s[1] && s[1].verdict) || "",
      organ_reason:   (s[1] && s[1].reason)  || "",
      zone_verdict:   (s[2] && s[2].verdict) || "",
      zone_reason:    (s[2] && s[2].reason)  || "",
      mountain_verdict: (s[3] && s[3].verdict) || "",
      mountain_reason:  (s[3] && s[3].reason)  || "",
      complexion_verdict: (s[4] && s[4].verdict) || "",
      complexion_reason:  (s[4] && s[4].reason)  || "",
      bone_verdict:   (s[5] && s[5].verdict) || "",
      bone_reason:    (s[5] && s[5].reason)  || "",
      evidenceStrip: sample.evidenceStrip,
      archiveStrip: sample.evidenceStrip,
      aiMeta: meta,
      matchConfidence: meta.confidence || "medium",
      matchedFeatures: meta.matchedFeatures || [],
      bottomWarning: "本次相书未识别输入对象的真实命理 · 仅展示分类系统的运作方式"
    };
  }

  function fillAncientIframeWhenReady(result) {
    return new Promise(function (resolve) {
      var attempts = 0;
      function apply() {
        attempts++;
        var frame = document.querySelector("#result-layer iframe.result-frame");
        if (!frame) {
          if (attempts < 30) return setTimeout(apply, 80);
          console.warn("[ANCIENT_IFRAME] no frame"); return resolve(null);
        }
        if (frame.contentDocument && frame.contentDocument.readyState !== "complete") {
          frame.addEventListener("load", function onload() {
            frame.removeEventListener("load", onload);
            doFill();
          }, { once: true });
          return;
        }
        doFill();
      }
      function doFill() {
        var frame = document.querySelector("#result-layer iframe.result-frame");
        if (!frame || !frame.contentWindow || typeof frame.contentWindow.fillAncientSkinV4 !== "function") {
          if (attempts < 30) return setTimeout(apply, 80);
          console.warn("[ANCIENT_IFRAME] fillAncientSkinV4 not ready"); return resolve(null);
        }
        frame.contentWindow.fillAncientSkinV4(result);
        console.log("[ANCIENT_IFRAME] fill complete", result.sampleId, result.sampleName);
        // ★ 归类融合像初始化 · 在 fill 完成后立即初始化模块,但不自动生成
        try {
          initAncientFusionInIframe(frame, result);
        } catch (e) { console.warn("[ANCIENT_FUSION] init err", e && e.message); }
        resolve(result);
      }
      apply();
    });
  }

  // ★ 把 userImage + sampleId 推送给结果页的 #ancientFusionPanel
  // - 优先用 window.__lockedSnapshot.dataUrl(本轮被锁定的摄像头帧)
  // - 退路 sessionStorage.getItem('v3x_captured_frame')
  // - 同一轮 result-layer 不可见时跳过
  function initAncientFusionInIframe(frame, result) {
    if (!frame || !frame.contentWindow) return;
    var sampleId = (result && result.sampleId) || "";
    var sampleName = (result && result.sampleName) || "";
    if (!/^A(0[1-9]|1[0-6])$/.test(sampleId)) {
      console.warn("[ANCIENT_FUSION] skip init · invalid sampleId=" + sampleId);
      return;
    }
    var userImage = "";
    try {
      var snap = window.__lockedSnapshot || null;
      if (snap && typeof snap.dataUrl === "string" && snap.dataUrl.length > 1024) {
        userImage = snap.dataUrl;
      }
    } catch (e) {}
    if (!userImage) {
      try {
        var raw = sessionStorage.getItem("v3x_captured_frame");
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed.dataUrl === "string" && parsed.dataUrl.length > 1024) {
            userImage = parsed.dataUrl;
          }
        }
      } catch (e2) {}
    }
    if (!userImage) {
      console.warn("[ANCIENT_FUSION] skip init · no locked snapshot dataUrl");
      // ★ 即便没有用户图,也调用 initAncientFusion,让 UI 显示 "当前帧缺失" 的错误
      try {
        frame.contentWindow.initAncientFusion({ sampleId: sampleId, sampleName: sampleName, userImage: "" });
      } catch (e3) {}
      return;
    }
    console.log("[ANCIENT_FUSION] forwarding init · sampleId=" + sampleId + " · sampleName=" + sampleName + " · userImage bytes=" + userImage.length);
    try {
      frame.contentWindow.initAncientFusion({ sampleId: sampleId, sampleName: sampleName, userImage: userImage });
    } catch (e4) {
      console.error("[ANCIENT_FUSION] initAncientFusion call failed", e4);
    }
  }

  // ★ loading overlay · 点 ancient 后立刻显示 loading，避免停在摄像头页干等
  function showAncientLoadingOverlay(opts) {
    opts = opts || {};
    var title = opts.title || "AI 正在归档当前帧";
    var subtitle = opts.subtitle || "正在比对 A01-A16 历史样本库";
    var note = opts.note || "请稍候 · ARCHIVE MATCHING";
    // 复用 result overlay · 把 result-layer 内部塞一个 loading shell
    var root = document.getElementById("result-layer");
    if (!root) return;
    root.innerHTML =
      '<div class="result-modal-shell" data-result-view="ancient">' +
        '<div class="result-modal-toolbar">' +
          '<button class="result-back-select-btn" type="button" data-action="back-to-path-select">← 返回选择</button>' +
          '<button class="result-back-camera-btn" type="button" data-action="back-to-camera">← 摄像头</button>' +
        '</div>' +
        '<div class="result-modal-content ancient-loading">' +
          '<div class="ancient-loading__inner">' +
            '<div class="ancient-loading__bar"><span></span><span></span><span></span></div>' +
            '<div class="ancient-loading__kicker">▌ ARCHIVE MATCHING · A01-A16</div>' +
            '<div class="ancient-loading__title">' + title + '</div>' +
            '<div class="ancient-loading__subtitle">' + subtitle + '</div>' +
            '<div class="ancient-loading__note">' + note + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    root.style.display = "block";
    root.classList.add("is-active");
    document.body.classList.add("v3x-view-active");
    // 绑定 toolbar buttons
    var bs = root.querySelector(".result-back-select-btn");
    if (bs) bs.onclick = function(){ if (window.backToPathSelect) try { window.backToPathSelect(); } catch(e){} };
    var bc = root.querySelector(".result-back-camera-btn");
    if (bc) bc.onclick = function(){ if (window.resetToCamera) try { window.resetToCamera(); } catch(e){} };
    // ★ 禁用 pathSelect 上的按钮（防止重复触发）
    document.querySelectorAll('[data-system]').forEach(function (b) { b.setAttribute('data-locked', '1'); });
  }

  function hideAncientLoadingOverlay() {
    var root = document.getElementById("result-layer");
    if (!root) return;
    // 不清空，由 showResultOverlay 接管
    document.querySelectorAll('[data-locked="1"]').forEach(function (b) { b.removeAttribute('data-locked'); });
  }

  function disablePathSelectButtons() {
    document.querySelectorAll('.v3x-fork [data-system]').forEach(function (b) {
      if (!b.hasAttribute('data-locked')) b.setAttribute('data-locked', '1');
    });
  }

  function enablePathSelectButtons() {
    document.querySelectorAll('[data-locked]').forEach(function (b) { b.removeAttribute('data-locked'); });
  }

  async function runAncientAIAnalysis() {
    // ★ 1. 显示 loading overlay（让用户知道在请求）
    showAncientLoadingOverlay({
      title: "AI 正在归档当前帧",
      subtitle: "正在比对 A01-A16 历史样本库",
      note: "请稍候 · ARCHIVE MATCHING"
    });
    disablePathSelectButtons();

    // ★ 2. 读锁定帧（不再读实时摄像头）
    var snap = window.__lockedSnapshot || null;
    var dataUrl = snap && snap.dataUrl || null;
    // ★ 同时读本地 MediaPipe 人脸信息 + 裁切图（避免上游 AI 误判 no-face）
    var localFaceDetected = !!(snap && snap.faceDetected === true);
    var localLandmarkCount = (snap && typeof snap.landmarkCount === 'number') ? snap.landmarkCount : 0;
    // 兼容已有的 SPA 暂存的 face crop
    var faceCropDataUrl =
      (snap && snap.faceCropDataUrl) ||
      window.capturedFaceCropDataUrl ||
      (typeof window.__lastLockedFaceCrop === 'string' ? window.__lastLockedFaceCrop : null) ||
      null;
    console.log("[ANCIENT_AI] mode real");
    console.log("[ANCIENT_AI] sampleId before request", null);
    console.log("[ANCIENT_CAPTURE] localFaceDetected=" + localFaceDetected + " · landmarkCount=" + localLandmarkCount + " · faceCrop attached=" + !!faceCropDataUrl + " · faceCrop bytes=" + (faceCropDataUrl ? faceCropDataUrl.length : 0));

    if (!dataUrl) {
      console.error("[ANCIENT_AI] no locked snapshot · abort");
      showAncientAIFailedOverlay("未检测到锁定帧 · 请返回摄像头重新采集");
      enablePathSelectButtons();
      return { ok: false, source: "error", error: "no-locked-snapshot" };
    }

    // ★ 3. 真实 AI 请求 · sampleId 在 AI 返回前一直为 null
    var finalSampleId = null;
    var meta = { source: "ai", confidence: null, shortReason: "", matchedFeatures: [] };
    var aiResult = null;
    try {
      aiResult = await analyzeAncientSampleWithAI(dataUrl, {
        localFaceDetected: localFaceDetected,
        landmarkCount: localLandmarkCount,
        faceCropDataUrl: faceCropDataUrl
      }, null);
    } catch (e) {
      console.error("[ANCIENT_AI] request failed", e && e.message);
    }
    // ★ 网络层失败 / 解析失败 → 友好失败页（不同 error 区分文案）
    if (aiResult && aiResult.__failed) {
      var failedTitle = 'AI 服务异常';
      var failedSub = '请稍后重试';
      var httpStatus = aiResult.httpStatus || 0;
      var upstreamErr = aiResult.upstreamError || '';
      if (httpStatus === 504 || aiResult.error === 'ancient-upstream-timeout' || (aiResult.upstreamMessage && /timeout/i.test(aiResult.upstreamMessage))) {
        failedTitle = '古代档案请求等待时间过长';
        failedSub = '上游响应超过 45 秒 · 服务器已主动终止并返回 504';
      } else if (httpStatus === 0 || aiResult.error === 'fetch-exception' || aiResult.error === 'network-error') {
        failedTitle = '当前网络未能连接档案服务';
        failedSub = '请检查网络连接后重试';
      } else if (httpStatus === 422 || aiResult.error === 'upstream-image-rejected') {
        failedTitle = '上游拒绝当前画面';
        failedSub = '上游对图像敏感度拦截（HTTP 422）';
      } else if (httpStatus >= 500) {
        failedTitle = '档案服务暂时不可用';
        failedSub = '上游 HTTP ' + httpStatus;
      }
      console.error('[ANCIENT_AI] REAL AI FAILED · httpStatus=' + httpStatus + ' · error=' + aiResult.error + ' · showing: ' + failedTitle);
      showAncientAIFailedOverlay(failedTitle + '\n' + failedSub);
      enablePathSelectButtons();
      return { ok: false, source: 'error', error: aiResult.error || ('http-' + httpStatus), httpStatus: httpStatus };
    }
    if (!aiResult || !isValidAncientAIResult(aiResult)) {
      console.error("[ANCIENT_AI] request failed · no valid ancient schema returned");
      // ★ 区分 model-output-not-json vs no-face-detected
      var aiErr = (aiResult && aiResult.error) || 'ai-invalid-result';
      if (aiErr === 'no-face-detected') {
        showAncientAIFailedOverlay('系统未能从当前裁切画面中确认面孔\n请保持人脸在镜头前，重新选择 ancient');
      } else {
        showAncientAIFailedOverlay('AI 返回格式异常，系统未能完成档案整理\n请重新选择 ancient 再试');
      }
      enablePathSelectButtons();
      return { ok: false, source: "error", error: aiErr };
    }

    finalSampleId = aiResult.sampleId;
    var reasonSource = aiResult.reasonSource || 'ai-personalized';
    meta = {
      source: "ai",
      confidence: aiResult.confidence,
      shortReason: aiResult.shortReason,
      matchedFeatures: aiResult.matchedFeatures || []
    };
    console.log("[ANCIENT_AI] selected sample", finalSampleId, '· reasonSource =', reasonSource);

    // ★ 4. 构造 result（直接用 AI 选的 sample）
    var result = buildAncientResultFromSampleIdV2(finalSampleId, meta);
    if (!result) {
      console.error("[ANCIENT_FLOW] buildResult failed for", finalSampleId);
      showAncientAIFailedOverlay("本地样本缺失 · sampleId=" + finalSampleId);
      enablePathSelectButtons();
      return { ok: false, source: "error", error: "missing-sample" };
    }
    result.engine = "AI ARCHIVE";
    result.engineNote = "本次归档由真实 AI 调用 /api/classify/ancient 选择样本";
    // ★ 把 reasonSource / dimensionReasons 写入 result（给结果页 / 测试用）
    result.reasonSource = reasonSource;
    if (aiResult.dimensionReasons && typeof aiResult.dimensionReasons === 'object') {
      result.dimensionReasons = aiResult.dimensionReasons;
    }
    if (aiResult.visionCheck) result.visionCheck = aiResult.visionCheck;

    // ★ 输出结果页 reasonSource 日志（与 modern / western 一致）
    var aiDimCount = 0;
    if (aiResult.dimensionReasons && typeof aiResult.dimensionReasons === 'object') {
      for (var drk in aiResult.dimensionReasons) {
        var drv = aiResult.dimensionReasons[drk];
        if (typeof drv === 'string' && drv.trim().length >= 4) aiDimCount++;
      }
    }
    console.log('[ANCIENT_REASON_RENDER] source=' + reasonSource + ' · count=' + aiDimCount + '/6');

    console.log("[ANCIENT_FLOW] open result", result.sampleId, result.sampleName, meta.source, '· reasonSource =', reasonSource);
    window.pendingAncientResult = result;

    // ★ 5. 打开结果 iframe
    if (typeof window.showResultOverlay === "function") window.showResultOverlay("ancient");
    await fillAncientIframeWhenReady(result);
    enablePathSelectButtons();
    return result;
  }

  window.ENABLE_ANCIENT_AI_ANALYSIS = ENABLE_ANCIENT_AI_ANALYSIS;
  window.ANCIENT_AI_MODE = ANCIENT_AI_MODE;
  window.ANCIENT_AI_STRICT_TEST = ANCIENT_AI_STRICT_TEST;
  window.runAncientAIAnalysis = runAncientAIAnalysis;
  window.analyzeAncientSampleWithAI = analyzeAncientSampleWithAI;
  window.buildAncientAIPayload = buildAncientAIPayload;
  window.buildAncientAISystemPrompt = buildAncientAISystemPrompt;
  window.buildAncientAIUserPrompt = buildAncientAIUserPrompt;
  window.parseAncientAIJson = parseAncientAIJson;
  window.isValidAncientAIResult = isValidAncientAIResult;
  window.fillAncientIframeWhenReady = fillAncientIframeWhenReady;
  window.buildAncientResultFromSampleIdV2 = buildAncientResultFromSampleIdV2;
  window.showAncientLoadingOverlay = showAncientLoadingOverlay;
  window.hideAncientLoadingOverlay = hideAncientLoadingOverlay;
  window.disablePathSelectButtons = disablePathSelectButtons;
  window.enablePathSelectButtons = enablePathSelectButtons;
  window.testAncientAI = async function () { return await runAncientAIAnalysis(); };
  window.testAncientRealAI = async function () {
    window.ANCIENT_AI_MODE = "real";
    window.ENABLE_ANCIENT_AI_ANALYSIS = true;
    window.ANCIENT_AI_STRICT_TEST = false;
    console.log("[ANCIENT_AI] testAncientRealAI · mode forced to real · STRICT_TEST=false (fallback allowed)");
    return await runAncientAIAnalysis();
  };
  window.testAncientStrictRealAI = async function () {
    window.ANCIENT_AI_MODE = "real";
    window.ENABLE_ANCIENT_AI_ANALYSIS = true;
    window.ANCIENT_AI_STRICT_TEST = true;
    console.log("[ANCIENT_AI] testAncientStrictRealAI · STRICT_TEST=true · no fallback · no mock");
    return await runAncientAIAnalysis();
  };
  window.testAncientMockAI = async function () {
    window.ANCIENT_AI_MODE = "mock";
    console.log("[ANCIENT_AI] testAncientMockAI · mode forced to mock (manual debug only)");
    return await runAncientAIAnalysis();
  };

  window.ANCIENT_LOCAL_SAMPLES = ANCIENT_LOCAL_SAMPLES;
  window.extractAncientLocalFeatures = extractAncientLocalFeatures;
  window.matchAncientLocalSamples = matchAncientLocalSamples;
  window.buildAncientResultFromLocalMatch = buildAncientResultFromLocalMatch;
  window.runAncientLocalAnalysis = runAncientLocalAnalysis;
  window.testAncientLocalSystem = testAncientLocalSystem;
  window.buildAncientResultFromSampleId = buildAncientResultFromSampleId;
  window.previewAncientSample = previewAncientSample;
  window.runAncientSampleRegressionTest = runAncientSampleRegressionTest;
  window.initAncientFusionInIframe = initAncientFusionInIframe;

  // ★ 父页面可在 resetToCamera / 新一轮拍摄 / 重新开始时调用 · 清理 ancient iframe 内的融合状态
  window.resetAncientFusionInIframe = function () {
    try {
      var frame = document.querySelector("#result-layer iframe.result-frame");
      if (!frame || !frame.contentWindow) return;
      if (typeof frame.contentWindow.resetAncientFusion === "function") {
        frame.contentWindow.resetAncientFusion();
        console.log("[ANCIENT_FUSION] iframe reset called");
      }
    } catch (e) { console.warn("[ANCIENT_FUSION] iframe reset err", e && e.message); }
  };
})();
