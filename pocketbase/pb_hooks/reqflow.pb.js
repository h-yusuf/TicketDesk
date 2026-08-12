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
