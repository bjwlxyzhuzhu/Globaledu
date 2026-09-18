// 省级行政区 中文名 → 英文名（用于地图中英标注）
import { CITY_EN as CITY_EN_GEN } from './cityEn';

export const PROVINCE_EN: Record<string, string> = {
  北京市: 'Beijing', 天津市: 'Tianjin', 上海市: 'Shanghai', 重庆市: 'Chongqing',
  河北省: 'Hebei', 山西省: 'Shanxi', 辽宁省: 'Liaoning', 吉林省: 'Jilin', 黑龙江省: 'Heilongjiang',
  江苏省: 'Jiangsu', 浙江省: 'Zhejiang', 安徽省: 'Anhui', 福建省: 'Fujian', 江西省: 'Jiangxi',
  山东省: 'Shandong', 河南省: 'Henan', 湖北省: 'Hubei', 湖南省: 'Hunan', 广东省: 'Guangdong',
  海南省: 'Hainan', 四川省: 'Sichuan', 贵州省: 'Guizhou', 云南省: 'Yunnan', 陕西省: 'Shaanxi',
  甘肃省: 'Gansu', 青海省: 'Qinghai', 台湾省: 'Taiwan',
  内蒙古自治区: 'Inner Mongolia', 广西壮族自治区: 'Guangxi', 西藏自治区: 'Tibet',
  宁夏回族自治区: 'Ningxia', 新疆维吾尔自治区: 'Xinjiang',
  香港特别行政区: 'Hong Kong', 澳门特别行政区: 'Macau',
};

// 省 → 省会（中文名，与省 GeoJSON 城市 name 对齐）
export const PROVINCE_CAPITAL: Record<string, string> = {
  河北省: '石家庄市', 山西省: '太原市', 辽宁省: '沈阳市', 吉林省: '长春市', 黑龙江省: '哈尔滨市',
  江苏省: '南京市', 浙江省: '杭州市', 安徽省: '合肥市', 福建省: '福州市', 江西省: '南昌市',
  山东省: '济南市', 河南省: '郑州市', 湖北省: '武汉市', 湖南省: '长沙市', 广东省: '广州市',
  海南省: '海口市', 四川省: '成都市', 贵州省: '贵阳市', 云南省: '昆明市', 陕西省: '西安市',
  甘肃省: '兰州市', 青海省: '西宁市', 台湾省: '台北市',
  内蒙古自治区: '呼和浩特市', 广西壮族自治区: '南宁市', 西藏自治区: '拉萨市',
  宁夏回族自治区: '银川市', 新疆维吾尔自治区: '乌鲁木齐市',
};

// 主要城市（省会+重点城市）中文名 → 英文名（用于城市地图中英标注；缺失回退中文）
const CITY_EN_OVERRIDE: Record<string, string> = {
  西安市: "Xi'an", 宝鸡市: 'Baoji', 咸阳市: 'Xianyang', 渭南市: 'Weinan', 铜川市: 'Tongchuan',
  延安市: 'Yan’an', 榆林市: 'Yulin', 汉中市: 'Hanzhong', 安康市: 'Ankang', 商洛市: 'Shangluo',
  南京市: 'Nanjing', 镇江市: 'Zhenjiang', 苏州市: 'Suzhou', 无锡市: 'Wuxi', 常州市: 'Changzhou',
  扬州市: 'Yangzhou', 徐州市: 'Xuzhou', 南通市: 'Nantong', 成都市: 'Chengdu', 绵阳市: 'Mianyang',
  乐山市: 'Leshan', 宜宾市: 'Yibin', 石家庄市: 'Shijiazhuang', 太原市: 'Taiyuan', 沈阳市: 'Shenyang',
  长春市: 'Changchun', 哈尔滨市: 'Harbin', 杭州市: 'Hangzhou', 合肥市: 'Hefei', 福州市: 'Fuzhou',
  南昌市: 'Nanchang', 济南市: 'Jinan', 郑州市: 'Zhengzhou', 武汉市: 'Wuhan', 长沙市: 'Changsha',
  广州市: 'Guangzhou', 海口市: 'Haikou', 贵阳市: 'Guiyang', 昆明市: 'Kunming', 兰州市: 'Lanzhou',
  西宁市: 'Xining', 呼和浩特市: 'Hohhot', 南宁市: 'Nanning', 拉萨市: 'Lhasa', 银川市: 'Yinchuan',
  乌鲁木齐市: 'Ürümqi', 台北市: 'Taipei', 北京市: 'Beijing', 上海市: 'Shanghai', 天津市: 'Tianjin',
  重庆市: 'Chongqing',
  连云港市: 'Lianyungang', 淮安市: "Huai'an", 盐城市: 'Yancheng', 泰州市: 'Taizhou', 宿迁市: 'Suqian',
  自贡市: 'Zigong', 攀枝花市: 'Panzhihua', 泸州市: 'Luzhou', 德阳市: 'Deyang', 广元市: 'Guangyuan',
  遂宁市: 'Suining', 内江市: 'Neijiang', 南充市: 'Nanchong', 眉山市: 'Meishan', 广安市: "Guang'an",
  达州市: 'Dazhou', 雅安市: "Ya'an", 巴中市: 'Bazhong', 资阳市: 'Ziyang',
  阿坝藏族羌族自治州: 'Aba', 甘孜藏族自治州: 'Garzê', 凉山彝族自治州: 'Liangshan',
};

// 合并：自动生成全量(363 市) + 上面人工惯用名覆盖（覆盖优先）
export const CITY_EN: Record<string, string> = { ...CITY_EN_GEN, ...CITY_EN_OVERRIDE };
