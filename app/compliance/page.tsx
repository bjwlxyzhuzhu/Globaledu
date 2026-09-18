import LearnChrome from "@/app/learn/LearnChrome";

const card: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 16, background: "rgba(255,255,255,.04)", padding: 20, marginBottom: 16 };
const h: React.CSSProperties = { fontSize: 15.5, fontWeight: 800, marginBottom: 10 };
const li: React.CSSProperties = { fontSize: 13.5, color: "var(--ink)", lineHeight: 1.9 };

export default function CompliancePage() {
  return (
    <LearnChrome emoji="🛡" title="合规与隐私说明" subtitle="数据保护 · 知识产权 · AI 伦理">
      <div style={{ maxWidth: 820 }}>
        <div style={card}>
          <div style={h}>一、数据处理与隐私保护</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={li}><b>最小化采集</b>：仅采集教学必需数据（登录标识、显示名、与 AI 的对话、主动上传的学习材料、积分与调用日志），不采集身份证号、人脸、定位等敏感信息。</li>
            <li style={li}><b>存储与安全</b>：数据启用行级安全（RLS），学生仅能读写自己的数据；积分仅由服务端原子扣减，且仅管理员可修改，杜绝自助加分。</li>
            <li style={li}><b>API Key 安全</b>：用户自带的大模型 Key 加密存储、仅服务端按用途读取，不下发前端。</li>
            <li style={li}><b>留存与删除</b>：对话与日志按学期留存，学生可在账户中心删除自己的内容，学期结束按需清理。</li>
          </ul>
        </div>

        <div style={card}>
          <div style={h}>二、知识产权与内容来源</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={li}>课程理论、区域产业案例、模板与提示词均为课程团队<b>自有或已获授权</b>的教学资源。</li>
            <li style={li}>官方赛事资料<b>仅用于检索与要点引用</b>，不分发原文、不二次出版。</li>
            <li style={li}>学生须<b>标注 AI 参与环节</b>，区分 AI 生成、人工判断与团队原创，避免“AI 替写”。</li>
          </ul>
        </div>

        <div style={card}>
          <div style={h}>三、AI 伦理原则</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={li}><b>辅助而非替代</b>：AI 提供诊断、生成、质询、评价辅助，最终判断与责任主体是师生本人；评分/答辩反馈仅供参考。</li>
            <li style={li}><b>不做歧视性预警</b>：学情分析用于教学改进与个性化支持，不给学生贴标签、不做歧视性排名公示。</li>
            <li style={li}><b>公平与可及</b>：功能对全体学生一致开放；关注算法偏见，鼓励多源核验、批判性采纳 AI 输出。</li>
            <li style={li}><b>学术诚信与安全</b>：坚持事实核验与引用规范；处理材料遵守隐私与数据安全，内容经合规过滤。</li>
          </ul>
        </div>
      </div>
    </LearnChrome>
  );
}
