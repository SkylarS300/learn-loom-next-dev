// app/api/users/route.js
//
// Disabled: this route (and the `user` email/password/name/grade model it
// reads/writes) is not used by LearnLoom's actual auth flow, which is
// anonymous-code based (see app/api/session/*). Leaving it live meant:
//   - POST could create real accounts with PII the product isn't supposed
//     to collect (email, first/last name, grade).
//   - GET returned every account's name/email/grade with no auth check.
//
// Disabled here rather than deleted so the underlying `user` table/data
// (if any exists in a given environment) isn't touched. If this system is
// intentionally being revived (e.g. for teacher accounts), it needs real
// authentication on GET and a product decision about PII collection first.

export async function POST() {
  return Response.json(
    { ok: false, error: "This endpoint is disabled." },
    { status: 410 }
  );
}

export async function GET() {
  return Response.json(
    { ok: false, error: "This endpoint is disabled." },
    { status: 410 }
  );
}