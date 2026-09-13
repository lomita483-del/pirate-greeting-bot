"""Compatibility methods kept separate from the core repository implementation."""
from __future__ import annotations
from typing import Any, Optional
from .repository import Repository, _now

async def due_event_reminders(self, limit: int = 25):
    rows = await self.db.try_run(lambda c: c.table("event_reminders").select("*").eq("status", "pending").lte("scheduled_for", _now()).order("scheduled_for").limit(limit).execute())
    reminders = getattr(rows, "data", None) or []
    if not reminders: return []
    ids = list({r["event_id"] for r in reminders if r.get("event_id")})
    ev = await self.db.try_run(lambda c: c.table("calendar_events").select("*").in_("id", ids).execute())
    by_id = {e["id"]: e for e in (getattr(ev, "data", None) or [])}
    for row in reminders: row["event"] = by_id.get(row.get("event_id"))
    return reminders

async def mark_event_reminder_sent(self, reminder_id: str, message_id: Optional[str] = None):
    await self.db.try_run(lambda c: c.table("event_reminders").update({"status":"sent","sent_at":_now(),"message_id":message_id}).eq("id", reminder_id).execute())

async def mark_event_reminder_failed(self, reminder_id: str, error: str, attempts: int):
    await self.db.try_run(lambda c: c.table("event_reminders").update({"status":"failed" if attempts >= 3 else "pending","attempts":attempts,"error":error[:500]}).eq("id", reminder_id).execute())

async def calendar_event(self, event_id: str):
    rows = await self.db.try_run(lambda c: c.table("calendar_events").select("*").eq("id", event_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else None

async def set_event_rsvp(self,event_id:str,guild_id:str,user_id:str,response:str):
    await self.db.try_run(lambda c:c.table("event_rsvps").upsert({"event_id":event_id,"guild_id":guild_id,"user_id":user_id,"response":response,"updated_at":_now()},on_conflict="event_id,user_id").execute())

async def event_rsvp_counts(self,event_id:str):
    rows=await self.db.try_run(lambda c:c.table("event_rsvps").select("response").eq("event_id",event_id).limit(1000).execute()); counts={"attending":0,"declined":0,"maybe":0}
    for row in getattr(rows,"data",None) or []:
        key=str(row.get("response") or "attending"); counts[key]=counts.get(key,0)+1
    return counts

async def calendar_sources(self,guild_id:str):
    rows=await self.db.try_run(lambda c:c.table("calendar_sources").select("*").eq("guild_id",guild_id).limit(50).execute()); return getattr(rows,"data",None) or []
async def upcoming_events(self,guild_id:str,limit:int=10):
    rows=await self.db.try_run(lambda c:c.table("calendar_events").select("*").eq("guild_id",guild_id).eq("status","confirmed").gte("start_time",_now()).order("start_time").limit(limit).execute()); return getattr(rows,"data",None) or []
async def events_between(self,guild_id:str,start_iso:str,end_iso:str,limit:int=25):
    rows=await self.db.try_run(lambda c:c.table("calendar_events").select("*").eq("guild_id",guild_id).eq("status","confirmed").gte("start_time",start_iso).lte("start_time",end_iso).order("start_time").limit(limit).execute()); return getattr(rows,"data",None) or []
async def event_notifiers(self,guild_id:str):
    rows=await self.db.try_run(lambda c:c.table("event_notifiers").select("*").eq("guild_id",guild_id).limit(50).execute()); return getattr(rows,"data",None) or []
async def calendar_filters(self,guild_id:str):
    rows=await self.db.try_run(lambda c:c.table("calendar_filters").select("*").eq("guild_id",guild_id).order("priority",desc=True).limit(50).execute()); return getattr(rows,"data",None) or []
async def calendar_job_log(self,guild_id:str,limit:int=10):
    rows=await self.db.try_run(lambda c:c.table("calendar_job_log").select("*").eq("guild_id",guild_id).order("created_at",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []
async def pending_reminder_count(self,guild_id:str):
    rows=await self.db.try_run(lambda c:c.table("event_reminders").select("id").eq("guild_id",guild_id).eq("status","pending").limit(1000).execute()); return len(getattr(rows,"data",None) or [])
async def queue_calendar_sync(self,guild_id:str,requested_by:str):
    await self.db.try_run(lambda c:c.table("bot_action_queue").insert({"guild_id":guild_id,"action":"calendar_sync","payload":{},"requested_by":requested_by,"status":"pending"}).execute())

async def create_giveaway(self,payload):
    result=await self.db.run(lambda c:c.table("giveaways").insert(payload).execute()); rows=getattr(result,"data",None) or [{}]; return rows[0]
async def update_giveaway(self,giveaway_id,payload): await self.db.try_run(lambda c:c.table("giveaways").update(payload).eq("id",giveaway_id).execute())
async def due_giveaways(self):
    rows=await self.db.try_run(lambda c:c.table("giveaways").select("*").eq("status","running").lte("ends_at",_now()).limit(25).execute()); return getattr(rows,"data",None) or []
async def get_giveaway_by_message(self,message_id):
    rows=await self.db.try_run(lambda c:c.table("giveaways").select("*").eq("message_id",message_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
async def latest_giveaway(self,guild_id):
    rows=await self.db.try_run(lambda c:c.table("giveaways").select("*").eq("guild_id",guild_id).order("created_at",desc=True).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}

async def create_poll(self,payload):
    result=await self.db.run(lambda c:c.table("polls").insert(payload).execute()); rows=getattr(result,"data",None) or [{}]; return rows[0]
async def get_poll_by_message(self,message_id):
    rows=await self.db.try_run(lambda c:c.table("polls").select("*").eq("message_id",message_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
async def latest_poll(self,guild_id):
    rows=await self.db.try_run(lambda c:c.table("polls").select("*").eq("guild_id",guild_id).order("created_at",desc=True).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
async def due_polls(self):
    rows=await self.db.try_run(lambda c:c.table("polls").select("*").eq("status","open").not_.is_("ends_at","null").lte("ends_at",_now()).limit(25).execute()); return getattr(rows,"data",None) or []
async def update_poll(self,poll_id,payload): await self.db.try_run(lambda c:c.table("polls").update(payload).eq("id",poll_id).execute())

async def starboard_settings(self,guild_id):
    rows=await self.db.try_run(lambda c:c.table("starboard_settings").select("*").eq("guild_id",guild_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
async def starboard_entry(self,source_message_id):
    rows=await self.db.try_run(lambda c:c.table("starboard_entries").select("*").eq("source_message_id",source_message_id).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
async def save_starboard_entry(self,payload): await self.db.try_run(lambda c:c.table("starboard_entries").upsert(payload,on_conflict="source_message_id").execute())
async def due_announcements(self):
    rows=await self.db.try_run(lambda c:c.table("scheduled_announcements").select("*").eq("enabled",True).lte("next_run_at",_now()).limit(25).execute()); return getattr(rows,"data",None) or []
async def update_announcement(self,announcement_id,payload): await self.db.try_run(lambda c:c.table("scheduled_announcements").update(payload).eq("id",announcement_id).execute())
async def stat_channels(self,guild_id):
    rows=await self.db.try_run(lambda c:c.table("stat_channels").select("*").eq("guild_id",guild_id).eq("enabled",True).limit(25).execute()); return getattr(rows,"data",None) or []
async def mark_stat_channel(self,row_id,value): await self.db.try_run(lambda c:c.table("stat_channels").update({"last_value":value,"last_updated_at":_now()}).eq("id",row_id).execute())

async def next_case_number(self,guild_id):
    result=await self.db.try_run(lambda c:c.rpc("next_case_number",{"_guild_id":guild_id}).execute()); value=getattr(result,"data",None); value=value[0] if isinstance(value,list) and value else value
    try:return int(value)
    except (TypeError,ValueError):return 1
async def create_case(self,payload):
    payload=dict(payload); payload.setdefault("case_number",await self.next_case_number(payload["guild_id"])); result=await self.db.try_run(lambda c:c.table("moderation_cases").insert(payload).execute()); rows=getattr(result,"data",None) or [{}]; return rows[0]
async def close_active_cases(self,guild_id,user_id,actions): await self.db.try_run(lambda c:c.table("moderation_cases").update({"active":False}).eq("guild_id",guild_id).eq("target_id",user_id).eq("active",True).in_("action",actions).execute())
async def expired_cases(self):
    rows=await self.db.try_run(lambda c:c.table("moderation_cases").select("*").eq("active",True).not_.is_("expires_at","null").lte("expires_at",_now()).limit(50).execute()); return getattr(rows,"data",None) or []
async def update_case(self,case_id,payload): await self.db.try_run(lambda c:c.table("moderation_cases").update(payload).eq("id",case_id).execute())
async def recent_cases(self,guild_id,limit=10):
    rows=await self.db.try_run(lambda c:c.table("moderation_cases").select("*").eq("guild_id",guild_id).order("created_at",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []
async def get_case(self,guild_id,case_number):
    rows=await self.db.try_run(lambda c:c.table("moderation_cases").select("*").eq("guild_id",guild_id).eq("case_number",case_number).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else None
async def user_cases(self,guild_id,user_id,limit=50):
    rows=await self.db.try_run(lambda c:c.table("moderation_cases").select("*").eq("guild_id",guild_id).eq("target_id",user_id).order("created_at",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []

async def emit_event(self,payload):
    rows=await self.db.try_run(lambda c:c.table("system_events").insert(payload).execute()); data=getattr(rows,"data",None) or []; return data[0].get("id") if data else None
async def write_audit_log(self,payload): await self.db.try_run(lambda c:c.table("audit_logs").insert(payload).execute())
async def recent_audit_logs(self,guild_id,limit=10):
    rows=await self.db.try_run(lambda c:c.table("audit_logs").select("*").eq("guild_id",guild_id).order("created_at",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []
async def list_welcome_messages(self,guild_id):
    rows=await self.db.try_run(lambda c:c.table("welcome_messages").select("*").eq("guild_id",guild_id).eq("enabled",True).order("position").limit(3).execute()); return getattr(rows,"data",None) or []
async def list_embed_template_names(self,guild_id):
    rows=await self.db.try_run(lambda c:c.table("embed_templates").select("name").eq("guild_id",guild_id).order("name").limit(100).execute()); return [r["name"] for r in (getattr(rows,"data",None) or [])]
async def get_embed_template(self,guild_id,name):
    rows=await self.db.try_run(lambda c:c.table("embed_templates").select("*").eq("guild_id",guild_id).ilike("name",name).limit(1).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else None
async def add_command_record(self,payload):
    rows=await self.db.try_run(lambda c:c.table("command_records").insert(payload).execute()); data=getattr(rows,"data",None) or []; return data[0] if data else {}
async def list_command_records(self,guild_id,namespace,limit=10):
    rows=await self.db.try_run(lambda c:c.table("command_records").select("*").eq("guild_id",guild_id).eq("namespace",namespace).order("created_at",desc=True).limit(limit).execute()); return getattr(rows,"data",None) or []
async def edit_command_record(self,guild_id,namespace,label):
    latest=await self.list_command_records(guild_id,namespace,1)
    if not latest:return False
    await self.db.try_run(lambda c:c.table("command_records").update({"label":label[:200]}).eq("id",latest[0]["id"]).execute()); return True
async def delete_command_records(self,guild_id,namespace,label=None):
    existing=await self.list_command_records(guild_id,namespace,100); targets=[r for r in existing if not label or (r.get("label") or "").lower()==label.lower()]
    for row in targets: await self.db.try_run(lambda c,i=row["id"]:c.table("command_records").delete().eq("id",i).execute())
    return len(targets)


def install_repository_compat() -> None:
    methods = {name: value for name, value in globals().items() if callable(value) and name not in {"Repository","install_repository_compat"} and not name.startswith("_")}
    for name, value in methods.items():
        if not hasattr(Repository, name):
            setattr(Repository, name, value)
