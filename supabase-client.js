// ETHAN ERP & LMS - Supabase integration layer
// The app automatically uses Supabase when valid project credentials are supplied in config.js.
// Without credentials, it remains in local preview mode.

window.ETHAN_BACKEND = (() => {
  const cfg = window.ETHAN_CONFIG || {};
  const ready = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase);
  const client = ready ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey) : null;

  async function signUp({email,password,firstName,lastName,phone,role}) {
    if (!client) return { local: true };
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { first_name:firstName, last_name:lastName, phone, role } }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email,password) {
    if (!client) return { local: true };
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function resetPassword(email) {
    if (!client) return { local:true };
    const redirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return data;
  }

  async function getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function getProfile(userId) {
    if (!client) return null;
    const { data, error } = await client.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error;
    return data;
  }

  async function listStudents() {
    if (!client) return null;
    const { data, error } = await client.from("students").select("*, profiles(*)").order("created_at",{ascending:false});
    if (error) throw error;
    return data;
  }

  async function listCourses() {
    if (!client) return null;
    const { data, error } = await client.from("courses").select("*").order("created_at",{ascending:false});
    if (error) throw error;
    return data;
  }

  async function createCourse(payload) {
    if (!client) return null;
    const { data, error } = await client.from("courses").insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function createStudent(payload) {
    if (!client) return null;
    const { data, error } = await client.from("students").insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function createPayment(payload) {
    if (!client) return null;
    const { data, error } = await client.from("payments").insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  return { ready, client, signUp, signIn, signOut, resetPassword, getSession, getProfile, listStudents, listCourses, createCourse, createStudent, createPayment };
})();