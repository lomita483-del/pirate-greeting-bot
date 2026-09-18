"""Typed data-access helpers. Every table touched by AHOY lives here."""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Optional
from .client import Database, DatabaseError
from ..utils.logger import get_logger
log = get_logger("repository")
def _now() -> str: return datetime.now(timezone.utc).isoformat()

class Repository:
    def __init__(self, db: Database) -> None: self.db = db
    async def upsert_server(self,guild_id:str,name:str,icon:Optional[str],owner_id:Optional[str],member_count:int)->None:
        payload={"guild_id":guild_id,"name":name,"icon":icon,"owner_id":owner_id,"member_count":member_count,"bot_present":True}; await self.db.try_run(lambda c:c.table("servers").upsert(payload,on_conflict="guild_id").execute())
        for table in ("server_settings","welcome_settings","logging_settings","automod_settings","role_settings"): await self.db.try_run(lambda c,t=table:c.table(t).upsert({"guild_id":guild_id},on_conflict="guild_id",ignore_duplicates=True).execute())
    async def mark_server_left(self,guild_id:str)->None: await self.db.try_run(lambda c:c.table("servers").update({"bot_present":False}).eq("guild_id",guild_id).execute())
    async def get_settings(self,guild_id:str,table:str="server_settings")->dict[str,Any]:
        rows=await self.db.try_run(lambda c:c.table(table).select("*").eq("guild_id",guild_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
    async def upsert_member(self,guild_id:str,member:Any)->None:
        payload={"guild_id":guild_id,"user_id":str(member.id),"username":member.name,"display_name":member.display_name,"avatar":member.display_avatar.url if member.display_avatar else None,"is_bot":bool(member.bot),"joined_at":member.joined_at.isoformat() if getattr(member,"joined_at",None) else None,"left_at":None}; await self.db.try_run(lambda c:c.table("members").upsert(payload,on_conflict="guild_id,user_id").execute())
    async def mark_member_left(self,guild_id:str,user_id:str)->None: await self.db.try_run(lambda c:c.table("members").update({"left_at":_now()}).eq("guild_id",guild_id).eq("user_id",user_id).execute())
    async def add_warning(self,guild_id:str,user_id:str,username:str,moderator_id:str,moderator_name:str,reason:str)->dict[str,Any]:
        result=await self.db.run(lambda c:c.table("warnings").insert({"guild_id":guild_id,"user_id":user_id,"username":username,"moderator_id":moderator_id,"moderator_name":moderator_name,"reason":reason}).execute()); rows=getattr(result,"data",None) or [{}]; return rows[0]
    async def list_warnings(self,guild_id:str,user_id:str)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("warnings").select("*").eq("guild_id",guild_id).eq("user_id",user_id).eq("active",True).order("created_at",desc=True).limit(25).execute()); return getattr(rows,"data",None) or []
    async def log_action(self,guild_id:str,action:str,**kwargs:Any)->None:
        payload={"guild_id":guild_id,"action":action,"target_id":kwargs.get("target_id"),"target_name":kwargs.get("target_name"),"moderator_id":kwargs.get("moderator_id"),"moderator_name":kwargs.get("moderator_name"),"reason":kwargs.get("reason"),"duration_seconds":kwargs.get("duration_seconds"),"metadata":kwargs.get("metadata") or {}}; await self.db.try_run(lambda c:c.table("moderation_logs").insert(payload).execute())
    async def recent_actions(self,guild_id:str,limit:int=10)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("moderation_logs").select("*").eq("guild_id",guild_id).order("created_at",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []
    async def get_xp(self,guild_id:str,user_id:str)->dict[str,Any]:
        rows=await self.db.try_run(lambda c:c.table("xp_profiles").select("*").eq("guild_id",guild_id).eq("user_id",user_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
    async def save_xp(self,payload:dict[str,Any])->None: await self.db.try_run(lambda c:c.table("xp_profiles").upsert(payload,on_conflict="guild_id,user_id").execute())
    async def xp_leaderboard(self,guild_id:str,limit:int=10)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("xp_profiles").select("*").eq("guild_id",guild_id).order("xp",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []
    async def xp_rank(self,guild_id:str,xp:int)->int:
        rows=await self.db.try_run(lambda c:c.table("xp_profiles").select("user_id").eq("guild_id",guild_id).gt("xp",xp).execute()); return len(getattr(rows,"data",None) or [])+1
    async def get_wallet(self,guild_id:str,user_id:str)->dict[str,Any]:
        rows=await self.db.try_run(lambda c:c.table("economy_profiles").select("*").eq("guild_id",guild_id).eq("user_id",user_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
    async def save_wallet(self,payload:dict[str,Any])->None: await self.db.run(lambda c:c.table("economy_profiles").upsert(payload,on_conflict="guild_id,user_id").execute())
    async def economy_leaderboard(self,guild_id:str,limit:int=10)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("economy_profiles").select("*").eq("guild_id",guild_id).order("balance",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []
    async def next_ticket_number(self,guild_id:str)->int:
        rows=await self.db.try_run(lambda c:c.table("tickets").select("ticket_number").eq("guild_id",guild_id).order("ticket_number",desc=True).limit(1).execute()); data=getattr(rows,"data",None) or []; return (data[0]["ticket_number"]+1) if data else 1
    async def create_ticket(self,payload:dict[str,Any])->dict[str,Any]:
        result=await self.db.run(lambda c:c.table("tickets").insert(payload).execute()); rows=getattr(result,"data",None) or [{}]; return rows[0]
    async def get_ticket_by_channel(self,channel_id:str)->dict[str,Any]:
        rows=await self.db.try_run(lambda c:c.table("tickets").select("*").eq("channel_id",channel_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
    async def update_ticket(self,ticket_id:str,payload:dict[str,Any])->None: await self.db.try_run(lambda c:c.table("tickets").update(payload).eq("id",ticket_id).execute())
    async def add_ticket_message(self,ticket_id:str,author:Any,content:str)->None: await self.db.try_run(lambda c:c.table("ticket_messages").insert({"ticket_id":ticket_id,"author_id":str(author.id),"author_name":str(author),"content":content[:4000]}).execute())
    async def ticket_transcript(self,ticket_id:str)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("ticket_messages").select("*").eq("ticket_id",ticket_id).order("sent_at").limit(500).execute()); return getattr(rows,"data",None) or []
    async def add_reminder(self,payload:dict[str,Any])->None: await self.db.run(lambda c:c.table("reminders").insert(payload).execute())
    async def due_reminders(self)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("reminders").select("*").eq("delivered",False).lte("remind_at",_now()).limit(50).execute()); return getattr(rows,"data",None) or []
    async def mark_reminder_delivered(self,reminder_id:str)->None: await self.db.try_run(lambda c:c.table("reminders").update({"delivered":True}).eq("id",reminder_id).execute())
    async def custom_commands(self,guild_id:str)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("custom_commands").select("*").eq("guild_id",guild_id).eq("enabled",True).limit(100).execute()); return getattr(rows,"data",None) or []
    async def bump_custom_command(self,command_id:str,uses:int)->None: await self.db.try_run(lambda c:c.table("custom_commands").update({"uses":uses+1}).eq("id",command_id).execute())
    async def add_reaction_role(self,payload:dict[str,Any])->None: await self.db.run(lambda c:c.table("reaction_roles").upsert(payload,on_conflict="message_id,emoji").execute())
    async def reaction_roles_for_message(self,message_id:str)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("reaction_roles").select("*").eq("message_id",message_id).limit(50).execute()); return getattr(rows,"data",None) or []
    async def guild_reaction_roles(self,guild_id:str)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("reaction_roles").select("*").eq("guild_id",guild_id).order("created_at",desc=True).limit(200).execute()); return getattr(rows,"data",None) or []
    async def remove_reaction_role(self,guild_id:str,message_id:str,emoji:str)->None: await self.db.try_run(lambda c:c.table("reaction_roles").delete().eq("guild_id",guild_id).eq("message_id",message_id).eq("emoji",emoji).execute())
    async def pending_notifications(self)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("platform_notifications").select("*").eq("delivery_status","pending").limit(20).execute()); return getattr(rows,"data",None) or []
    async def mark_notification(self,notification_id:str,status:str,error:Optional[str]=None)->None: await self.db.try_run(lambda c:c.table("platform_notifications").update({"delivery_status":status,"delivery_error":error,"delivered_at":_now()}).eq("id",notification_id).execute())
    async def platform_user(self,user_id:str)->Optional[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("platform_users").select("banned, bot_blocked, plan, feature_flags").eq("discord_user_id",user_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else None
    async def log_activity(self,payload:dict[str,Any])->None: await self.db.try_run(lambda c:c.table("activity_logs").insert(payload).execute())
    async def pending_bot_actions(self,limit:int=20)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("bot_action_queue").select("*").eq("status","pending").order("created_at").limit(limit).execute()); return getattr(rows,"data",None) or []
    async def finish_bot_action(self,action_id:str,status:str,error:Optional[str]=None)->None: await self.db.try_run(lambda c:c.table("bot_action_queue").update({"status":status,"error":error,"processed_at":_now()}).eq("id",action_id).execute())
    async def command_settings(self,guild_id:str)->dict[str,bool]:
        rows=await self.db.try_run(lambda c:c.table("guild_command_settings").select("command, enabled").eq("guild_id",guild_id).execute()); return {r["command"]:bool(r["enabled"]) for r in (getattr(rows,"data",None) or [])}
    async def command_config(self,guild_id:str,command:str)->dict[str,Any]:
        rows=await self.db.try_run(lambda c:c.table("guild_command_settings").select("*").eq("guild_id",guild_id).eq("command",command).limit(1).execute()); data=getattr(rows,"data",None) or []; return dict(data[0]) if data else {}
    async def command_enabled(self,guild_id:str,command:str)->bool:
        config=await self.command_config(guild_id,command); return bool(config.get("enabled",True)) if config else True
    async def set_command_enabled(self,guild_id:str,command:str,enabled:bool)->None: await self.db.try_run(lambda c:c.table("guild_command_settings").upsert({"guild_id":guild_id,"command":command,"enabled":enabled,"updated_at":_now()},on_conflict="guild_id,command").execute())
    async def command_cooldown_at(self,guild_id:str,command:str,user_id:str):
        rows=await self.db.try_run(lambda c:c.table("command_cooldowns").select("last_used_at").eq("guild_id",guild_id).eq("command",command).eq("user_id",user_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0]["last_used_at"] if data else None
    async def touch_command_cooldown(self,guild_id:str,command:str,user_id:str)->None: await self.db.try_run(lambda c:c.table("command_cooldowns").upsert({"guild_id":guild_id,"command":command,"user_id":user_id,"last_used_at":_now()},on_conflict="guild_id,command,user_id").execute())
    async def get_feature_state(self,guild_id:str,key:str)->dict[str,Any]:
        rows=await self.db.try_run(lambda c:c.table("guild_feature_state").select("value").eq("guild_id",guild_id).eq("key",key).limit(1).execute()); data=getattr(rows,"data",None) or []; return dict(data[0].get("value") or {}) if data else {}
    async def set_feature_state(self,guild_id:str,key:str,value:dict[str,Any])->None: await self.db.try_run(lambda c:c.table("guild_feature_state").upsert({"guild_id":guild_id,"key":key,"value":value,"updated_at":_now()},on_conflict="guild_id,key").execute())
    async def touch_user_activity(self,guild_id:str,user_id:str,username:str,fields:dict[str,Any])->None: await self.db.try_run(lambda c:c.table("user_activity").upsert({"guild_id":guild_id,"user_id":user_id,"username":username,"last_seen_at":_now(),"updated_at":_now(),**fields},on_conflict="guild_id,user_id").execute())
    async def get_user_activity(self,guild_id:str,user_id:str)->dict[str,Any]:
        rows=await self.db.try_run(lambda c:c.table("user_activity").select("*").eq("guild_id",guild_id).eq("user_id",user_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
    async def list_user_activity(self,guild_id:str,limit:int=200)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("user_activity").select("*").eq("guild_id",guild_id).order("last_seen_at",desc=True,nullsfirst=False).limit(limit).execute()); return getattr(rows,"data",None) or []
    async def touch_user_message(self,guild_id:str,user_id:str,username:str,channel_id:str,content:str)->None: await self.touch_user_activity(guild_id,user_id,username,{"last_message_at":_now(),"last_message_content":content[:500],"last_message_channel_id":channel_id})
    async def touch_user_voice(self,guild_id:str,user_id:str,username:str,*,joined:bool)->None: await self.touch_user_activity(guild_id,user_id,username,{"last_voice_join_at" if joined else "last_voice_leave_at":_now()})
    async def touch_user_presence(self,guild_id:str,user_id:str,username:str,status:str)->None: await self.touch_user_activity(guild_id,user_id,username,{"last_online_status":status})
    async def touch_user_command(self,guild_id:str,user_id:str,username:str,command_name:str)->None:
        current=await self.get_user_activity(guild_id,user_id); await self.touch_user_activity(guild_id,user_id,username,{"last_command_at":_now(),"last_command_name":command_name,"command_count":int(current.get("command_count") or 0)+1})
    async def get_voice_stats(self,guild_id:str,user_id:str)->dict[str,Any]:
        rows=await self.db.try_run(lambda c:c.table("voice_stats").select("*").eq("guild_id",guild_id).eq("user_id",user_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
    async def save_voice_stats(self,payload:dict[str,Any])->None: await self.db.try_run(lambda c:c.table("voice_stats").upsert(payload,on_conflict="guild_id,user_id").execute())
    async def voice_leaderboard(self,guild_id:str,limit:int=10)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("voice_stats").select("*").eq("guild_id",guild_id).order("voice_seconds",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []
    async def bump_message_activity(self,guild_id:str,user_id:str,channel_id:str,day_iso:str)->None:
        rows=await self.db.try_run(lambda c:c.table("message_activity").select("count").eq("guild_id",guild_id).eq("user_id",user_id).eq("channel_id",channel_id).eq("day",day_iso).limit(1).execute()); data=getattr(rows,"data",None) or []; current=int(data[0]["count"]) if data else 0; await self.db.try_run(lambda c:c.table("message_activity").upsert({"guild_id":guild_id,"user_id":user_id,"channel_id":channel_id,"day":day_iso,"count":current+1,"updated_at":_now()},on_conflict="guild_id,user_id,channel_id,day").execute())
    async def bump_voice_activity(self,guild_id:str,user_id:str,channel_id:str,day_iso:str,seconds:int)->None:
        if seconds<=0:return
        rows=await self.db.try_run(lambda c:c.table("voice_activity").select("seconds").eq("guild_id",guild_id).eq("user_id",user_id).eq("channel_id",channel_id).eq("day",day_iso).limit(1).execute()); data=getattr(rows,"data",None) or []; current=int(data[0]["seconds"]) if data else 0; await self.db.try_run(lambda c:c.table("voice_activity").upsert({"guild_id":guild_id,"user_id":user_id,"channel_id":channel_id,"day":day_iso,"seconds":current+seconds,"updated_at":_now()},on_conflict="guild_id,user_id,channel_id,day").execute())
    async def record_member_count(self,guild_id:str,day_iso:str,count:int)->None: await self.db.try_run(lambda c:c.table("member_count_daily").upsert({"guild_id":guild_id,"day":day_iso,"member_count":count,"updated_at":_now()},on_conflict="guild_id,day").execute())
    async def message_totals_since(self,guild_id:str,since_day_iso:str)->int:
        rows=await self.db.try_run(lambda c:c.table("message_activity").select("count").eq("guild_id",guild_id).gte("day",since_day_iso).limit(5000).execute()); return sum(int(r.get("count",0) or 0) for r in (getattr(rows,"data",None) or []))
    async def user_message_total(self,guild_id:str,user_id:str,since_day_iso:str)->int:
        rows=await self.db.try_run(lambda c:c.table("message_activity").select("count").eq("guild_id",guild_id).eq("user_id",user_id).gte("day",since_day_iso).limit(5000).execute()); return sum(int(r.get("count",0) or 0) for r in (getattr(rows,"data",None) or []))
    async def channel_message_total(self,guild_id:str,channel_id:str,since_day_iso:str)->int:
        rows=await self.db.try_run(lambda c:c.table("message_activity").select("count").eq("guild_id",guild_id).eq("channel_id",channel_id).gte("day",since_day_iso).limit(5000).execute()); return sum(int(r.get("count",0) or 0) for r in (getattr(rows,"data",None) or []))
    async def message_leaderboard(self,guild_id:str,since_day_iso:str,limit:int=10)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("message_activity").select("user_id, count").eq("guild_id",guild_id).gte("day",since_day_iso).limit(5000).execute()); totals:dict[str,int]={}
        for r in getattr(rows,"data",None) or []: totals[r["user_id"]]=totals.get(r["user_id"],0)+int(r.get("count",0) or 0)
        return [{"user_id":u,"messages":n} for u,n in sorted(totals.items(),key=lambda kv:kv[1],reverse=True)[:limit]]
    async def channel_leaderboard(self,guild_id:str,since_day_iso:str,limit:int=10)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("message_activity").select("channel_id, count").eq("guild_id",guild_id).gte("day",since_day_iso).limit(5000).execute()); totals:dict[str,int]={}
        for r in getattr(rows,"data",None) or []: totals[r["channel_id"]]=totals.get(r["channel_id"],0)+int(r.get("count",0) or 0)
        return [{"channel_id":u,"messages":n} for u,n in sorted(totals.items(),key=lambda kv:kv[1],reverse=True)[:limit]]
    async def voice_user_leaderboard(self,guild_id:str,since_day_iso:str,limit:int=10)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("voice_activity").select("user_id, seconds").eq("guild_id",guild_id).gte("day",since_day_iso).limit(5000).execute()); totals:dict[str,int]={}
        for r in getattr(rows,"data",None) or []: totals[r["user_id"]]=totals.get(r["user_id"],0)+int(r.get("seconds",0) or 0)
        return [{"user_id":u,"voice_seconds":n} for u,n in sorted(totals.items(),key=lambda kv:kv[1],reverse=True)[:limit]]
    async def message_series(self,guild_id:str,since_day_iso:str)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("message_activity").select("day, count").eq("guild_id",guild_id).gte("day",since_day_iso).limit(20000).execute()); by:dict[str,int]={}
        for r in getattr(rows,"data",None) or []: by[str(r["day"])]=by.get(str(r["day"]),0)+int(r.get("count",0) or 0)
        return [{"day":d,"messages":n} for d,n in sorted(by.items())]
    async def voice_series(self,guild_id:str,since_day_iso:str)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("voice_activity").select("day, seconds").eq("guild_id",guild_id).gte("day",since_day_iso).limit(20000).execute()); by:dict[str,int]={}
        for r in getattr(rows,"data",None) or []: by[str(r["day"])]=by.get(str(r["day"]),0)+int(r.get("seconds",0) or 0)
        return [{"day":d,"seconds":n} for d,n in sorted(by.items())]
    async def member_growth_series(self,guild_id:str,since_day_iso:str)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("member_count_daily").select("day, member_count").eq("guild_id",guild_id).gte("day",since_day_iso).order("day").limit(400).execute()); return getattr(rows,"data",None) or []
    async def increment_server_counter(self,guild_id:str,column:str,amount:int=1)->None:
        if amount==0:return
        rows=await self.db.try_run(lambda c:c.table("servers").select(column).eq("guild_id",guild_id).limit(1).execute()); data=getattr(rows,"data",None) or []; current=int(data[0].get(column) or 0) if data else 0; await self.db.try_run(lambda c:c.table("servers").update({column:current+amount}).eq("guild_id",guild_id).execute())
    async def set_server_counters(self,guild_id:str,values:dict[str,int])->None:
        if values: await self.db.try_run(lambda c:c.table("servers").update(values).eq("guild_id",guild_id).execute())
    async def create_report(self,payload:dict[str,Any])->dict[str,Any]:
        result=await self.db.try_run(lambda c:c.table("user_reports").insert(payload).execute()); rows=getattr(result,"data",None) or [{}]; return rows[0]
    async def log_error(self,*,source:str,error_type:str,message:str,guild_id:Optional[str]=None,command:Optional[str]=None,traceback_text:Optional[str]=None,user_id:Optional[str]=None,channel_id:Optional[str]=None,cause:Optional[str]=None,location:Optional[str]=None,context:Optional[str]=None)->None:
        payload={"guild_id":guild_id,"source":source,"command":command,"error_type":error_type,"message":message[:2000],"traceback":(traceback_text or "")[:8000] or None,"user_id":user_id,"channel_id":channel_id,"cause":cause,"location":location,"context":context}; await self.db.try_run(lambda c:c.table("bot_error_logs").insert(payload).execute())
    async def get_roll_call_settings(self,guild_id:str)->dict[str,Any]: return await self.roll_call_settings(guild_id)
    async def roll_call_settings(self,guild_id:str)->dict[str,Any]:
        rows=await self.db.try_run(lambda c:c.table("roll_call_settings").select("*").eq("guild_id",guild_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
    async def save_roll_call_settings(self,guild_id:str,fields:dict[str,Any])->None: await self.db.try_run(lambda c:c.table("roll_call_settings").upsert({"guild_id":guild_id,"updated_at":_now(),**fields},on_conflict="guild_id").execute())
    async def create_roll_call(self,payload:dict[str,Any])->dict[str,Any]:
        result=await self.db.try_run(lambda c:c.table("roll_calls").insert(payload).execute()); rows=getattr(result,"data",None) or [{}]; return rows[0]
    async def get_roll_call(self,roll_call_id:str)->Optional[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("roll_calls").select("*").eq("id",roll_call_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else None
    async def get_roll_call_by_message(self,guild_id:str,message_id:str)->Optional[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("roll_calls").select("*").eq("guild_id",guild_id).eq("message_id",message_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else None
    async def set_roll_call_message(self,roll_call_id:str,message_id:str)->None: await self.db.try_run(lambda c:c.table("roll_calls").update({"message_id":message_id}).eq("id",roll_call_id).execute())
    async def close_roll_call(self,roll_call_id:str)->None: await self.db.try_run(lambda c:c.table("roll_calls").update({"status":"closed","updated_at":_now()}).eq("id",roll_call_id).execute())
    async def due_roll_calls(self)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("roll_calls").select("*").eq("status","open").lte("closes_at",_now()).limit(50).execute()); return getattr(rows,"data",None) or []
    async def active_roll_calls(self)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("roll_calls").select("*").eq("status","open").limit(500).execute()); return getattr(rows,"data",None) or []
    async def list_roll_calls(self,guild_id:str,limit:int=25)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("roll_calls").select("*").eq("guild_id",guild_id).order("created_at",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []
    async def add_roll_call_response(self,roll_call_id:str,user_id:str,username:str)->bool:
        existing=await self.db.try_run(lambda c:c.table("roll_call_responses").select("id").eq("roll_call_id",roll_call_id).eq("user_id",user_id).limit(1).execute());
        if getattr(existing,"data",None): return False
        await self.db.try_run(lambda c:c.table("roll_call_responses").insert({"roll_call_id":roll_call_id,"user_id":user_id,"username":username}).execute()); return True
    async def roll_call_responses(self,roll_call_id:str)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("roll_call_responses").select("*").eq("roll_call_id",roll_call_id).limit(5000).execute()); return getattr(rows,"data",None) or []
    async def get_streak(self,guild_id:str,user_id:str)->dict[str,Any]:
        rows=await self.db.try_run(lambda c:c.table("roll_call_streaks").select("*").eq("guild_id",guild_id).eq("user_id",user_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
    async def save_streak(self,payload:dict[str,Any])->None: await self.db.try_run(lambda c:c.table("roll_call_streaks").upsert(payload,on_conflict="guild_id,user_id").execute())
    async def top_streaks(self,guild_id:str,limit:int=10)->list[dict[str,Any]]:
        rows=await self.db.try_run(lambda c:c.table("roll_call_streaks").select("*").eq("guild_id",guild_id).order("current_streak",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []

# Install the compatibility helpers now that Repository is fully defined
# above. Doing the install here — instead of as an import-time side effect
# inside client.py — removes a circular-import order dependency: both
# repository_compat.py and ticket_repository_compat.py import Repository
# from this module, and by this point in the file Repository already exists
# in this module's namespace, so the import succeeds no matter which module
# a caller happens to import first (client.py or repository.py).
try:
    from .repository_compat import install_repository_compat
    install_repository_compat()
    from .ticket_repository_compat import install_ticket_repository_compat
    install_ticket_repository_compat()
except Exception:
    log.exception("Failed to load repository compatibility helpers")

__all__=["Repository","DatabaseError"]
