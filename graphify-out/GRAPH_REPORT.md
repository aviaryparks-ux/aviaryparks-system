# Graph Report - .  (2026-07-23)

## Corpus Check
- 184 files · ~339,111 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 139 nodes · 13 edges · 126 communities (2 shown, 124 thin omitted)
- Extraction: 31% EXTRACTED · 69% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Hr System
- Agent Rules
- Presentation Mod
- Work Order
- Nextjs Readme
- Mod Reports
- Chat Firebasetimestamp
- Event Appevent
- Layout Chatlayout
- Loading Loading
- Page Modtemplatepage
- Page Workorderdetailpage
- Page Wotemplatepage
- Route Options
- Route Post
- Route Post
- Route Get
- Route Get
- Route Post
- Route Delete
- Route Post
- Layout Rootlayout
- Manifest Manifest
- Page Home
- Presentation Attendance
- Agoracallroom Agoracallroom
- Mappicker Mappicker
- Protectedroute Protectedroute
- Richtexteditor Richtexteditor
- Features Appfeature
- Authcontext Authprovider
- Authcontext Useauth
- Usepermissions Usepermissions
- Department Deletedepartmentgroup
- Department Ensuredepartmentgroups
- Department Onemployeedepartmentchanged
- Department Syncalldepartmentgroups
- Firebase Addmembertogroup
- Firebase Archiveconversation
- Firebase Creategroupchat
- Firebase Deleteconversation
- Firebase Getallusers
- Firebase Getconversation
- Firebase Getorcreateprivateconversation
- Firebase Getuserbyid
- Firebase Leavegroup
- Firebase Markasread
- Firebase Removememberfromgroup
- Firebase Searchusers
- Firebase Sendmessage
- Firebase Subscribetoconversations
- Firebase Subscribetogroupconversations
- Firebase Subscribetomessages
- Firebase Subscribetoprivateconversations
- Firebase Subscribetounreadcount
- Crypto Decryptsession
- Crypto Decryptsessionsync
- Crypto Encryptsession
- Crypto Encryptsessionsync
- Firebase Db
- Firebase Markallnotificationsasread
- Firebase Marknotificationasread
- Firebase Subscribetonotifications
- Password Generatepassword
- Password Getpasswordscore
- Password Passwordrequirements
- Password Passwordvalidationresult
- Password Validatepassword
- Limit Checkratelimit
- Limit Createratelimitheaders
- Limit Getclientidentifier
- Roles Canmanageusers
- Roles Getroledisplayname
- Roles Getrolelevel
- Roles Hasadminaccess
- Roles Hasequalorhigherprivilege
- Roles Issuperadmin
- Roles Isvalidrole
- Roles Normalizerole
- Roles Rolelevel
- Index Playmessagesound
- Index Playnotificationsound
- Index Startringtone
- Index Stopringtone
- Middleware Middleware
- Layout Rootlayout
- Rate Limiting
- Security Guide
- Security Headers
- Session Encryption
- Mod Schedules
- Work Order
- Work Order
- Chat Chatuser
- Chat Conversation
- Chat Creategrouppayload
- Chat Lastmessage
- Chat Message
- Chat Timestampvalue
- Chat Userconversation
- Event Eventstatus
- Event Eventtype
- Event Feodata
- Event Reodata
- Mod Modarea
- Mod Modquestion
- Mod Modschedule
- Mod Modtemplate
- Mod Photorating
- Mod Questionphoto
- Order Approvalstatus
- Order Approvalstep
- Order Budgetitem
- Order Milestone
- Order Slatracking
- Order Threadmessage
- Order Woarea
- Order Woinventoryitem
- Order Woinventorytemplate
- Order Workorder
- Order Workorderphoto
- Order Workorderpriority
- Order Workorderstatus
- Order Workordertype
- Order Workthread
- Order Workupdate

## God Nodes (most connected - your core abstractions)
1. `AviaryPark HR Management System` - 4 edges
2. `Next.js Agent Rules` - 2 edges
3. `Morning Briefing Next.js Agent Rules` - 2 edges
4. `FirebaseTimestamp` - 1 edges
5. `BaseEvent` - 1 edges
6. `AppEvent` - 1 edges
7. `AppNotification` - 1 edges
8. `Manager on Duty (MOD) Module` - 1 edges
9. `Work Order Module` - 1 edges
10. `Claude Instructions` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Morning Briefing Next.js Agent Rules` --semantically_similar_to--> `Next.js Agent Rules`  [INFERRED] [semantically similar]
  morning-briefing/AGENTS.md → AGENTS.md
- `Morning Briefing README` --semantically_similar_to--> `Next.js README`  [INFERRED] [semantically similar]
  morning-briefing/README.md → README.md
- `PPT Detail Prompt` --conceptually_related_to--> `AviaryPark HR Management System`  [INFERRED]
  PPT_DETAIL_PROMPT.md → AVIARYPARK_HR_FLOWCHART_PRESENTATION.md
- `PPT Prompt AviaryPark HR` --conceptually_related_to--> `AviaryPark HR Management System`  [INFERRED]
  PPT_PROMPT_AVIARYPARK_HR.md → AVIARYPARK_HR_FLOWCHART_PRESENTATION.md
- `PPT Quick Prompt` --conceptually_related_to--> `AviaryPark HR Management System`  [INFERRED]
  PPT_QUICK_PROMPT.txt → AVIARYPARK_HR_FLOWCHART_PRESENTATION.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **AviaryPark HR Presentations** — ppt_detail_prompt_ppt_prompt, ppt_prompt_aviarypark_hr_ppt_prompt, ppt_quick_prompt_quick_prompt, presentation_hr_presentation, aviarypark_hr_flowchart_presentation_aviarypark_hr_system [INFERRED 0.85]

## Communities (126 total, 124 thin omitted)

### Community 0 - "Hr System"
Cohesion: 0.40
Nodes (5): AviaryPark HR Management System, PPT Detail Prompt, PPT Prompt AviaryPark HR, PPT Quick Prompt, HTML Presentation for AviaryPark HR

### Community 1 - "Agent Rules"
Cohesion: 0.50
Nodes (4): Next.js Agent Rules, Claude Instructions, Morning Briefing Next.js Agent Rules, Morning Briefing Claude Instructions

## Knowledge Gaps
- **133 isolated node(s):** `ChatLayout`, `Loading`, `MODTemplatePage`, `WorkOrderDetailPage`, `WOTemplatePage` (+128 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **124 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 4 inferred relationships involving `AviaryPark HR Management System` (e.g. with `PPT Detail Prompt` and `PPT Prompt AviaryPark HR`) actually correct?**
  _`AviaryPark HR Management System` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ChatLayout`, `Loading`, `MODTemplatePage` to the rest of the system?**
  _133 weakly-connected nodes found - possible documentation gaps or missing edges._