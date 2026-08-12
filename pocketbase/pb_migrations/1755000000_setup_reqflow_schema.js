/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);

  // --- extend the built-in "users" auth collection ---
  const users = dao.findCollectionByNameOrId("users");

  // Not required: PocketBase select fields have no native "default value",
  // and the createRule below blocks clients from submitting a role at
  // signup — so a fresh user's role is "" until an it_admin sets it.
  // App code treats "" the same as "requester" (least privilege).
  users.schema.addField(new SchemaField({
    name: "role",
    type: "select",
    required: false,
    options: {
      maxSelect: 1,
      values: ["requester", "it_admin"],
    },
  }));

  users.listRule = 'id = @request.auth.id || @request.auth.role = "it_admin"';
  users.viewRule = 'id = @request.auth.id || @request.auth.role = "it_admin"';
  users.createRule = "@request.data.role:isset = false";
  users.updateRule =
    '(id = @request.auth.id && @request.data.role:isset = false) || @request.auth.role = "it_admin"';
  users.deleteRule = '@request.auth.role = "it_admin"';

  dao.saveCollection(users);

  // --- "requests" collection ---
  const requests = new Collection({
    name: "requests",
    type: "base",
    listRule: 'requester = @request.auth.id || @request.auth.role = "it_admin"',
    viewRule: 'requester = @request.auth.id || @request.auth.role = "it_admin"',
    createRule:
      '@request.data.requester = @request.auth.id && @request.data.status = "pending"',
    // NOTE: @request.data.<field> is the *submitted* value only — PocketBase
    // does not merge it with the existing record like Firestore's
    // request.resource.data does. So "unchanged field" must be checked via
    // the ":isset = false" guard (field absent from payload), not equality
    // against the existing value.
    updateRule:
      '(@request.auth.role = "it_admin" && ((@request.data.status != "rejected" && @request.data.status != "revision_requested") || @request.data.reviewNote != "")) || (requester = @request.auth.id && status = "revision_requested" && @request.data.status = "pending" && @request.data.requester:isset = false)',
    // null = admins-only. PocketBase treats "" as "allow everyone" (the
    // opposite of Firestore's `if false` idiom this was meant to mirror) —
    // see 1755100001_fix_requests_delete_rule.js for the patch that fixes
    // this on databases that already ran this migration.
    deleteRule: null,
    schema: [
      new SchemaField({
        name: "requester",
        type: "relation",
        required: true,
        options: {
          collectionId: users.id,
          cascadeDelete: false,
          minSelect: 1,
          maxSelect: 1,
        },
      }),
      new SchemaField({
        name: "title",
        type: "text",
        required: true,
      }),
      new SchemaField({
        name: "category",
        type: "select",
        required: true,
        options: {
          maxSelect: 1,
          values: ["feature_request", "bug_fix", "maintenance", "other"],
        },
      }),
      new SchemaField({
        name: "description",
        type: "text",
        required: true,
      }),
      new SchemaField({
        name: "urgency",
        type: "select",
        required: true,
        options: {
          maxSelect: 1,
          values: ["low", "medium", "high"],
        },
      }),
      new SchemaField({
        name: "status",
        type: "text",
        required: true,
      }),
      new SchemaField({
        name: "reviewedBy",
        type: "relation",
        required: false,
        options: {
          collectionId: users.id,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        },
      }),
      new SchemaField({
        name: "reviewNote",
        type: "text",
        required: false,
      }),
      new SchemaField({
        name: "notionPageId",
        type: "text",
        required: false,
      }),
    ],
  });

  return dao.saveCollection(requests);
}, (db) => {
  const dao = new Dao(db);

  const requests = dao.findCollectionByNameOrId("requests");
  dao.deleteCollection(requests);

  const users = dao.findCollectionByNameOrId("users");
  const roleField = users.schema.getFieldByName("role");
  if (roleField) {
    users.schema.removeField(roleField.id);
  }
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  users.createRule = "";
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = "id = @request.auth.id";
  dao.saveCollection(users);
});
