import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Pool } from "@neondatabase/serverless";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000 })
  : null;
const jwks = process.env.NEON_AUTH_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL))
  : null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respond(res, status, message) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).type("text/plain; charset=utf-8").send(message);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (req.method !== "GET") return respond(res, 405, "Method not allowed.");
  if (!pool || !jwks) return respond(res, 503, "Course materials are temporarily unavailable.");

  try {
    const match = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ""));
    if (!match) return respond(res, 401, "Sign in to access course materials.");

    const { payload } = await jwtVerify(match[1], jwks);
    const userId = String(payload.sub || "");
    if (!UUID_RE.test(userId) || payload.role !== "authenticated") {
      return respond(res, 401, "Your learning session is invalid. Sign in again.");
    }

    const roleResult = await pool.query(
      "SELECT role::text AS role FROM public.profiles WHERE id=$1",
      [userId]
    );
    const role = roleResult.rows[0]?.role || "student";
    const isStaff = ["super_admin", "admin", "instructor"].includes(role);

    const kind = String(req.params.kind || "");
    const requested = String(req.params.filename || "");
    const isManual = kind === "manual";
    const isNarration = kind === "narration";
    if ((!isManual && !isNarration) ||
        (isManual && !/^[A-Za-z0-9._-]+\.pdf$/i.test(requested)) ||
        (isNarration && !/^[A-Za-z0-9._-]+\.txt$/i.test(requested))) {
      return respond(res, 404, "Course resource not found.");
    }

    const query = isManual
      ? "SELECT cma.filename, cma.course_id FROM public.course_manual_assets cma JOIN public.courses c ON c.id=cma.course_id WHERE cma.filename=$1 AND cma.is_active=true AND c.published=true AND ($2::boolean=true OR EXISTS (SELECT 1 FROM public.enrolments e JOIN public.students s ON s.id=e.student_id WHERE s.user_id=$3 AND e.course_id=c.id AND e.status='active')) LIMIT 1"
      : "SELECT cma.filename, cma.course_id FROM public.course_manual_assets cma JOIN public.courses c ON c.id=cma.course_id WHERE replace(regexp_replace(cma.filename, '-FULL-VISUAL-STUDY-MANUAL\\.pdf$', '.pdf'), '.pdf', '.txt')=$1 AND cma.is_active=true AND c.published=true AND ($2::boolean=true OR EXISTS (SELECT 1 FROM public.enrolments e JOIN public.students s ON s.id=e.student_id WHERE s.user_id=$3 AND e.course_id=c.id AND e.status='active')) LIMIT 1";

    const record = await pool.query(query, [requested, isStaff, userId]);
    if (!record.rows.length) {
      return respond(res, 403, "This course is locked until the Superadmin verifies payment and approves your enrolment.");
    }

    const mapped = record.rows[0].filename;
    const filename = isNarration
      ? mapped.replace(/-FULL-VISUAL-STUDY-MANUAL\.pdf$/i, ".txt").replace(/\.pdf$/i, ".txt")
      : mapped;
    const folder = isNarration ? "course-narration" : "course-materials";
    const filePath = path.resolve(ROOT, "assets", folder, filename);
    const allowedRoot = path.resolve(ROOT, "assets", folder) + path.sep;
    if (!filePath.startsWith(allowedRoot)) return respond(res, 404, "Course resource not found.");

    res.setHeader("Content-Type", isNarration ? "text/plain; charset=utf-8" : "application/pdf");
    res.setHeader("Content-Disposition", isNarration ? "inline" : 'inline; filename="' + filename.replace(/["\\r\\n]/g, "_") + '"');
    return res.sendFile(filePath, error => {
      if (error && !res.headersSent) respond(res, 404, "Course resource not found.");
    });
  } catch (error) {
    const status = Number(error?.statusCode) || (error?.code === "ERR_JWT_EXPIRED" ? 401 : 500);
    console.error("[Ethan LMS course asset]", error?.code || error?.name || "Error", error?.message || "");
    return respond(res, status, status >= 500
      ? "The course resource could not be loaded. Please try again."
      : error?.message || "Course resource access denied.");
  }
}
