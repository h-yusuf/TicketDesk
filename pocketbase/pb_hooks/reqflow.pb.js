/// <reference path="../pb_data/types.d.ts" />

// PocketBase select fields have no native default value, and the
// "users" createRule blocks clients from submitting a role at signup
// (so it can't be self-elevated) — this hook fills in the actual
// default ("requester") server-side once the record is otherwise valid,
// instead of leaving it blank in the Admin UI.
onRecordBeforeCreateRequest((e) => {
  if (!e.record.get("role")) {
    e.record.set("role", "requester");
  }
}, "users");

// --- Discord + Notion notifications -----------------------------------
//
// Both integrations are optional: if their env vars are unset, each hook
// no-ops silently (never throws), so request create/update always
// succeeds regardless of whether Discord/Notion are configured.
//
// NOTE: each hook callback below runs in its own isolated JS scope in
// PocketBase's JSVM — top-level helper functions declared in this file
// are NOT visible inside the callbacks, so each one is self-contained
// on purpose (verified against a "ReferenceError: ... is not defined"
// failure when this was factored into shared helpers).

onRecordAfterCreateRequest((e) => {
  const token = $os.getenv("DISCORD_BOT_TOKEN");
  const channelId = $os.getenv("DISCORD_HOME_CHANNEL");
  if (!token || !channelId) return;

  const categoryLabel =
    {
      feature_request: "Request Baru",
      bug_fix: "Perbaikan Bug",
      maintenance: "Maintenance",
      other: "Lainnya",
    }[e.record.get("category")] || e.record.get("category");
  const urgencyLabel =
    { low: "Low", medium: "Medium", high: "High" }[e.record.get("urgency")] ||
    e.record.get("urgency");

  let requesterLabel = "unknown";
  try {
    const requester = $app.dao().findRecordById("users", e.record.get("requester"));
    requesterLabel = requester.get("name") || requester.get("email") || requester.id;
  } catch (err) {
    console.log("Discord notify (create): requester lookup failed", err);
  }

  try {
    const res = $http.send({
      url: `https://discord.com/api/v10/channels/${channelId}/messages`,
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [
          {
            title: `🆕 Request Baru: ${e.record.get("title")}`,
            color: 0xe2892e,
            fields: [
              { name: "Requester", value: requesterLabel, inline: true },
              { name: "Kategori", value: categoryLabel, inline: true },
              { name: "Urgency", value: urgencyLabel, inline: true },
              { name: "Deskripsi", value: e.record.get("description") || "(tidak ada)" },
            ],
          },
        ],
      }),
    });
    if (res.statusCode >= 300) {
      console.log("Discord notify (create) failed:", res.statusCode, res.raw);
    }
  } catch (err) {
    console.log("Discord notify (create) error:", err);
  }
}, "requests");

onRecordAfterUpdateRequest((e) => {
  const oldStatus = e.record.originalCopy().get("status");
  const newStatus = e.record.get("status");
  if (oldStatus === newStatus) return;

  const token = $os.getenv("DISCORD_BOT_TOKEN");
  const channelId = $os.getenv("DISCORD_HOME_CHANNEL");
  if (token && channelId) {
    try {
      const res = $http.send({
        url: `https://discord.com/api/v10/channels/${channelId}/messages`,
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `🔄 Status **${e.record.get("title")}**: \`${oldStatus}\` → \`${newStatus}\``,
        }),
      });
      if (res.statusCode >= 300) {
        console.log("Discord notify (update) failed:", res.statusCode, res.raw);
      }
    } catch (err) {
      console.log("Discord notify (update) error:", err);
    }
  }

  if (newStatus !== "approved" || oldStatus === "approved") return;

  const notionToken = $os.getenv("NOTION_TOKEN");
  const databaseId = $os.getenv("NOTION_DATABASE_ID");
  if (!notionToken || !databaseId) return;

  const categoryLabel =
    {
      feature_request: "Request Baru",
      bug_fix: "Perbaikan Bug",
      maintenance: "Maintenance",
      other: "Lainnya",
    }[e.record.get("category")] || e.record.get("category");
  const priority =
    { low: "Low", medium: "Medium", high: "High" }[e.record.get("urgency")] || "Medium";
  const description = e.record.get("description");

  try {
    const res = $http.send({
      url: "https://api.notion.com/v1/pages",
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          "Nama tugas": { title: [{ text: { content: e.record.get("title") } }] },
          Category: { rich_text: [{ text: { content: categoryLabel } }] },
          Status: { status: { name: "New Request" } },
          Prioritas: { select: { name: priority } },
          No: { rich_text: [{ text: { content: e.record.id } }] },
        },
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: { rich_text: [{ text: { content: description } }] },
          },
        ],
      }),
    });

    if (res.statusCode >= 200 && res.statusCode < 300 && res.json && res.json.id) {
      e.record.set("notionPageId", res.json.id);
      $app.dao().saveRecord(e.record);
    } else {
      console.log("Notion push failed:", res.statusCode, res.raw);
    }
  } catch (err) {
    console.log("Notion push error:", err);
  }
}, "requests");

// --- Notion status sync (poll, not webhook) -----------------------------
//
// Notion's webhook/Automations feature needs a paid plan and per-database
// UI setup; polling on a cron keeps this entirely in our own hooks, same
// as everything else here. Every 5 min, re-check each pushed request's
// Notion page and mirror its Status back onto our `status` field, so the
// requester/IT dashboards show how far the ticket has moved in Notion's
// own Kanban (Backlog/To Do/In Progress/In Review/Done/Rejected) without
// anyone needing to check Notion directly. No-ops silently if NOTION_TOKEN
// is unset.
cronAdd("notion_status_sync", "*/5 * * * *", () => {
  const token = $os.getenv("NOTION_TOKEN");
  if (!token) return;

  const dao = $app.dao();
  const records = dao.findRecordsByFilter("requests", "notionPageId != ''", "-updated", 0, 0);

  for (const record of records) {
    try {
      const res = $http.send({
        url: `https://api.notion.com/v1/pages/${record.get("notionPageId")}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
        },
      });

      if (res.statusCode !== 200 || !res.json) {
        console.log("Notion sync: fetch failed for", record.id, res.statusCode);
        continue;
      }

      const notionStatus = res.json.properties && res.json.properties.Status &&
        res.json.properties.Status.status && res.json.properties.Status.status.name;
      if (notionStatus && notionStatus !== record.get("status")) {
        record.set("status", notionStatus);
        dao.saveRecord(record);
      }
    } catch (err) {
      console.log("Notion sync error for", record.id, err);
    }
  }
});
