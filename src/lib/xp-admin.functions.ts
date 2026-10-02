import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
const input=z.object({guildId:z.string().regex(/^\d{5,25}$/)});const action=z.enum(["give","remove","level-up","rank-give","rank-remove"]);
async function auth(guildId:string){const {sessionFromHeader,assertGuildAccess}=await import("@/lib/discord.server");const session=await sessionFromHeader(getRequestHeader("cookie")??null);if(!session)throw new Error("Please sign in with Discord.");await assertGuildAccess(session,guildId);const {supabaseAdmin}=await import("@/integrations/supabase/client.server");return{session,supabaseAdmin};}
async function discord(path:string,init:RequestInit={}){const token=process.env["DISCORD_TOKEN"];if(!token)throw new Error("Bot delivery is not configured.");const res=await fetch(`https://discord.com/api/v10${path}`,{...init,headers:{authorization:`Bot ${token}`,"content-type":"application/json",...(init.headers||{})}});if(!res.ok)throw new Error(`Discord API error (${res.status}).`);return res.json();}
async function targets(guildId:string,raw:string){const out:any[]=[];for(const token of raw.split(",").map(x=>x.trim()).filter(Boolean)){let rows:any[]=[];if(/^\d{5,25}$/.test(token)){try{rows=[await discord(`/guilds/${guildId}/members/${token}`)]}catch{rows=[]}}else rows=await discord(`/guilds/${guildId}/members?query=${encodeURIComponent(token.replace(/^@/,""))}&limit=20`);const needle=token.replace(/^@/,"").toLowerCase();const m=rows.find(x=>x?.user?.username?.toLowerCase()===needle||x?.user?.global_name?.toLowerCase()===needle)||rows[0];if(m&&!out.some(x=>x.user.id===m.user.id))out.push(m)}return out;}
function levelForXp(xp:number){let l=0;while(xp>=5*(l+1)**2+50*(l+1)+100)l++;return l;}function xpForLevel(l:number){return l<=0?0:5*l*l+50*l+100;}
export const adminXpAction=createServerFn({method:"POST"}).inputValidator((d:unknown)=>z.object({...input.shape,action,targets:z.string().min(1).max(2000),amount:z.number().int().min(1).max(1000000).optional(),role:z.string().max(100).optional()}).parse(d)).handler(async({data})=>{const{session,supabaseAdmin}=await auth(data.guildId);const users=await targets(data.guildId,data.targets);if(!users.length)throw new Error("No matching Discord users were found.");if(data.action.startsWith("rank-")&&!data.role)throw new Error("A rank role is required.");if(!data.action.startsWith("rank-")&&!data.amount&&data.action!=="level-up")throw new Error("An XP amount is required.");let role:any=null;if(data.action.startsWith("rank-")){const roles=await discord(`/guilds/${data.guildId}/roles`);const needle=data.role!.replace(/^@/,"").toLowerCase();role=roles.find((r:any)=>r.name.toLowerCase()===needle||`<@&${r.id}>`===data.role);if(!role)throw new Error("Rank role not found.");}const results:string[]=[];for(const m of users){const uid=m.user.id;if(data.action.startsWith("rank-")){await discord(`/guilds/${data.guildId}/members/${uid}/roles/${role.id}`,{method:data.action==="rank-give"?"PUT":"DELETE"});results.push(`${m.user.username}: ${data.action==="rank-give"?"+":"-"}${role.name}`);continue;}const{data:p}=await supabaseAdmin.from("xp_profiles").select("xp,level,messages,last_awarded_at").eq("guild_id",data.guildId).eq("user_id",uid).maybeSingle();let xp=Number(p?.xp||0);if(data.action==="give")xp+=Number(data.amount);else if(data.action==="remove")xp=Math.max(0,xp-Number(data.amount));else xp=Math.max(xp,xpForLevel(levelForXp(xp)+1));const level=levelForXp(xp);await supabaseAdmin.from("xp_profiles").upsert({guild_id:data.guildId,user_id:uid,username:m.user.username,xp,level,messages:Number(p?.messages||0),last_awarded_at:p?.last_awarded_at||null},{onConflict:"guild_id,user_id"});results.push(`${m.user.username}: ${xp.toLocaleString()} XP · Lv ${level}`)}await supabaseAdmin.from("dashboard_access_log").insert({discord_user_id:session.userId,discord_username:session.username,guild_id:data.guildId,action:`admin:${data.action}`});return{ok:true,count:users.length,results};});

const adjustInput = z.object({
  guildId: z.string().regex(/^\d{5,25}$/),
  userId: z.string().regex(/^\d{5,25}$/),
  amount: z.number().int().min(0).max(2_000_000_000),
  action: z.enum(["give", "remove", "set"]),
  reason: z.string().max(500).optional(),
});

function applyAdjust(current: number, action: "give" | "remove" | "set", amount: number, max: number) {
  const next = action === "give" ? current + amount : action === "remove" ? current - amount : amount;
  return Math.max(0, Math.min(max, next));
}

export const adminAdjustXp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adjustInput.parse(d))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await auth(data.guildId);
    if (data.amount > 10_000_000) throw new Error("XP amount is too large.");
    const { data: p } = await supabaseAdmin
      .from("xp_profiles")
      .select("xp,level,messages,username,last_awarded_at")
      .eq("guild_id", data.guildId)
      .eq("user_id", data.userId)
      .maybeSingle();
    const oldXp = Number(p?.xp ?? 0);
    const oldLevel = Number(p?.level ?? levelForXp(oldXp));
    const newXp = applyAdjust(oldXp, data.action, data.amount, 1_000_000_000);
    const newLevel = levelForXp(newXp);
    const { error } = await supabaseAdmin.from("xp_profiles").upsert(
      {
        guild_id: data.guildId,
        user_id: data.userId,
        username: p?.username ?? null,
        xp: newXp,
        level: newLevel,
        messages: Number(p?.messages ?? 0),
        last_awarded_at: p?.last_awarded_at ?? null,
      },
      { onConflict: "guild_id,user_id" },
    );
    if (error) throw new Error("Could not update XP.");
    await supabaseAdmin.from("xp_admin_audit").insert({
      guild_id: data.guildId,
      actor_user_id: session.userId,
      target_user_id: data.userId,
      action: data.action,
      amount: data.amount,
      old_xp: oldXp,
      new_xp: newXp,
      old_level: oldLevel,
      new_level: newLevel,
      reason: data.reason ?? null,
    });
    return { oldXp, newXp, oldLevel, newLevel };
  });

export const adminAdjustEconomy = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adjustInput.parse(d))
  .handler(async ({ data }) => {
    const { session, supabaseAdmin } = await auth(data.guildId);
    const { data: p } = await supabaseAdmin
      .from("economy_profiles")
      .select("balance")
      .eq("guild_id", data.guildId)
      .eq("user_id", data.userId)
      .maybeSingle();
    const oldBalance = Number(p?.balance ?? 0);
    const newBalance = applyAdjust(oldBalance, data.action, data.amount, 2_000_000_000);
    const { error } = p
      ? await supabaseAdmin.from("economy_profiles").update({ balance: newBalance }).eq("guild_id", data.guildId).eq("user_id", data.userId)
      : await supabaseAdmin.from("economy_profiles").insert({ guild_id: data.guildId, user_id: data.userId, balance: newBalance });
    if (error) throw new Error("Could not update the balance.");
    await supabaseAdmin.from("economy_admin_audit").insert({
      guild_id: data.guildId,
      actor_user_id: session.userId,
      target_user_id: data.userId,
      action: data.action,
      amount: data.amount,
      old_balance: oldBalance,
      new_balance: newBalance,
      reason: data.reason ?? null,
    });
    return { oldBalance, newBalance };
  });
