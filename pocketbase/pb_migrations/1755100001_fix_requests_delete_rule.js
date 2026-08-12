/// <reference path="../pb_data/types.d.ts" />
// SECURITY FIX: deleteRule was set to "" (empty string), which in
// PocketBase means "allow everyone" (unlike Firestore's `if false`
// pattern this was meant to mirror) — any authenticated user could
// delete any other user's request via the API. Verified via a direct
// test: an unrelated user's DELETE request against another user's
// ticket returned 204. `null` is PocketBase's actual "admins only"
// value.
migrate((db) => {
  const dao = new Dao(db);
  const requests = dao.findCollectionByNameOrId("requests");
  requests.deleteRule = null;
  return dao.saveCollection(requests);
}, (db) => {
  const dao = new Dao(db);
  const requests = dao.findCollectionByNameOrId("requests");
  requests.deleteRule = "";
  return dao.saveCollection(requests);
});
