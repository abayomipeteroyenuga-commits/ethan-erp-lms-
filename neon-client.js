// ETHAN ERP & LMS — dedicated Neon authentication, data and materials service.
(async function bootEthanNeon(){
  const cfg=window.ETHAN_CONFIG||{};
  const startApp=()=>{
    if(window.__ETHAN_APP_SCRIPT_STARTED)return;
    window.__ETHAN_APP_SCRIPT_STARTED=true;
    const script=document.createElement("script");
    script.src="./app.js?v=20261110-menu-fix-1";
    script.onload=()=>{
      const classroom=document.createElement("script");
      classroom.src="./digital-learning.js?v=20261110-menu-fix-1";
      classroom.onerror=()=>{const m=document.getElementById("signinMessage");if(m){m.textContent="The digital classroom could not load. Refresh the page and try again.";m.className="form-message error";}};
      document.body.appendChild(classroom);
    };
    script.onerror=()=>{const m=document.getElementById("signinMessage");if(m){m.textContent="The learning portal could not load. Refresh the page and try again.";m.className="form-message error";}};
    document.body.appendChild(script);
  };
  try{
    if(!cfg.neonAuthUrl||!cfg.neonDataApiUrl)throw new Error("Ethan LMS authentication and data services are not configured.");
    let neonSdk=null,sdkErrors=[];
    const sdkUrls=[
      "/neon-sdk.bundle.js?v=20261110",
      "https://esm.sh/@neondatabase/neon-js@0.9.0-beta?bundle",
      "https://cdn.jsdelivr.net/npm/@neondatabase/neon-js@0.9.0-beta/+esm"
    ];
    for(const sdkUrl of sdkUrls){
      try{
        neonSdk=await import(sdkUrl);
        if(neonSdk?.createClient)break;
        throw new Error("SDK module did not expose createClient");
      }catch(error){
        sdkErrors.push((error?.message||"SDK import failed")+" ("+(sdkUrl.startsWith("/")?"local bundle":new URL(sdkUrl).host)+")");
        neonSdk=null;
      }
    }
    if(!neonSdk?.createClient){
      throw new Error("The local Neon browser SDK could not be loaded. Refresh the page or contact the Academy. "+sdkErrors.join(" | "));
    }
    const client=neonSdk.createClient({
      auth:{url:cfg.neonAuthUrl},
      dataApi:{url:cfg.neonDataApiUrl}
    });
    const requestStorage=async(payload)=>{
      const {data,error}=await client.auth.getSession();
      if(error)throw error;
      const token=data?.session?.token||data?.session?.access_token||data?.session?.accessToken;
      if(!token)throw new Error("Your sign-in session has expired. Sign in again.");
      const response=await fetch("/api/storage/presign",{
        method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
        body:JSON.stringify(payload),cache:"no-store"
      });
      const result=await response.json().catch(()=>({error:"The file service returned an invalid response."}));
      if(!response.ok)throw new Error(result.error||"The course-material service is unavailable.");
      return result;
    };
    const PENDING_PROFILE_KEY="ethan_pending_profile_v1";
    const savePendingProfile=details=>{
      try{
        localStorage.setItem(PENDING_PROFILE_KEY,JSON.stringify({...details,createdAt:Date.now()}));
      }catch(_){}
    };
    const getPendingProfile=email=>{
      try{
        const saved=JSON.parse(localStorage.getItem(PENDING_PROFILE_KEY)||"null");
        if(!saved||String(saved.email||"").toLowerCase()!==String(email||"").toLowerCase())return null;
        if(Date.now()-Number(saved.createdAt||0)>48*60*60*1000){
          localStorage.removeItem(PENDING_PROFILE_KEY);return null;
        }
        return saved;
      }catch(_){return null;}
    };
    const clearPendingProfile=()=>{
      try{localStorage.removeItem(PENDING_PROFILE_KEY);}catch(_){}
    };
    const sessionFrom=async fallback=>{
      const response=await client.auth.getSession();
      if(response?.error)throw response.error;
      return response?.data?.session||fallback||null;
    };
    const ensureProfile=async({firstName="",lastName="",phone="",learnerType="student"}={})=>{
      const {data,error}=await client.rpc("ensure_student_account",{
        p_first_name:firstName,p_last_name:lastName,p_phone:phone,p_learner_type:learnerType
      });
      if(error)throw error;
      return data;
    };
    const protectedAssetUrls=new Set();
    const backend={
      ready:true,client,
      async signUp({email,password,firstName,lastName,phone,learnerType}){
        const response=await client.auth.signUp.email({
          email,password,name:(firstName+" "+lastName).trim(),callbackURL:location.origin+location.pathname
        });
        if(response?.error)throw response.error;
        const data=response?.data||response;
        const user=data?.user||data?.session?.user;
        if(!user)throw new Error("The account service did not return the new user. Please try again.");
        const session=await sessionFrom(data?.session);
        const pending={email:String(email).trim().toLowerCase(),firstName,lastName,phone,learnerType};
        if(!session){
          savePendingProfile(pending);
          return {user,session:null,profile:null,verificationRequired:true};
        }
        const profile=await ensureProfile({firstName,lastName,phone,learnerType});
        clearPendingProfile();
        return {user,session,profile,verificationRequired:false};
      },
      async signIn(email,password){
        const response=await client.auth.signIn.email({email,password});
        if(response?.error)throw response.error;
        const data=response?.data||response;
        const session=await sessionFrom(data?.session);
        const user=data?.user||session?.user;
        if(!user)throw new Error("Email or password is incorrect.");
        if(!session)throw new Error("Your account was recognised, but a secure session could not be started. Please sign in again.");
        const lookup=await client.from("profiles").select("*").eq("id",user.id).maybeSingle();
        if(lookup.error)throw lookup.error;
        let profile=lookup.data;
        if(!profile){
          const pending=getPendingProfile(email);
          const parts=String(user.name||"").trim().split(/\\s+/);
          profile=await ensureProfile({
            firstName:pending?.firstName||parts[0]||"",
            lastName:pending?.lastName||parts.slice(1).join(" "),
            phone:pending?.phone||"",
            learnerType:pending?.learnerType||"student"
          });
        }
        clearPendingProfile();
        return {user,session,profile};
      },
      async signOut(){
        const {error}=await client.auth.signOut();
        if(error)throw error;
        protectedAssetUrls.forEach(url=>{try{URL.revokeObjectURL(url);}catch(_){}});
        protectedAssetUrls.clear();
      },
      async resetPassword(email){
        const {error}=await client.auth.requestPasswordReset({email,redirectTo:location.origin+location.pathname});
        if(error)throw error;
      },
      async completePasswordReset(token,newPassword){
        const {error}=await client.auth.resetPassword({token,newPassword});
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
      async updateMyProfile(payload={}){
        const activeSession=await backend.getSession();
        const userId=activeSession?.user?.id;
        if(!userId)throw new Error("Your sign-in session has expired. Sign in again.");
        const firstName=String(payload.firstName||"").trim();
        const lastName=String(payload.lastName||"").trim();
        const phone=String(payload.phone||"").trim();
        if(!firstName||!lastName)throw new Error("Enter both your first name and last name.");
        const {data,error}=await client.from("profiles").update({
          first_name:firstName,last_name:lastName,phone:phone||null
        }).eq("id",userId).select("*").single();
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
        const fee=Number(payload.fee);
        if(!Number.isFinite(fee)||fee<=0)throw new Error("Set a course fee greater than zero before publishing it.");
        const {data,error}=await client.from("courses").insert({...payload,fee,published:true}).select().single();
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
      async listPaymentBankAccounts(){
        const {data,error}=await client.from("payment_bank_accounts")
          .select("id,bank_name,account_name,account_number,currency,instructions,is_active,display_order")
          .order("display_order",{ascending:true}).order("created_at",{ascending:true});
        if(error)throw error;return data||[];
      },
      async createPaymentBankAccount(payload){
        const {data,error}=await client.from("payment_bank_accounts").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async updatePaymentBankAccount(accountId,payload){
        const {data,error}=await client.from("payment_bank_accounts")
          .update({...payload,updated_at:new Date().toISOString()}).eq("id",accountId).select().single();
        if(error)throw error;return data;
      },
      async listMyCourseAccessRequests(studentId){
        const {data,error}=await client.from("course_access_requests")
          .select("id,student_id,course_id,amount,payment_reference,payment_method,payment_date,bank_account_id,notes,status,submitted_at,reviewed_at,admin_note,course:courses(id,code,title,fee),bank_account:payment_bank_accounts(id,bank_name,account_name,account_number,currency)")
          .eq("student_id",studentId).order("submitted_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async listCourseAccessRequests(){
        const {data,error}=await client.from("course_access_requests")
          .select("id,student_id,course_id,amount,payment_reference,payment_method,payment_date,bank_account_id,notes,status,submitted_at,reviewed_by,reviewed_at,admin_note,payment_id,course:courses(id,code,title,fee),student:students(id,student_no,profiles(first_name,last_name,email,phone)),bank_account:payment_bank_accounts(id,bank_name,account_name,account_number,currency)")
          .order("submitted_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async createCourseAccessRequest(payload){
        const {data,error}=await client.from("course_access_requests").insert({
          student_id:payload.studentId,course_id:payload.courseId,amount:Number(payload.amount),
          payment_reference:String(payload.paymentReference||"").trim(),
          payment_method:payload.paymentMethod||"bank_transfer",payment_date:payload.paymentDate,bank_account_id:payload.bankAccountId||null,
          notes:String(payload.notes||"").trim()||null,status:"pending"
        }).select().single();
        if(error)throw error;return data;
      },
      async approveCourseAccessRequest(requestId,adminNote=""){
        const {data,error}=await client.rpc("approve_course_access_request",{
          p_request_id:requestId,p_admin_note:adminNote||null
        });
        if(error)throw error;return data;
      },
      async rejectCourseAccessRequest(requestId,adminNote=""){
        const {data,error}=await client.rpc("reject_course_access_request",{
          p_request_id:requestId,p_admin_note:adminNote||null
        });
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
      async listCourseModules(courseId){
        const {data,error}=await client.from("modules")
          .select("id,course_id,title,position,lessons(id,module_id,title,content_html,video_url,estimated_minutes,position,published)")
          .eq("course_id",courseId).order("position",{ascending:true});
        if(error)throw error;
        return (data||[]).map(m=>({...m,lessons:(m.lessons||[]).sort((a,b)=>Number(a.position||0)-Number(b.position||0))}));
      },
      async createCourseModule(payload){
        const {data,error}=await client.from("modules").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async createCourseLesson(payload){
        const {data,error}=await client.from("lessons").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async updateCourseLesson(lessonId,payload){
        const {data,error}=await client.from("lessons").update(payload).eq("id",lessonId).select().single();
        if(error)throw error;return data;
      },
      async listAttendance(){
        const {data,error}=await client.from("attendance").select("id,attendance_date,status,student:students(student_no,profiles(first_name,last_name,email)),course:courses(code,title)").order("attendance_date",{ascending:false});
        if(error)throw error;return data||[];
      },
      async markAttendance(payload){
        const {data,error}=await client.from("attendance").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async listResults(){
        const {data,error}=await client.from("results").select("id,assessment_name,score,grade,status,published,created_at,student:students(student_no,profiles(first_name,last_name,email)),course:courses(code,title)").order("created_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async createResult(payload){
        const {data,error}=await client.from("results").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async listCertificates(studentId=null){
        let query=client.from("certificates").select("id,certificate_no,issued_at,status,verification_code,student:students(student_no,profiles(first_name,last_name,email)),course:courses(code,title)").order("issued_at",{ascending:false});
        if(studentId)query=query.eq("student_id",studentId);
        const {data,error}=await query;
        if(error)throw error;return data||[];
      },
      async issueCertificate(payload){
        const {data,error}=await client.from("certificates").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async listMyLessonProgress(studentId){
        const {data,error}=await client.from("lesson_progress")
          .select("lesson_id,completed,completed_at").eq("student_id",studentId);
        if(error)throw error;return data||[];
      },
      async setLessonProgress({studentId,lessonId,completed=true}){
        const {data,error}=await client.from("lesson_progress").upsert({
          student_id:studentId,lesson_id:lessonId,completed:Boolean(completed),
          completed_at:completed?new Date().toISOString():null
        },{onConflict:"student_id,lesson_id"}).select().single();
        if(error)throw error;return data;
      },
      async listAssignments(){
        const {data,error}=await client.from("assignments").select("*, course:courses(id,code,title)").order("created_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async createAssignment(payload){
        const {data,error}=await client.from("assignments").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async listAssignmentSubmissions(){
        const {data,error}=await client.from("assignment_submissions").select("*, assignment:assignments(id,title,course_id), student:students(student_no, profiles(first_name,last_name,email))").order("submitted_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async submitAssignment({assignmentId,studentId,responseText,fileUrl=null}){
        const {data,error}=await client.from("assignment_submissions").insert({
          assignment_id:assignmentId,student_id:studentId,response_text:responseText,file_url:fileUrl
        }).select().single();
        if(error)throw error;return data;
      },
      async gradeAssignmentSubmission({submissionId,score,feedback,status="graded"}){
        const {data,error}=await client.rpc("grade_assignment_submission",{
          p_submission_id:submissionId,p_score:Number(score),p_feedback:feedback||null,p_status:status
        });
        if(error)throw error;return data;
      },
      async listQuizzes(){
        const {data,error}=await client.from("quizzes").select("*, course:courses(id,code,title)").order("created_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async createQuiz(payload){
        const {data,error}=await client.from("quizzes").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async updateQuiz(quizId,payload){
        const {data,error}=await client.from("quizzes").update(payload).eq("id",quizId).select().single();
        if(error)throw error;return data;
      },
      async listQuizQuestionsForStaff(quizId){
        const {data,error}=await client.from("quiz_questions").select("id,question,question_type,options,correct_answer,marks").eq("quiz_id",quizId);
        if(error)throw error;return data||[];
      },
      async createQuizQuestion(payload){
        const {data,error}=await client.from("quiz_questions").insert(payload).select().single();
        if(error)throw error;return data;
      },
      async getPublishedQuizQuestions(quizId){
        const {data,error}=await client.rpc("get_published_quiz_questions",{p_quiz_id:quizId});
        if(error)throw error;return Array.isArray(data)?data:[];
      },
      async submitQuizAttempt(quizId,answers){
        const {data,error}=await client.rpc("submit_quiz_attempt",{p_quiz_id:quizId,p_answers:answers});
        if(error)throw error;return data;
      },
      async listQuizAttempts(){
        const {data,error}=await client.from("quiz_attempts").select("*, quiz:quizzes(id,title,course_id)").order("completed_at",{ascending:false});
        if(error)throw error;return data||[];
      },
      async getBuiltinCourseManual(filename){
        const session=await backend.getSession();
        if(!session?.token&&!session?.access_token&&!session?.accessToken)throw new Error("Sign in to open course materials.");
        const token=session.token||session.access_token||session.accessToken;
        const response=await fetch("/api/course-assets/manual/"+encodeURIComponent(filename),{
          headers:{Authorization:"Bearer "+token},cache:"no-store"
        });
        if(!response.ok){
          const message=await response.text().catch(()=>"The course manual could not be opened.");
          throw new Error(message||"The course manual could not be opened.");
        }
        const blob=await response.blob();
        const pdfUrl=URL.createObjectURL(blob);
        protectedAssetUrls.add(pdfUrl);
        return {pdf_url:pdfUrl,source:"protected-bundle",file_name:filename};
      },
      async getCourseNarration(filename){
        const session=await backend.getSession();
        if(!session?.token&&!session?.access_token&&!session?.accessToken)throw new Error("Sign in to listen to the course narration.");
        const token=session.token||session.access_token||session.accessToken;
        const response=await fetch("/api/course-assets/narration/"+encodeURIComponent(filename),{
          headers:{Authorization:"Bearer "+token},cache:"no-store"
        });
        if(!response.ok){
          const message=await response.text().catch(()=>"This course narration is unavailable.");
          throw new Error(message||"This course narration is unavailable.");
        }
        return response.text();
      },
      async uploadCourseMaterial({courseId,title,file}){
        const session=await backend.getSession();
        if(!session?.user?.id)throw new Error("Sign in again before uploading.");
        const safeName=String(file.name||"course.pdf").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(0,150);
        const path=courseId+"/"+crypto.randomUUID()+"-"+safeName;
        const signed=await requestStorage({action:"upload",courseId,key:path,contentType:file.type||"application/pdf"});
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
