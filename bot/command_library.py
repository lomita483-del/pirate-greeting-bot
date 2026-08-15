"""Generated AHOY command library — 900+ commands grouped by category.

Source: AHOY Master Discord Command Library. Do not hand-edit; regenerate instead.
Each category becomes one top-level slash command; entries become subcommands
(chunked into subcommand groups when a category exceeds Discord's 25 limit).
"""

from __future__ import annotations

CATEGORIES: list[dict] = [
    {
        "slug": "mod",
        "title": "Core Moderation",
        "commands": [
            {
                "name": "ban",
                "sub": "ban",
                "dedicated": true,
                "kind": "action",
                "desc": "Ban \u2014 Core Moderation."
            },
            {
                "name": "unban",
                "sub": "unban",
                "dedicated": true,
                "kind": "action",
                "desc": "Unban \u2014 Core Moderation."
            },
            {
                "name": "kick",
                "sub": "kick",
                "dedicated": true,
                "kind": "action",
                "desc": "Kick \u2014 Core Moderation."
            },
            {
                "name": "softban",
                "sub": "softban",
                "dedicated": false,
                "kind": "action",
                "desc": "Softban \u2014 Core Moderation."
            },
            {
                "name": "timeout",
                "sub": "timeout",
                "dedicated": true,
                "kind": "action",
                "desc": "Timeout \u2014 Core Moderation."
            },
            {
                "name": "untimeout",
                "sub": "untimeout",
                "dedicated": true,
                "kind": "action",
                "desc": "Untimeout \u2014 Core Moderation."
            },
            {
                "name": "mute",
                "sub": "mute",
                "dedicated": false,
                "kind": "action",
                "desc": "Mute \u2014 Core Moderation."
            },
            {
                "name": "unmute",
                "sub": "unmute",
                "dedicated": false,
                "kind": "action",
                "desc": "Unmute \u2014 Core Moderation."
            },
            {
                "name": "warn",
                "sub": "warn",
                "dedicated": true,
                "kind": "action",
                "desc": "Warn \u2014 Core Moderation."
            },
            {
                "name": "unwarn",
                "sub": "unwarn",
                "dedicated": false,
                "kind": "action",
                "desc": "Unwarn \u2014 Core Moderation."
            },
            {
                "name": "warnings",
                "sub": "warnings",
                "dedicated": true,
                "kind": "action",
                "desc": "Warnings \u2014 Core Moderation."
            },
            {
                "name": "clearwarnings",
                "sub": "clearwarnings",
                "dedicated": false,
                "kind": "action",
                "desc": "Clearwarnings \u2014 Core Moderation."
            },
            {
                "name": "warning",
                "sub": "warning",
                "dedicated": false,
                "kind": "action",
                "desc": "Warning \u2014 Core Moderation."
            },
            {
                "name": "warninglist",
                "sub": "warninglist",
                "dedicated": false,
                "kind": "action",
                "desc": "Warninglist \u2014 Core Moderation."
            },
            {
                "name": "warningedit",
                "sub": "warningedit",
                "dedicated": false,
                "kind": "action",
                "desc": "Warningedit \u2014 Core Moderation."
            },
            {
                "name": "warningdelete",
                "sub": "warningdelete",
                "dedicated": false,
                "kind": "action",
                "desc": "Warningdelete \u2014 Core Moderation."
            },
            {
                "name": "warningexpire",
                "sub": "warningexpire",
                "dedicated": false,
                "kind": "action",
                "desc": "Warningexpire \u2014 Core Moderation."
            },
            {
                "name": "warningreset",
                "sub": "warningreset",
                "dedicated": false,
                "kind": "action",
                "desc": "Warningreset \u2014 Core Moderation."
            },
            {
                "name": "history",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Core Moderation."
            },
            {
                "name": "punish",
                "sub": "punish",
                "dedicated": false,
                "kind": "action",
                "desc": "Punish \u2014 Core Moderation."
            },
            {
                "name": "pardon",
                "sub": "pardon",
                "dedicated": false,
                "kind": "action",
                "desc": "Pardon \u2014 Core Moderation."
            },
            {
                "name": "tempban",
                "sub": "tempban",
                "dedicated": false,
                "kind": "action",
                "desc": "Tempban \u2014 Core Moderation."
            },
            {
                "name": "tempkick",
                "sub": "tempkick",
                "dedicated": false,
                "kind": "action",
                "desc": "Tempkick \u2014 Core Moderation."
            },
            {
                "name": "temprole",
                "sub": "temprole",
                "dedicated": false,
                "kind": "action",
                "desc": "Temprole \u2014 Core Moderation."
            },
            {
                "name": "massban",
                "sub": "massban",
                "dedicated": false,
                "kind": "action",
                "desc": "Massban \u2014 Core Moderation."
            },
            {
                "name": "masskick",
                "sub": "masskick",
                "dedicated": false,
                "kind": "action",
                "desc": "Masskick \u2014 Core Moderation."
            },
            {
                "name": "masswarn",
                "sub": "masswarn",
                "dedicated": false,
                "kind": "action",
                "desc": "Masswarn \u2014 Core Moderation."
            },
            {
                "name": "deafen",
                "sub": "deafen",
                "dedicated": false,
                "kind": "action",
                "desc": "Deafen \u2014 Core Moderation."
            },
            {
                "name": "undeafen",
                "sub": "undeafen",
                "dedicated": false,
                "kind": "action",
                "desc": "Undeafen \u2014 Core Moderation."
            },
            {
                "name": "voicekick",
                "sub": "voicekick",
                "dedicated": false,
                "kind": "action",
                "desc": "Voicekick \u2014 Core Moderation."
            }
        ]
    },
    {
        "slug": "case",
        "title": "Case Management",
        "commands": [
            {
                "name": "case",
                "sub": "case",
                "dedicated": false,
                "kind": "action",
                "desc": "Case \u2014 Case Management."
            },
            {
                "name": "cases",
                "sub": "cases",
                "dedicated": false,
                "kind": "action",
                "desc": "Cases \u2014 Case Management."
            },
            {
                "name": "casecreate",
                "sub": "create",
                "dedicated": false,
                "kind": "create",
                "desc": "Create create \u2014 Case Management."
            },
            {
                "name": "caseedit",
                "sub": "edit",
                "dedicated": false,
                "kind": "edit",
                "desc": "Edit edit \u2014 Case Management."
            },
            {
                "name": "caseclose",
                "sub": "close",
                "dedicated": false,
                "kind": "action",
                "desc": "Close \u2014 Case Management."
            },
            {
                "name": "caseopen",
                "sub": "open",
                "dedicated": false,
                "kind": "action",
                "desc": "Open \u2014 Case Management."
            },
            {
                "name": "casevoid",
                "sub": "void",
                "dedicated": false,
                "kind": "action",
                "desc": "Void \u2014 Case Management."
            },
            {
                "name": "caseassign",
                "sub": "assign",
                "dedicated": false,
                "kind": "action",
                "desc": "Assign \u2014 Case Management."
            },
            {
                "name": "caseunassign",
                "sub": "unassign",
                "dedicated": false,
                "kind": "action",
                "desc": "Unassign \u2014 Case Management."
            },
            {
                "name": "casereason",
                "sub": "reason",
                "dedicated": false,
                "kind": "action",
                "desc": "Reason \u2014 Case Management."
            },
            {
                "name": "caseevidence",
                "sub": "evidence",
                "dedicated": false,
                "kind": "action",
                "desc": "Evidence \u2014 Case Management."
            },
            {
                "name": "casehistory",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Case Management."
            },
            {
                "name": "casecount",
                "sub": "count",
                "dedicated": false,
                "kind": "action",
                "desc": "Count \u2014 Case Management."
            },
            {
                "name": "lastcase",
                "sub": "lastcase",
                "dedicated": false,
                "kind": "action",
                "desc": "Lastcase \u2014 Case Management."
            },
            {
                "name": "casesearch",
                "sub": "search",
                "dedicated": false,
                "kind": "search",
                "desc": "Search search \u2014 Case Management."
            },
            {
                "name": "caseexport",
                "sub": "export",
                "dedicated": false,
                "kind": "export",
                "desc": "Export export \u2014 Case Management."
            },
            {
                "name": "casepriority",
                "sub": "priority",
                "dedicated": false,
                "kind": "action",
                "desc": "Priority \u2014 Case Management."
            },
            {
                "name": "casecategory",
                "sub": "category",
                "dedicated": false,
                "kind": "action",
                "desc": "Category \u2014 Case Management."
            },
            {
                "name": "casetag",
                "sub": "tag",
                "dedicated": false,
                "kind": "action",
                "desc": "Tag \u2014 Case Management."
            },
            {
                "name": "caselink",
                "sub": "link",
                "dedicated": false,
                "kind": "action",
                "desc": "Link \u2014 Case Management."
            },
            {
                "name": "casenote",
                "sub": "note",
                "dedicated": false,
                "kind": "action",
                "desc": "Note \u2014 Case Management."
            },
            {
                "name": "casecomment",
                "sub": "comment",
                "dedicated": false,
                "kind": "action",
                "desc": "Comment \u2014 Case Management."
            },
            {
                "name": "caseescalate",
                "sub": "escalate",
                "dedicated": false,
                "kind": "action",
                "desc": "Escalate \u2014 Case Management."
            },
            {
                "name": "casearchive",
                "sub": "archive",
                "dedicated": false,
                "kind": "action",
                "desc": "Archive \u2014 Case Management."
            },
            {
                "name": "caseunarchive",
                "sub": "unarchive",
                "dedicated": false,
                "kind": "action",
                "desc": "Unarchive \u2014 Case Management."
            }
        ]
    },
    {
        "slug": "investigate",
        "title": "User Investigation",
        "commands": [
            {
                "name": "userinfo",
                "sub": "userinfo",
                "dedicated": true,
                "kind": "action",
                "desc": "Userinfo \u2014 User Investigation."
            },
            {
                "name": "lookup",
                "sub": "lookup",
                "dedicated": false,
                "kind": "action",
                "desc": "Lookup \u2014 User Investigation."
            },
            {
                "name": "userhistory",
                "sub": "userhistory",
                "dedicated": false,
                "kind": "action",
                "desc": "Userhistory \u2014 User Investigation."
            },
            {
                "name": "joinedat",
                "sub": "joinedat",
                "dedicated": false,
                "kind": "action",
                "desc": "Joinedat \u2014 User Investigation."
            },
            {
                "name": "createdat",
                "sub": "createdat",
                "dedicated": false,
                "kind": "action",
                "desc": "Createdat \u2014 User Investigation."
            },
            {
                "name": "accountage",
                "sub": "accountage",
                "dedicated": false,
                "kind": "action",
                "desc": "Accountage \u2014 User Investigation."
            },
            {
                "name": "roles",
                "sub": "roles",
                "dedicated": false,
                "kind": "action",
                "desc": "Roles \u2014 User Investigation."
            },
            {
                "name": "permissions",
                "sub": "permissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Permissions \u2014 User Investigation."
            },
            {
                "name": "avatar",
                "sub": "avatar",
                "dedicated": false,
                "kind": "action",
                "desc": "Avatar \u2014 User Investigation."
            },
            {
                "name": "banner",
                "sub": "banner",
                "dedicated": false,
                "kind": "action",
                "desc": "Banner \u2014 User Investigation."
            },
            {
                "name": "userflags",
                "sub": "userflags",
                "dedicated": false,
                "kind": "action",
                "desc": "Userflags \u2014 User Investigation."
            },
            {
                "name": "useractivity",
                "sub": "useractivity",
                "dedicated": false,
                "kind": "action",
                "desc": "Useractivity \u2014 User Investigation."
            },
            {
                "name": "lastseen",
                "sub": "lastseen",
                "dedicated": false,
                "kind": "action",
                "desc": "Lastseen \u2014 User Investigation."
            },
            {
                "name": "firstmessage",
                "sub": "firstmessage",
                "dedicated": false,
                "kind": "action",
                "desc": "Firstmessage \u2014 User Investigation."
            },
            {
                "name": "messagecount",
                "sub": "messagecount",
                "dedicated": false,
                "kind": "action",
                "desc": "Messagecount \u2014 User Investigation."
            },
            {
                "name": "nickhistory",
                "sub": "nickhistory",
                "dedicated": false,
                "kind": "action",
                "desc": "Nickhistory \u2014 User Investigation."
            },
            {
                "name": "rolehistory",
                "sub": "rolehistory",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolehistory \u2014 User Investigation."
            },
            {
                "name": "namehistory",
                "sub": "namehistory",
                "dedicated": false,
                "kind": "action",
                "desc": "Namehistory \u2014 User Investigation."
            },
            {
                "name": "mentioninfo",
                "sub": "mentioninfo",
                "dedicated": false,
                "kind": "action",
                "desc": "Mentioninfo \u2014 User Investigation."
            },
            {
                "name": "mutualroles",
                "sub": "mutualroles",
                "dedicated": false,
                "kind": "action",
                "desc": "Mutualroles \u2014 User Investigation."
            },
            {
                "name": "mutualchannels",
                "sub": "mutualchannels",
                "dedicated": false,
                "kind": "action",
                "desc": "Mutualchannels \u2014 User Investigation."
            },
            {
                "name": "userchannels",
                "sub": "userchannels",
                "dedicated": false,
                "kind": "action",
                "desc": "Userchannels \u2014 User Investigation."
            },
            {
                "name": "usercases",
                "sub": "usercases",
                "dedicated": false,
                "kind": "action",
                "desc": "Usercases \u2014 User Investigation."
            },
            {
                "name": "userreports",
                "sub": "userreports",
                "dedicated": false,
                "kind": "action",
                "desc": "Userreports \u2014 User Investigation."
            },
            {
                "name": "userwarnings",
                "sub": "userwarnings",
                "dedicated": false,
                "kind": "action",
                "desc": "Userwarnings \u2014 User Investigation."
            },
            {
                "name": "userpunishments",
                "sub": "userpunishments",
                "dedicated": false,
                "kind": "action",
                "desc": "Userpunishments \u2014 User Investigation."
            },
            {
                "name": "usernotes",
                "sub": "usernotes",
                "dedicated": false,
                "kind": "action",
                "desc": "Usernotes \u2014 User Investigation."
            },
            {
                "name": "userstatus",
                "sub": "userstatus",
                "dedicated": false,
                "kind": "action",
                "desc": "Userstatus \u2014 User Investigation."
            },
            {
                "name": "userprofile",
                "sub": "userprofile",
                "dedicated": false,
                "kind": "action",
                "desc": "Userprofile \u2014 User Investigation."
            },
            {
                "name": "userscan",
                "sub": "userscan",
                "dedicated": false,
                "kind": "action",
                "desc": "Userscan \u2014 User Investigation."
            }
        ]
    },
    {
        "slug": "msg",
        "title": "Message Investigation",
        "commands": [
            {
                "name": "search",
                "sub": "search",
                "dedicated": false,
                "kind": "search",
                "desc": "Search search \u2014 Message Investigation."
            },
            {
                "name": "searchuser",
                "sub": "searchuser",
                "dedicated": false,
                "kind": "action",
                "desc": "Searchuser \u2014 Message Investigation."
            },
            {
                "name": "searchchannel",
                "sub": "searchchannel",
                "dedicated": false,
                "kind": "action",
                "desc": "Searchchannel \u2014 Message Investigation."
            },
            {
                "name": "searchbefore",
                "sub": "searchbefore",
                "dedicated": false,
                "kind": "action",
                "desc": "Searchbefore \u2014 Message Investigation."
            },
            {
                "name": "searchafter",
                "sub": "searchafter",
                "dedicated": false,
                "kind": "action",
                "desc": "Searchafter \u2014 Message Investigation."
            },
            {
                "name": "searchlinks",
                "sub": "searchlinks",
                "dedicated": false,
                "kind": "action",
                "desc": "Searchlinks \u2014 Message Investigation."
            },
            {
                "name": "searchattachments",
                "sub": "searchattachments",
                "dedicated": false,
                "kind": "action",
                "desc": "Searchattachments \u2014 Message Investigation."
            },
            {
                "name": "searchmentions",
                "sub": "searchmentions",
                "dedicated": false,
                "kind": "action",
                "desc": "Searchmentions \u2014 Message Investigation."
            },
            {
                "name": "searchkeyword",
                "sub": "searchkeyword",
                "dedicated": false,
                "kind": "action",
                "desc": "Searchkeyword \u2014 Message Investigation."
            },
            {
                "name": "searchcase",
                "sub": "searchcase",
                "dedicated": false,
                "kind": "action",
                "desc": "Searchcase \u2014 Message Investigation."
            },
            {
                "name": "messageinfo",
                "sub": "messageinfo",
                "dedicated": false,
                "kind": "action",
                "desc": "Messageinfo \u2014 Message Investigation."
            },
            {
                "name": "messagehistory",
                "sub": "messagehistory",
                "dedicated": false,
                "kind": "action",
                "desc": "Messagehistory \u2014 Message Investigation."
            },
            {
                "name": "findmessage",
                "sub": "findmessage",
                "dedicated": false,
                "kind": "action",
                "desc": "Findmessage \u2014 Message Investigation."
            },
            {
                "name": "firstmessage",
                "sub": "firstmessage",
                "dedicated": false,
                "kind": "action",
                "desc": "Firstmessage \u2014 Message Investigation."
            },
            {
                "name": "lastmessage",
                "sub": "lastmessage",
                "dedicated": false,
                "kind": "action",
                "desc": "Lastmessage \u2014 Message Investigation."
            },
            {
                "name": "messagecount",
                "sub": "messagecount",
                "dedicated": false,
                "kind": "action",
                "desc": "Messagecount \u2014 Message Investigation."
            },
            {
                "name": "messagecontext",
                "sub": "messagecontext",
                "dedicated": false,
                "kind": "action",
                "desc": "Messagecontext \u2014 Message Investigation."
            },
            {
                "name": "messageauthor",
                "sub": "messageauthor",
                "dedicated": false,
                "kind": "action",
                "desc": "Messageauthor \u2014 Message Investigation."
            },
            {
                "name": "messagelinks",
                "sub": "messagelinks",
                "dedicated": false,
                "kind": "action",
                "desc": "Messagelinks \u2014 Message Investigation."
            },
            {
                "name": "messageattachments",
                "sub": "messageattachments",
                "dedicated": false,
                "kind": "action",
                "desc": "Messageattachments \u2014 Message Investigation."
            },
            {
                "name": "messageedits",
                "sub": "messageedits",
                "dedicated": false,
                "kind": "action",
                "desc": "Messageedits \u2014 Message Investigation."
            },
            {
                "name": "messagedeletions",
                "sub": "messagedeletions",
                "dedicated": false,
                "kind": "action",
                "desc": "Messagedeletions \u2014 Message Investigation."
            },
            {
                "name": "messageactivity",
                "sub": "messageactivity",
                "dedicated": false,
                "kind": "action",
                "desc": "Messageactivity \u2014 Message Investigation."
            },
            {
                "name": "messageexport",
                "sub": "messageexport",
                "dedicated": false,
                "kind": "action",
                "desc": "Messageexport \u2014 Message Investigation."
            },
            {
                "name": "messageaudit",
                "sub": "messageaudit",
                "dedicated": false,
                "kind": "action",
                "desc": "Messageaudit \u2014 Message Investigation."
            }
        ]
    },
    {
        "slug": "cleanup",
        "title": "Message Cleanup",
        "commands": [
            {
                "name": "clear",
                "sub": "clear",
                "dedicated": true,
                "kind": "action",
                "desc": "Clear \u2014 Message Cleanup."
            },
            {
                "name": "purge",
                "sub": "purge",
                "dedicated": false,
                "kind": "action",
                "desc": "Purge \u2014 Message Cleanup."
            },
            {
                "name": "purgeuser",
                "sub": "purgeuser",
                "dedicated": false,
                "kind": "action",
                "desc": "Purgeuser \u2014 Message Cleanup."
            },
            {
                "name": "purgebots",
                "sub": "purgebots",
                "dedicated": false,
                "kind": "action",
                "desc": "Purgebots \u2014 Message Cleanup."
            },
            {
                "name": "purge-links",
                "sub": "purge-links",
                "dedicated": false,
                "kind": "action",
                "desc": "Purge links \u2014 Message Cleanup."
            },
            {
                "name": "purge-images",
                "sub": "purge-images",
                "dedicated": false,
                "kind": "action",
                "desc": "Purge images \u2014 Message Cleanup."
            },
            {
                "name": "purge-mentions",
                "sub": "purge-mentions",
                "dedicated": false,
                "kind": "action",
                "desc": "Purge mentions \u2014 Message Cleanup."
            },
            {
                "name": "purge-keyword",
                "sub": "purge-keyword",
                "dedicated": false,
                "kind": "action",
                "desc": "Purge keyword \u2014 Message Cleanup."
            },
            {
                "name": "purge-files",
                "sub": "purge-files",
                "dedicated": false,
                "kind": "action",
                "desc": "Purge files \u2014 Message Cleanup."
            },
            {
                "name": "purge-embeds",
                "sub": "purge-embeds",
                "dedicated": false,
                "kind": "action",
                "desc": "Purge embeds \u2014 Message Cleanup."
            },
            {
                "name": "purge-reactions",
                "sub": "purge-reactions",
                "dedicated": false,
                "kind": "action",
                "desc": "Purge reactions \u2014 Message Cleanup."
            },
            {
                "name": "purgecommands",
                "sub": "purgecommands",
                "dedicated": false,
                "kind": "action",
                "desc": "Purgecommands \u2014 Message Cleanup."
            },
            {
                "name": "purgeinvites",
                "sub": "purgeinvites",
                "dedicated": false,
                "kind": "action",
                "desc": "Purgeinvites \u2014 Message Cleanup."
            },
            {
                "name": "cleanup",
                "sub": "cleanup",
                "dedicated": false,
                "kind": "action",
                "desc": "Cleanup \u2014 Message Cleanup."
            },
            {
                "name": "cleanupbots",
                "sub": "bots",
                "dedicated": false,
                "kind": "action",
                "desc": "Bots \u2014 Message Cleanup."
            },
            {
                "name": "cleanupinvites",
                "sub": "invites",
                "dedicated": false,
                "kind": "action",
                "desc": "Invites \u2014 Message Cleanup."
            },
            {
                "name": "cleanup-links",
                "sub": "links",
                "dedicated": false,
                "kind": "action",
                "desc": "Links \u2014 Message Cleanup."
            },
            {
                "name": "cleanup-images",
                "sub": "images",
                "dedicated": false,
                "kind": "action",
                "desc": "Images \u2014 Message Cleanup."
            },
            {
                "name": "cleanup-files",
                "sub": "files",
                "dedicated": false,
                "kind": "action",
                "desc": "Files \u2014 Message Cleanup."
            },
            {
                "name": "cleanupcommands",
                "sub": "commands",
                "dedicated": false,
                "kind": "action",
                "desc": "Commands \u2014 Message Cleanup."
            },
            {
                "name": "cleanupuser",
                "sub": "user",
                "dedicated": false,
                "kind": "action",
                "desc": "User \u2014 Message Cleanup."
            },
            {
                "name": "cleanupkeyword",
                "sub": "keyword",
                "dedicated": false,
                "kind": "action",
                "desc": "Keyword \u2014 Message Cleanup."
            },
            {
                "name": "cleanupbefore",
                "sub": "before",
                "dedicated": false,
                "kind": "action",
                "desc": "Before \u2014 Message Cleanup."
            },
            {
                "name": "cleanupafter",
                "sub": "after",
                "dedicated": false,
                "kind": "action",
                "desc": "After \u2014 Message Cleanup."
            },
            {
                "name": "prune",
                "sub": "prune",
                "dedicated": false,
                "kind": "action",
                "desc": "Prune \u2014 Message Cleanup."
            },
            {
                "name": "prunebots",
                "sub": "prunebots",
                "dedicated": false,
                "kind": "action",
                "desc": "Prunebots \u2014 Message Cleanup."
            },
            {
                "name": "pruneinactive",
                "sub": "pruneinactive",
                "dedicated": false,
                "kind": "action",
                "desc": "Pruneinactive \u2014 Message Cleanup."
            },
            {
                "name": "prunemembers",
                "sub": "prunemembers",
                "dedicated": false,
                "kind": "action",
                "desc": "Prunemembers \u2014 Message Cleanup."
            }
        ]
    },
    {
        "slug": "automodx",
        "title": "AutoMod",
        "commands": [
            {
                "name": "automod",
                "sub": "automod",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod \u2014 AutoMod."
            },
            {
                "name": "automod-enable",
                "sub": "automod-enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on automod enable \u2014 AutoMod."
            },
            {
                "name": "automod-disable",
                "sub": "automod-disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off automod disable \u2014 AutoMod."
            },
            {
                "name": "automod-status",
                "sub": "automod-status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show automod status \u2014 AutoMod."
            },
            {
                "name": "automod-config",
                "sub": "automod-config",
                "dedicated": false,
                "kind": "config",
                "desc": "Configure automod config \u2014 AutoMod."
            },
            {
                "name": "automod-reset",
                "sub": "automod-reset",
                "dedicated": false,
                "kind": "reset",
                "desc": "Reset automod reset \u2014 AutoMod."
            },
            {
                "name": "automod-logs",
                "sub": "automod-logs",
                "dedicated": false,
                "kind": "logs",
                "desc": "Logs for automod logs \u2014 AutoMod."
            },
            {
                "name": "automod-action",
                "sub": "automod-action",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod action \u2014 AutoMod."
            },
            {
                "name": "automod-threshold",
                "sub": "automod-threshold",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod threshold \u2014 AutoMod."
            },
            {
                "name": "automod-exempt",
                "sub": "automod-exempt",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod exempt \u2014 AutoMod."
            },
            {
                "name": "automod-unexempt",
                "sub": "automod-unexempt",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod unexempt \u2014 AutoMod."
            },
            {
                "name": "automod-test",
                "sub": "automod-test",
                "dedicated": false,
                "kind": "test",
                "desc": "Test automod test \u2014 AutoMod."
            },
            {
                "name": "automod-rules",
                "sub": "automod-rules",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod rules \u2014 AutoMod."
            },
            {
                "name": "automod-add",
                "sub": "automod-add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create automod add \u2014 AutoMod."
            },
            {
                "name": "automod-remove",
                "sub": "automod-remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete automod remove \u2014 AutoMod."
            },
            {
                "name": "automod-edit",
                "sub": "automod-edit",
                "dedicated": false,
                "kind": "edit",
                "desc": "Edit automod edit \u2014 AutoMod."
            },
            {
                "name": "automod-priority",
                "sub": "automod-priority",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod priority \u2014 AutoMod."
            },
            {
                "name": "automod-alerts",
                "sub": "automod-alerts",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod alerts \u2014 AutoMod."
            },
            {
                "name": "automod-queue",
                "sub": "automod-queue",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod queue \u2014 AutoMod."
            },
            {
                "name": "automod-review",
                "sub": "automod-review",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod review \u2014 AutoMod."
            },
            {
                "name": "automod-approve",
                "sub": "automod-approve",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod approve \u2014 AutoMod."
            },
            {
                "name": "automod-reject",
                "sub": "automod-reject",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod reject \u2014 AutoMod."
            },
            {
                "name": "automod-stats",
                "sub": "automod-stats",
                "dedicated": false,
                "kind": "stats",
                "desc": "Statistics for automod stats \u2014 AutoMod."
            },
            {
                "name": "automod-history",
                "sub": "automod-history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for automod history \u2014 AutoMod."
            },
            {
                "name": "automod-sensitivity",
                "sub": "automod-sensitivity",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod sensitivity \u2014 AutoMod."
            },
            {
                "name": "automod-preview",
                "sub": "automod-preview",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod preview \u2014 AutoMod."
            }
        ]
    },
    {
        "slug": "filter",
        "title": "Content Filters",
        "commands": [
            {
                "name": "filter",
                "sub": "filter",
                "dedicated": false,
                "kind": "action",
                "desc": "Filter \u2014 Content Filters."
            },
            {
                "name": "filter-add",
                "sub": "add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create add \u2014 Content Filters."
            },
            {
                "name": "filter-remove",
                "sub": "remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete remove \u2014 Content Filters."
            },
            {
                "name": "filter-list",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Content Filters."
            },
            {
                "name": "filter-clear",
                "sub": "clear",
                "dedicated": false,
                "kind": "action",
                "desc": "Clear \u2014 Content Filters."
            },
            {
                "name": "filter-test",
                "sub": "test",
                "dedicated": false,
                "kind": "test",
                "desc": "Test test \u2014 Content Filters."
            },
            {
                "name": "wordfilter",
                "sub": "wordfilter",
                "dedicated": false,
                "kind": "action",
                "desc": "Wordfilter \u2014 Content Filters."
            },
            {
                "name": "wordfilter-add",
                "sub": "wordfilter-add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create wordfilter add \u2014 Content Filters."
            },
            {
                "name": "wordfilter-remove",
                "sub": "wordfilter-remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete wordfilter remove \u2014 Content Filters."
            },
            {
                "name": "wordfilter-list",
                "sub": "wordfilter-list",
                "dedicated": false,
                "kind": "list",
                "desc": "List wordfilter list \u2014 Content Filters."
            },
            {
                "name": "antilink",
                "sub": "antilink",
                "dedicated": false,
                "kind": "action",
                "desc": "Antilink \u2014 Content Filters."
            },
            {
                "name": "allowedlinks",
                "sub": "allowedlinks",
                "dedicated": false,
                "kind": "action",
                "desc": "Allowedlinks \u2014 Content Filters."
            },
            {
                "name": "allowedlinks-add",
                "sub": "allowedlinks-add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create allowedlinks add \u2014 Content Filters."
            },
            {
                "name": "allowedlinks-remove",
                "sub": "allowedlinks-remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete allowedlinks remove \u2014 Content Filters."
            },
            {
                "name": "allowedlinks-list",
                "sub": "allowedlinks-list",
                "dedicated": false,
                "kind": "list",
                "desc": "List allowedlinks list \u2014 Content Filters."
            },
            {
                "name": "discordfilter",
                "sub": "discordfilter",
                "dedicated": false,
                "kind": "action",
                "desc": "Discordfilter \u2014 Content Filters."
            },
            {
                "name": "invitelock",
                "sub": "invitelock",
                "dedicated": false,
                "kind": "action",
                "desc": "Invitelock \u2014 Content Filters."
            },
            {
                "name": "capsfilter",
                "sub": "capsfilter",
                "dedicated": false,
                "kind": "action",
                "desc": "Capsfilter \u2014 Content Filters."
            },
            {
                "name": "mentionlimit",
                "sub": "mentionlimit",
                "dedicated": false,
                "kind": "action",
                "desc": "Mentionlimit \u2014 Content Filters."
            },
            {
                "name": "emojilimit",
                "sub": "emojilimit",
                "dedicated": false,
                "kind": "action",
                "desc": "Emojilimit \u2014 Content Filters."
            },
            {
                "name": "attachmentlimit",
                "sub": "attachmentlimit",
                "dedicated": false,
                "kind": "action",
                "desc": "Attachmentlimit \u2014 Content Filters."
            },
            {
                "name": "linkfilter",
                "sub": "linkfilter",
                "dedicated": false,
                "kind": "action",
                "desc": "Linkfilter \u2014 Content Filters."
            },
            {
                "name": "linkscan",
                "sub": "linkscan",
                "dedicated": false,
                "kind": "action",
                "desc": "Linkscan \u2014 Content Filters."
            },
            {
                "name": "domaincheck",
                "sub": "domaincheck",
                "dedicated": false,
                "kind": "action",
                "desc": "Domaincheck \u2014 Content Filters."
            },
            {
                "name": "contentscan",
                "sub": "contentscan",
                "dedicated": false,
                "kind": "action",
                "desc": "Contentscan \u2014 Content Filters."
            }
        ]
    },
    {
        "slug": "antiraid",
        "title": "Anti-Raid & Anti-Spam",
        "commands": [
            {
                "name": "raidmode",
                "sub": "raidmode",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidmode \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidmode-enable",
                "sub": "raidmode-enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on raidmode enable \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidmode-disable",
                "sub": "raidmode-disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off raidmode disable \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidmode-status",
                "sub": "raidmode-status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show raidmode status \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidmode-lockdown",
                "sub": "raidmode-lockdown",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidmode lockdown \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidmode-unlock",
                "sub": "raidmode-unlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidmode unlock \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidmode-threshold",
                "sub": "raidmode-threshold",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidmode threshold \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidmode-duration",
                "sub": "raidmode-duration",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidmode duration \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidmode-alert",
                "sub": "raidmode-alert",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidmode alert \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidmode-logs",
                "sub": "raidmode-logs",
                "dedicated": false,
                "kind": "logs",
                "desc": "Logs for raidmode logs \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "antispam",
                "sub": "antispam",
                "dedicated": false,
                "kind": "action",
                "desc": "Antispam \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "antispam-enable",
                "sub": "antispam-enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on antispam enable \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "antispam-disable",
                "sub": "antispam-disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off antispam disable \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "antispam-status",
                "sub": "antispam-status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show antispam status \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "antispam-threshold",
                "sub": "antispam-threshold",
                "dedicated": false,
                "kind": "action",
                "desc": "Antispam threshold \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "antispam-action",
                "sub": "antispam-action",
                "dedicated": false,
                "kind": "action",
                "desc": "Antispam action \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "antispam-exempt",
                "sub": "antispam-exempt",
                "dedicated": false,
                "kind": "action",
                "desc": "Antispam exempt \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "recentjoins",
                "sub": "recentjoins",
                "dedicated": false,
                "kind": "action",
                "desc": "Recentjoins \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "recentleaves",
                "sub": "recentleaves",
                "dedicated": false,
                "kind": "action",
                "desc": "Recentleaves \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "joinrate",
                "sub": "joinrate",
                "dedicated": false,
                "kind": "action",
                "desc": "Joinrate \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "joinlog",
                "sub": "joinlog",
                "dedicated": false,
                "kind": "action",
                "desc": "Joinlog \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "massjoin",
                "sub": "massjoin",
                "dedicated": false,
                "kind": "action",
                "desc": "Massjoin \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidlogs",
                "sub": "raidlogs",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidlogs \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidstats",
                "sub": "raidstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidstats \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidhistory",
                "sub": "raidhistory",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidhistory \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidtest",
                "sub": "raidtest",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidtest \u2014 Anti-Raid & Anti-Spam."
            },
            {
                "name": "raidalerts",
                "sub": "raidalerts",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidalerts \u2014 Anti-Raid & Anti-Spam."
            }
        ]
    },
    {
        "slug": "security",
        "title": "Security",
        "commands": [
            {
                "name": "security",
                "sub": "security",
                "dedicated": false,
                "kind": "action",
                "desc": "Security \u2014 Security."
            },
            {
                "name": "security-status",
                "sub": "status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show status \u2014 Security."
            },
            {
                "name": "security-scan",
                "sub": "scan",
                "dedicated": false,
                "kind": "action",
                "desc": "Scan \u2014 Security."
            },
            {
                "name": "security-score",
                "sub": "score",
                "dedicated": false,
                "kind": "action",
                "desc": "Score \u2014 Security."
            },
            {
                "name": "security-recommendations",
                "sub": "recommendations",
                "dedicated": false,
                "kind": "action",
                "desc": "Recommendations \u2014 Security."
            },
            {
                "name": "security-incidents",
                "sub": "incidents",
                "dedicated": false,
                "kind": "action",
                "desc": "Incidents \u2014 Security."
            },
            {
                "name": "security-incident",
                "sub": "incident",
                "dedicated": false,
                "kind": "action",
                "desc": "Incident \u2014 Security."
            },
            {
                "name": "security-lockdown",
                "sub": "lockdown",
                "dedicated": false,
                "kind": "action",
                "desc": "Lockdown \u2014 Security."
            },
            {
                "name": "security-recovery",
                "sub": "recovery",
                "dedicated": false,
                "kind": "action",
                "desc": "Recovery \u2014 Security."
            },
            {
                "name": "security-audit",
                "sub": "audit",
                "dedicated": false,
                "kind": "action",
                "desc": "Audit \u2014 Security."
            },
            {
                "name": "security-config",
                "sub": "config",
                "dedicated": false,
                "kind": "config",
                "desc": "Configure config \u2014 Security."
            },
            {
                "name": "security-users",
                "sub": "users",
                "dedicated": false,
                "kind": "action",
                "desc": "Users \u2014 Security."
            },
            {
                "name": "security-roles",
                "sub": "roles",
                "dedicated": false,
                "kind": "action",
                "desc": "Roles \u2014 Security."
            },
            {
                "name": "security-channels",
                "sub": "channels",
                "dedicated": false,
                "kind": "action",
                "desc": "Channels \u2014 Security."
            },
            {
                "name": "security-webhooks",
                "sub": "webhooks",
                "dedicated": false,
                "kind": "action",
                "desc": "Webhooks \u2014 Security."
            },
            {
                "name": "security-bots",
                "sub": "bots",
                "dedicated": false,
                "kind": "action",
                "desc": "Bots \u2014 Security."
            },
            {
                "name": "security-permissions",
                "sub": "permissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Permissions \u2014 Security."
            },
            {
                "name": "security-backup",
                "sub": "backup",
                "dedicated": false,
                "kind": "action",
                "desc": "Backup \u2014 Security."
            },
            {
                "name": "security-verify",
                "sub": "verify",
                "dedicated": false,
                "kind": "action",
                "desc": "Verify \u2014 Security."
            },
            {
                "name": "healthcheck",
                "sub": "healthcheck",
                "dedicated": false,
                "kind": "action",
                "desc": "Healthcheck \u2014 Security."
            },
            {
                "name": "securitycheck",
                "sub": "check",
                "dedicated": false,
                "kind": "action",
                "desc": "Check \u2014 Security."
            },
            {
                "name": "permissionscan",
                "sub": "permissionscan",
                "dedicated": false,
                "kind": "action",
                "desc": "Permissionscan \u2014 Security."
            },
            {
                "name": "configcheck",
                "sub": "configcheck",
                "dedicated": false,
                "kind": "action",
                "desc": "Configcheck \u2014 Security."
            },
            {
                "name": "serverscan",
                "sub": "serverscan",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverscan \u2014 Security."
            }
        ]
    },
    {
        "slug": "trust",
        "title": "Trust & Risk",
        "commands": [
            {
                "name": "trust",
                "sub": "trust",
                "dedicated": false,
                "kind": "action",
                "desc": "Trust \u2014 Trust & Risk."
            },
            {
                "name": "trustscore",
                "sub": "score",
                "dedicated": false,
                "kind": "action",
                "desc": "Score \u2014 Trust & Risk."
            },
            {
                "name": "trustlist",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Trust & Risk."
            },
            {
                "name": "trust-add",
                "sub": "add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create add \u2014 Trust & Risk."
            },
            {
                "name": "trust-remove",
                "sub": "remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete remove \u2014 Trust & Risk."
            },
            {
                "name": "trusthistory",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Trust & Risk."
            },
            {
                "name": "trustedroles",
                "sub": "edroles",
                "dedicated": false,
                "kind": "action",
                "desc": "Edroles \u2014 Trust & Risk."
            },
            {
                "name": "trustedchannels",
                "sub": "edchannels",
                "dedicated": false,
                "kind": "action",
                "desc": "Edchannels \u2014 Trust & Risk."
            },
            {
                "name": "risk",
                "sub": "risk",
                "dedicated": false,
                "kind": "action",
                "desc": "Risk \u2014 Trust & Risk."
            },
            {
                "name": "risklist",
                "sub": "risklist",
                "dedicated": false,
                "kind": "action",
                "desc": "Risklist \u2014 Trust & Risk."
            },
            {
                "name": "riskusers",
                "sub": "riskusers",
                "dedicated": false,
                "kind": "action",
                "desc": "Riskusers \u2014 Trust & Risk."
            },
            {
                "name": "riskchannels",
                "sub": "riskchannels",
                "dedicated": false,
                "kind": "action",
                "desc": "Riskchannels \u2014 Trust & Risk."
            },
            {
                "name": "riskroles",
                "sub": "riskroles",
                "dedicated": false,
                "kind": "action",
                "desc": "Riskroles \u2014 Trust & Risk."
            },
            {
                "name": "riskalerts",
                "sub": "riskalerts",
                "dedicated": false,
                "kind": "action",
                "desc": "Riskalerts \u2014 Trust & Risk."
            },
            {
                "name": "suspicious",
                "sub": "suspicious",
                "dedicated": false,
                "kind": "action",
                "desc": "Suspicious \u2014 Trust & Risk."
            },
            {
                "name": "suspiciouslist",
                "sub": "suspiciouslist",
                "dedicated": false,
                "kind": "action",
                "desc": "Suspiciouslist \u2014 Trust & Risk."
            },
            {
                "name": "watch",
                "sub": "watch",
                "dedicated": false,
                "kind": "action",
                "desc": "Watch \u2014 Trust & Risk."
            },
            {
                "name": "watchlist",
                "sub": "watchlist",
                "dedicated": false,
                "kind": "action",
                "desc": "Watchlist \u2014 Trust & Risk."
            },
            {
                "name": "watch-add",
                "sub": "watch-add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create watch add \u2014 Trust & Risk."
            },
            {
                "name": "watch-remove",
                "sub": "watch-remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete watch remove \u2014 Trust & Risk."
            },
            {
                "name": "watch-info",
                "sub": "watch-info",
                "dedicated": false,
                "kind": "view",
                "desc": "View watch info \u2014 Trust & Risk."
            },
            {
                "name": "watch-alerts",
                "sub": "watch-alerts",
                "dedicated": false,
                "kind": "action",
                "desc": "Watch alerts \u2014 Trust & Risk."
            },
            {
                "name": "watch-history",
                "sub": "watch-history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for watch history \u2014 Trust & Risk."
            },
            {
                "name": "watch-keyword",
                "sub": "watch-keyword",
                "dedicated": false,
                "kind": "action",
                "desc": "Watch keyword \u2014 Trust & Risk."
            },
            {
                "name": "watch-links",
                "sub": "watch-links",
                "dedicated": false,
                "kind": "action",
                "desc": "Watch links \u2014 Trust & Risk."
            },
            {
                "name": "watch-joins",
                "sub": "watch-joins",
                "dedicated": false,
                "kind": "action",
                "desc": "Watch joins \u2014 Trust & Risk."
            }
        ]
    },
    {
        "slug": "report",
        "title": "Reports",
        "commands": [
            {
                "name": "report",
                "sub": "report",
                "dedicated": false,
                "kind": "action",
                "desc": "Report \u2014 Reports."
            },
            {
                "name": "reportmessage",
                "sub": "message",
                "dedicated": false,
                "kind": "action",
                "desc": "Message \u2014 Reports."
            },
            {
                "name": "reports",
                "sub": "reports",
                "dedicated": false,
                "kind": "action",
                "desc": "Reports \u2014 Reports."
            },
            {
                "name": "reportview",
                "sub": "view",
                "dedicated": false,
                "kind": "view",
                "desc": "View view \u2014 Reports."
            },
            {
                "name": "reportclaim",
                "sub": "claim",
                "dedicated": false,
                "kind": "action",
                "desc": "Claim \u2014 Reports."
            },
            {
                "name": "reportclose",
                "sub": "close",
                "dedicated": false,
                "kind": "action",
                "desc": "Close \u2014 Reports."
            },
            {
                "name": "reportreopen",
                "sub": "reopen",
                "dedicated": false,
                "kind": "action",
                "desc": "Reopen \u2014 Reports."
            },
            {
                "name": "reportassign",
                "sub": "assign",
                "dedicated": false,
                "kind": "action",
                "desc": "Assign \u2014 Reports."
            },
            {
                "name": "reportpriority",
                "sub": "priority",
                "dedicated": false,
                "kind": "action",
                "desc": "Priority \u2014 Reports."
            },
            {
                "name": "reportnote",
                "sub": "note",
                "dedicated": false,
                "kind": "action",
                "desc": "Note \u2014 Reports."
            },
            {
                "name": "reportstats",
                "sub": "stats",
                "dedicated": false,
                "kind": "stats",
                "desc": "Statistics for stats \u2014 Reports."
            },
            {
                "name": "reportsearch",
                "sub": "search",
                "dedicated": false,
                "kind": "search",
                "desc": "Search search \u2014 Reports."
            },
            {
                "name": "reportcategory",
                "sub": "category",
                "dedicated": false,
                "kind": "action",
                "desc": "Category \u2014 Reports."
            },
            {
                "name": "reporttag",
                "sub": "tag",
                "dedicated": false,
                "kind": "action",
                "desc": "Tag \u2014 Reports."
            },
            {
                "name": "reporthistory",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Reports."
            },
            {
                "name": "reportexport",
                "sub": "export",
                "dedicated": false,
                "kind": "export",
                "desc": "Export export \u2014 Reports."
            },
            {
                "name": "reportmerge",
                "sub": "merge",
                "dedicated": false,
                "kind": "action",
                "desc": "Merge \u2014 Reports."
            },
            {
                "name": "reportsplit",
                "sub": "split",
                "dedicated": false,
                "kind": "action",
                "desc": "Split \u2014 Reports."
            },
            {
                "name": "reportescalate",
                "sub": "escalate",
                "dedicated": false,
                "kind": "action",
                "desc": "Escalate \u2014 Reports."
            }
        ]
    },
    {
        "slug": "appeal",
        "title": "Appeals",
        "commands": [
            {
                "name": "appeal",
                "sub": "appeal",
                "dedicated": false,
                "kind": "action",
                "desc": "Appeal \u2014 Appeals."
            },
            {
                "name": "appeals",
                "sub": "appeals",
                "dedicated": false,
                "kind": "action",
                "desc": "Appeals \u2014 Appeals."
            },
            {
                "name": "appealview",
                "sub": "view",
                "dedicated": false,
                "kind": "view",
                "desc": "View view \u2014 Appeals."
            },
            {
                "name": "appealapprove",
                "sub": "approve",
                "dedicated": false,
                "kind": "action",
                "desc": "Approve \u2014 Appeals."
            },
            {
                "name": "appealdeny",
                "sub": "deny",
                "dedicated": false,
                "kind": "action",
                "desc": "Deny \u2014 Appeals."
            },
            {
                "name": "appealassign",
                "sub": "assign",
                "dedicated": false,
                "kind": "action",
                "desc": "Assign \u2014 Appeals."
            },
            {
                "name": "appealnote",
                "sub": "note",
                "dedicated": false,
                "kind": "action",
                "desc": "Note \u2014 Appeals."
            },
            {
                "name": "appealstatus",
                "sub": "status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show status \u2014 Appeals."
            },
            {
                "name": "appealstats",
                "sub": "stats",
                "dedicated": false,
                "kind": "stats",
                "desc": "Statistics for stats \u2014 Appeals."
            },
            {
                "name": "appealhistory",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Appeals."
            },
            {
                "name": "appealpriority",
                "sub": "priority",
                "dedicated": false,
                "kind": "action",
                "desc": "Priority \u2014 Appeals."
            },
            {
                "name": "appealcategory",
                "sub": "category",
                "dedicated": false,
                "kind": "action",
                "desc": "Category \u2014 Appeals."
            },
            {
                "name": "appealcomment",
                "sub": "comment",
                "dedicated": false,
                "kind": "action",
                "desc": "Comment \u2014 Appeals."
            },
            {
                "name": "appealescalate",
                "sub": "escalate",
                "dedicated": false,
                "kind": "action",
                "desc": "Escalate \u2014 Appeals."
            },
            {
                "name": "appealclose",
                "sub": "close",
                "dedicated": false,
                "kind": "action",
                "desc": "Close \u2014 Appeals."
            },
            {
                "name": "appealreopen",
                "sub": "reopen",
                "dedicated": false,
                "kind": "action",
                "desc": "Reopen \u2014 Appeals."
            },
            {
                "name": "appealexport",
                "sub": "export",
                "dedicated": false,
                "kind": "export",
                "desc": "Export export \u2014 Appeals."
            }
        ]
    },
    {
        "slug": "incident",
        "title": "Incident Management",
        "commands": [
            {
                "name": "incident",
                "sub": "incident",
                "dedicated": false,
                "kind": "action",
                "desc": "Incident \u2014 Incident Management."
            },
            {
                "name": "incidentcreate",
                "sub": "create",
                "dedicated": false,
                "kind": "create",
                "desc": "Create create \u2014 Incident Management."
            },
            {
                "name": "incidentlist",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Incident Management."
            },
            {
                "name": "incidentview",
                "sub": "view",
                "dedicated": false,
                "kind": "view",
                "desc": "View view \u2014 Incident Management."
            },
            {
                "name": "incidentupdate",
                "sub": "update",
                "dedicated": false,
                "kind": "action",
                "desc": "Update \u2014 Incident Management."
            },
            {
                "name": "incidentclose",
                "sub": "close",
                "dedicated": false,
                "kind": "action",
                "desc": "Close \u2014 Incident Management."
            },
            {
                "name": "incidentreopen",
                "sub": "reopen",
                "dedicated": false,
                "kind": "action",
                "desc": "Reopen \u2014 Incident Management."
            },
            {
                "name": "incidentassign",
                "sub": "assign",
                "dedicated": false,
                "kind": "action",
                "desc": "Assign \u2014 Incident Management."
            },
            {
                "name": "incidentpriority",
                "sub": "priority",
                "dedicated": false,
                "kind": "action",
                "desc": "Priority \u2014 Incident Management."
            },
            {
                "name": "incidentnote",
                "sub": "note",
                "dedicated": false,
                "kind": "action",
                "desc": "Note \u2014 Incident Management."
            },
            {
                "name": "incidenttimeline",
                "sub": "timeline",
                "dedicated": false,
                "kind": "action",
                "desc": "Timeline \u2014 Incident Management."
            },
            {
                "name": "incidentstats",
                "sub": "stats",
                "dedicated": false,
                "kind": "stats",
                "desc": "Statistics for stats \u2014 Incident Management."
            },
            {
                "name": "incidentexport",
                "sub": "export",
                "dedicated": false,
                "kind": "export",
                "desc": "Export export \u2014 Incident Management."
            },
            {
                "name": "incidentcategory",
                "sub": "category",
                "dedicated": false,
                "kind": "action",
                "desc": "Category \u2014 Incident Management."
            },
            {
                "name": "incidenttag",
                "sub": "tag",
                "dedicated": false,
                "kind": "action",
                "desc": "Tag \u2014 Incident Management."
            },
            {
                "name": "incidentlink",
                "sub": "link",
                "dedicated": false,
                "kind": "action",
                "desc": "Link \u2014 Incident Management."
            },
            {
                "name": "incidentmerge",
                "sub": "merge",
                "dedicated": false,
                "kind": "action",
                "desc": "Merge \u2014 Incident Management."
            },
            {
                "name": "incidentescalate",
                "sub": "escalate",
                "dedicated": false,
                "kind": "action",
                "desc": "Escalate \u2014 Incident Management."
            }
        ]
    },
    {
        "slug": "staff",
        "title": "Staff Management",
        "commands": [
            {
                "name": "staff",
                "sub": "staff",
                "dedicated": false,
                "kind": "action",
                "desc": "Staff \u2014 Staff Management."
            },
            {
                "name": "stafflist",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Staff Management."
            },
            {
                "name": "staffinfo",
                "sub": "info",
                "dedicated": false,
                "kind": "view",
                "desc": "View info \u2014 Staff Management."
            },
            {
                "name": "staffadd",
                "sub": "add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create add \u2014 Staff Management."
            },
            {
                "name": "staffremove",
                "sub": "remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete remove \u2014 Staff Management."
            },
            {
                "name": "staffpromote",
                "sub": "promote",
                "dedicated": false,
                "kind": "action",
                "desc": "Promote \u2014 Staff Management."
            },
            {
                "name": "staffdemote",
                "sub": "demote",
                "dedicated": false,
                "kind": "action",
                "desc": "Demote \u2014 Staff Management."
            },
            {
                "name": "staffactivity",
                "sub": "activity",
                "dedicated": false,
                "kind": "action",
                "desc": "Activity \u2014 Staff Management."
            },
            {
                "name": "staffattendance",
                "sub": "attendance",
                "dedicated": false,
                "kind": "action",
                "desc": "Attendance \u2014 Staff Management."
            },
            {
                "name": "staffschedule",
                "sub": "schedule",
                "dedicated": false,
                "kind": "action",
                "desc": "Schedule \u2014 Staff Management."
            },
            {
                "name": "staffnotes",
                "sub": "notes",
                "dedicated": false,
                "kind": "action",
                "desc": "Notes \u2014 Staff Management."
            },
            {
                "name": "staffwarnings",
                "sub": "warnings",
                "dedicated": false,
                "kind": "action",
                "desc": "Warnings \u2014 Staff Management."
            },
            {
                "name": "staffcases",
                "sub": "cases",
                "dedicated": false,
                "kind": "action",
                "desc": "Cases \u2014 Staff Management."
            },
            {
                "name": "staffperformance",
                "sub": "performance",
                "dedicated": false,
                "kind": "action",
                "desc": "Performance \u2014 Staff Management."
            },
            {
                "name": "staffpoints",
                "sub": "points",
                "dedicated": false,
                "kind": "action",
                "desc": "Points \u2014 Staff Management."
            },
            {
                "name": "staffleaderboard",
                "sub": "leaderboard",
                "dedicated": false,
                "kind": "action",
                "desc": "Leaderboard \u2014 Staff Management."
            },
            {
                "name": "staffrank",
                "sub": "rank",
                "dedicated": false,
                "kind": "action",
                "desc": "Rank \u2014 Staff Management."
            },
            {
                "name": "staffawards",
                "sub": "awards",
                "dedicated": false,
                "kind": "action",
                "desc": "Awards \u2014 Staff Management."
            },
            {
                "name": "staffaward",
                "sub": "award",
                "dedicated": false,
                "kind": "action",
                "desc": "Award \u2014 Staff Management."
            },
            {
                "name": "staffachievements",
                "sub": "achievements",
                "dedicated": false,
                "kind": "action",
                "desc": "Achievements \u2014 Staff Management."
            },
            {
                "name": "staffbadges",
                "sub": "badges",
                "dedicated": false,
                "kind": "action",
                "desc": "Badges \u2014 Staff Management."
            },
            {
                "name": "staffmilestones",
                "sub": "milestones",
                "dedicated": false,
                "kind": "action",
                "desc": "Milestones \u2014 Staff Management."
            },
            {
                "name": "staffreport",
                "sub": "report",
                "dedicated": false,
                "kind": "action",
                "desc": "Report \u2014 Staff Management."
            },
            {
                "name": "staffreview",
                "sub": "review",
                "dedicated": false,
                "kind": "action",
                "desc": "Review \u2014 Staff Management."
            },
            {
                "name": "staffstatus",
                "sub": "status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show status \u2014 Staff Management."
            }
        ]
    },
    {
        "slug": "modteam",
        "title": "Moderator Management",
        "commands": [
            {
                "name": "mod",
                "sub": "mod",
                "dedicated": false,
                "kind": "action",
                "desc": "Mod \u2014 Moderator Management."
            },
            {
                "name": "mod-add",
                "sub": "mod-add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create mod add \u2014 Moderator Management."
            },
            {
                "name": "mod-remove",
                "sub": "mod-remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete mod remove \u2014 Moderator Management."
            },
            {
                "name": "mod-list",
                "sub": "mod-list",
                "dedicated": false,
                "kind": "list",
                "desc": "List mod list \u2014 Moderator Management."
            },
            {
                "name": "mod-info",
                "sub": "mod-info",
                "dedicated": false,
                "kind": "view",
                "desc": "View mod info \u2014 Moderator Management."
            },
            {
                "name": "modstats",
                "sub": "modstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Modstats \u2014 Moderator Management."
            },
            {
                "name": "modactivity",
                "sub": "modactivity",
                "dedicated": false,
                "kind": "action",
                "desc": "Modactivity \u2014 Moderator Management."
            },
            {
                "name": "modactions",
                "sub": "modactions",
                "dedicated": false,
                "kind": "action",
                "desc": "Modactions \u2014 Moderator Management."
            },
            {
                "name": "modhistory",
                "sub": "modhistory",
                "dedicated": false,
                "kind": "action",
                "desc": "Modhistory \u2014 Moderator Management."
            },
            {
                "name": "modnote",
                "sub": "modnote",
                "dedicated": false,
                "kind": "action",
                "desc": "Modnote \u2014 Moderator Management."
            },
            {
                "name": "modnotes",
                "sub": "modnotes",
                "dedicated": false,
                "kind": "action",
                "desc": "Modnotes \u2014 Moderator Management."
            },
            {
                "name": "modmute",
                "sub": "modmute",
                "dedicated": false,
                "kind": "action",
                "desc": "Modmute \u2014 Moderator Management."
            },
            {
                "name": "modunmute",
                "sub": "modunmute",
                "dedicated": false,
                "kind": "action",
                "desc": "Modunmute \u2014 Moderator Management."
            },
            {
                "name": "modcases",
                "sub": "modcases",
                "dedicated": false,
                "kind": "action",
                "desc": "Modcases \u2014 Moderator Management."
            },
            {
                "name": "modperformance",
                "sub": "modperformance",
                "dedicated": false,
                "kind": "action",
                "desc": "Modperformance \u2014 Moderator Management."
            },
            {
                "name": "modaccuracy",
                "sub": "modaccuracy",
                "dedicated": false,
                "kind": "action",
                "desc": "Modaccuracy \u2014 Moderator Management."
            },
            {
                "name": "modresponse",
                "sub": "modresponse",
                "dedicated": false,
                "kind": "action",
                "desc": "Modresponse \u2014 Moderator Management."
            },
            {
                "name": "modresolved",
                "sub": "modresolved",
                "dedicated": false,
                "kind": "action",
                "desc": "Modresolved \u2014 Moderator Management."
            },
            {
                "name": "modweekly",
                "sub": "modweekly",
                "dedicated": false,
                "kind": "action",
                "desc": "Modweekly \u2014 Moderator Management."
            },
            {
                "name": "modmonthly",
                "sub": "modmonthly",
                "dedicated": false,
                "kind": "action",
                "desc": "Modmonthly \u2014 Moderator Management."
            },
            {
                "name": "modleaderboard",
                "sub": "modleaderboard",
                "dedicated": false,
                "kind": "action",
                "desc": "Modleaderboard \u2014 Moderator Management."
            },
            {
                "name": "modrank",
                "sub": "modrank",
                "dedicated": false,
                "kind": "action",
                "desc": "Modrank \u2014 Moderator Management."
            },
            {
                "name": "modpoints",
                "sub": "modpoints",
                "dedicated": false,
                "kind": "action",
                "desc": "Modpoints \u2014 Moderator Management."
            },
            {
                "name": "modreview",
                "sub": "modreview",
                "dedicated": false,
                "kind": "action",
                "desc": "Modreview \u2014 Moderator Management."
            },
            {
                "name": "modstatus",
                "sub": "modstatus",
                "dedicated": false,
                "kind": "action",
                "desc": "Modstatus \u2014 Moderator Management."
            }
        ]
    },
    {
        "slug": "modstats",
        "title": "Moderation Analytics",
        "commands": [
            {
                "name": "modstats-server",
                "sub": "server",
                "dedicated": false,
                "kind": "action",
                "desc": "Server \u2014 Moderation Analytics."
            },
            {
                "name": "punishmentstats",
                "sub": "punishmentstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Punishmentstats \u2014 Moderation Analytics."
            },
            {
                "name": "warningstats",
                "sub": "warningstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Warningstats \u2014 Moderation Analytics."
            },
            {
                "name": "banstats",
                "sub": "banstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Banstats \u2014 Moderation Analytics."
            },
            {
                "name": "kickstats",
                "sub": "kickstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Kickstats \u2014 Moderation Analytics."
            },
            {
                "name": "timeoutstats",
                "sub": "timeoutstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Timeoutstats \u2014 Moderation Analytics."
            },
            {
                "name": "reportstats-server",
                "sub": "reportstats-server",
                "dedicated": false,
                "kind": "action",
                "desc": "Reportstats server \u2014 Moderation Analytics."
            },
            {
                "name": "raidstats-server",
                "sub": "raidstats-server",
                "dedicated": false,
                "kind": "action",
                "desc": "Raidstats server \u2014 Moderation Analytics."
            },
            {
                "name": "moderationgraph",
                "sub": "moderationgraph",
                "dedicated": false,
                "kind": "action",
                "desc": "Moderationgraph \u2014 Moderation Analytics."
            },
            {
                "name": "moderationtrend",
                "sub": "moderationtrend",
                "dedicated": false,
                "kind": "action",
                "desc": "Moderationtrend \u2014 Moderation Analytics."
            },
            {
                "name": "punishmenttrend",
                "sub": "punishmenttrend",
                "dedicated": false,
                "kind": "action",
                "desc": "Punishmenttrend \u2014 Moderation Analytics."
            },
            {
                "name": "warningtrend",
                "sub": "warningtrend",
                "dedicated": false,
                "kind": "action",
                "desc": "Warningtrend \u2014 Moderation Analytics."
            },
            {
                "name": "bantrend",
                "sub": "bantrend",
                "dedicated": false,
                "kind": "action",
                "desc": "Bantrend \u2014 Moderation Analytics."
            },
            {
                "name": "kicktrend",
                "sub": "kicktrend",
                "dedicated": false,
                "kind": "action",
                "desc": "Kicktrend \u2014 Moderation Analytics."
            },
            {
                "name": "timeouttrend",
                "sub": "timeouttrend",
                "dedicated": false,
                "kind": "action",
                "desc": "Timeouttrend \u2014 Moderation Analytics."
            },
            {
                "name": "resolutionstats",
                "sub": "resolutionstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Resolutionstats \u2014 Moderation Analytics."
            },
            {
                "name": "response-time",
                "sub": "response-time",
                "dedicated": false,
                "kind": "action",
                "desc": "Response time \u2014 Moderation Analytics."
            },
            {
                "name": "case-volume",
                "sub": "case-volume",
                "dedicated": false,
                "kind": "action",
                "desc": "Case volume \u2014 Moderation Analytics."
            },
            {
                "name": "moderator-volume",
                "sub": "moderator-volume",
                "dedicated": false,
                "kind": "action",
                "desc": "Moderator volume \u2014 Moderation Analytics."
            },
            {
                "name": "moderationoverview",
                "sub": "moderationoverview",
                "dedicated": false,
                "kind": "action",
                "desc": "Moderationoverview \u2014 Moderation Analytics."
            }
        ]
    },
    {
        "slug": "evidence",
        "title": "Evidence",
        "commands": [
            {
                "name": "evidence",
                "sub": "evidence",
                "dedicated": false,
                "kind": "action",
                "desc": "Evidence \u2014 Evidence."
            },
            {
                "name": "evidence-add",
                "sub": "add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create add \u2014 Evidence."
            },
            {
                "name": "evidence-list",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Evidence."
            },
            {
                "name": "evidence-remove",
                "sub": "remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete remove \u2014 Evidence."
            },
            {
                "name": "evidence-note",
                "sub": "note",
                "dedicated": false,
                "kind": "action",
                "desc": "Note \u2014 Evidence."
            },
            {
                "name": "evidence-message",
                "sub": "message",
                "dedicated": false,
                "kind": "action",
                "desc": "Message \u2014 Evidence."
            },
            {
                "name": "evidence-channel",
                "sub": "channel",
                "dedicated": false,
                "kind": "action",
                "desc": "Channel \u2014 Evidence."
            },
            {
                "name": "evidence-export",
                "sub": "export",
                "dedicated": false,
                "kind": "export",
                "desc": "Export export \u2014 Evidence."
            },
            {
                "name": "evidence-search",
                "sub": "search",
                "dedicated": false,
                "kind": "search",
                "desc": "Search search \u2014 Evidence."
            },
            {
                "name": "evidence-view",
                "sub": "view",
                "dedicated": false,
                "kind": "view",
                "desc": "View view \u2014 Evidence."
            },
            {
                "name": "evidence-link",
                "sub": "link",
                "dedicated": false,
                "kind": "action",
                "desc": "Link \u2014 Evidence."
            },
            {
                "name": "evidence-attach",
                "sub": "attach",
                "dedicated": false,
                "kind": "action",
                "desc": "Attach \u2014 Evidence."
            },
            {
                "name": "evidence-history",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Evidence."
            },
            {
                "name": "evidence-verify",
                "sub": "verify",
                "dedicated": false,
                "kind": "action",
                "desc": "Verify \u2014 Evidence."
            }
        ]
    },
    {
        "slug": "channel",
        "title": "Channel Management",
        "commands": [
            {
                "name": "lock",
                "sub": "lock",
                "dedicated": false,
                "kind": "action",
                "desc": "Lock \u2014 Channel Management."
            },
            {
                "name": "unlock",
                "sub": "unlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Unlock \u2014 Channel Management."
            },
            {
                "name": "lockdown",
                "sub": "lockdown",
                "dedicated": false,
                "kind": "action",
                "desc": "Lockdown \u2014 Channel Management."
            },
            {
                "name": "unlockdown",
                "sub": "unlockdown",
                "dedicated": false,
                "kind": "action",
                "desc": "Unlockdown \u2014 Channel Management."
            },
            {
                "name": "hide",
                "sub": "hide",
                "dedicated": false,
                "kind": "action",
                "desc": "Hide \u2014 Channel Management."
            },
            {
                "name": "unhide",
                "sub": "unhide",
                "dedicated": false,
                "kind": "action",
                "desc": "Unhide \u2014 Channel Management."
            },
            {
                "name": "slowmode",
                "sub": "slowmode",
                "dedicated": false,
                "kind": "action",
                "desc": "Slowmode \u2014 Channel Management."
            },
            {
                "name": "channelinfo",
                "sub": "info",
                "dedicated": false,
                "kind": "view",
                "desc": "View info \u2014 Channel Management."
            },
            {
                "name": "channelstats",
                "sub": "stats",
                "dedicated": false,
                "kind": "stats",
                "desc": "Statistics for stats \u2014 Channel Management."
            },
            {
                "name": "channelpermissions",
                "sub": "permissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Permissions \u2014 Channel Management."
            },
            {
                "name": "settopic",
                "sub": "settopic",
                "dedicated": false,
                "kind": "action",
                "desc": "Settopic \u2014 Channel Management."
            },
            {
                "name": "cleartopic",
                "sub": "cleartopic",
                "dedicated": false,
                "kind": "action",
                "desc": "Cleartopic \u2014 Channel Management."
            },
            {
                "name": "renamechannel",
                "sub": "renamechannel",
                "dedicated": false,
                "kind": "action",
                "desc": "Renamechannel \u2014 Channel Management."
            },
            {
                "name": "clonechannel",
                "sub": "clonechannel",
                "dedicated": false,
                "kind": "action",
                "desc": "Clonechannel \u2014 Channel Management."
            },
            {
                "name": "channelprotect",
                "sub": "protect",
                "dedicated": false,
                "kind": "action",
                "desc": "Protect \u2014 Channel Management."
            },
            {
                "name": "channelprotect-enable",
                "sub": "protect-enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on protect enable \u2014 Channel Management."
            },
            {
                "name": "channelprotect-disable",
                "sub": "protect-disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off protect disable \u2014 Channel Management."
            },
            {
                "name": "channelprotect-status",
                "sub": "protect-status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show protect status \u2014 Channel Management."
            },
            {
                "name": "channelprotect-permissions",
                "sub": "protect-permissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Protect permissions \u2014 Channel Management."
            },
            {
                "name": "channelprotect-spam",
                "sub": "protect-spam",
                "dedicated": false,
                "kind": "action",
                "desc": "Protect spam \u2014 Channel Management."
            },
            {
                "name": "channelprotect-links",
                "sub": "protect-links",
                "dedicated": false,
                "kind": "action",
                "desc": "Protect links \u2014 Channel Management."
            },
            {
                "name": "channelprotect-mentions",
                "sub": "protect-mentions",
                "dedicated": false,
                "kind": "action",
                "desc": "Protect mentions \u2014 Channel Management."
            },
            {
                "name": "channelprotect-attachments",
                "sub": "protect-attachments",
                "dedicated": false,
                "kind": "action",
                "desc": "Protect attachments \u2014 Channel Management."
            },
            {
                "name": "channelaudit",
                "sub": "audit",
                "dedicated": false,
                "kind": "action",
                "desc": "Audit \u2014 Channel Management."
            },
            {
                "name": "channelactivity",
                "sub": "activity",
                "dedicated": false,
                "kind": "action",
                "desc": "Activity \u2014 Channel Management."
            },
            {
                "name": "channelarchive",
                "sub": "archive",
                "dedicated": false,
                "kind": "action",
                "desc": "Archive \u2014 Channel Management."
            }
        ]
    },
    {
        "slug": "category",
        "title": "Category Management",
        "commands": [
            {
                "name": "categoryinfo",
                "sub": "info",
                "dedicated": false,
                "kind": "view",
                "desc": "View info \u2014 Category Management."
            },
            {
                "name": "categorylock",
                "sub": "lock",
                "dedicated": false,
                "kind": "action",
                "desc": "Lock \u2014 Category Management."
            },
            {
                "name": "categoryunlock",
                "sub": "unlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Unlock \u2014 Category Management."
            },
            {
                "name": "categoryhide",
                "sub": "hide",
                "dedicated": false,
                "kind": "action",
                "desc": "Hide \u2014 Category Management."
            },
            {
                "name": "categoryunhide",
                "sub": "unhide",
                "dedicated": false,
                "kind": "action",
                "desc": "Unhide \u2014 Category Management."
            },
            {
                "name": "categorypermissions",
                "sub": "permissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Permissions \u2014 Category Management."
            },
            {
                "name": "categorychannels",
                "sub": "channels",
                "dedicated": false,
                "kind": "action",
                "desc": "Channels \u2014 Category Management."
            },
            {
                "name": "categoryaudit",
                "sub": "audit",
                "dedicated": false,
                "kind": "action",
                "desc": "Audit \u2014 Category Management."
            },
            {
                "name": "categoryclone",
                "sub": "clone",
                "dedicated": false,
                "kind": "action",
                "desc": "Clone \u2014 Category Management."
            },
            {
                "name": "categoryrename",
                "sub": "rename",
                "dedicated": false,
                "kind": "action",
                "desc": "Rename \u2014 Category Management."
            },
            {
                "name": "categorycreate",
                "sub": "create",
                "dedicated": false,
                "kind": "create",
                "desc": "Create create \u2014 Category Management."
            },
            {
                "name": "categorydelete",
                "sub": "delete",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete delete \u2014 Category Management."
            }
        ]
    },
    {
        "slug": "rolemgmt",
        "title": "Role Management",
        "commands": [
            {
                "name": "role",
                "sub": "role",
                "dedicated": true,
                "kind": "action",
                "desc": "Role \u2014 Role Management."
            },
            {
                "name": "roleadd",
                "sub": "roleadd",
                "dedicated": false,
                "kind": "action",
                "desc": "Roleadd \u2014 Role Management."
            },
            {
                "name": "roleremove",
                "sub": "roleremove",
                "dedicated": false,
                "kind": "action",
                "desc": "Roleremove \u2014 Role Management."
            },
            {
                "name": "rolecreate",
                "sub": "rolecreate",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolecreate \u2014 Role Management."
            },
            {
                "name": "roledelete",
                "sub": "roledelete",
                "dedicated": false,
                "kind": "action",
                "desc": "Roledelete \u2014 Role Management."
            },
            {
                "name": "rolerename",
                "sub": "rolerename",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolerename \u2014 Role Management."
            },
            {
                "name": "roleinfo",
                "sub": "roleinfo",
                "dedicated": false,
                "kind": "action",
                "desc": "Roleinfo \u2014 Role Management."
            },
            {
                "name": "rolemembers",
                "sub": "rolemembers",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolemembers \u2014 Role Management."
            },
            {
                "name": "rolelock",
                "sub": "rolelock",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolelock \u2014 Role Management."
            },
            {
                "name": "roleunlock",
                "sub": "roleunlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Roleunlock \u2014 Role Management."
            },
            {
                "name": "rolewhitelist",
                "sub": "rolewhitelist",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolewhitelist \u2014 Role Management."
            },
            {
                "name": "roleblacklist",
                "sub": "roleblacklist",
                "dedicated": false,
                "kind": "action",
                "desc": "Roleblacklist \u2014 Role Management."
            },
            {
                "name": "roletransfer",
                "sub": "roletransfer",
                "dedicated": false,
                "kind": "action",
                "desc": "Roletransfer \u2014 Role Management."
            },
            {
                "name": "rolehierarchy",
                "sub": "rolehierarchy",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolehierarchy \u2014 Role Management."
            },
            {
                "name": "rolepermissions",
                "sub": "rolepermissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolepermissions \u2014 Role Management."
            },
            {
                "name": "rolescan",
                "sub": "rolescan",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolescan \u2014 Role Management."
            },
            {
                "name": "roleaudit",
                "sub": "roleaudit",
                "dedicated": false,
                "kind": "action",
                "desc": "Roleaudit \u2014 Role Management."
            },
            {
                "name": "dangerousroles",
                "sub": "dangerousroles",
                "dedicated": false,
                "kind": "action",
                "desc": "Dangerousroles \u2014 Role Management."
            },
            {
                "name": "adminroles",
                "sub": "adminroles",
                "dedicated": false,
                "kind": "action",
                "desc": "Adminroles \u2014 Role Management."
            },
            {
                "name": "modroles",
                "sub": "modroles",
                "dedicated": false,
                "kind": "action",
                "desc": "Modroles \u2014 Role Management."
            },
            {
                "name": "rolecolor",
                "sub": "rolecolor",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolecolor \u2014 Role Management."
            },
            {
                "name": "roleposition",
                "sub": "roleposition",
                "dedicated": false,
                "kind": "action",
                "desc": "Roleposition \u2014 Role Management."
            },
            {
                "name": "roleclone",
                "sub": "roleclone",
                "dedicated": false,
                "kind": "action",
                "desc": "Roleclone \u2014 Role Management."
            }
        ]
    },
    {
        "slug": "voicemod",
        "title": "Voice Moderation",
        "commands": [
            {
                "name": "voicemute",
                "sub": "voicemute",
                "dedicated": false,
                "kind": "action",
                "desc": "Voicemute \u2014 Voice Moderation."
            },
            {
                "name": "voiceunmute",
                "sub": "voiceunmute",
                "dedicated": false,
                "kind": "action",
                "desc": "Voiceunmute \u2014 Voice Moderation."
            },
            {
                "name": "voicekick",
                "sub": "voicekick",
                "dedicated": false,
                "kind": "action",
                "desc": "Voicekick \u2014 Voice Moderation."
            },
            {
                "name": "deafen",
                "sub": "deafen",
                "dedicated": false,
                "kind": "action",
                "desc": "Deafen \u2014 Voice Moderation."
            },
            {
                "name": "undeafen",
                "sub": "undeafen",
                "dedicated": false,
                "kind": "action",
                "desc": "Undeafen \u2014 Voice Moderation."
            },
            {
                "name": "move",
                "sub": "move",
                "dedicated": false,
                "kind": "action",
                "desc": "Move \u2014 Voice Moderation."
            },
            {
                "name": "moveall",
                "sub": "moveall",
                "dedicated": false,
                "kind": "action",
                "desc": "Moveall \u2014 Voice Moderation."
            },
            {
                "name": "voiceinfo",
                "sub": "voiceinfo",
                "dedicated": false,
                "kind": "action",
                "desc": "Voiceinfo \u2014 Voice Moderation."
            },
            {
                "name": "voiceusers",
                "sub": "voiceusers",
                "dedicated": false,
                "kind": "action",
                "desc": "Voiceusers \u2014 Voice Moderation."
            },
            {
                "name": "voicelock",
                "sub": "voicelock",
                "dedicated": false,
                "kind": "action",
                "desc": "Voicelock \u2014 Voice Moderation."
            },
            {
                "name": "voiceunlock",
                "sub": "voiceunlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Voiceunlock \u2014 Voice Moderation."
            },
            {
                "name": "voiceaudit",
                "sub": "voiceaudit",
                "dedicated": false,
                "kind": "action",
                "desc": "Voiceaudit \u2014 Voice Moderation."
            },
            {
                "name": "voiceactivity",
                "sub": "voiceactivity",
                "dedicated": false,
                "kind": "action",
                "desc": "Voiceactivity \u2014 Voice Moderation."
            },
            {
                "name": "voicechannels",
                "sub": "voicechannels",
                "dedicated": false,
                "kind": "action",
                "desc": "Voicechannels \u2014 Voice Moderation."
            },
            {
                "name": "voicepermissions",
                "sub": "voicepermissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Voicepermissions \u2014 Voice Moderation."
            },
            {
                "name": "voiceprotect",
                "sub": "voiceprotect",
                "dedicated": false,
                "kind": "action",
                "desc": "Voiceprotect \u2014 Voice Moderation."
            },
            {
                "name": "voiceprotect-enable",
                "sub": "voiceprotect-enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on voiceprotect enable \u2014 Voice Moderation."
            },
            {
                "name": "voiceprotect-disable",
                "sub": "voiceprotect-disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off voiceprotect disable \u2014 Voice Moderation."
            },
            {
                "name": "voiceraid",
                "sub": "voiceraid",
                "dedicated": false,
                "kind": "action",
                "desc": "Voiceraid \u2014 Voice Moderation."
            },
            {
                "name": "voicealerts",
                "sub": "voicealerts",
                "dedicated": false,
                "kind": "action",
                "desc": "Voicealerts \u2014 Voice Moderation."
            },
            {
                "name": "voicehistory",
                "sub": "voicehistory",
                "dedicated": false,
                "kind": "action",
                "desc": "Voicehistory \u2014 Voice Moderation."
            }
        ]
    },
    {
        "slug": "botcfg",
        "title": "Bot Management",
        "commands": [
            {
                "name": "botinfo",
                "sub": "botinfo",
                "dedicated": false,
                "kind": "action",
                "desc": "Botinfo \u2014 Bot Management."
            },
            {
                "name": "botstatus",
                "sub": "botstatus",
                "dedicated": false,
                "kind": "action",
                "desc": "Botstatus \u2014 Bot Management."
            },
            {
                "name": "botpermissions",
                "sub": "botpermissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Botpermissions \u2014 Bot Management."
            },
            {
                "name": "bothealth",
                "sub": "bothealth",
                "dedicated": false,
                "kind": "action",
                "desc": "Bothealth \u2014 Bot Management."
            },
            {
                "name": "botlatency",
                "sub": "botlatency",
                "dedicated": false,
                "kind": "action",
                "desc": "Botlatency \u2014 Bot Management."
            },
            {
                "name": "botuptime",
                "sub": "botuptime",
                "dedicated": false,
                "kind": "action",
                "desc": "Botuptime \u2014 Bot Management."
            },
            {
                "name": "botcommands",
                "sub": "botcommands",
                "dedicated": false,
                "kind": "action",
                "desc": "Botcommands \u2014 Bot Management."
            },
            {
                "name": "boterrors",
                "sub": "boterrors",
                "dedicated": false,
                "kind": "action",
                "desc": "Boterrors \u2014 Bot Management."
            },
            {
                "name": "botlogs",
                "sub": "botlogs",
                "dedicated": false,
                "kind": "action",
                "desc": "Botlogs \u2014 Bot Management."
            },
            {
                "name": "botmaintenance",
                "sub": "botmaintenance",
                "dedicated": false,
                "kind": "action",
                "desc": "Botmaintenance \u2014 Bot Management."
            },
            {
                "name": "botmodules",
                "sub": "botmodules",
                "dedicated": false,
                "kind": "action",
                "desc": "Botmodules \u2014 Bot Management."
            },
            {
                "name": "botmodule-enable",
                "sub": "botmodule-enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on botmodule enable \u2014 Bot Management."
            },
            {
                "name": "botmodule-disable",
                "sub": "botmodule-disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off botmodule disable \u2014 Bot Management."
            },
            {
                "name": "botcheck",
                "sub": "botcheck",
                "dedicated": false,
                "kind": "action",
                "desc": "Botcheck \u2014 Bot Management."
            },
            {
                "name": "botverify",
                "sub": "botverify",
                "dedicated": false,
                "kind": "action",
                "desc": "Botverify \u2014 Bot Management."
            },
            {
                "name": "botquarantine",
                "sub": "botquarantine",
                "dedicated": false,
                "kind": "action",
                "desc": "Botquarantine \u2014 Bot Management."
            },
            {
                "name": "botunquarantine",
                "sub": "botunquarantine",
                "dedicated": false,
                "kind": "action",
                "desc": "Botunquarantine \u2014 Bot Management."
            },
            {
                "name": "botactivity",
                "sub": "botactivity",
                "dedicated": false,
                "kind": "action",
                "desc": "Botactivity \u2014 Bot Management."
            },
            {
                "name": "newbots",
                "sub": "newbots",
                "dedicated": false,
                "kind": "action",
                "desc": "Newbots \u2014 Bot Management."
            },
            {
                "name": "botjoins",
                "sub": "botjoins",
                "dedicated": false,
                "kind": "action",
                "desc": "Botjoins \u2014 Bot Management."
            },
            {
                "name": "botleaves",
                "sub": "botleaves",
                "dedicated": false,
                "kind": "action",
                "desc": "Botleaves \u2014 Bot Management."
            },
            {
                "name": "botalerts",
                "sub": "botalerts",
                "dedicated": false,
                "kind": "action",
                "desc": "Botalerts \u2014 Bot Management."
            },
            {
                "name": "botwhitelist",
                "sub": "botwhitelist",
                "dedicated": false,
                "kind": "action",
                "desc": "Botwhitelist \u2014 Bot Management."
            },
            {
                "name": "botblacklist",
                "sub": "botblacklist",
                "dedicated": false,
                "kind": "action",
                "desc": "Botblacklist \u2014 Bot Management."
            },
            {
                "name": "botpermissionscan",
                "sub": "botpermissionscan",
                "dedicated": false,
                "kind": "action",
                "desc": "Botpermissionscan \u2014 Bot Management."
            },
            {
                "name": "botconfig",
                "sub": "botconfig",
                "dedicated": false,
                "kind": "action",
                "desc": "Botconfig \u2014 Bot Management."
            }
        ]
    },
    {
        "slug": "webhook",
        "title": "Webhook Security",
        "commands": [
            {
                "name": "webhooks",
                "sub": "webhooks",
                "dedicated": false,
                "kind": "action",
                "desc": "Webhooks \u2014 Webhook Security."
            },
            {
                "name": "webhookinfo",
                "sub": "info",
                "dedicated": false,
                "kind": "view",
                "desc": "View info \u2014 Webhook Security."
            },
            {
                "name": "webhooklist",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Webhook Security."
            },
            {
                "name": "webhookaudit",
                "sub": "audit",
                "dedicated": false,
                "kind": "action",
                "desc": "Audit \u2014 Webhook Security."
            },
            {
                "name": "webhookscan",
                "sub": "scan",
                "dedicated": false,
                "kind": "action",
                "desc": "Scan \u2014 Webhook Security."
            },
            {
                "name": "webhooklock",
                "sub": "lock",
                "dedicated": false,
                "kind": "action",
                "desc": "Lock \u2014 Webhook Security."
            },
            {
                "name": "webhookunlock",
                "sub": "unlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Unlock \u2014 Webhook Security."
            },
            {
                "name": "webhookdelete",
                "sub": "delete",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete delete \u2014 Webhook Security."
            },
            {
                "name": "webhookalerts",
                "sub": "alerts",
                "dedicated": false,
                "kind": "action",
                "desc": "Alerts \u2014 Webhook Security."
            },
            {
                "name": "webhookhistory",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Webhook Security."
            },
            {
                "name": "webhookpermissions",
                "sub": "permissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Permissions \u2014 Webhook Security."
            },
            {
                "name": "webhookactivity",
                "sub": "activity",
                "dedicated": false,
                "kind": "action",
                "desc": "Activity \u2014 Webhook Security."
            }
        ]
    },
    {
        "slug": "ticketsys",
        "title": "Ticket System",
        "commands": [
            {
                "name": "ticket",
                "sub": "ticket",
                "dedicated": true,
                "kind": "action",
                "desc": "Ticket \u2014 Ticket System."
            },
            {
                "name": "tickets",
                "sub": "tickets",
                "dedicated": false,
                "kind": "action",
                "desc": "Tickets \u2014 Ticket System."
            },
            {
                "name": "ticketview",
                "sub": "ticketview",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketview \u2014 Ticket System."
            },
            {
                "name": "ticketclaim",
                "sub": "ticketclaim",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketclaim \u2014 Ticket System."
            },
            {
                "name": "ticketclose",
                "sub": "ticketclose",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketclose \u2014 Ticket System."
            },
            {
                "name": "ticketreopen",
                "sub": "ticketreopen",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketreopen \u2014 Ticket System."
            },
            {
                "name": "ticketassign",
                "sub": "ticketassign",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketassign \u2014 Ticket System."
            },
            {
                "name": "ticketpriority",
                "sub": "ticketpriority",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketpriority \u2014 Ticket System."
            },
            {
                "name": "ticketnote",
                "sub": "ticketnote",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketnote \u2014 Ticket System."
            },
            {
                "name": "tickettranscript",
                "sub": "tickettranscript",
                "dedicated": false,
                "kind": "action",
                "desc": "Tickettranscript \u2014 Ticket System."
            },
            {
                "name": "ticketstats",
                "sub": "ticketstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketstats \u2014 Ticket System."
            },
            {
                "name": "ticketsearch",
                "sub": "ticketsearch",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketsearch \u2014 Ticket System."
            },
            {
                "name": "tickettransfer",
                "sub": "tickettransfer",
                "dedicated": false,
                "kind": "action",
                "desc": "Tickettransfer \u2014 Ticket System."
            },
            {
                "name": "ticketlock",
                "sub": "ticketlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketlock \u2014 Ticket System."
            },
            {
                "name": "ticketunlock",
                "sub": "ticketunlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketunlock \u2014 Ticket System."
            },
            {
                "name": "ticketadd",
                "sub": "ticketadd",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketadd \u2014 Ticket System."
            },
            {
                "name": "ticketremove",
                "sub": "ticketremove",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketremove \u2014 Ticket System."
            },
            {
                "name": "ticketrename",
                "sub": "ticketrename",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketrename \u2014 Ticket System."
            },
            {
                "name": "ticketcategory",
                "sub": "ticketcategory",
                "dedicated": false,
                "kind": "action",
                "desc": "Ticketcategory \u2014 Ticket System."
            }
        ]
    },
    {
        "slug": "announce",
        "title": "Announcements",
        "commands": [
            {
                "name": "announce",
                "sub": "announce",
                "dedicated": false,
                "kind": "action",
                "desc": "Announce \u2014 Announcements."
            },
            {
                "name": "announce-embed",
                "sub": "embed",
                "dedicated": false,
                "kind": "action",
                "desc": "Embed \u2014 Announcements."
            },
            {
                "name": "announce-schedule",
                "sub": "schedule",
                "dedicated": false,
                "kind": "action",
                "desc": "Schedule \u2014 Announcements."
            },
            {
                "name": "announce-cancel",
                "sub": "cancel",
                "dedicated": false,
                "kind": "action",
                "desc": "Cancel \u2014 Announcements."
            },
            {
                "name": "announce-preview",
                "sub": "preview",
                "dedicated": false,
                "kind": "action",
                "desc": "Preview \u2014 Announcements."
            },
            {
                "name": "announce-everyone",
                "sub": "everyone",
                "dedicated": false,
                "kind": "action",
                "desc": "Everyone \u2014 Announcements."
            },
            {
                "name": "announce-here",
                "sub": "here",
                "dedicated": false,
                "kind": "action",
                "desc": "Here \u2014 Announcements."
            },
            {
                "name": "announce-history",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Announcements."
            },
            {
                "name": "announcement-edit",
                "sub": "ment-edit",
                "dedicated": false,
                "kind": "edit",
                "desc": "Edit ment edit \u2014 Announcements."
            },
            {
                "name": "announcement-delete",
                "sub": "ment-delete",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete ment delete \u2014 Announcements."
            },
            {
                "name": "announcement-pin",
                "sub": "ment-pin",
                "dedicated": false,
                "kind": "action",
                "desc": "Ment pin \u2014 Announcements."
            },
            {
                "name": "announcement-unpin",
                "sub": "ment-unpin",
                "dedicated": false,
                "kind": "action",
                "desc": "Ment unpin \u2014 Announcements."
            },
            {
                "name": "announcement-test",
                "sub": "ment-test",
                "dedicated": false,
                "kind": "test",
                "desc": "Test ment test \u2014 Announcements."
            },
            {
                "name": "announcement-template",
                "sub": "ment-template",
                "dedicated": false,
                "kind": "action",
                "desc": "Ment template \u2014 Announcements."
            }
        ]
    },
    {
        "slug": "servercfg",
        "title": "Server Management",
        "commands": [
            {
                "name": "serverinfo",
                "sub": "serverinfo",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverinfo \u2014 Server Management."
            },
            {
                "name": "serverstats",
                "sub": "serverstats",
                "dedicated": true,
                "kind": "action",
                "desc": "Serverstats \u2014 Server Management."
            },
            {
                "name": "membercount",
                "sub": "membercount",
                "dedicated": false,
                "kind": "action",
                "desc": "Membercount \u2014 Server Management."
            },
            {
                "name": "botlist",
                "sub": "botlist",
                "dedicated": false,
                "kind": "action",
                "desc": "Botlist \u2014 Server Management."
            },
            {
                "name": "rolelist",
                "sub": "rolelist",
                "dedicated": false,
                "kind": "action",
                "desc": "Rolelist \u2014 Server Management."
            },
            {
                "name": "channellist",
                "sub": "channellist",
                "dedicated": false,
                "kind": "action",
                "desc": "Channellist \u2014 Server Management."
            },
            {
                "name": "emojilist",
                "sub": "emojilist",
                "dedicated": false,
                "kind": "action",
                "desc": "Emojilist \u2014 Server Management."
            },
            {
                "name": "stickerlist",
                "sub": "stickerlist",
                "dedicated": false,
                "kind": "action",
                "desc": "Stickerlist \u2014 Server Management."
            },
            {
                "name": "servericon",
                "sub": "servericon",
                "dedicated": false,
                "kind": "action",
                "desc": "Servericon \u2014 Server Management."
            },
            {
                "name": "serverbanner",
                "sub": "serverbanner",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverbanner \u2014 Server Management."
            },
            {
                "name": "serverinvite",
                "sub": "serverinvite",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverinvite \u2014 Server Management."
            },
            {
                "name": "serverroles",
                "sub": "serverroles",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverroles \u2014 Server Management."
            },
            {
                "name": "serverpermissions",
                "sub": "serverpermissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverpermissions \u2014 Server Management."
            },
            {
                "name": "serveractivity",
                "sub": "serveractivity",
                "dedicated": false,
                "kind": "action",
                "desc": "Serveractivity \u2014 Server Management."
            },
            {
                "name": "serverhealth",
                "sub": "serverhealth",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverhealth \u2014 Server Management."
            },
            {
                "name": "serverage",
                "sub": "serverage",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverage \u2014 Server Management."
            },
            {
                "name": "serverowner",
                "sub": "serverowner",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverowner \u2014 Server Management."
            },
            {
                "name": "serveraudit",
                "sub": "serveraudit",
                "dedicated": false,
                "kind": "action",
                "desc": "Serveraudit \u2014 Server Management."
            },
            {
                "name": "serverconfig",
                "sub": "serverconfig",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverconfig \u2014 Server Management."
            }
        ]
    },
    {
        "slug": "joinleave",
        "title": "Join & Leave Management",
        "commands": [
            {
                "name": "welcome",
                "sub": "welcome",
                "dedicated": false,
                "kind": "action",
                "desc": "Welcome \u2014 Join & Leave Management."
            },
            {
                "name": "welcome-test",
                "sub": "welcome-test",
                "dedicated": false,
                "kind": "test",
                "desc": "Test welcome test \u2014 Join & Leave Management."
            },
            {
                "name": "welcome-enable",
                "sub": "welcome-enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on welcome enable \u2014 Join & Leave Management."
            },
            {
                "name": "welcome-disable",
                "sub": "welcome-disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off welcome disable \u2014 Join & Leave Management."
            },
            {
                "name": "goodbye",
                "sub": "goodbye",
                "dedicated": false,
                "kind": "action",
                "desc": "Goodbye \u2014 Join & Leave Management."
            },
            {
                "name": "goodbye-enable",
                "sub": "goodbye-enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on goodbye enable \u2014 Join & Leave Management."
            },
            {
                "name": "goodbye-disable",
                "sub": "goodbye-disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off goodbye disable \u2014 Join & Leave Management."
            },
            {
                "name": "joinmessages",
                "sub": "joinmessages",
                "dedicated": false,
                "kind": "action",
                "desc": "Joinmessages \u2014 Join & Leave Management."
            },
            {
                "name": "leavemessages",
                "sub": "leavemessages",
                "dedicated": false,
                "kind": "action",
                "desc": "Leavemessages \u2014 Join & Leave Management."
            },
            {
                "name": "joinstats",
                "sub": "joinstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Joinstats \u2014 Join & Leave Management."
            },
            {
                "name": "leavestats",
                "sub": "leavestats",
                "dedicated": false,
                "kind": "action",
                "desc": "Leavestats \u2014 Join & Leave Management."
            },
            {
                "name": "membercheck",
                "sub": "membercheck",
                "dedicated": false,
                "kind": "action",
                "desc": "Membercheck \u2014 Join & Leave Management."
            },
            {
                "name": "newmembers",
                "sub": "newmembers",
                "dedicated": false,
                "kind": "action",
                "desc": "Newmembers \u2014 Join & Leave Management."
            },
            {
                "name": "memberwelcome",
                "sub": "memberwelcome",
                "dedicated": false,
                "kind": "action",
                "desc": "Memberwelcome \u2014 Join & Leave Management."
            },
            {
                "name": "joinrole",
                "sub": "joinrole",
                "dedicated": false,
                "kind": "action",
                "desc": "Joinrole \u2014 Join & Leave Management."
            },
            {
                "name": "joinalert",
                "sub": "joinalert",
                "dedicated": false,
                "kind": "action",
                "desc": "Joinalert \u2014 Join & Leave Management."
            },
            {
                "name": "leavealert",
                "sub": "leavealert",
                "dedicated": false,
                "kind": "action",
                "desc": "Leavealert \u2014 Join & Leave Management."
            },
            {
                "name": "joinhistory",
                "sub": "joinhistory",
                "dedicated": false,
                "kind": "action",
                "desc": "Joinhistory \u2014 Join & Leave Management."
            }
        ]
    },
    {
        "slug": "verify",
        "title": "Verification",
        "commands": [
            {
                "name": "verify",
                "sub": "verify",
                "dedicated": false,
                "kind": "action",
                "desc": "Verify \u2014 Verification."
            },
            {
                "name": "verifysetup",
                "sub": "setup",
                "dedicated": false,
                "kind": "action",
                "desc": "Setup \u2014 Verification."
            },
            {
                "name": "verifyenable",
                "sub": "enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on enable \u2014 Verification."
            },
            {
                "name": "verifydisable",
                "sub": "disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off disable \u2014 Verification."
            },
            {
                "name": "verifyrole",
                "sub": "role",
                "dedicated": false,
                "kind": "action",
                "desc": "Role \u2014 Verification."
            },
            {
                "name": "verifychannel",
                "sub": "channel",
                "dedicated": false,
                "kind": "action",
                "desc": "Channel \u2014 Verification."
            },
            {
                "name": "verifytimeout",
                "sub": "timeout",
                "dedicated": false,
                "kind": "action",
                "desc": "Timeout \u2014 Verification."
            },
            {
                "name": "verificationlogs",
                "sub": "verificationlogs",
                "dedicated": false,
                "kind": "action",
                "desc": "Verificationlogs \u2014 Verification."
            },
            {
                "name": "unverified",
                "sub": "unverified",
                "dedicated": false,
                "kind": "action",
                "desc": "Unverified \u2014 Verification."
            },
            {
                "name": "verifyuser",
                "sub": "user",
                "dedicated": false,
                "kind": "action",
                "desc": "User \u2014 Verification."
            },
            {
                "name": "unverify",
                "sub": "unverify",
                "dedicated": false,
                "kind": "action",
                "desc": "Unverify \u2014 Verification."
            },
            {
                "name": "verificationlevel",
                "sub": "verificationlevel",
                "dedicated": false,
                "kind": "action",
                "desc": "Verificationlevel \u2014 Verification."
            },
            {
                "name": "verificationstatus",
                "sub": "verificationstatus",
                "dedicated": false,
                "kind": "action",
                "desc": "Verificationstatus \u2014 Verification."
            },
            {
                "name": "verificationreset",
                "sub": "verificationreset",
                "dedicated": false,
                "kind": "action",
                "desc": "Verificationreset \u2014 Verification."
            },
            {
                "name": "verificationtest",
                "sub": "verificationtest",
                "dedicated": false,
                "kind": "action",
                "desc": "Verificationtest \u2014 Verification."
            }
        ]
    },
    {
        "slug": "invite",
        "title": "Invite Management",
        "commands": [
            {
                "name": "invites",
                "sub": "invites",
                "dedicated": false,
                "kind": "action",
                "desc": "Invites \u2014 Invite Management."
            },
            {
                "name": "inviteinfo",
                "sub": "info",
                "dedicated": false,
                "kind": "view",
                "desc": "View info \u2014 Invite Management."
            },
            {
                "name": "invitecreate",
                "sub": "create",
                "dedicated": false,
                "kind": "create",
                "desc": "Create create \u2014 Invite Management."
            },
            {
                "name": "invite-delete",
                "sub": "delete",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete delete \u2014 Invite Management."
            },
            {
                "name": "invitelist",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Invite Management."
            },
            {
                "name": "inviteleaderboard",
                "sub": "leaderboard",
                "dedicated": false,
                "kind": "action",
                "desc": "Leaderboard \u2014 Invite Management."
            },
            {
                "name": "inviteblock",
                "sub": "block",
                "dedicated": false,
                "kind": "action",
                "desc": "Block \u2014 Invite Management."
            },
            {
                "name": "inviteallow",
                "sub": "allow",
                "dedicated": false,
                "kind": "action",
                "desc": "Allow \u2014 Invite Management."
            },
            {
                "name": "invitefilter",
                "sub": "filter",
                "dedicated": false,
                "kind": "action",
                "desc": "Filter \u2014 Invite Management."
            },
            {
                "name": "inviteaudit",
                "sub": "audit",
                "dedicated": false,
                "kind": "action",
                "desc": "Audit \u2014 Invite Management."
            },
            {
                "name": "invitehistory",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Invite Management."
            },
            {
                "name": "inviteowner",
                "sub": "owner",
                "dedicated": false,
                "kind": "action",
                "desc": "Owner \u2014 Invite Management."
            },
            {
                "name": "inviteusage",
                "sub": "usage",
                "dedicated": false,
                "kind": "action",
                "desc": "Usage \u2014 Invite Management."
            },
            {
                "name": "inviterank",
                "sub": "rank",
                "dedicated": false,
                "kind": "action",
                "desc": "Rank \u2014 Invite Management."
            }
        ]
    },
    {
        "slug": "analytics",
        "title": "Server Analytics",
        "commands": [
            {
                "name": "analytics",
                "sub": "analytics",
                "dedicated": false,
                "kind": "action",
                "desc": "Analytics \u2014 Server Analytics."
            },
            {
                "name": "analytics-members",
                "sub": "members",
                "dedicated": false,
                "kind": "action",
                "desc": "Members \u2014 Server Analytics."
            },
            {
                "name": "analytics-messages",
                "sub": "messages",
                "dedicated": false,
                "kind": "action",
                "desc": "Messages \u2014 Server Analytics."
            },
            {
                "name": "analytics-activity",
                "sub": "activity",
                "dedicated": false,
                "kind": "action",
                "desc": "Activity \u2014 Server Analytics."
            },
            {
                "name": "analytics-joins",
                "sub": "joins",
                "dedicated": false,
                "kind": "action",
                "desc": "Joins \u2014 Server Analytics."
            },
            {
                "name": "analytics-leaves",
                "sub": "leaves",
                "dedicated": false,
                "kind": "action",
                "desc": "Leaves \u2014 Server Analytics."
            },
            {
                "name": "analytics-channels",
                "sub": "channels",
                "dedicated": false,
                "kind": "action",
                "desc": "Channels \u2014 Server Analytics."
            },
            {
                "name": "analytics-roles",
                "sub": "roles",
                "dedicated": false,
                "kind": "action",
                "desc": "Roles \u2014 Server Analytics."
            },
            {
                "name": "analytics-moderation",
                "sub": "moderation",
                "dedicated": false,
                "kind": "action",
                "desc": "Moderation \u2014 Server Analytics."
            },
            {
                "name": "analytics-reports",
                "sub": "reports",
                "dedicated": false,
                "kind": "action",
                "desc": "Reports \u2014 Server Analytics."
            },
            {
                "name": "analytics-automod",
                "sub": "automod",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod \u2014 Server Analytics."
            },
            {
                "name": "analytics-engagement",
                "sub": "engagement",
                "dedicated": false,
                "kind": "action",
                "desc": "Engagement \u2014 Server Analytics."
            },
            {
                "name": "analytics-retention",
                "sub": "retention",
                "dedicated": false,
                "kind": "action",
                "desc": "Retention \u2014 Server Analytics."
            },
            {
                "name": "analytics-growth",
                "sub": "growth",
                "dedicated": false,
                "kind": "action",
                "desc": "Growth \u2014 Server Analytics."
            },
            {
                "name": "analytics-voice",
                "sub": "voice",
                "dedicated": false,
                "kind": "action",
                "desc": "Voice \u2014 Server Analytics."
            },
            {
                "name": "analytics-invites",
                "sub": "invites",
                "dedicated": false,
                "kind": "action",
                "desc": "Invites \u2014 Server Analytics."
            },
            {
                "name": "analytics-export",
                "sub": "export",
                "dedicated": false,
                "kind": "export",
                "desc": "Export export \u2014 Server Analytics."
            }
        ]
    },
    {
        "slug": "member",
        "title": "Member Management",
        "commands": [
            {
                "name": "members",
                "sub": "members",
                "dedicated": false,
                "kind": "action",
                "desc": "Members \u2014 Member Management."
            },
            {
                "name": "members-online",
                "sub": "s-online",
                "dedicated": false,
                "kind": "action",
                "desc": "S online \u2014 Member Management."
            },
            {
                "name": "members-offline",
                "sub": "s-offline",
                "dedicated": false,
                "kind": "action",
                "desc": "S offline \u2014 Member Management."
            },
            {
                "name": "members-bots",
                "sub": "s-bots",
                "dedicated": false,
                "kind": "action",
                "desc": "S bots \u2014 Member Management."
            },
            {
                "name": "members-humans",
                "sub": "s-humans",
                "dedicated": false,
                "kind": "action",
                "desc": "S humans \u2014 Member Management."
            },
            {
                "name": "members-new",
                "sub": "s-new",
                "dedicated": false,
                "kind": "action",
                "desc": "S new \u2014 Member Management."
            },
            {
                "name": "members-inactive",
                "sub": "s-inactive",
                "dedicated": false,
                "kind": "action",
                "desc": "S inactive \u2014 Member Management."
            },
            {
                "name": "members-verified",
                "sub": "s-verified",
                "dedicated": false,
                "kind": "action",
                "desc": "S verified \u2014 Member Management."
            },
            {
                "name": "members-unverified",
                "sub": "s-unverified",
                "dedicated": false,
                "kind": "action",
                "desc": "S unverified \u2014 Member Management."
            },
            {
                "name": "members-suspicious",
                "sub": "s-suspicious",
                "dedicated": false,
                "kind": "action",
                "desc": "S suspicious \u2014 Member Management."
            },
            {
                "name": "members-search",
                "sub": "s-search",
                "dedicated": false,
                "kind": "search",
                "desc": "Search s search \u2014 Member Management."
            },
            {
                "name": "members-role",
                "sub": "s-role",
                "dedicated": false,
                "kind": "action",
                "desc": "S role \u2014 Member Management."
            },
            {
                "name": "members-joined",
                "sub": "s-joined",
                "dedicated": false,
                "kind": "action",
                "desc": "S joined \u2014 Member Management."
            },
            {
                "name": "members-sort",
                "sub": "s-sort",
                "dedicated": false,
                "kind": "action",
                "desc": "S sort \u2014 Member Management."
            },
            {
                "name": "members-export",
                "sub": "s-export",
                "dedicated": false,
                "kind": "export",
                "desc": "Export s export \u2014 Member Management."
            }
        ]
    },
    {
        "slug": "inactive",
        "title": "Inactive Members",
        "commands": [
            {
                "name": "inactive",
                "sub": "inactive",
                "dedicated": false,
                "kind": "action",
                "desc": "Inactive \u2014 Inactive Members."
            },
            {
                "name": "inactivity",
                "sub": "inactivity",
                "dedicated": false,
                "kind": "action",
                "desc": "Inactivity \u2014 Inactive Members."
            },
            {
                "name": "inactivity-report",
                "sub": "inactivity-report",
                "dedicated": false,
                "kind": "action",
                "desc": "Inactivity report \u2014 Inactive Members."
            },
            {
                "name": "inactive-list",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Inactive Members."
            },
            {
                "name": "inactive-notify",
                "sub": "notify",
                "dedicated": false,
                "kind": "action",
                "desc": "Notify \u2014 Inactive Members."
            },
            {
                "name": "inactive-role",
                "sub": "role",
                "dedicated": false,
                "kind": "action",
                "desc": "Role \u2014 Inactive Members."
            },
            {
                "name": "inactive-remove",
                "sub": "remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete remove \u2014 Inactive Members."
            },
            {
                "name": "inactive-exempt",
                "sub": "exempt",
                "dedicated": false,
                "kind": "action",
                "desc": "Exempt \u2014 Inactive Members."
            },
            {
                "name": "inactive-scan",
                "sub": "scan",
                "dedicated": false,
                "kind": "action",
                "desc": "Scan \u2014 Inactive Members."
            },
            {
                "name": "inactive-settings",
                "sub": "settings",
                "dedicated": false,
                "kind": "config",
                "desc": "Configure settings \u2014 Inactive Members."
            }
        ]
    },
    {
        "slug": "suggest",
        "title": "Suggestions & Community",
        "commands": [
            {
                "name": "suggestion",
                "sub": "ion",
                "dedicated": false,
                "kind": "action",
                "desc": "Ion \u2014 Suggestions & Community."
            },
            {
                "name": "suggestions",
                "sub": "ions",
                "dedicated": false,
                "kind": "action",
                "desc": "Ions \u2014 Suggestions & Community."
            },
            {
                "name": "suggestionapprove",
                "sub": "ionapprove",
                "dedicated": false,
                "kind": "action",
                "desc": "Ionapprove \u2014 Suggestions & Community."
            },
            {
                "name": "suggestiondeny",
                "sub": "iondeny",
                "dedicated": false,
                "kind": "action",
                "desc": "Iondeny \u2014 Suggestions & Community."
            },
            {
                "name": "suggestionreview",
                "sub": "ionreview",
                "dedicated": false,
                "kind": "action",
                "desc": "Ionreview \u2014 Suggestions & Community."
            },
            {
                "name": "suggestionmerge",
                "sub": "ionmerge",
                "dedicated": false,
                "kind": "action",
                "desc": "Ionmerge \u2014 Suggestions & Community."
            },
            {
                "name": "suggestionstatus",
                "sub": "ionstatus",
                "dedicated": false,
                "kind": "action",
                "desc": "Ionstatus \u2014 Suggestions & Community."
            },
            {
                "name": "suggestionedit",
                "sub": "ionedit",
                "dedicated": false,
                "kind": "action",
                "desc": "Ionedit \u2014 Suggestions & Community."
            },
            {
                "name": "suggestiondelete",
                "sub": "iondelete",
                "dedicated": false,
                "kind": "action",
                "desc": "Iondelete \u2014 Suggestions & Community."
            },
            {
                "name": "suggestionstats",
                "sub": "ionstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Ionstats \u2014 Suggestions & Community."
            },
            {
                "name": "poll",
                "sub": "poll",
                "dedicated": true,
                "kind": "action",
                "desc": "Poll \u2014 Suggestions & Community."
            },
            {
                "name": "pollclose",
                "sub": "pollclose",
                "dedicated": false,
                "kind": "action",
                "desc": "Pollclose \u2014 Suggestions & Community."
            },
            {
                "name": "pollresults",
                "sub": "pollresults",
                "dedicated": false,
                "kind": "action",
                "desc": "Pollresults \u2014 Suggestions & Community."
            },
            {
                "name": "pollend",
                "sub": "pollend",
                "dedicated": false,
                "kind": "action",
                "desc": "Pollend \u2014 Suggestions & Community."
            },
            {
                "name": "pollstats",
                "sub": "pollstats",
                "dedicated": false,
                "kind": "action",
                "desc": "Pollstats \u2014 Suggestions & Community."
            },
            {
                "name": "voteinfo",
                "sub": "voteinfo",
                "dedicated": false,
                "kind": "action",
                "desc": "Voteinfo \u2014 Suggestions & Community."
            }
        ]
    },
    {
        "slug": "rules",
        "title": "Rules & Policies",
        "commands": [
            {
                "name": "rules",
                "sub": "rules",
                "dedicated": false,
                "kind": "action",
                "desc": "Rules \u2014 Rules & Policies."
            },
            {
                "name": "rules-view",
                "sub": "view",
                "dedicated": false,
                "kind": "view",
                "desc": "View view \u2014 Rules & Policies."
            },
            {
                "name": "rules-add",
                "sub": "add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create add \u2014 Rules & Policies."
            },
            {
                "name": "rules-edit",
                "sub": "edit",
                "dedicated": false,
                "kind": "edit",
                "desc": "Edit edit \u2014 Rules & Policies."
            },
            {
                "name": "rules-remove",
                "sub": "remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete remove \u2014 Rules & Policies."
            },
            {
                "name": "rules-publish",
                "sub": "publish",
                "dedicated": false,
                "kind": "action",
                "desc": "Publish \u2014 Rules & Policies."
            },
            {
                "name": "rules-version",
                "sub": "version",
                "dedicated": false,
                "kind": "action",
                "desc": "Version \u2014 Rules & Policies."
            },
            {
                "name": "rules-history",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Rules & Policies."
            },
            {
                "name": "rules-acceptance",
                "sub": "acceptance",
                "dedicated": false,
                "kind": "action",
                "desc": "Acceptance \u2014 Rules & Policies."
            },
            {
                "name": "policy",
                "sub": "policy",
                "dedicated": false,
                "kind": "action",
                "desc": "Policy \u2014 Rules & Policies."
            },
            {
                "name": "policy-list",
                "sub": "policy-list",
                "dedicated": false,
                "kind": "list",
                "desc": "List policy list \u2014 Rules & Policies."
            },
            {
                "name": "policy-view",
                "sub": "policy-view",
                "dedicated": false,
                "kind": "view",
                "desc": "View policy view \u2014 Rules & Policies."
            },
            {
                "name": "policy-create",
                "sub": "policy-create",
                "dedicated": false,
                "kind": "create",
                "desc": "Create policy create \u2014 Rules & Policies."
            },
            {
                "name": "policy-edit",
                "sub": "policy-edit",
                "dedicated": false,
                "kind": "edit",
                "desc": "Edit policy edit \u2014 Rules & Policies."
            },
            {
                "name": "policy-delete",
                "sub": "policy-delete",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete policy delete \u2014 Rules & Policies."
            },
            {
                "name": "policy-publish",
                "sub": "policy-publish",
                "dedicated": false,
                "kind": "action",
                "desc": "Policy publish \u2014 Rules & Policies."
            },
            {
                "name": "policy-archive",
                "sub": "policy-archive",
                "dedicated": false,
                "kind": "action",
                "desc": "Policy archive \u2014 Rules & Policies."
            },
            {
                "name": "policyhistory",
                "sub": "policyhistory",
                "dedicated": false,
                "kind": "action",
                "desc": "Policyhistory \u2014 Rules & Policies."
            },
            {
                "name": "policysearch",
                "sub": "policysearch",
                "dedicated": false,
                "kind": "action",
                "desc": "Policysearch \u2014 Rules & Policies."
            }
        ]
    },
    {
        "slug": "config",
        "title": "Configuration",
        "commands": [
            {
                "name": "config",
                "sub": "config",
                "dedicated": false,
                "kind": "config",
                "desc": "Configure config \u2014 Configuration."
            },
            {
                "name": "config-moderation",
                "sub": "moderation",
                "dedicated": false,
                "kind": "action",
                "desc": "Moderation \u2014 Configuration."
            },
            {
                "name": "config-automod",
                "sub": "automod",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod \u2014 Configuration."
            },
            {
                "name": "config-antiraid",
                "sub": "antiraid",
                "dedicated": false,
                "kind": "action",
                "desc": "Antiraid \u2014 Configuration."
            },
            {
                "name": "config-logging",
                "sub": "logging",
                "dedicated": false,
                "kind": "action",
                "desc": "Logging \u2014 Configuration."
            },
            {
                "name": "config-reports",
                "sub": "reports",
                "dedicated": false,
                "kind": "action",
                "desc": "Reports \u2014 Configuration."
            },
            {
                "name": "config-warnings",
                "sub": "warnings",
                "dedicated": false,
                "kind": "action",
                "desc": "Warnings \u2014 Configuration."
            },
            {
                "name": "config-punishments",
                "sub": "punishments",
                "dedicated": false,
                "kind": "action",
                "desc": "Punishments \u2014 Configuration."
            },
            {
                "name": "config-permissions",
                "sub": "permissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Permissions \u2014 Configuration."
            },
            {
                "name": "config-channels",
                "sub": "channels",
                "dedicated": false,
                "kind": "action",
                "desc": "Channels \u2014 Configuration."
            },
            {
                "name": "config-roles",
                "sub": "roles",
                "dedicated": false,
                "kind": "action",
                "desc": "Roles \u2014 Configuration."
            },
            {
                "name": "config-reset",
                "sub": "reset",
                "dedicated": false,
                "kind": "reset",
                "desc": "Reset reset \u2014 Configuration."
            },
            {
                "name": "config-view",
                "sub": "view",
                "dedicated": false,
                "kind": "view",
                "desc": "View view \u2014 Configuration."
            },
            {
                "name": "config-export",
                "sub": "export",
                "dedicated": false,
                "kind": "export",
                "desc": "Export export \u2014 Configuration."
            },
            {
                "name": "config-import",
                "sub": "import",
                "dedicated": false,
                "kind": "action",
                "desc": "Import \u2014 Configuration."
            },
            {
                "name": "config-backup",
                "sub": "backup",
                "dedicated": false,
                "kind": "action",
                "desc": "Backup \u2014 Configuration."
            },
            {
                "name": "config-validate",
                "sub": "validate",
                "dedicated": false,
                "kind": "action",
                "desc": "Validate \u2014 Configuration."
            }
        ]
    },
    {
        "slug": "alert",
        "title": "Alerts",
        "commands": [
            {
                "name": "alerts",
                "sub": "alerts",
                "dedicated": false,
                "kind": "action",
                "desc": "Alerts \u2014 Alerts."
            },
            {
                "name": "alerts-enable",
                "sub": "s-enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on s enable \u2014 Alerts."
            },
            {
                "name": "alerts-disable",
                "sub": "s-disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off s disable \u2014 Alerts."
            },
            {
                "name": "alerts-mentions",
                "sub": "s-mentions",
                "dedicated": false,
                "kind": "action",
                "desc": "S mentions \u2014 Alerts."
            },
            {
                "name": "alerts-raids",
                "sub": "s-raids",
                "dedicated": false,
                "kind": "action",
                "desc": "S raids \u2014 Alerts."
            },
            {
                "name": "alerts-bans",
                "sub": "s-bans",
                "dedicated": false,
                "kind": "action",
                "desc": "S bans \u2014 Alerts."
            },
            {
                "name": "alerts-suspicious",
                "sub": "s-suspicious",
                "dedicated": false,
                "kind": "action",
                "desc": "S suspicious \u2014 Alerts."
            },
            {
                "name": "alerts-reports",
                "sub": "s-reports",
                "dedicated": false,
                "kind": "action",
                "desc": "S reports \u2014 Alerts."
            },
            {
                "name": "alerts-automod",
                "sub": "s-automod",
                "dedicated": false,
                "kind": "action",
                "desc": "S automod \u2014 Alerts."
            },
            {
                "name": "alerts-configure",
                "sub": "s-configure",
                "dedicated": false,
                "kind": "config",
                "desc": "Configure s configure \u2014 Alerts."
            },
            {
                "name": "alert-create",
                "sub": "create",
                "dedicated": false,
                "kind": "create",
                "desc": "Create create \u2014 Alerts."
            },
            {
                "name": "alert-edit",
                "sub": "edit",
                "dedicated": false,
                "kind": "edit",
                "desc": "Edit edit \u2014 Alerts."
            },
            {
                "name": "alert-delete",
                "sub": "delete",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete delete \u2014 Alerts."
            },
            {
                "name": "alert-broadcast",
                "sub": "broadcast",
                "dedicated": false,
                "kind": "action",
                "desc": "Broadcast \u2014 Alerts."
            },
            {
                "name": "alert-schedule",
                "sub": "schedule",
                "dedicated": false,
                "kind": "action",
                "desc": "Schedule \u2014 Alerts."
            },
            {
                "name": "alert-cancel",
                "sub": "cancel",
                "dedicated": false,
                "kind": "action",
                "desc": "Cancel \u2014 Alerts."
            },
            {
                "name": "alert-history",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Alerts."
            },
            {
                "name": "alert-test",
                "sub": "test",
                "dedicated": false,
                "kind": "test",
                "desc": "Test test \u2014 Alerts."
            }
        ]
    },
    {
        "slug": "livemod",
        "title": "Live Moderation",
        "commands": [
            {
                "name": "live",
                "sub": "live",
                "dedicated": false,
                "kind": "action",
                "desc": "Live \u2014 Live Moderation."
            },
            {
                "name": "live-moderation",
                "sub": "live-moderation",
                "dedicated": false,
                "kind": "action",
                "desc": "Live moderation \u2014 Live Moderation."
            },
            {
                "name": "live-reports",
                "sub": "live-reports",
                "dedicated": false,
                "kind": "action",
                "desc": "Live reports \u2014 Live Moderation."
            },
            {
                "name": "live-automod",
                "sub": "live-automod",
                "dedicated": false,
                "kind": "action",
                "desc": "Live automod \u2014 Live Moderation."
            },
            {
                "name": "live-joins",
                "sub": "live-joins",
                "dedicated": false,
                "kind": "action",
                "desc": "Live joins \u2014 Live Moderation."
            },
            {
                "name": "live-leaves",
                "sub": "live-leaves",
                "dedicated": false,
                "kind": "action",
                "desc": "Live leaves \u2014 Live Moderation."
            },
            {
                "name": "live-bans",
                "sub": "live-bans",
                "dedicated": false,
                "kind": "action",
                "desc": "Live bans \u2014 Live Moderation."
            },
            {
                "name": "live-messages",
                "sub": "live-messages",
                "dedicated": false,
                "kind": "action",
                "desc": "Live messages \u2014 Live Moderation."
            },
            {
                "name": "live-raids",
                "sub": "live-raids",
                "dedicated": false,
                "kind": "action",
                "desc": "Live raids \u2014 Live Moderation."
            },
            {
                "name": "live-alerts",
                "sub": "live-alerts",
                "dedicated": false,
                "kind": "action",
                "desc": "Live alerts \u2014 Live Moderation."
            },
            {
                "name": "live-voice",
                "sub": "live-voice",
                "dedicated": false,
                "kind": "action",
                "desc": "Live voice \u2014 Live Moderation."
            },
            {
                "name": "live-cases",
                "sub": "live-cases",
                "dedicated": false,
                "kind": "action",
                "desc": "Live cases \u2014 Live Moderation."
            }
        ]
    },
    {
        "slug": "schedule",
        "title": "Scheduling",
        "commands": [
            {
                "name": "schedule",
                "sub": "schedule",
                "dedicated": false,
                "kind": "action",
                "desc": "Schedule \u2014 Scheduling."
            },
            {
                "name": "schedule-ban",
                "sub": "ban",
                "dedicated": false,
                "kind": "action",
                "desc": "Ban \u2014 Scheduling."
            },
            {
                "name": "schedule-timeout",
                "sub": "timeout",
                "dedicated": false,
                "kind": "action",
                "desc": "Timeout \u2014 Scheduling."
            },
            {
                "name": "schedule-message",
                "sub": "message",
                "dedicated": false,
                "kind": "action",
                "desc": "Message \u2014 Scheduling."
            },
            {
                "name": "schedule-lockdown",
                "sub": "lockdown",
                "dedicated": false,
                "kind": "action",
                "desc": "Lockdown \u2014 Scheduling."
            },
            {
                "name": "schedule-unlock",
                "sub": "unlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Unlock \u2014 Scheduling."
            },
            {
                "name": "schedule-announcement",
                "sub": "announcement",
                "dedicated": false,
                "kind": "action",
                "desc": "Announcement \u2014 Scheduling."
            },
            {
                "name": "schedule-purge",
                "sub": "purge",
                "dedicated": false,
                "kind": "action",
                "desc": "Purge \u2014 Scheduling."
            },
            {
                "name": "schedule-list",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Scheduling."
            },
            {
                "name": "schedule-cancel",
                "sub": "cancel",
                "dedicated": false,
                "kind": "action",
                "desc": "Cancel \u2014 Scheduling."
            },
            {
                "name": "schedule-edit",
                "sub": "edit",
                "dedicated": false,
                "kind": "edit",
                "desc": "Edit edit \u2014 Scheduling."
            },
            {
                "name": "schedule-view",
                "sub": "view",
                "dedicated": false,
                "kind": "view",
                "desc": "View view \u2014 Scheduling."
            },
            {
                "name": "schedule-reminder",
                "sub": "reminder",
                "dedicated": false,
                "kind": "action",
                "desc": "Reminder \u2014 Scheduling."
            }
        ]
    },
    {
        "slug": "automation",
        "title": "Automation",
        "commands": [
            {
                "name": "automation",
                "sub": "automation",
                "dedicated": false,
                "kind": "action",
                "desc": "Automation \u2014 Automation."
            },
            {
                "name": "automation-create",
                "sub": "create",
                "dedicated": false,
                "kind": "create",
                "desc": "Create create \u2014 Automation."
            },
            {
                "name": "automation-edit",
                "sub": "edit",
                "dedicated": false,
                "kind": "edit",
                "desc": "Edit edit \u2014 Automation."
            },
            {
                "name": "automation-delete",
                "sub": "delete",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete delete \u2014 Automation."
            },
            {
                "name": "automation-enable",
                "sub": "enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on enable \u2014 Automation."
            },
            {
                "name": "automation-disable",
                "sub": "disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off disable \u2014 Automation."
            },
            {
                "name": "automation-list",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Automation."
            },
            {
                "name": "automation-test",
                "sub": "test",
                "dedicated": false,
                "kind": "test",
                "desc": "Test test \u2014 Automation."
            },
            {
                "name": "automation-logs",
                "sub": "logs",
                "dedicated": false,
                "kind": "logs",
                "desc": "Logs for logs \u2014 Automation."
            },
            {
                "name": "automation-history",
                "sub": "history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for history \u2014 Automation."
            },
            {
                "name": "automation-trigger",
                "sub": "trigger",
                "dedicated": false,
                "kind": "action",
                "desc": "Trigger \u2014 Automation."
            },
            {
                "name": "automation-action",
                "sub": "action",
                "dedicated": false,
                "kind": "action",
                "desc": "Action \u2014 Automation."
            },
            {
                "name": "automation-condition",
                "sub": "condition",
                "dedicated": false,
                "kind": "action",
                "desc": "Condition \u2014 Automation."
            },
            {
                "name": "automation-preview",
                "sub": "preview",
                "dedicated": false,
                "kind": "action",
                "desc": "Preview \u2014 Automation."
            }
        ]
    },
    {
        "slug": "backup",
        "title": "Backups & Recovery",
        "commands": [
            {
                "name": "backup",
                "sub": "backup",
                "dedicated": false,
                "kind": "action",
                "desc": "Backup \u2014 Backups & Recovery."
            },
            {
                "name": "backup-create",
                "sub": "create",
                "dedicated": false,
                "kind": "create",
                "desc": "Create create \u2014 Backups & Recovery."
            },
            {
                "name": "backup-delete",
                "sub": "delete",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete delete \u2014 Backups & Recovery."
            },
            {
                "name": "backup-list",
                "sub": "list",
                "dedicated": false,
                "kind": "list",
                "desc": "List list \u2014 Backups & Recovery."
            },
            {
                "name": "backup-info",
                "sub": "info",
                "dedicated": false,
                "kind": "view",
                "desc": "View info \u2014 Backups & Recovery."
            },
            {
                "name": "backup-restore",
                "sub": "restore",
                "dedicated": false,
                "kind": "action",
                "desc": "Restore \u2014 Backups & Recovery."
            },
            {
                "name": "backup-schedule",
                "sub": "schedule",
                "dedicated": false,
                "kind": "action",
                "desc": "Schedule \u2014 Backups & Recovery."
            },
            {
                "name": "backup-cancel",
                "sub": "cancel",
                "dedicated": false,
                "kind": "action",
                "desc": "Cancel \u2014 Backups & Recovery."
            },
            {
                "name": "backup-status",
                "sub": "status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show status \u2014 Backups & Recovery."
            },
            {
                "name": "backup-export",
                "sub": "export",
                "dedicated": false,
                "kind": "export",
                "desc": "Export export \u2014 Backups & Recovery."
            },
            {
                "name": "backup-settings",
                "sub": "settings",
                "dedicated": false,
                "kind": "config",
                "desc": "Configure settings \u2014 Backups & Recovery."
            },
            {
                "name": "recovery",
                "sub": "recovery",
                "dedicated": false,
                "kind": "action",
                "desc": "Recovery \u2014 Backups & Recovery."
            },
            {
                "name": "recovery-status",
                "sub": "recovery-status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show recovery status \u2014 Backups & Recovery."
            },
            {
                "name": "recovery-channels",
                "sub": "recovery-channels",
                "dedicated": false,
                "kind": "action",
                "desc": "Recovery channels \u2014 Backups & Recovery."
            },
            {
                "name": "recovery-roles",
                "sub": "recovery-roles",
                "dedicated": false,
                "kind": "action",
                "desc": "Recovery roles \u2014 Backups & Recovery."
            },
            {
                "name": "recovery-permissions",
                "sub": "recovery-permissions",
                "dedicated": false,
                "kind": "action",
                "desc": "Recovery permissions \u2014 Backups & Recovery."
            },
            {
                "name": "recovery-settings",
                "sub": "recovery-settings",
                "dedicated": false,
                "kind": "config",
                "desc": "Configure recovery settings \u2014 Backups & Recovery."
            },
            {
                "name": "recovery-restore",
                "sub": "recovery-restore",
                "dedicated": false,
                "kind": "action",
                "desc": "Recovery restore \u2014 Backups & Recovery."
            },
            {
                "name": "recovery-logs",
                "sub": "recovery-logs",
                "dedicated": false,
                "kind": "logs",
                "desc": "Logs for recovery logs \u2014 Backups & Recovery."
            }
        ]
    },
    {
        "slug": "aimod",
        "title": "AI Moderation",
        "commands": [
            {
                "name": "ai-mod",
                "sub": "ai-mod",
                "dedicated": false,
                "kind": "action",
                "desc": "Ai mod \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-status",
                "sub": "ai-mod-status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show ai mod status \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-enable",
                "sub": "ai-mod-enable",
                "dedicated": false,
                "kind": "enable",
                "desc": "Turn on ai mod enable \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-disable",
                "sub": "ai-mod-disable",
                "dedicated": false,
                "kind": "disable",
                "desc": "Turn off ai mod disable \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-scan",
                "sub": "ai-mod-scan",
                "dedicated": false,
                "kind": "action",
                "desc": "Ai mod scan \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-review",
                "sub": "ai-mod-review",
                "dedicated": false,
                "kind": "action",
                "desc": "Ai mod review \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-queue",
                "sub": "ai-mod-queue",
                "dedicated": false,
                "kind": "action",
                "desc": "Ai mod queue \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-explain",
                "sub": "ai-mod-explain",
                "dedicated": false,
                "kind": "action",
                "desc": "Ai mod explain \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-confidence",
                "sub": "ai-mod-confidence",
                "dedicated": false,
                "kind": "action",
                "desc": "Ai mod confidence \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-threshold",
                "sub": "ai-mod-threshold",
                "dedicated": false,
                "kind": "action",
                "desc": "Ai mod threshold \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-exemptions",
                "sub": "ai-mod-exemptions",
                "dedicated": false,
                "kind": "action",
                "desc": "Ai mod exemptions \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-statistics",
                "sub": "ai-mod-statistics",
                "dedicated": false,
                "kind": "stats",
                "desc": "Statistics for ai mod statistics \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-test",
                "sub": "ai-mod-test",
                "dedicated": false,
                "kind": "test",
                "desc": "Test ai mod test \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-feedback",
                "sub": "ai-mod-feedback",
                "dedicated": false,
                "kind": "action",
                "desc": "Ai mod feedback \u2014 AI Moderation."
            },
            {
                "name": "ai-mod-history",
                "sub": "ai-mod-history",
                "dedicated": false,
                "kind": "history",
                "desc": "Show history for ai mod history \u2014 AI Moderation."
            }
        ]
    },
    {
        "slug": "queue",
        "title": "Moderation Queue",
        "commands": [
            {
                "name": "queue",
                "sub": "queue",
                "dedicated": false,
                "kind": "action",
                "desc": "Queue \u2014 Moderation Queue."
            },
            {
                "name": "queue-reports",
                "sub": "reports",
                "dedicated": false,
                "kind": "action",
                "desc": "Reports \u2014 Moderation Queue."
            },
            {
                "name": "queue-automod",
                "sub": "automod",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod \u2014 Moderation Queue."
            },
            {
                "name": "queue-appeals",
                "sub": "appeals",
                "dedicated": false,
                "kind": "action",
                "desc": "Appeals \u2014 Moderation Queue."
            },
            {
                "name": "queue-priority",
                "sub": "priority",
                "dedicated": false,
                "kind": "action",
                "desc": "Priority \u2014 Moderation Queue."
            },
            {
                "name": "queue-claim",
                "sub": "claim",
                "dedicated": false,
                "kind": "action",
                "desc": "Claim \u2014 Moderation Queue."
            },
            {
                "name": "queue-release",
                "sub": "release",
                "dedicated": false,
                "kind": "action",
                "desc": "Release \u2014 Moderation Queue."
            },
            {
                "name": "queue-assign",
                "sub": "assign",
                "dedicated": false,
                "kind": "action",
                "desc": "Assign \u2014 Moderation Queue."
            },
            {
                "name": "queue-close",
                "sub": "close",
                "dedicated": false,
                "kind": "action",
                "desc": "Close \u2014 Moderation Queue."
            },
            {
                "name": "queue-stats",
                "sub": "stats",
                "dedicated": false,
                "kind": "stats",
                "desc": "Statistics for stats \u2014 Moderation Queue."
            },
            {
                "name": "queue-next",
                "sub": "next",
                "dedicated": false,
                "kind": "action",
                "desc": "Next \u2014 Moderation Queue."
            },
            {
                "name": "queue-clear",
                "sub": "clear",
                "dedicated": false,
                "kind": "action",
                "desc": "Clear \u2014 Moderation Queue."
            },
            {
                "name": "queue-search",
                "sub": "search",
                "dedicated": false,
                "kind": "search",
                "desc": "Search search \u2014 Moderation Queue."
            }
        ]
    },
    {
        "slug": "training",
        "title": "Moderator Training",
        "commands": [
            {
                "name": "training",
                "sub": "training",
                "dedicated": false,
                "kind": "action",
                "desc": "Training \u2014 Moderator Training."
            },
            {
                "name": "training-start",
                "sub": "start",
                "dedicated": false,
                "kind": "action",
                "desc": "Start \u2014 Moderator Training."
            },
            {
                "name": "training-cases",
                "sub": "cases",
                "dedicated": false,
                "kind": "action",
                "desc": "Cases \u2014 Moderator Training."
            },
            {
                "name": "training-scenario",
                "sub": "scenario",
                "dedicated": false,
                "kind": "action",
                "desc": "Scenario \u2014 Moderator Training."
            },
            {
                "name": "training-quiz",
                "sub": "quiz",
                "dedicated": false,
                "kind": "action",
                "desc": "Quiz \u2014 Moderator Training."
            },
            {
                "name": "training-results",
                "sub": "results",
                "dedicated": false,
                "kind": "action",
                "desc": "Results \u2014 Moderator Training."
            },
            {
                "name": "training-progress",
                "sub": "progress",
                "dedicated": false,
                "kind": "action",
                "desc": "Progress \u2014 Moderator Training."
            },
            {
                "name": "training-leaderboard",
                "sub": "leaderboard",
                "dedicated": false,
                "kind": "action",
                "desc": "Leaderboard \u2014 Moderator Training."
            },
            {
                "name": "training-reset",
                "sub": "reset",
                "dedicated": false,
                "kind": "reset",
                "desc": "Reset reset \u2014 Moderator Training."
            },
            {
                "name": "training-certification",
                "sub": "certification",
                "dedicated": false,
                "kind": "action",
                "desc": "Certification \u2014 Moderator Training."
            },
            {
                "name": "training-modules",
                "sub": "modules",
                "dedicated": false,
                "kind": "action",
                "desc": "Modules \u2014 Moderator Training."
            },
            {
                "name": "training-status",
                "sub": "status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show status \u2014 Moderator Training."
            }
        ]
    },
    {
        "slug": "recognition",
        "title": "Staff Recognition",
        "commands": [
            {
                "name": "staffawards",
                "sub": "staffawards",
                "dedicated": false,
                "kind": "action",
                "desc": "Staffawards \u2014 Staff Recognition."
            },
            {
                "name": "staffaward",
                "sub": "staffaward",
                "dedicated": false,
                "kind": "action",
                "desc": "Staffaward \u2014 Staff Recognition."
            },
            {
                "name": "staffpoints",
                "sub": "staffpoints",
                "dedicated": false,
                "kind": "action",
                "desc": "Staffpoints \u2014 Staff Recognition."
            },
            {
                "name": "staffpoints-add",
                "sub": "staffpoints-add",
                "dedicated": false,
                "kind": "create",
                "desc": "Create staffpoints add \u2014 Staff Recognition."
            },
            {
                "name": "staffpoints-remove",
                "sub": "staffpoints-remove",
                "dedicated": false,
                "kind": "delete",
                "desc": "Delete staffpoints remove \u2014 Staff Recognition."
            },
            {
                "name": "staffleaderboard",
                "sub": "staffleaderboard",
                "dedicated": false,
                "kind": "action",
                "desc": "Staffleaderboard \u2014 Staff Recognition."
            },
            {
                "name": "staffachievements",
                "sub": "staffachievements",
                "dedicated": false,
                "kind": "action",
                "desc": "Staffachievements \u2014 Staff Recognition."
            },
            {
                "name": "staffbadges",
                "sub": "staffbadges",
                "dedicated": false,
                "kind": "action",
                "desc": "Staffbadges \u2014 Staff Recognition."
            },
            {
                "name": "staffmilestones",
                "sub": "staffmilestones",
                "dedicated": false,
                "kind": "action",
                "desc": "Staffmilestones \u2014 Staff Recognition."
            },
            {
                "name": "staffrecognition",
                "sub": "staffrecognition",
                "dedicated": false,
                "kind": "action",
                "desc": "Staffrecognition \u2014 Staff Recognition."
            },
            {
                "name": "stafftop",
                "sub": "stafftop",
                "dedicated": false,
                "kind": "action",
                "desc": "Stafftop \u2014 Staff Recognition."
            },
            {
                "name": "staffmonthly",
                "sub": "staffmonthly",
                "dedicated": false,
                "kind": "action",
                "desc": "Staffmonthly \u2014 Staff Recognition."
            },
            {
                "name": "staffweekly",
                "sub": "staffweekly",
                "dedicated": false,
                "kind": "action",
                "desc": "Staffweekly \u2014 Staff Recognition."
            }
        ]
    },
    {
        "slug": "export",
        "title": "Export & Data",
        "commands": [
            {
                "name": "export",
                "sub": "export",
                "dedicated": false,
                "kind": "export",
                "desc": "Export export \u2014 Export & Data."
            },
            {
                "name": "export-cases",
                "sub": "cases",
                "dedicated": false,
                "kind": "action",
                "desc": "Cases \u2014 Export & Data."
            },
            {
                "name": "export-reports",
                "sub": "reports",
                "dedicated": false,
                "kind": "action",
                "desc": "Reports \u2014 Export & Data."
            },
            {
                "name": "export-logs",
                "sub": "logs",
                "dedicated": false,
                "kind": "logs",
                "desc": "Logs for logs \u2014 Export & Data."
            },
            {
                "name": "export-members",
                "sub": "members",
                "dedicated": false,
                "kind": "action",
                "desc": "Members \u2014 Export & Data."
            },
            {
                "name": "export-moderation",
                "sub": "moderation",
                "dedicated": false,
                "kind": "action",
                "desc": "Moderation \u2014 Export & Data."
            },
            {
                "name": "export-analytics",
                "sub": "analytics",
                "dedicated": false,
                "kind": "action",
                "desc": "Analytics \u2014 Export & Data."
            },
            {
                "name": "export-settings",
                "sub": "settings",
                "dedicated": false,
                "kind": "config",
                "desc": "Configure settings \u2014 Export & Data."
            },
            {
                "name": "export-staff",
                "sub": "staff",
                "dedicated": false,
                "kind": "action",
                "desc": "Staff \u2014 Export & Data."
            },
            {
                "name": "export-incidents",
                "sub": "incidents",
                "dedicated": false,
                "kind": "action",
                "desc": "Incidents \u2014 Export & Data."
            },
            {
                "name": "export-appeals",
                "sub": "appeals",
                "dedicated": false,
                "kind": "action",
                "desc": "Appeals \u2014 Export & Data."
            },
            {
                "name": "export-evidence",
                "sub": "evidence",
                "dedicated": false,
                "kind": "action",
                "desc": "Evidence \u2014 Export & Data."
            },
            {
                "name": "export-tickets",
                "sub": "tickets",
                "dedicated": false,
                "kind": "action",
                "desc": "Tickets \u2014 Export & Data."
            }
        ]
    },
    {
        "slug": "util",
        "title": "Moderator Utilities",
        "commands": [
            {
                "name": "remind",
                "sub": "remind",
                "dedicated": true,
                "kind": "action",
                "desc": "Remind \u2014 Moderator Utilities."
            },
            {
                "name": "timer",
                "sub": "timer",
                "dedicated": false,
                "kind": "action",
                "desc": "Timer \u2014 Moderator Utilities."
            },
            {
                "name": "note",
                "sub": "note",
                "dedicated": false,
                "kind": "action",
                "desc": "Note \u2014 Moderator Utilities."
            },
            {
                "name": "notes",
                "sub": "notes",
                "dedicated": false,
                "kind": "action",
                "desc": "Notes \u2014 Moderator Utilities."
            },
            {
                "name": "timestamp",
                "sub": "timestamp",
                "dedicated": false,
                "kind": "action",
                "desc": "Timestamp \u2014 Moderator Utilities."
            },
            {
                "name": "snowflake",
                "sub": "snowflake",
                "dedicated": false,
                "kind": "action",
                "desc": "Snowflake \u2014 Moderator Utilities."
            },
            {
                "name": "id",
                "sub": "id",
                "dedicated": false,
                "kind": "action",
                "desc": "Id \u2014 Moderator Utilities."
            },
            {
                "name": "channelid",
                "sub": "channelid",
                "dedicated": false,
                "kind": "action",
                "desc": "Channelid \u2014 Moderator Utilities."
            },
            {
                "name": "roleid",
                "sub": "roleid",
                "dedicated": false,
                "kind": "action",
                "desc": "Roleid \u2014 Moderator Utilities."
            },
            {
                "name": "permissions-check",
                "sub": "permissions-check",
                "dedicated": false,
                "kind": "action",
                "desc": "Permissions check \u2014 Moderator Utilities."
            },
            {
                "name": "commandcheck",
                "sub": "commandcheck",
                "dedicated": false,
                "kind": "action",
                "desc": "Commandcheck \u2014 Moderator Utilities."
            },
            {
                "name": "serverid",
                "sub": "serverid",
                "dedicated": false,
                "kind": "action",
                "desc": "Serverid \u2014 Moderator Utilities."
            },
            {
                "name": "botid",
                "sub": "botid",
                "dedicated": false,
                "kind": "action",
                "desc": "Botid \u2014 Moderator Utilities."
            },
            {
                "name": "emojiid",
                "sub": "emojiid",
                "dedicated": false,
                "kind": "action",
                "desc": "Emojiid \u2014 Moderator Utilities."
            },
            {
                "name": "format",
                "sub": "format",
                "dedicated": false,
                "kind": "action",
                "desc": "Format \u2014 Moderator Utilities."
            },
            {
                "name": "embedpreview",
                "sub": "embedpreview",
                "dedicated": false,
                "kind": "action",
                "desc": "Embedpreview \u2014 Moderator Utilities."
            }
        ]
    },
    {
        "slug": "emergency",
        "title": "Emergency Controls",
        "commands": [
            {
                "name": "panic",
                "sub": "panic",
                "dedicated": false,
                "kind": "action",
                "desc": "Panic \u2014 Emergency Controls."
            },
            {
                "name": "panic-status",
                "sub": "panic-status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show panic status \u2014 Emergency Controls."
            },
            {
                "name": "panic-stop",
                "sub": "panic-stop",
                "dedicated": false,
                "kind": "action",
                "desc": "Panic stop \u2014 Emergency Controls."
            },
            {
                "name": "emergency-lockdown",
                "sub": "lockdown",
                "dedicated": false,
                "kind": "action",
                "desc": "Lockdown \u2014 Emergency Controls."
            },
            {
                "name": "emergency-unlock",
                "sub": "unlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Unlock \u2014 Emergency Controls."
            },
            {
                "name": "emergency-purge",
                "sub": "purge",
                "dedicated": false,
                "kind": "action",
                "desc": "Purge \u2014 Emergency Controls."
            },
            {
                "name": "emergency-verify",
                "sub": "verify",
                "dedicated": false,
                "kind": "action",
                "desc": "Verify \u2014 Emergency Controls."
            },
            {
                "name": "emergency-automod",
                "sub": "automod",
                "dedicated": false,
                "kind": "action",
                "desc": "Automod \u2014 Emergency Controls."
            },
            {
                "name": "emergency-alert",
                "sub": "alert",
                "dedicated": false,
                "kind": "action",
                "desc": "Alert \u2014 Emergency Controls."
            },
            {
                "name": "emergency-logs",
                "sub": "logs",
                "dedicated": false,
                "kind": "logs",
                "desc": "Logs for logs \u2014 Emergency Controls."
            },
            {
                "name": "emergency-quarantine",
                "sub": "quarantine",
                "dedicated": false,
                "kind": "action",
                "desc": "Quarantine \u2014 Emergency Controls."
            },
            {
                "name": "emergency-status",
                "sub": "status",
                "dedicated": false,
                "kind": "status",
                "desc": "Show status \u2014 Emergency Controls."
            },
            {
                "name": "global-lockdown",
                "sub": "global-lockdown",
                "dedicated": false,
                "kind": "action",
                "desc": "Global lockdown \u2014 Emergency Controls."
            },
            {
                "name": "global-unlock",
                "sub": "global-unlock",
                "dedicated": false,
                "kind": "action",
                "desc": "Global unlock \u2014 Emergency Controls."
            },
            {
                "name": "global-alert",
                "sub": "global-alert",
                "dedicated": false,
                "kind": "action",
                "desc": "Global alert \u2014 Emergency Controls."
            }
        ]
    },
    {
        "slug": "panel",
        "title": "AHOY Dashboard",
        "commands": [
            {
                "name": "dashboard",
                "sub": "dashboard",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-stats",
                "sub": "dashboard-stats",
                "dedicated": false,
                "kind": "stats",
                "desc": "Statistics for dashboard stats \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-cases",
                "sub": "dashboard-cases",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard cases \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-reports",
                "sub": "dashboard-reports",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard reports \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-members",
                "sub": "dashboard-members",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard members \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-moderators",
                "sub": "dashboard-moderators",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard moderators \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-security",
                "sub": "dashboard-security",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard security \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-automod",
                "sub": "dashboard-automod",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard automod \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-analytics",
                "sub": "dashboard-analytics",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard analytics \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-logs",
                "sub": "dashboard-logs",
                "dedicated": false,
                "kind": "logs",
                "desc": "Logs for dashboard logs \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-settings",
                "sub": "dashboard-settings",
                "dedicated": false,
                "kind": "config",
                "desc": "Configure dashboard settings \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-incidents",
                "sub": "dashboard-incidents",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard incidents \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-appeals",
                "sub": "dashboard-appeals",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard appeals \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-tickets",
                "sub": "dashboard-tickets",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard tickets \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-live",
                "sub": "dashboard-live",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard live \u2014 AHOY Dashboard."
            },
            {
                "name": "dashboard-open",
                "sub": "dashboard-open",
                "dedicated": false,
                "kind": "action",
                "desc": "Dashboard open \u2014 AHOY Dashboard."
            }
        ]
    }
]

COMMAND_INDEX: dict[str, dict] = {
    entry["name"]: {**entry, "category": cat["slug"], "category_title": cat["title"]}
    for cat in CATEGORIES
    for entry in cat["commands"]
}

__all__ = ["CATEGORIES", "COMMAND_INDEX"]
