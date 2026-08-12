/// <reference path="../pb_data/types.d.ts" />
// Denormalized copy of the requester's email, set by the client at create
// time. Avoids relying on relation `expand` for the IT dashboard's
// "Diajukan oleh" label — the installed pocketbase JS SDK (0.21.5, pinned
// to match the v0.22.21 server) only forwards `query`/`headers` through
// realtime subscribe() options, not `expand`, so expanded data silently
// vanished the moment any realtime event replaced the initial (correctly
// expanded) list load.
migrate((db) => {
  const dao = new Dao(db);
  const requests = dao.findCollectionByNameOrId("requests");

  requests.schema.addField(new SchemaField({
    name: "requesterEmail",
    type: "text",
    required: false,
  }));

  return dao.saveCollection(requests);
}, (db) => {
  const dao = new Dao(db);
  const requests = dao.findCollectionByNameOrId("requests");
  const field = requests.schema.getFieldByName("requesterEmail");
  if (field) {
    requests.schema.removeField(field.id);
  }
  return dao.saveCollection(requests);
});
