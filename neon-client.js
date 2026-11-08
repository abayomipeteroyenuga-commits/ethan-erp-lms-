// ETHAN ERP & LMS — dedicated Neon authentication, data and materials service.
(async function bootEthanNeon(){
  const cfg=window.ETHAN_CONFIG||{};
  const startApp=()=>{
    if(window.__ETHAN_APP_SCRIPT_STARTED)return;
    window.__ETHAN_APP_SCRIPT_STARTED=true;
    const script=document.createElement("script");
    script.src="./app.js";
    script.onerror=()=>{const m=document.getElementById("signinMessage");if(m){m.textContent="The learning portal could not load. Refresh the page and try again.";m.className="form-message error";}};
    document.body.appendChild(script);
  };
  try{
    if(!cfg.neonDatabaseUrl)throw new Error("Ethan LMS Neon configuration is missing.");
    const {createClient}=await import("https://esm.sh/@neon/neon-js@latest?bundle");
    const client=createClient(cfg.neonDatabaseUrl);
    const requestStorage=async(payload)=>{
      const {data,error}=await client.auth.getSession();
      if(error)throw error;
      const token=data?.session?.access_token||data?.session?.accessToken;
      if(!token)throw new Error("Your sign-in session has expired. Sign in again.");
      const response=await fetch("/api/storage/presign",{
        method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
        body:JSON.stringify(payload),cache:"no-store"
      });
      const result=await response.json().catch(()=>({error:"The file service returned an invalid response."}));
      if(!response.ok)throw new Error(result.error||"The course-material service is unavailable.");
      return result;
    };
    const ensureProfile=async({firstName="",lastName="",phone="",learnerType="student"}={})=>{
      const {data,error}=await client.rpc("ensure_student_account",{
        p_first_name:firstName,p_last_name:lastName,p_phone:phone,p_learner_type:learnerType
      });
      if(error)throw error;
      return data;
    };
    const backend={
      ready:true,client,
      async signUp({email,password,firstName,lastName,phone,learnerType}){
        const {data,error}=await client.auth.signUp.email({
          email,password,name:(firstName+" "+lastName).trim(),callbackURL:location.origin+location.pathname
        });
        if(error)throw error;
        if(!data?.user)throw new Error("The account service did not return the new user. Please try again.");
        const session=await client.auth.getSession();
        if(session.error)throw session.error;
        if(!session.data?.session)throw new Error("Your account was created but a session was not started. Please sign in.");
        const profile=await ensureProfile({firstName,lastName,phone,learnerType});
        return {user:data.user,session:session.data.session,profile};
      },
      async signIn(email,password){
        const {data,error}=await client.auth.signIn.email({email,password});
        if(error)throw error;
        if(!data?.user)throw new Error("Email or password is incorrect.");
        const lookup=await client.from("profiles").select("*").eq("id",data.user.id).maybeSingle();
        if(lookup.error)throw lookup.error;
        let profile=lookup.data;
        if(!profile){
          const parts=String(data.user.name||"").trim().split(/\\s+/);
          profile=await ensureProfile({firstName:parts[0]||"",lastName:parts.slice(1).join(" "),phone:"",learnerType:"student"});
        }
        return {user:data.user,session:data.session||null,profile};
      },
      async signOut(){
        const {error}=await client.auth.signOut();
        if(error)throw error;
      },
      async resetPassword(email){
        const {error}=await client.auth.requestPasswordReset({email,redirectTo:location.origin+location.pathname});
        if(error)throw error;
      },
      async getSession(){
        const {data,error}=await client.auth.getSession();
        if(error)throw error;
        return data?.session?{...data.session,user:data.user||data.session.user}:null;
      },
      async getProfile(userId){
        const {data,error}=await client.from("profiles").select("*").eq("id",userId).single();
        if(error)throw error;
        return data;
      },
      async listStudents(){
        const {data,error}=await client.from("students").select("*, profiles(*)").order("created_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async listCourses(){
        const {data,error}=await client.from("courses").select("*").order("code",{ascending:true});
        if(error)throw error;return data||[];
      },
      async createCourse(payload){
        const {data,error}=await client.from("courses").insert({...payload,fee:0}).select().single();
        if(error)throw error;return data;
      },
      async createStudent(payload){
        const {data,error}=await client.from("students").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async getStudentByUserId(userId){
        const {data,error}=await client.from("students").select("*").eq("user_id",userId).maybeSingle();
        if(error)throw error;return data;
      },
      async listStudentEnrolments(studentId){
        const {data,error}=await client.from("enrolments").select("*, course:courses(*)").eq("student_id",studentId).eq("status","active").order("enrolled_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async createEnrolment(payload){
        const {data,error}=await client.from("enrolments").upsert(payload,{onConflict:"student_id,course_id"}).select().single();
        if(error)throw error;return data;
      },
      async listMyPayments(studentId){
        const {data,error}=await client.from("payments").select("*").eq("student_id",studentId).order("paid_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async listPayments(){
        const {data,error}=await client.from("payments").select("*, students(student_no, profiles(first_name,last_name,email))").order("paid_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async createPayment(payload){
        const {data,error}=await client.from("payments").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async listAnnouncements(){
        const {data,error}=await client.from("announcements").select("*").order("created_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async createAnnouncement(payload){
        const {data,error}=await client.from("announcements").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async listMyNotifications(){
        const session=await backend.getSession();
        if(!session?.user?.id)return [];
        const {data,error}=await client.from("notifications").select("*").eq("user_id",session.user.id).order("created_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async listStaff(){
        const {data,error}=await client.from("profiles").select("id,first_name,last_name,email,phone,role,created_at").in("role",["super_admin","admin","instructor"]).order("created_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async createStaff(payload){
        const {data,error}=await client.rpc("assign_staff_role",{p_email:payload.email,p_role:payload.role});
        if(error)throw error;return data;
      },
      async uploadCourseMaterial({courseId,title,file}){
        const session=await backend.getSession();
        if(!session?.user?.id)throw new Error("Sign in again before uploading.");
        const safeName=String(file.name||"course.pdf").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(0,150);
        const path=courseId+"/"+crypto.randomUUID()+"-"+safeName;
        const signed=await requestStorage({action:"upload",key:path,contentType:file.type||"application/pdf"});
        const uploaded=await fetch(signed.url,{method:"PUT",headers:signed.headers||{"Content-Type":file.type||"application/pdf"},body:file});
        if(!uploaded.ok)throw new Error("The file upload failed ("+uploaded.status+").");
        const {data,error}=await client.from("course_materials").insert({
          course_id:courseId,title,file_path:path,file_name:file.name,mime_type:file.type||"application/pdf",uploaded_by:session.user.id,is_active:true
        }).select().single();
        if(error){await requestStorage({action:"delete",key:path}).catch(()=>{});throw error;}
        return data;
      },
      async getCourseMaterial(courseTitle){
        const {data:course,error:courseError}=await client.from("courses").select("id,title").ilike("title",courseTitle).maybeSingle();
        if(courseError||!course)return null;
        const {data:material,error}=await client.from("course_materials").select("*").eq("course_id",course.id).eq("is_active",true).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(error||!material)return null;
        const signed=await requestStorage({action:"download",key:material.file_path,expiresIn:3600});
        return {...material,pdf_url:signed.url,source:"storage"};
      }
    };
    window.ETHAN_BACKEND=backend;
    window.ETHAN_NEON_READY=true;
    startApp();
  }catch(error){
    console.error("Ethan LMS Neon startup failed:",error);
    window.ETHAN_BACKEND={ready:false,error:error?.message||"The Neon learning service could not load."};
    startApp();
  }
})();
