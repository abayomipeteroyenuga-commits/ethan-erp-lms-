# v9.4 Super Admin Portal Hard Fix
Confirmed Super Admin: fedora4jesus@gmail.com

The role is normalized at the central portal entry point, so a stale browser/local Student record can no longer override the confirmed Super Admin identity. The fix applies to fresh Supabase login, restored Supabase session, local fallback session, role label, navigation and dashboard routing.
