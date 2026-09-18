import GalaxyHome from "@/components/GalaxyHome";
import { getProfile } from "@/lib/auth";

export default async function Page() {
  let profile = null;
  try {
    profile = await getProfile();
  } catch {
    // 数据表未建 / Supabase 暂不可达时，按未登录渲染（首页动效与登录入口照常）
    profile = null;
  }
  return (
    <GalaxyHome
      initialCredits={profile?.credits ?? null}
      loggedIn={!!profile}
      userName={profile?.name ?? null}
      studentNo={profile?.student_no ?? null}
      role={profile?.role ?? null}
    />
  );
}
