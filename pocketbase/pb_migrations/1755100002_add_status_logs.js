/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);
  const requests = dao.findCollectionByNameOrId("requests");

  const statusLogs = new Collection({
    name: "status_logs",
    type: "base",
    // Read-only from the client's perspective: only server-side hooks
    // write here (via $app.dao(), which bypasses these rules entirely).
    listRule: 'request.requester = @request.auth.id || @request.auth.role = "it_admin"',
    viewRule: 'request.requester = @request.auth.id || @request.auth.role = "it_admin"',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    schema: [
      new SchemaField({
        name: "request",
        type: "relation",
        required: true,
        options: {
          collectionId: requests.id,
          cascadeDelete: true,
          minSelect: 1,
          maxSelect: 1,
        },
      }),
      new SchemaField({
        name: "status",
        type: "text",
        required: true,
      }),
      new SchemaField({
        name: "source",
        type: "select",
        required: true,
        options: {
          maxSelect: 1,
          // "pengajuan" = our own approve/reject/revision workflow;
          // "pengerjaan" = mirrored from Notion's Kanban Status.
          values: ["pengajuan", "pengerjaan"],
        },
      }),
    ],
  });

  return dao.saveCollection(statusLogs);
}, (db) => {
  const dao = new Dao(db);
  const statusLogs = dao.findCollectionByNameOrId("status_logs");
  return dao.deleteCollection(statusLogs);
});
