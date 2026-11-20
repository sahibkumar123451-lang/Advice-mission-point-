# Security Specification — Advice Mission Point Firestore

## 1. Data Invariants
1. Public website configuration (`coachingConfig`, `socialLinksConfig`, `teacherConfig`) can be read by visitors so the landing page renders without login, but ONLY an authenticated, email-verified Admin (`isAdmin()`) can create, update, or delete configuration documents.
2. Public visitors can ONLY read/list `galleryItems` and `learningHubItems` where `published == true`. Draft/unpublished items (`published == false`) are strictly restricted to verified Admins (`isAdmin()`).
3. All document IDs (`configId`, `itemId`, `uid`) on single-document operations (`get`, `create`, `update`, `delete`) must match `^[a-zA-Z0-9_-]+$` and `<= 128` characters.
4. All arrays (`skills`, `subjectsTaught`, `keyFormulas`) are strictly bounded (`<= 25` elements) and first-element type checked when non-empty.
5. Every string field enforces strict `.size()` boundaries matching `firebase-blueprint.json` to prevent resource exhaustion ("Denial of Wallet").
6. Temporal integrity (`updatedAt == request.time`, `createdAt == request.time` on creates, and `createdAt` immutable on updates) prevents forged timestamps.
7. Strict key allowlists (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update) block shadow/ghost fields like `isAdmin` or `role`.
8. Student enquiries containing PII (`phoneOrEmail`) remain server-side or Admin-only, never exposed in public Firestore collections.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated write to `coachingConfig/main` changing coaching name/maps link -> DENIED (`isAdmin()` required).
2. Signed-in non-admin user (`other@gmail.com`) writing to `teacherConfig/main` -> DENIED (`isAdmin()` required).
3. Signed-in user with `email_verified: false` spoofing admin email -> DENIED (`email_verified == true` required).
4. Public user listing all `galleryItems` without `where('published', '==', true)` -> DENIED (`resource.data.published == true || isAdmin()`).
5. Public user `get` on an unpublished draft `galleryItems/draft1` (`published: false`) -> DENIED.
6. Self-escalation: signed-in non-admin creating `/admins/<ownUid>` -> DENIED (`isBootstrappedAdmin()` required).
7. Shadow Update: admin-like payload injecting ghost key `isSuperAdmin: true` into `galleryItems/gal-1` -> DENIED (`keys().hasOnly(...)` / `affectedKeys().hasOnly(...)`).
8. ID Poisoning: requesting `galleryItems/../../secret` or 500-char ID -> DENIED (`isValidId()`).
9. Resource Exhaustion: uploading 2MB string into `coachingConfig/main.name` -> DENIED (`size() <= 120`).
10. Immortal Field Tamper: modifying `createdAt` on an existing `galleryItems` update -> DENIED (`incoming().createdAt == existing().createdAt`).
11. Unbounded Array Injection: passing 50 items into `teacherConfig/main.skills` -> DENIED (`size() <= 25`).
12. Enum Tampering: setting `galleryItems/gal-1.mediaType` to `"executable"` -> DENIED (`in ['image', 'video', 'pdf']`).
