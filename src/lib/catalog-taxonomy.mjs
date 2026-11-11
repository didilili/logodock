// Industry definitions are shared by intake validation and directory navigation.
export const industryGroups = [
  {
    id: 'technology',
    label: '科技与软件',
    children: [
      {
        id: 'internet-platforms',
        label: '综合互联网',
        description: '多业务互联网集团与平台',
        aliases: ['互联网', '大厂', 'internet'],
      },
      {
        id: 'search',
        label: '搜索服务',
        description: '通用或垂直搜索服务',
        aliases: ['搜索引擎', 'search'],
      },
      {
        id: 'ai-products',
        label: 'AI 模型与应用',
        description: '模型、智能体和以 AI 为核心的应用',
        aliases: ['人工智能', '大模型', 'LLM', 'agent'],
      },
      {
        id: 'enterprise-software',
        label: '企业软件',
        description: '面向企业的管理、协作及行业应用软件',
        aliases: ['SaaS', 'ERP', 'CRM', 'OA', '办公', 'HR'],
      },
      {
        id: 'cloud',
        label: '云与基础设施',
        description: '云计算、托管及计算基础设施服务',
        aliases: ['云计算', 'IaaS', 'PaaS', 'cloud'],
      },
      {
        id: 'data-platforms',
        label: '数据与数据库',
        description: '数据库、数据治理、分析及数据平台',
        aliases: ['数据仓库', 'BI', '大数据', 'database'],
      },
      {
        id: 'developer-tools',
        label: '开发工具',
        description: '编码、版本控制、代码托管及开发自动化',
        aliases: ['代码托管', 'Git', 'IDE', '开发者', 'devtools'],
      },
      {
        id: 'security',
        label: '网络安全',
        description: '网络、信息、数据安全产品与服务',
        aliases: ['网安', '安全', 'security'],
      },
      {
        id: 'operating-systems',
        label: '操作系统',
        description: '通用与专用操作系统',
        aliases: ['OS', 'Linux', '国产系统'],
      },
      {
        id: 'creative-software',
        label: '效率与创意软件',
        description: '个人效率、影像、内容制作及文件工具',
        aliases: ['工具软件', '视频', '编辑', '图像', '创作'],
      },
      {
        id: 'industrial-software',
        label: '工业软件',
        description: '工业设计、制造执行与工业互联网软件',
        aliases: ['MES', 'EDA', 'CAD', '工业互联网'],
      },
    ],
  },
  {
    id: 'electronics',
    label: '电子与硬件',
    children: [
      {
        id: 'consumer-electronics',
        label: '消费电子',
        description: '手机、穿戴、影像、显示等终端产品',
        aliases: ['手机', '数码', '穿戴', '相机'],
      },
      {
        id: 'appliances',
        label: '家用电器',
        description: '家庭电器与家用清洁设备',
        aliases: ['家电', '空调', '冰箱', '扫地机'],
      },
      {
        id: 'semiconductors',
        label: '半导体',
        description: '芯片、存储器及半导体设计制造',
        aliases: ['芯片', 'IC', 'GPU', '存储', '半导体', 'semiconductor'],
      },
      {
        id: 'computing-hardware',
        label: '计算设备',
        description: '计算机、服务器及计算硬件',
        aliases: ['PC', '电脑', '服务器', '算力'],
      },
      {
        id: 'security-imaging',
        label: '安防与影像设备',
        description: '安防监控与视频物联硬件',
        aliases: ['监控', '摄像头', '视频物联'],
      },
    ],
  },
  {
    id: 'telecom',
    label: '通信与网络',
    children: [
      {
        id: 'telecom-operators',
        label: '通信运营',
        description: '公众通信运营服务',
        aliases: ['电信', '移动', '联通', '运营商'],
      },
      {
        id: 'telecom-equipment',
        label: '通信设备',
        description: '通信终端、无线及网络设备',
        aliases: ['通信', '基站', '路由', '交换机'],
      },
      {
        id: 'network-infrastructure',
        label: '网络基础设施',
        description: '网络连接与传输基础设施服务',
        aliases: ['网络', '传输', 'CDN'],
      },
    ],
  },
  {
    id: 'mobility',
    label: '汽车与出行',
    children: [
      {
        id: 'automakers',
        label: '整车品牌',
        description: '乘用车、商用车及新能源整车',
        aliases: ['汽车', '车企', '电动车', '新能源车'],
      },
      {
        id: 'autonomous-driving',
        label: '自动驾驶',
        description: '自动驾驶技术与系统',
        aliases: ['智驾', 'ADAS', '无人驾驶'],
      },
      {
        id: 'auto-components',
        label: '汽车零部件与技术',
        description: '汽车电子、零部件与车载技术',
        aliases: ['汽车电子', '车载', '供应商'],
      },
      {
        id: 'ride-services',
        label: '出行服务',
        description: '乘客出行、共享骑行及网约车服务',
        aliases: ['打车', '网约车', '共享单车'],
      },
      {
        id: 'micro-mobility',
        label: '两轮与微出行',
        description: '电动两轮车、滑板车等交通产品',
        aliases: ['电动车', '两轮', '平衡车', '滑板车'],
      },
      {
        id: 'auto-information',
        label: '汽车资讯与导航',
        description: '汽车资讯、估值、交易信息及地图导航',
        aliases: ['汽车媒体', '地图', '导航', '二手车估值'],
      },
    ],
  },
  {
    id: 'industry',
    label: '工业与制造',
    children: [
      {
        id: 'automation',
        label: '工业自动化',
        description: '控制、检测、运动控制及工业自动化设备',
        aliases: ['工控', '伺服', 'PLC', '机器视觉'],
      },
      {
        id: 'robotics',
        label: '机器人',
        description: '人形、工业与物流机器人及核心技术',
        aliases: ['具身智能', '机器人', '人形', '物流机器人'],
      },
      {
        id: 'heavy-equipment',
        label: '工程机械',
        description: '工程机械及相关作业装备',
        aliases: ['重工', '挖掘机', '工程装备'],
      },
      {
        id: 'electrical-equipment',
        label: '电气设备',
        description: '电力管理、配电与工业电气设备',
        aliases: ['电气', '配电', '电力管理'],
      },
      {
        id: 'manufacturing-equipment',
        label: '制造设备',
        description: '增材制造及其他专用生产设备',
        aliases: ['3D打印', '打印机', '制造装备'],
      },
      {
        id: 'materials',
        label: '材料制造',
        description: '工业材料、化学品及基础制造',
        aliases: ['材料', '化工', '钢铁'],
      },
    ],
  },
  {
    id: 'finance',
    label: '金融与保险',
    children: [
      {
        id: 'banking',
        label: '银行',
        description: '银行机构',
        aliases: ['商业银行', '银行', 'bank'],
      },
      {
        id: 'securities-investment',
        label: '证券与投资',
        description: '证券经纪、资产管理与投资机构',
        aliases: ['券商', '证券', '投资', '基金'],
      },
      {
        id: 'insurance',
        label: '保险',
        description: '保险集团、保险机构及保险服务平台',
        aliases: ['保险', '保险经纪', 'insure'],
      },
      {
        id: 'payments',
        label: '支付与金融科技',
        description: '支付、数字金融基础设施及综合金融科技',
        aliases: ['支付', 'fintech', '金融科技'],
      },
      {
        id: 'consumer-finance',
        label: '消费金融',
        description: '消费信贷与相关金融服务',
        aliases: ['消费金融', '借贷', '信贷'],
      },
      {
        id: 'financial-information',
        label: '金融信息与投研',
        description: '证券信息、投资研究及投顾服务',
        aliases: ['财经', '行情', '投研', '投顾'],
      },
    ],
  },
  {
    id: 'commerce',
    label: '电商与零售',
    children: [
      {
        id: 'ecommerce',
        label: '综合电商',
        description: '综合或垂直线上购物平台',
        aliases: ['电商', '购物', '商城'],
      },
      {
        id: 'cross-border-commerce',
        label: '跨境电商',
        description: '面向跨境交易的电商平台',
        aliases: ['跨境', '出海', '电商'],
      },
      {
        id: 'resale',
        label: '二手交易',
        description: '二手商品、回收与循环交易',
        aliases: ['回收', '二手', '循环'],
      },
      {
        id: 'retail',
        label: '零售连锁',
        description: '线下及线上线下融合零售品牌',
        aliases: ['零售', '门店', '连锁'],
      },
      {
        id: 'wholesale-trade',
        label: '批发与贸易',
        description: '批发、采购、进出口及贸易服务',
        aliases: ['贸易', '进出口', '采购', '供应链'],
      },
    ],
  },
  {
    id: 'media',
    label: '内容与文娱',
    children: [
      {
        id: 'social-community',
        label: '社交与社区',
        description: '社交网络、社区及用户内容平台',
        aliases: ['社交', '社区', 'UGC'],
      },
      {
        id: 'news-publishing',
        label: '新闻与出版',
        description: '媒体资讯、数字出版及内容服务',
        aliases: ['媒体', '新闻', '出版', '门户'],
      },
      {
        id: 'video-music',
        label: '视频与音乐',
        description: '长短视频、直播、音乐平台',
        aliases: ['视频', '音乐', '直播', '短视频'],
      },
      {
        id: 'games',
        label: '游戏与电竞',
        description: '游戏研发、发行及电竞',
        aliases: ['游戏', '电竞', '手游', '网游'],
      },
      {
        id: 'film-animation',
        label: '影视与动漫',
        description: '影视制作、动漫及发行',
        aliases: ['影视', '动画', '动漫'],
      },
    ],
  },
  {
    id: 'consumer',
    label: '消费品',
    children: [
      {
        id: 'food-beverages',
        label: '食品与饮料',
        description: '食品、饮料及相关消费品牌',
        aliases: ['食品', '饮料', '零食'],
      },
      {
        id: 'fashion',
        label: '服饰与鞋包',
        description: '服装、鞋履、箱包及配饰品牌',
        aliases: ['服饰', '运动鞋', '箱包'],
      },
      {
        id: 'beauty',
        label: '美妆与个护',
        description: '化妆品、护肤及个人护理',
        aliases: ['美妆', '护肤', '洗护'],
      },
      {
        id: 'home-goods',
        label: '家居与日用',
        description: '家具、家居用品及日用消费品',
        aliases: ['家居', '家具', '日用', '椅子'],
      },
      {
        id: 'jewelry-watches',
        label: '珠宝与钟表',
        description: '珠宝、腕表及相关配饰',
        aliases: ['珠宝', '首饰', '钟表'],
      },
    ],
  },
  {
    id: 'lifestyle',
    label: '生活与旅游',
    children: [
      {
        id: 'dining',
        label: '餐饮',
        description: '餐饮连锁与餐饮服务品牌',
        aliases: ['餐饮', '火锅', '餐厅', '美食'],
      },
      {
        id: 'local-services',
        label: '本地生活',
        description: '餐饮外卖及其他本地消费服务平台',
        aliases: ['外卖', '团购', '生活服务'],
      },
      {
        id: 'travel',
        label: '旅游服务',
        description: '旅行预订与旅游活动服务',
        aliases: ['旅游', '旅行', 'OTA', '门票'],
      },
      {
        id: 'hospitality',
        label: '酒店与住宿',
        description: '酒店、民宿及住宿品牌',
        aliases: ['酒店', '民宿', '住宿'],
      },
      {
        id: 'fitness',
        label: '运动与健身',
        description: '运动场馆、健身及相关服务',
        aliases: ['健身', '运动', '体育'],
      },
    ],
  },
  {
    id: 'health',
    label: '医疗与健康',
    children: [
      {
        id: 'healthcare',
        label: '医疗服务',
        description: '医疗机构及医疗服务平台',
        aliases: ['医院', '医疗', '诊疗'],
      },
      {
        id: 'pharma-biotech',
        label: '医药与生物科技',
        description: '药物研发、生物技术及研发制造服务',
        aliases: ['医药', '生物', 'CRO', 'CDMO', '制药'],
      },
      {
        id: 'medical-devices',
        label: '医疗器械',
        description: '医疗设备、器械及诊断设备',
        aliases: ['医疗器械', '医学影像', '设备'],
      },
      {
        id: 'wellness',
        label: '健康管理',
        description: '健康管理、健康服务与康养',
        aliases: ['健康', '康养', '健康管理'],
      },
    ],
  },
  {
    id: 'education',
    label: '教育与科研',
    children: [
      {
        id: 'training',
        label: '教育培训',
        description: '面向学生及成人的教学培训',
        aliases: ['教育', '培训', '学习', '考研'],
      },
      {
        id: 'universities',
        label: '学校与高校',
        description: '学校、高等院校及教育机构',
        aliases: ['大学', '学校', '高校'],
      },
      {
        id: 'education-technology',
        label: '教育科技',
        description: '教育工具、学习平台及教育技术',
        aliases: ['教育科技', '作业', '在线教育'],
      },
      {
        id: 'research',
        label: '科研机构',
        description: '科研院所与独立研究组织',
        aliases: ['科研', '研究所', '实验室'],
      },
    ],
  },
  {
    id: 'transport',
    label: '交通与物流',
    children: [
      {
        id: 'express-logistics',
        label: '快递与物流',
        description: '快递、综合物流及物流运营',
        aliases: ['快递', '物流', '速运'],
      },
      {
        id: 'freight-warehousing',
        label: '货运与仓储',
        description: '货物运输、货运平台及仓储服务',
        aliases: ['货运', '仓储', '运力', '搬家'],
      },
      {
        id: 'aviation-shipping',
        label: '航空与航运',
        description: '航空公司、航运公司及相关运输',
        aliases: ['航空', '航运', '运输'],
      },
      {
        id: 'public-transport',
        label: '公共交通',
        description: '轨道、公交及其他公共交通',
        aliases: ['地铁', '公交', '铁路'],
      },
    ],
  },
  {
    id: 'energy',
    label: '能源与环保',
    children: [
      {
        id: 'new-energy',
        label: '新能源',
        description: '光伏、储能及新能源技术设备',
        aliases: ['光伏', '储能', '新能源', '太阳能'],
      },
      {
        id: 'power',
        label: '电力与公用事业',
        description: '电力生产供应及公共事业运营',
        aliases: ['发电', '电网', '水务', '燃气'],
      },
      {
        id: 'environment',
        label: '环境服务',
        description: '环保治理、废弃物处理及环境服务',
        aliases: ['环保', '环境', '碳', '排放'],
      },
    ],
  },
  {
    id: 'professional',
    label: '企业与专业服务',
    children: [
      {
        id: 'marketing',
        label: '营销与广告',
        description: '广告传播、品牌营销及营销代理',
        aliases: ['营销', '广告', '品牌传播'],
      },
      {
        id: 'recruitment',
        label: '人力与招聘',
        description: '招聘平台、人力资源及人才服务',
        aliases: ['招聘', '人力', '猎头'],
      },
      {
        id: 'consulting-legal',
        label: '咨询与法律',
        description: '咨询、法律及其他专业顾问服务',
        aliases: ['咨询', '法律', '律所'],
      },
      {
        id: 'outsourcing',
        label: '外包与运营服务',
        description: 'IT 外包、客户服务与专业业务运营',
        aliases: ['外包', 'BPO', '客服', '服务商'],
      },
    ],
  },
  {
    id: 'built-environment',
    label: '建筑与地产',
    children: [
      {
        id: 'real-estate',
        label: '房地产',
        description: '房地产开发、经营及相关服务',
        aliases: ['地产', '房地产', '物业'],
      },
      {
        id: 'construction',
        label: '建筑工程',
        description: '建筑、土木及工程建设',
        aliases: ['建筑', '工程', '建设'],
      },
      {
        id: 'interiors-materials',
        label: '家装与建材',
        description: '家装、建材与建筑装饰',
        aliases: ['家装', '建材', '装修'],
      },
    ],
  },
];

export const topicLabels = {
  ai: '人工智能',
  'developer-ecosystem': '开发者生态',
  'open-source-ecosystem': '开源生态',
};

/** @type {Map<string, { id: string, label: string, parent?: string }>} */
export const categoryDefinitions = new Map(
  industryGroups.flatMap((group) => [
    [group.id, { id: group.id, label: group.label }],
    ...group.children.map((child) => [child.id, { ...child, parent: group.id }]),
  ]),
);
export const categoryLabels = Object.fromEntries(
  [...categoryDefinitions].map(([id, category]) => [id, category.label]),
);

// Existing directory links resolve to the current industry entry points.
const legacyCategories = {
  internet: 'internet-platforms',
  'code-hosting': 'developer-tools',
  hardware: 'electronics',
  telecommunications: 'telecom',
  ai: 'ai-products',
  software: 'technology',
  automotive: 'mobility',
  'e-commerce': 'commerce',
  entertainment: 'media',
  'industrial-automation': 'automation',
  'social-media': 'social-community',
  企业服务: 'professional',
  供应链: 'wholesale-trade',
  保险: 'insurance',
  医疗健康: 'health',
  医疗设备: 'medical-devices',
  教育: 'education',
  旅游: 'travel',
  物流: 'transport',
  能源: 'energy',
  营销服务: 'marketing',
  金融: 'finance',
  金融服务: 'finance',
  零售: 'retail',
  食品饮料: 'food-beverages',
  餐饮: 'dining',
};

export function normalizeCategory(id = '') {
  return Object.hasOwn(legacyCategories, id) ? legacyCategories[id] : id;
}

export function matchesCategory(brand, id) {
  const selected = normalizeCategory(id);
  return (
    !selected ||
    (brand.categories ?? []).some((value) => {
      const category = normalizeCategory(value);
      return category === selected || categoryDefinitions.get(category)?.parent === selected;
    })
  );
}

/** @returns {import('./types').CategoryOption[]} */
export function categoryOptions(brands, catalogBrands = brands) {
  const counts = new Map();
  const available = new Set(
    catalogBrands.flatMap((brand) => (brand.categories ?? []).map(normalizeCategory)),
  );
  for (const brand of brands) {
    const membership = new Set();
    for (const value of brand.categories ?? []) {
      const id = normalizeCategory(value);
      membership.add(id);
      const parent = categoryDefinitions.get(id)?.parent;
      if (parent) membership.add(parent);
    }
    for (const id of membership) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const groups = industryGroups.flatMap((group) => {
    const children = group.children
      .filter((child) => available.has(child.id))
      .map((child) => ({ ...child, count: counts.get(child.id) ?? 0 }));
    return children.length || available.has(group.id)
      ? [{ id: group.id, label: group.label, count: counts.get(group.id) ?? 0, children }]
      : [];
  });
  return [{ id: '', label: '全部品牌', count: brands.length }, ...groups];
}

export function topicOptions(brands, catalogBrands = brands) {
  const available = new Set(catalogBrands.flatMap((brand) => brand.topics ?? []));
  const counts = new Map();
  for (const brand of brands)
    for (const id of new Set(brand.topics ?? [])) counts.set(id, (counts.get(id) ?? 0) + 1);
  return Object.entries(topicLabels)
    .filter(([id]) => available.has(id))
    .map(([id, label]) => ({ id, label, count: counts.get(id) ?? 0 }));
}

export function filterCategoryOptions(categories, query) {
  const normalize = (value) => value.normalize('NFKC').toLowerCase().trim();
  const term = normalize(query);
  if (!term) return categories;
  return categories.flatMap((category) => {
    if (!category.id || normalize(category.label).includes(term)) return [category];
    const children = (category.children ?? []).filter((child) =>
      normalize([child.label, ...(child.aliases ?? [])].join(' ')).includes(term),
    );
    return children.length ? [{ ...category, children }] : [];
  });
}
