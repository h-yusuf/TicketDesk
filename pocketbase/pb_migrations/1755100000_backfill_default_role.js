/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);
  const users = dao.findCollectionByNameOrId("users");

  const records = dao.findRecordsByFilter(users.id, 'role = ""', "-created", 0, 0);
  for (const record of records) {
    record.set("role", "requester");
    dao.saveRecord(record);
  }
}, (db) => {
  // no-op: reverting a backfilled default isn't meaningful
});
