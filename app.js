const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const STORE={data:"ethan_data_v1"};
try{localStorage.removeItem("ethan_users_v1");localStorage.removeItem("ethan_session_v1");}catch(_){}
 
const seed = {
  students: [],
  instructors: [],
  courses: [],
  payments: [],
  enrolments: [],
  announcements: [],
  notifications: []
};

function loadData(){
  const saved = localStorage.getItem(STORE.data);
  if(saved){
    try{
      const parsed = JSON.parse(saved);
      const demoEmails = new Set(["amina@example.com","david@example.com","grace@example.com","parent@example.com"]);
      parsed.students = Array.isArray(parsed.students) ? parsed.students.filter(s=>!demoEmails.has(String(s.email||"").toLowerCase())) : [];
      parsed.instructors = Array.isArray(parsed.instructors) ? parsed.instructors.filter(i=>!["Samuel Adeyemi","Mariam Bello","Daniel Peter"].includes(i.name)) : [];
      parsed.payments = Array.isArray(parsed.payments) ? parsed.payments.filter(p=>!["Amina Yusuf","David Okoro","Grace Adewale"].includes(p.student)) : [];
      parsed.announcements = Array.isArray(parsed.announcements) ? parsed.announcements.filter(a=>a.title!=="Welcome to ETHAN ERP & LMS" && a.title!=="New cybersecurity course") : [];
      parsed.notifications = [];
      parsed.enrolments = Array.isArray(parsed.enrolments) ? parsed.enrolments : [];
      parsed.courses = Array.isArray(parsed.courses) ? parsed.courses.filter(c=>!["EDA-CYB-101","EDA-EXC-101","EDA-DMK-201","EDA-AIB-101","EDA-CAN-101","EDA-WEB-101"].includes(c.code)) : [];
      localStorage.setItem(STORE.data, JSON.stringify(parsed));
      return parsed;
    }catch(_){}
  }
  localStorage.setItem(STORE.data, JSON.stringify(seed));
  return structuredClone(seed);
}
let data = loadData();
data.enrolments = Array.isArray(data.enrolments) ? data.enrolments : [];
let currentUser = null;
let portalState = { myStudent:null, myEnrolments:[], myPayments:[], backendLoaded:false };
let currentPage = "dashboard";

function initials(name){return String(name||"").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("")||"EU";}
function resolveAuthenticatedRole(authUser,profile){
 const role=String(profile?.role||"student").trim().toLowerCase();
 return ["super_admin","admin","instructor","student"].includes(role)?role:"student";
}
function canonicalPortalRoleLabel(){return null;}
function portalUserFromAuth(authUser,profile){
 const authName=String(authUser?.name||"").trim().split(/\s+/);
 const firstName=profile?.first_name||authName[0]||"Ethan";
 const lastName=profile?.last_name||authName.slice(1).join(" ")||"User";
 return {firstName,lastName,name:(firstName+" "+lastName).trim(),email:authUser?.email||profile?.email||"",phone:profile?.phone||"",role:resolveAuthenticatedRole(authUser,profile),learnerType:profile?.learner_type||"student",id:authUser?.id};
}
function portalRoleLabel(user){
  if(user?.role==="student"){
    if(user?.learnerType==="professional") return "Professional";
    if(user?.learnerType==="business_owner") return "Business Owner";
    return "Student";
  }
  return String(user?.role||"student").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
}


// Staff register a free account first; authorised administrators can promote that account.


$$(".auth-tab").forEach(btn=>btn.addEventListener("click",()=>{
  $$(".auth-tab").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  $("#signinForm").classList.toggle("hidden", btn.dataset.authTab!=="signin");
  $("#signupForm").classList.toggle("hidden", btn.dataset.authTab!=="signup");
}));

$$(".toggle-password").forEach(btn=>btn.addEventListener("click",()=>{
  const input = document.getElementById(btn.dataset.target);
  input.type = input.type==="password" ? "text":"password";
  btn.textContent = input.type==="password" ? "Show":"Hide";
}));

$("#signupForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const firstName=$("#firstName").value.trim(),lastName=$("#lastName").value.trim();
 const email=$("#signupEmail").value.trim().toLowerCase(),phone=$("#signupPhone").value.trim();
 const learnerType=$("#signupRole").value,password=$("#signupPassword").value,confirm=$("#confirmPassword").value;
 const msg=$("#signupMessage");
 if(password!==confirm){msg.textContent="Passwords do not match.";msg.className="form-message error";return;}
 if(password.length<8){msg.textContent="Use a password with at least 8 characters.";msg.className="form-message error";return;}
 if(!window.ETHAN_BACKEND?.ready){msg.textContent=window.ETHAN_BACKEND?.error||"The secure sign-up service is unavailable. Refresh and try again.";msg.className="form-message error";return;}
 const button=$("#signupForm button[type='submit']");button.disabled=true;button.textContent="Creating free account…";
 try{
   const result=await window.ETHAN_BACKEND.signUp({email,password,firstName,lastName,phone,role:"student",learnerType});
   const profile=result.profile||await window.ETHAN_BACKEND.getProfile(result.user.id);
   const user=portalUserFromAuth(result.user,profile);
   $("#signupForm").reset();
   msg.textContent="Free account created. All 100 digital courses are now available.";
   msg.className="form-message success";
   await openPortal(user);
 }catch(err){msg.textContent=err.message||"Unable to create your free account. Please try again.";msg.className="form-message error";}
 finally{button.disabled=false;button.textContent="Create Account →";}
});

$("#signinForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const email=$("#signinEmail").value.trim().toLowerCase(),password=$("#signinPassword").value;
 const msg=$("#signinMessage"),button=$("#signinForm button[type='submit']");
 if(!window.ETHAN_BACKEND?.ready){msg.textContent=window.ETHAN_BACKEND?.error||"The secure sign-in service is unavailable. Refresh and try again.";msg.className="form-message error";return;}
 button.disabled=true;button.textContent="Signing in…";msg.textContent="";
 try{
   const result=await window.ETHAN_BACKEND.signIn(email,password);
   const profile=result.profile||await window.ETHAN_BACKEND.getProfile(result.user.id);
   await openPortal(portalUserFromAuth(result.user,profile));
 }catch(err){msg.textContent=err.message||"Unable to sign in. Check your email and password.";msg.className="form-message error";}
 finally{button.disabled=false;button.innerHTML='Sign In Securely <span>→</span>';}
});

$("#forgotPasswordBtn").addEventListener("click",()=>{
 showModal("Reset your password","Enter the email address on your free Ethan LMS account. We will send you a secure password reset link.",`
  <label>Email address<input id="resetEmail" type="email" autocomplete="email" placeholder="you@example.com" required></label>
 `,async()=>{
  const email=$("#resetEmail").value.trim().toLowerCase();
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return alert("Enter a valid email address.");
  if(!window.ETHAN_BACKEND?.ready)return alert(window.ETHAN_BACKEND?.error||"The secure password-reset service is unavailable.");
  try{await window.ETHAN_BACKEND.resetPassword(email);closeModal();alert("A password reset link has been sent. Open the link in the email to choose a new password. The link expires after 15 minutes.");}
  catch(err){alert(err.message||"Unable to send the password reset email.");}
 });
});

$("#logoutBtn").addEventListener("click",async ()=>{
  if(window.ETHAN_BACKEND?.ready){ try{ await window.ETHAN_BACKEND.signOut(); }catch(_){} }
  currentUser=null; $("#portal").classList.add("hidden"); $("#authScreen").classList.remove("hidden");
});

$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#notificationBtn").addEventListener("click",()=>$("#notificationPanel").classList.toggle("hidden"));
$("#closeNotif").addEventListener("click",()=>$("#notificationPanel").classList.add("hidden"));

$("#globalSearch").addEventListener("keydown", e=>{
  if(e.key!=="Enter") return;
  const q=e.target.value.toLowerCase().trim();
  if(!q) return;
  const match=data.courses.find(c=>String(c.title||"").toLowerCase().includes(q)) || data.students.find(s=>String(s.name||"").toLowerCase().includes(q));
  if(match) alert(`Found: ${match.title || match.name}`);
  else alert("No matching learner or course was found.");
});

const adminNav = [
  ["dashboard","▦","Dashboard"],["students","👥","Learners"],["instructors","🧑‍🏫","Instructors"],["staff","🛡","Staff Management"],
  ["courses","📚","Courses"],["lms","▶","LMS"],["assignments","📝","Assignments"],["quizzes","✅","Quizzes"],
  ["attendance","📅","Attendance"],["timetable","🕒","Timetable"],["payments","💳","Fees & Payments"],
  ["results","📊","Results"],["certificates","🎓","Certificates"],["announcements","📣","Announcements"],["reports","📈","Reports"],["settings","⚙","Settings"]
];
const navByRole = {
  super_admin: [...adminNav.slice(0,5), ["course-upload","⬆","Upload Course"], ...adminNav.slice(5)],
  admin: adminNav,
  student:[
    ["dashboard","▦","Dashboard"],["courses","📚","My Courses"],["lms","▶","Continue Learning"],["assignments","📝","Assignments"],
    ["quizzes","✅","Quizzes & Exams"],["attendance","📅","Attendance"],["results","📊","Results"],["certificates","🎓","Certificates"],["announcements","📣","Announcements"],["profile","👤","Profile"]
  ],
  parent:[
    ["dashboard","▦","Dashboard"],["students","👥","My Children"],["attendance","📅","Attendance"],["payments","💳","Fees & Payments"],
    ["results","📊","Results"],["announcements","📣","Announcements"],["profile","👤","Profile"]
  ],
  instructor:[
    ["dashboard","▦","Dashboard"],["courses","📚","My Courses"],["lms","▶","Course Builder"],["students","👥","My Students"],
    ["assignments","📝","Assignments"],["quizzes","✅","Quizzes"],["attendance","📅","Attendance"],["results","📊","Results"],["announcements","📣","Announcements"],["profile","👤","Profile"]
  ]
};

async function openPortal(user){
 currentUser=user;
 $("#authScreen").classList.add("hidden");$("#portal").classList.remove("hidden");
 $("#userName").textContent=user.name;$("#userRole").textContent=portalRoleLabel(user);
 $("#userAvatar").textContent=initials(user.name);
 await hydratePortalData(user);renderNav();renderNotifications();navigate("dashboard");
}
 
async function hydratePortalData(user){
  portalState={myStudent:null,myEnrolments:[],myPayments:[],backendLoaded:false};
  if(window.ETHAN_BACKEND?.ready){
    try{
      if(user.role==="student"){
        portalState.myStudent=await window.ETHAN_BACKEND.getStudentByUserId(user.id);
        if(portalState.myStudent){
          portalState.myEnrolments=await window.ETHAN_BACKEND.listStudentEnrolments(portalState.myStudent.id);
          portalState.myPayments=await window.ETHAN_BACKEND.listMyPayments(portalState.myStudent.id);
        }
      } else if(["admin","super_admin","instructor"].includes(user.role)){
        const [students,courses] = await Promise.all([
          window.ETHAN_BACKEND.listStudents(),
          window.ETHAN_BACKEND.listCourses()
        ]);
        if(Array.isArray(students)) data.students=students.map(s=>({
          id:s.id, studentNo:s.student_no, name:[s.profiles?.first_name,s.profiles?.last_name].filter(Boolean).join(" ")||s.student_no||"Learner",
          email:s.profiles?.email||"", program:"Awaiting allocation", status:s.status||"Active", progress:0, payment:"Unpaid", userId:s.user_id
        }));
        if(Array.isArray(courses)) data.courses=courses.map(c=>({
          id:c.id,code:c.code,title:c.title,category:c.difficulty||"Course",instructor:"Assigned by academy",
          duration:c.duration||"Self-paced",progress:0,lessons:0,completed:0,fee:Number(c.fee||0),published:c.published
        }));
        if(user.role==="admin" || user.role==="super_admin"){
          try{
            const [staff,payments] = await Promise.all([
              window.ETHAN_BACKEND.listStaff(),
              window.ETHAN_BACKEND.listPayments()
            ]);
            data.instructors = (staff||[]).filter(x=>x.role==="instructor").map((x,i)=>({
              id:x.id||`EDA-IN-${String(i+1).padStart(3,"0")}`,
              name:[x.first_name,x.last_name].filter(Boolean).join(" ")||"Instructor",
              email:x.email||"", specialization:"Assigned courses", courses:0, status:"Active"
            }));
            data.payments = (payments||[]).map(p=>({
              ref:p.reference, student:p.students?.profiles ? [p.students.profiles.first_name,p.students.profiles.last_name].filter(Boolean).join(" ") : "Learner",
              studentId:p.student_id, description:p.description||"Training Fee", amount:Number(p.amount||0),
              date:p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—",
              status:p.verified ? "Verified" : "Pending"
            }));
          }catch(_){}
        }
      }
      try{
        const announcements=await window.ETHAN_BACKEND.listAnnouncements();
        data.announcements=(announcements||[]).map(a=>({id:a.id,title:a.title,message:a.message,date:a.created_at?new Date(a.created_at).toLocaleDateString():""}));
      }catch(_){}
      try{
        const notifications=await window.ETHAN_BACKEND.listMyNotifications();
        data.notifications=(notifications||[]).map(n=>({title:n.title,message:n.message,time:n.created_at?new Date(n.created_at).toLocaleString():""}));
      }catch(_){}
      portalState.backendLoaded=true;
    }catch(err){ console.warn("Portal data could not be fully loaded",err); }
  }else if(user.role==="student"){
    portalState.myStudent=data.students.find(s=>(s.email||"").toLowerCase()===user.email.toLowerCase())||null;
    const sid=portalState.myStudent?.id;
    portalState.myEnrolments=data.enrolments.filter(e=>e.studentId===sid).map(e=>({ ...e, course:data.courses.find(c=>(c.id||c.code)===e.courseId || c.code===e.courseCode) })).filter(e=>e.course);
  }
}

function studentEnrolments(){ return currentUser?.role==="student" ? (portalState.myEnrolments||[]) : []; }
function studentCourses(){
 const enrolled=studentEnrolments().map(e=>e.course).filter(Boolean);
 if(enrolled.length)return enrolled;
 return (ETHAN_PUBLIC_COURSES||[]).map((course,index)=>({
  id:"free-course-"+(index+1),code:"EDA-"+String(index+1).padStart(3,"0"),
  title:course.name,description:course.brief,duration:"Self-paced",
  fee:0,published:true,progress:0,lessons:0,completed:0
 }));
}
function emptyState(title,message,action=""){ return `<div class="card" style="text-align:center;padding:34px"><h3>${title}</h3><p class="muted" style="max-width:620px;margin:8px auto 18px">${message}</p>${action}</div>`; }
function renderNav(){
  const role=currentUser.role==="admin"?"admin":currentUser.role;
  const nav=navByRole[role]||navByRole.student;
  $("#sideNav").innerHTML=nav.map(([id,icon,label])=>`<button class="nav-item" data-page="${id}"><span>${icon}</span><span>${label}</span></button>`).join("");
  $$("#sideNav .nav-item").forEach(b=>b.addEventListener("click",()=>{navigate(b.dataset.page);$("#sidebar").classList.remove("open")}));
}
function navigate(page){
  currentPage=page;
  $$("#sideNav .nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const label=($("#sideNav .nav-item.active span:last-child")||{}).textContent || "Dashboard";
  $("#pageTitle").textContent=label; $("#pageEyebrow").textContent=portalRoleLabel(currentUser).toUpperCase()+" PORTAL";
  const renderers={dashboard:renderDashboard,students:renderStudents,parents:renderParents,instructors:renderInstructors,staff:renderStaff,courses:renderCourses,lms:renderLMS,assignments:renderAssignments,quizzes:renderQuizzes,attendance:renderAttendance,timetable:renderTimetable,payments:renderPayments,results:renderResults,certificates:renderCertificates,announcements:renderAnnouncements,reports:renderReports,settings:renderSettings,profile:renderProfile,"course-upload":renderCourseUpload};
  (renderers[page]||renderDashboard)();
}

function stat(label,value,sub,icon){return `<div class="stat-card"><div class="stat-icon">${icon}</div><div><small class="stat-label">${label}</small><strong class="stat-value">${value}</strong><span class="stat-sub">${sub}</span></div></div>`}
function pageHead(title,desc,action=""){return `<div class="page-title-block"><div class="toolbar"><div><h1>${title}</h1><p class="muted">${desc}</p></div>${action}</div></div>`}

function renderDashboard(){
  const role=currentUser.role;
  if(role==="admin" || role==="super_admin"){
    $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">ACADEMY OVERVIEW</span><h1>Welcome back, ${currentUser.firstName}</h1><p>Manage learners, courses, finance and academic operations from one place.</p></div><div class="hero-actions"><button class="secondary-btn" onclick="navigate('students')">Manage Students</button><button class="secondary-btn" onclick="navigate('courses')">Manage Courses</button></div></div>
      <div class="stats-grid">${stat("Total Students",data.students.length,"Active learner records","👥")}${stat("Active Courses",data.courses.length,"Published catalogue","📚")}${stat("Instructors",data.instructors.length,"Teaching staff","🧑‍🏫")}${stat("Payments","₦175,000","Recent confirmed","💳")}</div>
      <div class="dashboard-grid">
        <div class="card"><div class="card-head"><h3>Student Progress</h3><button class="text-btn" onclick="navigate('students')">View students</button></div><div class="progress-list">${data.students.map(s=>`<div class="progress-row"><div class="progress-top"><strong>${s.name}</strong><span>${s.progress}%</span></div><small class="muted">${s.program}</small><div class="progress"><span style="width:${s.progress}%"></span></div></div>`).join("")}</div></div>
        <div class="card"><div class="card-head"><h3>Quick Actions</h3></div><div class="quick-grid">${[["Add Student","students"],["Create Course","courses"],["Record Payment","payments"],["Mark Attendance","attendance"],["Publish Result","results"],["Issue Certificate","certificates"]].map(([a,p])=>`<div class="quick-card" onclick="navigate('${p}')"><strong>${a}</strong><p class="muted">Open module</p></div>`).join("")}</div></div>
      </div>`;
  } else if(role==="student"){
    const courses=studentCourses();
    const average=courses.length?Math.round(courses.reduce((n,c)=>n+Number(c.progress||0),0)/courses.length):0;
    $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">STUDENT PORTAL</span><h1>Welcome back, ${currentUser.firstName}</h1><p>${courses.length?"Your free course access is active. Continue learning below.":"Your account is ready. Course access opens only after you create a free account your course."}</p></div><button class="secondary-btn" onclick="navigate('${courses.length?"lms":"payments"}')">${courses.length?"Continue Learning":"View Payment Status"}</button></div>
      <div class="stats-grid">${stat("My Courses",String(courses.length),courses.length?"Allocated courses":"Courses available","📚")}${stat("Average Progress",average+"%",courses.length?"Across allocated courses":"Starts after allocation","📈")}${stat("Assignments","0",courses.length?"Published assignments appear here":"No active course","📝")}${stat("Certificates","0","Issued after successful completion","🎓")}</div>
      ${courses.length?`<div class="card"><div class="card-head"><h3>My Course Progress</h3></div><div class="progress-list">${courses.map(c=>`<div class="progress-row"><div class="progress-top"><strong>${c.title}</strong><span>${Number(c.progress||0)}%</span></div><small class="muted">${c.duration||"Self-paced"}</small><div class="progress"><span style="width:${Number(c.progress||0)}%"></span></div></div>`).join("")}</div></div>`:emptyState("Browse the free course catalogue","Registration does not automatically enrol you in a course. Once your payment is confirmed, Admin will allocate the exact course you paid for and your lessons/videos will become available.",`<button class="primary-btn" onclick="navigate('payments')">Payment & Course Access</button>`)}`;
  } else if(role==="parent"){
    $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">PARENT PORTAL</span><h1>Welcome, ${currentUser.firstName}</h1><p>Follow your child's learning progress, attendance, results and fees.</p></div></div>
      <div class="stats-grid">${stat("Linked Children","1","Student account","👥")}${stat("Attendance","94%","This month","📅")}${stat("Overall Progress","72%","Current term","📈")}${stat("Outstanding","₦35,000","Fee balance","💳")}</div>
      ${studentTable(data.students.slice(0,1))}`;
  } else {
    $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">INSTRUCTOR PORTAL</span><h1>Welcome, ${currentUser.firstName}</h1><p>Manage teaching, lessons, assignments, attendance and student performance.</p></div><button class="secondary-btn" onclick="navigate('lms')">Open Course Builder</button></div>
      <div class="stats-grid">${stat("My Courses","3","Assigned courses","📚")}${stat("My Students","48","Active learners","👥")}${stat("To Grade","8","Submissions","📝")}${stat("Today's Classes","2","Scheduled","🕒")}</div>
      <div class="card"><div class="card-head"><h3>Assigned Courses</h3></div>${courseCards(data.courses.slice(0,3))}</div>`;
  }
}

function studentTable(list){
 return `<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Student ID</th><th>Name</th><th>Program</th><th>Progress</th><th>Payment</th><th>Status</th></tr></thead><tbody>${list.map(s=>`<tr><td>${s.id}</td><td><strong>${s.name}</strong><br><small class="muted">${s.email}</small></td><td>${s.program}</td><td>${s.progress}%</td><td><span class="badge ${s.payment==="Paid"?"green":"gold"}">${s.payment}</span></td><td><span class="badge green">${s.status}</span></td></tr>`).join("")}</tbody></table></div></div>`;
}
function renderStudents(){
  const list=currentUser.role==="student" ? [] : data.students;
  $("#content").innerHTML=pageHead("Learners","Registered learner accounts. New learners create their own account from the public Create Account tab.")+
    (list.length?studentTable(list):emptyState("No learner records yet","Registered Students, Professionals and Business Owners will appear here."));
}
function showStudentModal(){
 showModal("Add Student","Create a new student record.",`
  <div class="grid-2"><label>Full name<input id="mStudentName"></label><label>Email<input id="mStudentEmail" type="email"></label></div>
  <div class="grid-2"><label>Programme<input id="mStudentProgram"></label><label>Payment status<select id="mStudentPayment"><option>Unpaid</option><option>Part Paid</option><option>Paid</option></select></label></div>
 `,()=>{
   const name=$("#mStudentName").value.trim(), email=$("#mStudentEmail").value.trim(), program=$("#mStudentProgram").value.trim();
   if(!name||!email||!program) return alert("Please complete all fields.");
   data.students.push({id:`EDA-ST-${String(data.students.length+1).padStart(4,"0")}`,name,email,program,status:"Active",progress:0,payment:$("#mStudentPayment").value});
   persist(); closeModal(); renderStudents();
 });
}
function renderParents(){
 $("#content").innerHTML=pageHead("Parents & Guardians","Manage parent accounts and linked students.",`<button class="primary-btn">+ Add Parent</button>`)+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Parent</th><th>Email</th><th>Linked Students</th><th>Status</th></tr></thead><tbody>
 <tr><td><strong>Mrs. Yusuf</strong></td><td>parent@example.com</td><td>Amina Yusuf</td><td><span class="badge green">Active</span></td></tr>
 </tbody></table></div></div>`;
}
function renderInstructors(){
 const rows=data.instructors||[];
 $("#content").innerHTML=pageHead("Instructors","View instructor accounts and teaching staff.",`<button class="primary-btn" id="manageInstructorStaffBtn">Manage Staff Accounts</button>`)+
 (rows.length?`<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Specialization</th><th>Status</th></tr></thead><tbody>${rows.map(i=>`<tr><td><strong>${i.name}</strong></td><td>${i.email||"—"}</td><td>${i.specialization||"Assigned courses"}</td><td><span class="badge green">${i.status||"Active"}</span></td></tr>`).join("")}</tbody></table></div></div>`:emptyState("No instructor accounts yet","Create Instructor accounts securely from Staff Management."));
 $("#manageInstructorStaffBtn").onclick=()=>navigate("staff");
}
async function renderStaff(){
 if(!["admin","super_admin"].includes(currentUser.role)){
  $("#content").innerHTML=emptyState("Access restricted","Only Admin and Super Admin can manage staff accounts.");return;
 }
 let staff=[];try{if(window.ETHAN_BACKEND?.ready)staff=await window.ETHAN_BACKEND.listStaff();}catch(err){console.warn(err);}
 const allowed=currentUser.role==="super_admin"?["admin","instructor"]:["instructor"];
 $("#content").innerHTML=pageHead("Staff Management","Promote an existing free Ethan LMS account to an authorised staff role.",'<button class="primary-btn" id="createStaffBtn">+ Assign Staff Role</button>')+
 `<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>${staff.length?staff.map(x=>`<tr><td><strong>${[x.first_name,x.last_name].filter(Boolean).join(" ")||"Staff User"}</strong></td><td>${x.email||"—"}</td><td><span class="badge blue">${String(x.role||"").replace("_"," ")}</span></td><td><span class="badge green">Active</span></td></tr>`).join(""):`<tr><td colspan="4">No staff records loaded yet.</td></tr>`}</tbody></table></div></div>`;
 $("#createStaffBtn").onclick=()=>showModal("Assign Staff Role","The person must first create a free account on this login page. Enter the same account email here to promote it.",`
  <label>Registered email address<input id="staffEmail" type="email" required></label>
  <label>Role<select id="staffRole">${allowed.map(r=>`<option value="${r}">${r==="admin"?"Admin":"Instructor"}</option>`).join("")}</select></label>
  <p class="muted">The user keeps their own password. No temporary password is created or shared.</p>
 `,async()=>{
  const email=$("#staffEmail").value.trim().toLowerCase(),role=$("#staffRole").value;
  if(!email)return alert("Enter the registered email address.");
  try{await window.ETHAN_BACKEND.createStaff({email,role});closeModal();alert(role==="admin"?"Admin role assigned.":"Instructor role assigned.");renderStaff();}
  catch(err){alert(err.message||"The staff role could not be assigned.");}
 });
}

/* v8.8 - Structured readable study notes for every course */
let currentStudyCourseTitle = "";

function escHtml(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

function courseProfile(title){
 const t=String(title||"").toLowerCase();
 let domain="digital technology";
 let definition=`${title} is a structured professional subject that develops the knowledge, methods and practical skills needed to use its concepts effectively in academic, workplace and business environments.`;
 let concepts=["Foundations and terminology","Purpose and professional applications","Core tools and features","Planning and workflow","Practical implementation","Quality control","Common mistakes","Performance measurement","Professional best practice","Continuous improvement"];
 let tools=["Relevant computer or mobile application","Practice files and guided exercises","Internet access where required","Spreadsheet or documentation tool for recording work"];
 let scenario=`Ethan Digital Academy wants to apply ${title} to improve a real learning, workplace or business process. The learner must identify the problem, define the objective, choose appropriate tools, complete the work, measure the result and recommend improvements.`;

 if(/digital marketing/.test(t)){
   domain="digital marketing";
   definition="Digital marketing is the planned use of digital channels, content, technology and measurable data to attract, engage, convert and retain customers.";
   concepts=["Customer and audience research","Marketing objectives and SMART goals","Digital marketing funnel","Content strategy and content pillars","Search engine optimization (SEO)","Social media marketing","Email marketing","Paid media fundamentals","Landing pages and conversion","Analytics, KPIs and optimization"];
   tools=["Website or landing page","Search and SEO tools","Social media platforms","Email marketing platform","Canva or another design tool","Spreadsheet or analytics dashboard"];
 } else if(/excel|google sheets|data|power bi|statistics|dashboard|reporting|business intelligence/.test(t)){
   domain="data and analytics";
   definition=`${title} develops the ability to organize, calculate, analyze, interpret and present information so that data can support reliable decisions.`;
   concepts=["Data structure","Accurate data entry","Cleaning and validation","Calculations and measures","Sorting and filtering","Analysis","Visualization","Dashboards","Interpretation","Reporting and decision-making"];
   tools=["Microsoft Excel, Google Sheets or the relevant analytics tool","Practice datasets","Calculator where appropriate","Reporting template"];
 } else if(/word|document/.test(t)){
   domain="document productivity";
   definition=`${title} focuses on creating, formatting, reviewing and presenting professional documents accurately and consistently.`;
   concepts=["Document planning","Page setup","Text formatting","Styles and hierarchy","Tables and objects","Headers and footers","Review and collaboration","References","Export and printing","Document standards"];
   tools=["Microsoft Word or compatible word processor","Practice documents","PDF reader"];
 } else if(/powerpoint|presentation/.test(t)){
   domain="professional presentation";
   definition=`${title} is the structured use of slides, text, visuals and delivery techniques to communicate information clearly to an audience.`;
   concepts=["Audience and purpose","Message hierarchy","Slide structure","Typography","Visual communication","Charts and media","Transitions","Speaker preparation","Accessibility","Presentation review"];
   tools=["Microsoft PowerPoint or compatible presentation software","Image/chart resources","Presentation display where available"];
 } else if(/canva|graphic|photoshop|coreldraw|logo|brand|figma|ui\/ux/.test(t)){
   domain="creative design";
   definition=`${title} applies visual communication principles and digital tools to create clear, attractive and purposeful designs.`;
   concepts=["Design purpose","Audience","Visual hierarchy","Typography","Colour","Alignment and spacing","Images and graphics","Brand consistency","Usability","Export and quality control"];
   tools=["Relevant design application","Brand assets","Image resources","Practice design brief"];
 } else if(/video|capcut|photography|storytelling|content creation/.test(t)){
   domain="digital media production";
   definition=`${title} covers the planning, creation, editing and delivery of visual or audiovisual media for education, communication or marketing.`;
   concepts=["Purpose and audience","Pre-production planning","Composition","Lighting","Audio","Editing","Story structure","Captions","Publishing formats","Performance review"];
   tools=["Phone or camera","Relevant editing application","Microphone where available","Media storage"];
 } else if(/facebook|instagram|tiktok|youtube|linkedin|social media|whatsapp|content marketing|email marketing|influencer|affiliate|personal branding|reputation/.test(t)){
   domain="online marketing and communication";
   definition=`${title} is the planned use of relevant digital communication channels to reach a defined audience, build relationships and support measurable objectives.`;
   concepts=["Audience research","Account or channel optimization","Content strategy","Content pillars","Publishing formats","Community engagement","Calls to action","Lead generation","Analytics","Optimization"];
   tools=["Relevant platform","Content calendar","Design/video tool","Analytics dashboard","Spreadsheet"];
 } else if(/seo|search engine|google ads|meta ads|marketing analytics/.test(t)){
   domain="performance marketing";
   definition=`${title} uses structured research, digital platforms and measurable performance data to improve online visibility, traffic, leads or conversions.`;
   concepts=["Search or audience intent","Research","Campaign objectives","Targeting","Content or creative","Landing experience","Measurement","KPIs","Optimization","Reporting"];
   tools=["Relevant advertising/search platform","Analytics tool","Website or landing page","Spreadsheet"];
 } else if(/artificial intelligence|ai |chatgpt|prompt engineering|generative/.test(t)){
   domain="artificial intelligence";
   definition=`${title} develops practical understanding of AI systems and how they can be used responsibly to support research, productivity, content and business workflows.`;
   concepts=["AI capabilities and limitations","Prompt design","Context","Output evaluation","Fact checking","Privacy","Responsible use","Workflow integration","Automation","Human review"];
   tools=["Approved AI assistant","Source documents","Productivity tools","Verification sources"];
 } else if(/python|javascript|programming|software development|api|git|github/.test(t)){
   domain="software and programming";
   definition=`${title} develops structured problem-solving skills for creating, understanding, testing or managing software and digital systems.`;
   concepts=["Problem definition","Logic","Data and variables","Conditions","Repetition","Functions","Input and output","Testing","Debugging","Documentation"];
   tools=["Code editor","Browser or relevant runtime","Practice exercises","Version-control tools where relevant"];
 } else if(/web|html|css|wordpress|e-commerce website|landing page|hosting|domain/.test(t)){
   domain="web technology";
   definition=`${title} covers the planning, creation, publication and maintenance of useful web-based information or services.`;
   concepts=["Purpose and audience","Information architecture","Page structure","Content","Responsive design","Usability","Domains and hosting","Security","Performance","Maintenance"];
   tools=["Browser","Code editor or website builder","Hosting environment where required","Testing checklist"];
 } else if(/cybersecurity|security|hardware|maintenance|it support|windows|file management|cloud storage|computer/.test(t)){
   domain="IT and digital operations";
   definition=`${title} develops practical knowledge for using, supporting, maintaining or protecting computer systems and digital information effectively.`;
   concepts=["System components","User needs","Configuration","Safe operation","Troubleshooting","Maintenance","Security","Backups","Documentation","Support procedure"];
   tools=["Computer","Operating-system tools","Relevant utilities","Practice checklist"];
 } else if(/business|entrepreneur|freelanc|remote work|project management|crm|erp|e-commerce/.test(t)){
   domain="digital business";
   definition=`${title} applies structured processes, digital tools and measurable decisions to improve professional or business performance.`;
   concepts=["Business objective","Customer or stakeholder needs","Process mapping","Digital tools","Roles and responsibilities","Records","Communication","KPIs","Risk and quality","Continuous improvement"];
   tools=["Productivity suite","Spreadsheet","Communication tools","Relevant business platform"];
 }

 return {
   domain,definition,concepts,tools,
   example:`A learner is given a realistic ${title} assignment. The learner first defines the required result, selects the appropriate tools, completes the task step by step, checks the work against professional standards and records the final outcome.`,
   caseStudy:`ETHAN DIGITAL ACADEMY — ${title.toUpperCase()} CASE STUDY

Situation:
Ethan Digital Academy wants to use ${title} to improve a realistic academic, professional or business activity.

Problem:
The current activity needs a clearer structure, better use of digital tools and a measurable way to judge success.

Objective:
Apply the principles of ${title} to produce a professional result that solves the identified problem.

Target users or stakeholders:
1. Learners who need practical digital competence.
2. Professionals who need efficient workplace methods.
3. Business owners who need better digital processes and measurable outcomes.

Approach:
- Define the problem and expected result.
- Identify the people affected by the work.
- Select the relevant ${title} concepts and tools.
- Plan the work before implementation.
- Complete the task using accepted professional practice.
- Check accuracy, usability, clarity and safety.
- Record evidence of the completed work.
- Measure the result using suitable indicators.
- Recommend improvements.

Evidence to collect:
Completed work, screenshots where appropriate, calculations or records, observations, decisions and a short evaluation.

Evaluation:
Success is determined by whether the completed work meets the original objective, is accurate and professional, and produces a useful result for the intended user. The learner should explain what worked, what did not work and what should be improved next time.`
 };
}
function buildCourseStudyGuide(title){
 const p=courseProfile(title);
 return {
   title,
   introduction:`This professional course introduces ${title} through structured explanation, guided examples, case-study analysis and practical application. Learners are expected to understand the subject, apply it to realistic tasks and evaluate the quality of their work. The course is designed for paid Ethan Digital Academy enrollees and connects knowledge directly to academic, workplace and business use.`,
   definition:p.definition,
   objectives:[
     `Explain the meaning, purpose and professional importance of ${title}.`,
     `Identify and explain the major concepts used in ${title}.`,
     `Select appropriate tools and resources for a ${title} task.`,
     `Plan a realistic ${title} activity before implementation.`,
     `Apply the correct workflow to complete a professional task.`,
     `Evaluate completed work using accuracy, clarity, usability and other relevant standards.`,
     `Recognize common mistakes, risks and weak practices in ${title}.`,
     `Use evidence and appropriate performance indicators to measure results.`,
     `Complete a practical ${title} project and explain the decisions made.`,
     `Recommend improvements after reviewing the final result.`
   ],
   concepts:p.concepts,
   tools:p.tools,
   example:p.example,
   caseStudy:p.caseStudy,
   practical:[
     `Choose a realistic academic, workplace or business problem connected to ${title}.`,
     "Write a clear objective and describe the expected result.",
     "Identify the intended user, customer or stakeholder.",
     `Select at least five relevant ${title} concepts from this course.`,
     "List the tools and resources required for the work.",
     "Create a short implementation plan before starting.",
     "Complete the practical work step by step.",
     "Keep suitable evidence such as screenshots, records, calculations, observations or design decisions.",
     "Check the final work for accuracy, clarity, usability and professionalism.",
     "Write a short evaluation explaining the result and at least three improvements."
   ],
   assessment:[
     `Define ${title} in your own words and explain why it is important.`,
     `Describe five important concepts used in ${title}.`,
     "Explain how you would choose the correct tools for a practical task.",
     `Give one realistic professional or business use of ${title}.`,
     "State three common mistakes that can reduce the quality of completed work.",
     "Explain how evidence or KPIs can be used to evaluate a result.",
     `Using the Ethan Digital Academy case study, explain the problem, objective, approach and expected result.`,
     `Prepare a one-page plan for a practical ${title} project.`
   ],
   summary:`${title} should be understood as both knowledge and practical competence. A professional learner must understand the terminology, plan the work, use appropriate tools, follow a clear process, check the quality of the output and evaluate the final result. Repeated practice and evidence-based improvement are essential to mastery.`
 };
}
function renderGuideHtml(g){
  const list=a=>`<ul>${a.map(x=>`<li>${escHtml(x)}</li>`).join("")}</ul>`;
  return `
    <header class="study-cover">
      <span class="eyebrow">ETHAN DIGITAL ACADEMY STUDY NOTE</span>
      <h1>${escHtml(g.title)}</h1>
      <p>Structured learning material for enrolled learners.</p>
    </header>
    <section><h2>1. Introduction</h2><p>${escHtml(g.introduction)}</p></section>
    <section><h2>2. Definition</h2><p>${escHtml(g.definition)}</p></section>
    <section><h2>3. Learning Objectives</h2>${list(g.objectives)}</section>
    <section><h2>4. Key Concepts</h2>${list(g.concepts)}</section>
    ${g.tools.length?`<section><h2>5. Tools and Resources</h2>${list(g.tools)}</section>`:""}
    <section><h2>${g.tools.length?"6":"5"}. Worked Example</h2><p>${escHtml(g.example)}</p></section>
    <section><h2>${g.tools.length?"7":"6"}. Case Study</h2><div class="study-case">${escHtml(g.caseStudy).replace(/\n/g,"<br>")}</div></section>
    <section><h2>${g.tools.length?"8":"7"}. Practical Activity</h2>${list(g.practical)}</section>
    <section><h2>${g.tools.length?"9":"8"}. Review Questions / Assessment</h2>${list(g.assessment)}</section>
    <section><h2>${g.tools.length?"10":"9"}. Summary</h2><p>${escHtml(g.summary)}</p></section>
  `;
}

const BUILTIN_COURSE_MATERIALS = {
  "computer appreciation":"./assets/course-materials/Computer-Appreciation-EDA-COM-101.pdf",
  "microsoft word":"./assets/course-materials/Microsoft-Word-EDA-WRD-102.pdf",
  "microsoft excel":"./assets/course-materials/Microsoft-Excel-EDA-EXC-103.pdf",
  "microsoft powerpoint":"./assets/course-materials/Microsoft-PowerPoint-EDA-PPT-104.pdf",
  "microsoft access":"./assets/course-materials/Microsoft-Access-EDA-ACC-105.pdf",
  "google workspace":"./assets/course-materials/Google-Workspace-EDA-GWS-106.pdf",
  "internet & email skills":"./assets/course-materials/Internet-Email-Skills-EDA-IES-107.pdf",
  "typing & keyboard mastery":"./assets/course-materials/Typing-Keyboard-Mastery-EDA-TYP-108.pdf",
  "typing & keyboarding skills":"./assets/course-materials/Typing-Keyboard-Mastery-EDA-TYP-108.pdf",
  "computer hardware fundamentals":"./assets/course-materials/Computer-Hardware-Fundamentals-EDA-HDW-109.pdf",
  "computer maintenance":"./assets/course-materials/Computer-Maintenance-EDA-MNT-110.pdf",
  "windows productivity":"./assets/course-materials/Windows-Productivity-EDA-WIN-112.pdf",
  "file management & cloud storage":"./assets/course-materials/File-Management-Cloud-Storage-EDA-FCS-113.pdf",
  "it support fundamentals":"./assets/course-materials/IT-Support-Fundamentals-EDA-ITS-111.pdf",
  "digital literacy":"./assets/course-materials/Digital-Literacy-EDA-DLT-115.pdf",
  "canva graphic design":"./assets/course-materials/Canva-Graphic-Design-EDA-CGD-116.pdf",
  "advanced canva design":"./assets/course-materials/Advanced-Canva-Design-EDA-ACD-117.pdf",
  "adobe photoshop basics":"./assets/course-materials/Adobe-Photoshop-Basics-EDA-PSB-118.pdf",
  "coreldraw essentials":"./assets/course-materials/CorelDRAW-Essentials-EDA-CDR-119.pdf",
  "brand identity design":"./assets/course-materials/Brand-Identity-Design-EDA-BID-120.pdf",
  "social media graphics":"./assets/course-materials/Social-Media-Graphics-EDA-SMG-121.pdf",
  "flyer & poster design":"./assets/course-materials/Flyer-Poster-Design-EDA-FPD-122.pdf",
  "flyer and poster design":"./assets/course-materials/Flyer-Poster-Design-EDA-FPD-122.pdf",
  "logo design fundamentals":"./assets/course-materials/Logo-Design-Fundamentals-EDA-LDF-123.pdf",
  "ui/ux design fundamentals":"./assets/course-materials/UI-UX-Design-Fundamentals-EDA-UIX-124.pdf",
  "ui ux design fundamentals":"./assets/course-materials/UI-UX-Design-Fundamentals-EDA-UIX-124.pdf",
  "cybersecurity awareness":"./assets/course-materials/Cybersecurity-Fundamentals-EDA-CYB-114.pdf",
  "cybersecurity fundamentals":"./assets/course-materials/Cybersecurity-Fundamentals-EDA-CYB-114.pdf",
  "digital marketing":"./assets/course-materials/Digital-Marketing-EDA-DMK-130.pdf",
  "digital marketing strategy":"./assets/course-materials/Digital-Marketing-EDA-DMK-130.pdf",
  "python for beginners":"./assets/course-materials/Coding-Programming-Fundamentals-EDA-COD-171.pdf",
  "software development basics":"./assets/course-materials/Coding-Programming-Fundamentals-EDA-COD-171.pdf",
  "coding & programming fundamentals":"./assets/course-materials/Coding-Programming-Fundamentals-EDA-COD-171.pdf",
  "coding and programming fundamentals":"./assets/course-materials/Coding-Programming-Fundamentals-EDA-COD-171.pdf",
  "figma for beginners":"./assets/course-materials/Figma-for-Beginners-EDA-FIG-125.pdf",
  "capcut video editing":"./assets/course-materials/CapCut-Video-Editing-EDA-CVE-126.pdf",
  "advanced video editing":"./assets/course-materials/Advanced-Video-Editing-EDA-AVE-127.pdf"
};
function builtinCourseMaterial(title){ return BUILTIN_COURSE_MATERIALS[String(title||"").trim().toLowerCase()] || ""; }

async function resolveCourseMaterial(title){
  const built=builtinCourseMaterial(title); if(built) return {pdf_url:built,source:"bundled"};
  try{ if(window.ETHAN_BACKEND?.getCourseMaterial) return await window.ETHAN_BACKEND.getCourseMaterial(title); }catch(e){ console.warn(e); }
  return null;
}

async function renderCourseUpload(){
  if(!isSuperAdmin()){ $("#content").innerHTML=emptyState("Access restricted","Only the Super Admin can upload full course study materials."); return; }
  const options=data.courses.slice().sort((a,b)=>String(a.title).localeCompare(String(b.title))).map(c=>`<option value="${escHtml(c.id||c.code||c.title)}">${escHtml(c.code||"")} — ${escHtml(c.title)}</option>`).join("");
  $("#content").innerHTML=pageHead("Upload Course","Upload the complete paid-enrollee PDF study manual and attach it to a course.")+`
  <div class="card"><div class="card-head"><h3>Full Course Study Material</h3></div>
  <div class="grid-2"><label>Course<select id="uploadCourseId"><option value="">Select course</option>${options}</select></label>
  <label>Material title<input id="uploadMaterialTitle" placeholder="e.g. Full Visual Study Manual"></label></div>
  <label>Course PDF<input id="uploadCoursePdf" type="file" accept="application/pdf,.pdf"></label>
  <p class="muted">PDF is the learner reading copy. It is stored in the private Neon course-materials bucket. All learners can open published manuals free after signing in; authorised academy staff can upload and manage course materials.</p>
  <div class="study-actions"><button class="primary-btn" id="uploadCourseBtn">Upload & Attach Course</button></div><div id="uploadCourseStatus" class="form-message"></div></div>
  <div class="card"><div class="card-head"><h3>How this works</h3></div><p>The full manual becomes the main online course reader. Learners no longer see only the short generated summary when a complete PDF is available.</p></div>`;
  $("#uploadCourseBtn").onclick=async()=>{
    const courseId=$("#uploadCourseId").value, file=$("#uploadCoursePdf").files[0], title=$("#uploadMaterialTitle").value.trim()||"Full Visual Study Manual", st=$("#uploadCourseStatus");
    if(!courseId||!file){ st.textContent="Select a course and choose a PDF file."; st.className="form-message error"; return; }
    if(file.type!=="application/pdf" && !file.name.toLowerCase().endsWith(".pdf")){ st.textContent="Upload a PDF course manual."; st.className="form-message error"; return; }
    try{ st.textContent="Uploading course material…"; st.className="form-message"; await window.ETHAN_BACKEND.uploadCourseMaterial({courseId,title,file}); st.textContent="Course uploaded and attached successfully."; st.className="form-message success"; $("#uploadCoursePdf").value=""; }
    catch(e){ st.textContent=e.message||"Course upload failed."; st.className="form-message error"; }
  };
}


let ethanNarration={chunks:[],index:0,rate:1,paused:false,active:false,title:""};
function narrationPathFromPdf(pdf){
  if(!pdf) return "";
  const name=String(pdf).split("/").pop().split("?")[0].replace(/\.pdf$/i,".txt");
  return "./assets/course-narration/"+name;
}
function stopCourseNarration(){
  try{ speechSynthesis.cancel(); }catch(e){}
  ethanNarration.active=false; ethanNarration.paused=false; ethanNarration.index=0;
  const st=document.getElementById("narrationStatus"); if(st) st.textContent="Voice narration stopped.";
  const btn=document.getElementById("narrationPlayBtn"); if(btn) btn.textContent="▶ Play";
}
function splitNarrationText(text){
  const clean=String(text||"").replace(/\s+/g," ").trim();
  if(!clean) return [];
  const sentences=clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[clean];
  const out=[]; let cur="";
  for(const x of sentences){ if((cur+" "+x).length>700 && cur){out.push(cur.trim());cur=x;}else cur+=(cur?" ":"")+x; }
  if(cur) out.push(cur.trim()); return out;
}
function speakNarrationChunk(){
  if(!ethanNarration.active || ethanNarration.index>=ethanNarration.chunks.length){
    ethanNarration.active=false; ethanNarration.paused=false;
    const st=document.getElementById("narrationStatus"); if(st) st.textContent="Narration completed.";
    const btn=document.getElementById("narrationPlayBtn"); if(btn) btn.textContent="▶ Play"; return;
  }
  const text=ethanNarration.chunks[ethanNarration.index];
  const u=new SpeechSynthesisUtterance(text); u.rate=ethanNarration.rate;
  const sel=document.getElementById("narrationVoiceSelect");
  const voices=speechSynthesis.getVoices(); if(sel && sel.value && voices[Number(sel.value)]) u.voice=voices[Number(sel.value)];
  const st=document.getElementById("narrationStatus"); if(st) st.textContent=`Narrating section ${ethanNarration.index+1} of ${ethanNarration.chunks.length}: ${text.slice(0,120)}${text.length>120?"…":""}`;
  u.onend=()=>{ if(ethanNarration.active && !ethanNarration.paused){ethanNarration.index++;speakNarrationChunk();} };
  u.onerror=()=>{ if(st) st.textContent="Narration could not continue on this browser/device."; ethanNarration.active=false; };
  speechSynthesis.speak(u);
}
async function startCourseNarration(pdf,title){
  if(!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)){
    const st=document.getElementById("narrationStatus");
    if(st) st.textContent="Voice narration is not supported by this browser/device.";
    return;
  }
  if(ethanNarration.active && ethanNarration.paused){ speechSynthesis.resume(); ethanNarration.paused=false; const b=document.getElementById("narrationPlayBtn"); if(b)b.textContent="⏸ Pause"; return; }
  if(ethanNarration.active){ speechSynthesis.pause(); ethanNarration.paused=true; const b=document.getElementById("narrationPlayBtn"); if(b)b.textContent="▶ Resume"; return; }

  // Always resolve narration from the canonical bundled course PDF when the course
  // has a built-in manual. This keeps narration working even if the visible PDF is
  // a Neon signed/uploaded URL with a different filename.
  const canonicalPdf=builtinCourseMaterial(title)||pdf||"";
  const pdfName=String(canonicalPdf).split("/").pop().split("?")[0].replace(/\.pdf$/i,"");
  let text=window.ETHAN_NARRATION_TEXT?.[pdfName]||"";

  // Fallback to the bundled transcript file. Resolve relative to this deployed app,
  // not the domain root, so Vercel previews/sub-path deployments also work.
  if(!String(text).trim()){
    try{
      const txtName=String(canonicalPdf).split("/").pop().split("?")[0].replace(/\.pdf$/i,".txt");
      const base=new URL("./", window.location.href);
      const narrationUrl=new URL("assets/course-narration/"+txtName, base).href;
      const r=await fetch(narrationUrl,{cache:"no-store"});
      if(r.ok) text=await r.text();
    }catch(e){ console.warn("Narration transcript fetch failed",e); }
  }

  if(!String(text).trim()){
    const st=document.getElementById("narrationStatus");
    if(st) st.textContent="Narration transcript could not be loaded. Refresh once after deployment; if this persists, the course transcript is missing from the deployed files.";
    return;
  }

  try{
    const chunks=splitNarrationText(text);
    if(!chunks.length) throw new Error("Narration transcript is empty");
    ethanNarration={chunks,index:0,rate:Number(document.getElementById("narrationRate")?.value||1),paused:false,active:true,title:title||"Course",generation:(ethanNarration.generation||0)+1};
    localStorage.setItem("ethanNarrationRate",String(ethanNarration.rate));
    const b=document.getElementById("narrationPlayBtn"); if(b)b.textContent="⏸ Pause";
    speakNarrationChunk();
  }catch(e){
    console.error("Narration start failed",e);
    const st=document.getElementById("narrationStatus");
    if(st) st.textContent="Narration could not start on this browser/device.";
  }
}
function narrationControls(pdf,title){
  const saved=Number(localStorage.getItem("ethanNarrationRate")||1);
  return `<section class="narration-panel" aria-label="Voice narration controls"><div><strong>🔊 Voice Narration</strong><p class="muted">Optional. Listen to the full study manual or continue reading normally.</p></div><div class="narration-controls"><button class="primary-btn" id="narrationPlayBtn">▶ Play</button><button class="secondary-btn" id="narrationPrevBtn">⏮ Previous</button><button class="secondary-btn" id="narrationNextBtn">Next ⏭</button><button class="secondary-btn" id="narrationStopBtn">■ Stop</button><label>Speed <select id="narrationRate"><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><label>Voice <select id="narrationVoiceSelect"><option value="">Device default</option></select></label></div><div id="narrationStatus" class="narration-status" aria-live="polite">Narration is off.</div></section>`;
}
function bindNarrationControls(pdf,title){
  const rate=document.getElementById("narrationRate"); if(rate){rate.value=String(Number(localStorage.getItem("ethanNarrationRate")||1));rate.onchange=()=>{ethanNarration.rate=Number(rate.value);localStorage.setItem("ethanNarrationRate",rate.value);if(ethanNarration.active){speechSynthesis.cancel();speakNarrationChunk();}};}
  const fill=()=>{const sel=document.getElementById("narrationVoiceSelect");if(!sel)return;const old=sel.value;sel.innerHTML='<option value="">Device default</option>'+speechSynthesis.getVoices().map((v,i)=>`<option value="${i}">${escHtml(v.name)} (${escHtml(v.lang)})</option>`).join("");sel.value=old;}; fill(); speechSynthesis.onvoiceschanged=fill;
  document.getElementById("narrationPlayBtn").onclick=()=>startCourseNarration(pdf,title);
  document.getElementById("narrationStopBtn").onclick=stopCourseNarration;
  document.getElementById("narrationPrevBtn").onclick=()=>{if(!ethanNarration.chunks.length)return; speechSynthesis.cancel();ethanNarration.active=true;ethanNarration.paused=false;ethanNarration.index=Math.max(0,ethanNarration.index-1);speakNarrationChunk();};
  document.getElementById("narrationNextBtn").onclick=()=>{if(!ethanNarration.chunks.length)return; speechSynthesis.cancel();ethanNarration.active=true;ethanNarration.paused=false;ethanNarration.index=Math.min(ethanNarration.chunks.length-1,ethanNarration.index+1);speakNarrationChunk();};
}

async function openCourseStudy(title){
  currentStudyCourseTitle=decodeURIComponent(title);
  if(!currentUser){alert("Sign in to open free course materials.");return;}
  if(currentUser.role!=="student"&&!canAccessAllCourseMaterials()){alert("You do not have permission to access this course material.");return;}
  const g=buildCourseStudyGuide(currentStudyCourseTitle);
  const material=await resolveCourseMaterial(currentStudyCourseTitle);
  if(material?.pdf_url){
    $("#content").innerHTML=pageHead("Full Course Study",
      isSuperAdmin()?"Super Admin academic access: complete uploaded course manual.":"Free course study manual.",
      `<div class="study-actions"><button class="primary-btn" id="openFullPdfBtn">Open Full PDF</button></div>`)+
      narrationControls(material.pdf_url,currentStudyCourseTitle)+`<div class="card course-pdf-shell"><div class="card-head"><div><h3>${escHtml(currentStudyCourseTitle)}</h3><p class="muted">Complete course manual</p></div></div><iframe class="course-pdf-reader" src="${escHtml(material.pdf_url)}#toolbar=1&navpanes=1&view=FitH" title="${escHtml(currentStudyCourseTitle)} full course manual"></iframe></div>`;
    $("#openFullPdfBtn").onclick=()=>window.open(material.pdf_url,"_blank","noopener"); bindNarrationControls(material.pdf_url,currentStudyCourseTitle); return;
  }
  $("#content").innerHTML=pageHead("Course Study Note",isSuperAdmin()?"Super Admin academic access: structured course material.":"Free course study material.",`<div class="study-actions"><button class="secondary-btn" id="downloadWordBtn">Download Word</button><button class="primary-btn" id="printPdfBtn">Save as PDF / Print</button></div>`)+`<article class="study-reader">${renderGuideHtml(g)}</article>`;
  $("#downloadWordBtn").onclick=()=>downloadCourseWord(g); $("#printPdfBtn").onclick=()=>printCoursePdf(g);
}

function downloadCourseWord(g){
  const styles=`<style>
  body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;margin:40px}
  h1{color:#24496b;font-size:28px} h2{color:#24496b;margin-top:24px;font-size:20px}
  .study-case{background:#f4f7fa;padding:16px;border-left:4px solid #24496b}
  li{margin:6px 0}
  </style>`;
  const doc=`<!doctype html><html><head><meta charset="utf-8">${styles}</head><body>
  <p><strong>ETHAN DIGITAL ACADEMY</strong></p>${renderGuideHtml(g)}
  </body></html>`;
  const blob=new Blob(["\ufeff",doc],{type:"application/msword"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`${g.title.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"")}-Study-Note.doc`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function printCoursePdf(g){
  if(String(g?.title||"").trim().toLowerCase()==="canva graphic design"){ window.open("./assets/course-materials/Canva-Graphic-Design-EDA-CGD-116.pdf","_blank"); return; }
  if(String(g?.title||"").trim().toLowerCase()==="advanced canva design"){ window.open("./assets/course-materials/Advanced-Canva-Design-EDA-ACD-117.pdf","_blank"); return; }
  if(String(g?.title||"").trim().toLowerCase()==="adobe photoshop basics"){ window.open("./assets/course-materials/Adobe-Photoshop-Basics-EDA-PSB-118.pdf","_blank"); return; }
  if(String(g?.title||"").trim().toLowerCase()==="digital literacy"){ window.open("./assets/course-materials/Digital-Literacy-EDA-DLT-115.pdf","_blank"); return; }
  if(String(g?.title||"").trim().toLowerCase()==="file management & cloud storage"){ window.open("./assets/course-materials/File-Management-Cloud-Storage-EDA-FCS-113.pdf","_blank"); return; }
  if(String(g?.title||"").trim().toLowerCase()==="windows productivity"){ window.open("./assets/course-materials/Windows-Productivity-EDA-WIN-112.pdf","_blank"); return; }
  const _itTitle = String(g?.title || g?.name || g || "").toLowerCase();
  if (_itTitle === "it support fundamentals") { window.open("assets/course-materials/IT-Support-Fundamentals-EDA-ITS-111.pdf", "_blank"); return; }

  if(["python for beginners","software development basics","coding & programming fundamentals","coding and programming fundamentals"].includes(String(g?.title||"").trim().toLowerCase())){ window.open("./assets/course-materials/Coding-Programming-Fundamentals-EDA-COD-171.pdf","_blank"); return; }
  if(String(g?.title||"").trim().toLowerCase()==="digital marketing strategy"){ window.open("./assets/course-materials/Digital-Marketing-EDA-DMK-130.pdf","_blank"); return; }
  if(String(g?.title||"").trim().toLowerCase()==="digital marketing"){ window.open("./assets/course-materials/Digital-Marketing-EDA-DMK-130.pdf","_blank"); return; }
  if(["cybersecurity awareness","cybersecurity fundamentals"].includes(String(g?.title||"").trim().toLowerCase())){ window.open("./assets/course-materials/Cybersecurity-Fundamentals-EDA-CYB-114.pdf","_blank"); return; }
  if(String(g?.title||"").trim().toLowerCase()==="computer appreciation"){
    window.open("./assets/course-materials/Computer-Appreciation-EDA-COM-101.pdf","_blank");
    return;
  }
  if(String(g?.title||"").trim().toLowerCase()==="microsoft word"){
    window.open("./assets/course-materials/Microsoft-Word-EDA-WRD-102.pdf","_blank");
    return;
  }
  if(String(g?.title||"").trim().toLowerCase()==="microsoft excel"){
    window.open("./assets/course-materials/Microsoft-Excel-EDA-EXC-103.pdf","_blank");
    return;
  }
  if(String(g?.title||"").trim().toLowerCase()==="microsoft powerpoint"){
    window.open("./assets/course-materials/Microsoft-PowerPoint-EDA-PPT-104.pdf","_blank");
    return;
  }
  if(String(g?.title||"").trim().toLowerCase()==="microsoft access"){
    window.open("./assets/course-materials/Microsoft-Access-EDA-ACC-105.pdf","_blank");
    return;
  }
  if(String(g?.title||"").trim().toLowerCase()==="google workspace"){
    window.open("./assets/course-materials/Google-Workspace-EDA-GWS-106.pdf","_blank");
    return;
  }
  if(String(g?.title||"").trim().toLowerCase()==="internet & email skills"){
    window.open("./assets/course-materials/Internet-Email-Skills-EDA-IES-107.pdf","_blank");
    return;
  }
  if(["typing & keyboard mastery","typing & keyboarding skills"].includes(String(g?.title||"").trim().toLowerCase())){
    window.open("./assets/course-materials/Typing-Keyboard-Mastery-EDA-TYP-108.pdf","_blank");
    return;
  }
  if(String(g?.title||"").trim().toLowerCase()==="computer hardware fundamentals"){
    window.open("./assets/course-materials/Computer-Hardware-Fundamentals-EDA-HDW-109.pdf","_blank");
    return;
  }
  if(String(g?.title||"").trim().toLowerCase()==="computer maintenance"){
    window.open("./assets/course-materials/Computer-Maintenance-EDA-MNT-110.pdf","_blank");
    return;
  }
  const w=window.open("","_blank");
  if(!w){ alert("Please allow pop-ups to save the study note as PDF."); return; }
  w.document.write(`<!doctype html><html><head><title>${escHtml(g.title)} - Ethan Digital Academy</title>
  <style>
    @page{size:A4;margin:18mm}
    body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.55}
    h1{color:#24496b;font-size:28px}h2{color:#24496b;font-size:19px;margin-top:24px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
    .eyebrow{font-size:11px;letter-spacing:1.4px;color:#9b7a3c;font-weight:700}
    .study-cover{padding-bottom:16px;border-bottom:2px solid #24496b;margin-bottom:24px}
    .study-case{background:#f6f8fa;padding:14px;border-left:4px solid #24496b}
    li{margin:5px 0}
  </style></head><body>${renderGuideHtml(g)}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  w.document.close();
}

function courseCards(list){
 return `<div class="course-grid">${list.map(c=>{
   const encoded=encodeURIComponent(c.title||"Course");
   return `<article class="course-card"><div class="course-thumb"><strong>${c.category||"Course"}</strong></div><div class="course-body"><small class="muted">${c.code||""}</small><h3>${c.title}</h3><p class="muted">${c.instructor||"Ethan Digital Academy"}</p><div class="course-meta"><span>${c.duration||"Self-paced"}</span><span>${Number(c.progress||0)}%</span></div><div class="progress"><span style="width:${Number(c.progress||0)}%"></span></div><div class="course-card-actions"><button class="primary-btn" onclick="openCourseStudy('${encoded}')">${currentUser.role==="student"?"Read Course Note":"Preview Study Note"}</button><button class="secondary-btn" onclick="navigate('lms')">${currentUser.role==="student"?"Learning Area":"Course Builder"}</button></div></div></article>`;
 }).join("")}</div>`;
}
function renderCourses(){
 const add=(currentUser.role==="admin"||currentUser.role==="super_admin"||currentUser.role==="instructor")?`<button class="primary-btn" id="addCourseBtn">+ Create Course</button>`:"";
 $("#content").innerHTML=pageHead(currentUser.role==="student"?"My Courses":"Courses","Browse and manage the academy course catalogue.",add)+courseCards(data.courses);
 if($("#addCourseBtn")) $("#addCourseBtn").onclick=()=>showModal("Create Course","Add a course to the catalogue.",`
  <label>Course title<input id="courseTitle"></label><div class="grid-2"><label>Category<input id="courseCat"></label><label>Duration<input id="courseDur" placeholder="6 weeks"></label></div>
 `,()=>{
  const t=$("#courseTitle").value.trim(),cat=$("#courseCat").value.trim(),dur=$("#courseDur").value.trim();if(!t||!cat||!dur)return alert("Complete all fields.");
  data.courses.push({code:`EDA-CRS-${String(data.courses.length+1).padStart(3,"0")}`,title:t,category:cat,instructor:currentUser.name,duration:dur,progress:0,lessons:0,completed:0});persist();closeModal();renderCourses();
 });
}

const cyberLessons=[
 {title:"1. Introduction to Cybersecurity",body:`<h1>Introduction to Cybersecurity</h1><p>Cybersecurity is the practice of protecting computers, networks, applications, devices and information from unauthorized access, disruption, damage or theft.</p><h2>Learning objectives</h2><ul><li>Explain cybersecurity in simple terms.</li><li>Identify common digital assets that need protection.</li><li>Understand the role of people, processes and technology.</li></ul><div class="callout"><strong>Key idea:</strong> Cybersecurity is not only an IT issue. People, processes and technology must work together.</div>`},
 {title:"2. CIA Triad",body:`<h1>The CIA Triad</h1><p>The three core security objectives are confidentiality, integrity and availability.</p><h2>Confidentiality</h2><p>Only authorized people should access protected information.</p><h2>Integrity</h2><p>Information should remain accurate and should not be changed without authorization.</p><h2>Availability</h2><p>Authorized users should be able to access systems when needed.</p>`},
 {title:"3. Threats, Vulnerabilities & Risk",body:`<h1>Threats, Vulnerabilities & Risk</h1><p>A <strong>threat</strong> can cause harm. A <strong>vulnerability</strong> is a weakness. <strong>Risk</strong> is the possibility that a threat will exploit a vulnerability and create damage.</p><div class="callout">A simple model is: Risk ≈ Likelihood × Impact.</div>`},
 {title:"4. Password & Authentication Security",body:`<h1>Password & Authentication Security</h1><p>Use long, unique passwords or passphrases. Multi-factor authentication adds another independent verification factor.</p><h2>Authentication factors</h2><ul><li>Something you know</li><li>Something you have</li><li>Something you are</li></ul>`},
 {title:"5. Network Security",body:`<h1>Network Security</h1><p>Network security protects connected systems and the information moving between them.</p><h2>Common controls</h2><ul><li>Firewalls</li><li>Secure Wi-Fi</li><li>Network segmentation</li><li>Monitoring</li><li>Secure remote access</li></ul>`}
];
let lessonIndex=0;
function renderLMS(){
 $("#content").innerHTML=pageHead(currentUser.role==="instructor"?"Course Builder":"Learning Classroom","Study structured lessons and track your progress.")+`
 <div class="lesson-layout">
  <aside class="lesson-menu">${cyberLessons.map((l,i)=>`<button data-lesson="${i}" class="${i===lessonIndex?"active":""}">${l.title}</button>`).join("")}</aside>
  <article class="lesson-content">
    <small class="eyebrow">CYBERSECURITY FUNDAMENTALS</small>
    ${cyberLessons[lessonIndex].body}
    <h3>Practical activity</h3><p>Review the security settings on one of your own accounts or devices. Record which protections are enabled, such as a strong password, screen lock, updates and multi-factor authentication.</p>
    <div class="lesson-nav"><button class="secondary-btn" id="prevLesson" ${lessonIndex===0?"disabled":""}>← Previous</button><button class="primary-btn" id="completeLesson">${lessonIndex===cyberLessons.length-1?"Complete Lesson":"Mark Complete & Next →"}</button></div>
  </article>
 </div>`;
 $$(".lesson-menu button").forEach(b=>b.onclick=()=>{lessonIndex=+b.dataset.lesson;renderLMS()});
 $("#prevLesson").onclick=()=>{if(lessonIndex>0){lessonIndex--;renderLMS()}};
 $("#completeLesson").onclick=()=>{if(lessonIndex<cyberLessons.length-1){lessonIndex++;renderLMS()}else alert("Lesson completed. Your learning progress has been saved in this browser preview.")};
}
function renderAssignments(){
 $("#content").innerHTML=pageHead("Assignments","View, submit and grade practical learning tasks.",currentUser.role==="admin"||currentUser.role==="instructor"?`<button class="primary-btn">+ Create Assignment</button>`:"")+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Assignment</th><th>Course</th><th>Due Date</th><th>Status</th><th>Score</th></tr></thead><tbody>
 <tr><td>Security Awareness Audit</td><td>Cybersecurity Fundamentals</td><td>18 Sep 2026</td><td><span class="badge gold">In Progress</span></td><td>—</td></tr>
 <tr><td>Excel Sales Dashboard</td><td>Microsoft Excel Mastery</td><td>20 Sep 2026</td><td><span class="badge blue">Submitted</span></td><td>Pending</td></tr>
 </tbody></table></div></div>`;
}
function renderQuizzes(){
 $("#content").innerHTML=pageHead("Quizzes & Examinations","Assessment centre for quizzes and examinations.",currentUser.role==="admin"||currentUser.role==="instructor"?`<button class="primary-btn">+ Create Quiz</button>`:"")+`
 <div class="course-grid">
  <div class="course-card"><div class="course-body"><span class="badge blue">Quiz</span><h3>Cybersecurity Module 1</h3><p class="muted">10 questions • 15 minutes • Pass mark 60%</p><button class="primary-btn">Start Quiz</button></div></div>
  <div class="course-card"><div class="course-body"><span class="badge gold">Exam</span><h3>Excel Final Assessment</h3><p class="muted">25 questions • 45 minutes • Pass mark 70%</p><button class="secondary-btn">View Details</button></div></div>
 </div>`;
}
function renderAttendance(){
 $("#content").innerHTML=pageHead("Attendance","Monitor attendance across courses and classes.",currentUser.role==="admin"||currentUser.role==="instructor"?`<button class="primary-btn">Mark Attendance</button>`:"")+`
 <div class="stats-grid">${stat("Present","42","Today","✅")}${stat("Absent","3","Today","✕")}${stat("Late","2","Today","⏱")}${stat("Rate","89%","This month","📈")}</div>
 ${studentTable(data.students)}`;
}
function renderTimetable(){
 $("#content").innerHTML=pageHead("Timetable","Today's and upcoming classes.")+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Day</th><th>Course</th><th>Instructor</th><th>Time</th><th>Mode</th></tr></thead><tbody>
 <tr><td>Monday</td><td>Cybersecurity Fundamentals</td><td>Daniel Peter</td><td>10:00 – 12:00</td><td><span class="badge blue">Classroom</span></td></tr>
 <tr><td>Tuesday</td><td>Microsoft Excel Mastery</td><td>Mariam Bello</td><td>13:00 – 15:00</td><td><span class="badge green">Online</span></td></tr>
 </tbody></table></div></div>`;
}
function renderPayments(){
 $("#content").innerHTML=pageHead("Fees & Payments","Track fees, balances, transactions and receipts.",currentUser.role==="admin"?`<button class="primary-btn" id="recordPaymentBtn">+ Record Payment</button>`:"")+`
 <div class="stats-grid">${stat("Total Expected","₦250,000","Current records","💰")}${stat("Received","₦175,000","Confirmed","✅")}${stat("Outstanding","₦75,000","Remaining","⏳")}${stat("Payment Rate","70%","Current","📈")}</div>
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Reference</th><th>Student</th><th>Description</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>${data.payments.map(p=>`<tr><td>${p.ref}</td><td>${p.student}</td><td>${p.description}</td><td>₦${p.amount.toLocaleString()}</td><td>${p.date}</td><td><span class="badge green">${p.status}</span></td></tr>`).join("")}</tbody></table></div></div>`;
 if($("#recordPaymentBtn")) $("#recordPaymentBtn").onclick=()=>showModal("Record Payment","Record a verified manual payment.",`
 <label>Student<select id="payStudent">${data.students.map(s=>`<option>${s.name}</option>`).join("")}</select></label><label>Description<input id="payDesc"></label><label>Amount<input id="payAmount" type="number"></label>
 `,()=>{const amount=+$("#payAmount").value;if(!amount)return alert("Enter a valid amount.");data.payments.unshift({ref:`EDA-PAY-${1000+data.payments.length+1}`,student:$("#payStudent").value,description:$("#payDesc").value||"Training Fee",amount,date:new Date().toISOString().slice(0,10),status:"Confirmed"});persist();closeModal();renderPayments()});
}
function renderResults(){
 $("#content").innerHTML=pageHead("Results","Academic assessment results and performance.")+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Course</th><th>Assessment</th><th>Score</th><th>Grade</th><th>Status</th></tr></thead><tbody>
 <tr><td>Cybersecurity Fundamentals</td><td>Module 1 Quiz</td><td>82%</td><td>A</td><td><span class="badge green">Passed</span></td></tr>
 <tr><td>Microsoft Excel Mastery</td><td>Practical 2</td><td>76%</td><td>B</td><td><span class="badge green">Passed</span></td></tr>
 </tbody></table></div></div>`;
}
function renderCertificates(){
 $("#content").innerHTML=pageHead("Certificates","Issue, manage and verify course certificates.",currentUser.role==="admin"?`<button class="primary-btn">Issue Certificate</button>`:"")+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Certificate ID</th><th>Student</th><th>Course</th><th>Issue Date</th><th>Status</th></tr></thead><tbody>
 <tr><td>EDA-CERT-2026-001</td><td>${currentUser.role==="student"?currentUser.name:"Grace Adewale"}</td><td>Digital Skills Foundation</td><td>05 Sep 2026</td><td><span class="badge green">Valid</span></td></tr>
 </tbody></table></div></div>`;
}
function renderAnnouncements(){
 $("#content").innerHTML=pageHead("Announcements","Academy updates and important information.",currentUser.role==="admin"||currentUser.role==="instructor"?`<button class="primary-btn" id="newAnnouncementBtn">+ New Announcement</button>`:"")+`
 <div class="progress-list">${data.announcements.map(a=>`<div class="card"><strong>${a.title}</strong><p>${a.message}</p><small class="muted">${a.date}</small></div>`).join("")}</div>`;
 if($("#newAnnouncementBtn")) $("#newAnnouncementBtn").onclick=()=>showModal("New Announcement","Publish an academy announcement.",`<label>Title<input id="annTitle"></label><label>Message<textarea id="annMsg" rows="4"></textarea></label>`,()=>{if(!$("#annTitle").value.trim()||!$("#annMsg").value.trim())return alert("Complete title and message.");data.announcements.unshift({title:$("#annTitle").value.trim(),message:$("#annMsg").value.trim(),date:"Today"});persist();closeModal();renderAnnouncements()});
}
function renderReports(){
 $("#content").innerHTML=pageHead("Reports","Academy reporting across students, finance and learning.")+`
 <div class="quick-grid">${["Student Enrolment","Course Completion","Attendance","Payments & Revenue","Outstanding Fees","Academic Performance"].map(x=>`<div class="quick-card"><strong>${x}</strong><p class="muted">View report</p><button class="secondary-btn">Open</button></div>`).join("")}</div>`;
}
function renderSettings(){
 $("#content").innerHTML=pageHead("Settings","Configure academy, academic, payment and security preferences.")+`
 <div class="dashboard-grid">
 <div class="card"><h3>General Settings</h3><label>Academy Name<input value="Ethan Digital Academy" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:10px"></label><br><br><label>Website<input value="https://ethandigitalacademy.org" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:10px"></label><br><br><button class="primary-btn">Save Settings</button></div>
 <div class="card"><h3>Platform Status</h3><p><span class="badge green">Frontend Ready</span></p><p><span class="badge gold">Backend connection pending</span></p><p class="muted">Dedicated Neon authentication and database services are configured for this application.</p></div>
 </div>`;
}
function renderProfile(){
 $("#content").innerHTML=pageHead("Profile","Your account and personal information.")+`
 <div class="card"><div style="display:flex;gap:16px;align-items:center"><div class="avatar" style="width:72px;height:72px;font-size:23px">${initials(currentUser.name)}</div><div><h2 style="margin:0">${currentUser.name}</h2><p class="muted">${currentUser.email}</p><span class="badge blue">${currentUser.role}</span></div></div></div>`;
}
function renderNotifications(){
 $("#notificationList").innerHTML=data.notifications.map(n=>`<div class="notification-item"><strong>${n.title}</strong><div>${n.message}</div><small>${n.time}</small></div>`).join("");
}
function persist(){localStorage.setItem(STORE.data,JSON.stringify(data))}
function showModal(title,desc,body,onSave){
 const el=document.createElement("div");el.className="modal-backdrop";el.id="activeModal";el.innerHTML=`<div class="modal"><div class="card-head"><div><h3>${title}</h3><p class="muted">${desc}</p></div><button class="icon-btn" id="modalClose">✕</button></div>${body}<div class="modal-actions"><button class="secondary-btn" id="modalCancel">Cancel</button><button class="primary-btn" id="modalSave">Save</button></div></div>`;
 document.body.appendChild(el); $("#modalClose").onclick=closeModal;$("#modalCancel").onclick=closeModal;$("#modalSave").onclick=onSave;
}
function closeModal(){const m=$("#activeModal");if(m)m.remove()}

(async function restore(){
 if(!window.ETHAN_BACKEND?.ready){
  const msg=$("#signinMessage");
  if(msg){msg.textContent=window.ETHAN_BACKEND?.error||"The secure learning service is unavailable. Refresh and try again.";msg.className="form-message error";}
  return;
 }
 const resetToken=new URL(location.href).searchParams.get("token");
 if(resetToken){
  showModal("Choose a new password","Enter and confirm a new password for your Ethan LMS account.",`
   <label>New password<input id="newResetPassword" type="password" minlength="8" autocomplete="new-password" required></label>
   <label>Confirm new password<input id="confirmResetPassword" type="password" minlength="8" autocomplete="new-password" required></label>
  `,async()=>{
   const next=$("#newResetPassword").value,confirm=$("#confirmResetPassword").value;
   if(next.length<8)return alert("Use at least 8 characters for your new password.");
   if(next!==confirm)return alert("The passwords do not match.");
   try{
    await window.ETHAN_BACKEND.completePasswordReset(resetToken,next);
    closeModal();
    const url=new URL(location.href);url.searchParams.delete("token");history.replaceState({},"",url.pathname+(url.search||"")+url.hash);
    alert("Your password has been updated. Sign in with your new password.");
   }catch(error){alert(error.message||"The reset link is invalid or expired. Request a new password reset email.");}
  });
  return;
 }
 try{
  const session=await window.ETHAN_BACKEND.getSession();if(!session?.user)return;
  const profile=await window.ETHAN_BACKEND.getProfile(session.user.id);
  if(profile)await openPortal(portalUserFromAuth(session.user,profile));
 }catch(error){
  console.warn("Ethan LMS session restore failed:",error);
  const msg=$("#signinMessage");if(msg){msg.textContent=error.message||"Your saved session could not be restored. Please sign in again.";msg.className="form-message error";}
 }
})();

if("serviceWorker" in navigator){
  window.addEventListener("load", async ()=>{
    try{
      const reg = await navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"});
      await reg.update();
    }catch(_){}
  });
}


/* v5: payment-controlled course allocation */


function approvedBankPaymentHtml(){return "";}

/* v9.2 - Super Admin full academic access */
function isSuperAdmin(){
  return currentUser?.role === "super_admin";
}
function canAccessAllCourseMaterials(){
  return ["super_admin","admin","instructor"].includes(currentUser?.role||"");
}
function canCreateCourses(){
  return ["super_admin","admin","instructor"].includes(currentUser?.role||"");
}
function allAcademyCoursesForStaff(){
  const dbCourses = Array.isArray(data.courses) ? data.courses : [];
  const seen = new Set(dbCourses.map(c=>String(c.title||"").trim().toLowerCase()));
  const catalogueCourses = ETHAN_PUBLIC_COURSES
    .filter(c=>!seen.has(String(c.name||"").trim().toLowerCase()))
    .map((c,i)=>({
      id:`catalogue-${i+1}`,
      code:`EDA-${String(i+1).padStart(3,"0")}`,
      title:c.name,
      duration:"Self-paced",
      progress:0,
      published:true,
      catalogue:true
    }));
  return [...dbCourses, ...catalogueCourses];
}

function getPublicCourseByTitle(title){
  return ETHAN_PUBLIC_COURSES.find(c=>String(c.name||"").trim().toLowerCase()===String(title||"").trim().toLowerCase());
}
function learnerCourseCard(c){
 const info=getPublicCourseByTitle(c.title)||{},title=c.title||"Course",encoded=encodeURIComponent(title);
 const progress=Math.max(0,Math.min(100,Number(c.progress||0)));
 return `<article class="learner-course-card">
  <div class="learner-course-card-top"><span class="course-status-badge">FREE • AVAILABLE</span><span class="course-progress-label">${progress}%</span></div>
  <div class="learner-course-icon">${escHtml(title.split(/\\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase())}</div>
  <small>${escHtml(c.code||"DIGITAL COURSE")}</small><h3>${escHtml(title)}</h3><p>${escHtml(info.brief||"Free Ethan Digital Academy course.")}</p>
  <div class="learner-progress"><span style="width:${progress}%"></span></div>
  <div class="learner-course-meta"><span>${escHtml(c.duration||"Self-paced")}</span><span>Free access</span></div>
  <div class="learner-course-actions"><button class="primary-btn" onclick="openCourseStudy('${encoded}')">Open Free Course</button><button class="secondary-btn" onclick="navigate('lms')">Learning Area</button></div>
 </article>`;
}
function lockedCatalogueCard(c){
 const encoded=encodeURIComponent(c.name||"Course");
 return `<article class="catalogue-lock-card"><div><span class="lock-chip">FREE COURSE</span><h4>${escHtml(c.name)}</h4><p>${escHtml(c.brief)}</p></div><div class="catalogue-lock-footer"><strong>FREE</strong><button class="secondary-btn" onclick="openCourseStudy('${encoded}')">Open Course</button></div></article>`;
}
function renderStudentHome(){
 const courses=studentCourses(),learnerLabel=portalRoleLabel(currentUser),firstName=escHtml(currentUser.firstName||currentUser.name||"Learner");
 const avgProgress=courses.length?Math.round(courses.reduce((sum,c)=>sum+Number(c.progress||0),0)/courses.length):0;
 $("#content").innerHTML=`
 <section class="student-home-hero"><div><span class="eyebrow">ETHAN DIGITAL ACADEMY</span><h1>Welcome, ${firstName}</h1><p>${escHtml(learnerLabel)} learning portal. Your free courses, lessons, study manuals and progress are all here.</p></div><div class="student-home-profile"><small>ACCOUNT TYPE</small><strong>${escHtml(learnerLabel)}</strong></div></section>
 <section class="student-home-stats"><div><small>FREE COURSES</small><strong>100</strong></div><div><small>MY ENROLMENTS</small><strong>${courses.length}</strong></div><div><small>AVERAGE PROGRESS</small><strong>${avgProgress}%</strong></div><div><small>LEARNING ACCESS</small><strong>ACTIVE</strong></div></section>
 <section class="student-section"><div class="student-section-head"><div><span class="eyebrow">MY LEARNING</span><h2>My Digital Courses</h2><p>All published courses are included with your free account.</p></div><button class="secondary-btn" onclick="navigate('courses')">View My Courses</button></div>
 ${courses.length?`<div class="learner-course-grid">${courses.map(learnerCourseCard).join("")}</div>`:`<div class="student-empty-panel"><div><span class="empty-icon">ED</span><h3>Preparing your course access</h3><p>Your free account is active. Refresh if your enrolments have not appeared yet.</p></div><button class="primary-btn" onclick="navigate('courses')">Browse Free Courses</button></div>`}
 </section>
 <section class="student-section"><div class="student-section-head"><div><span class="eyebrow">EXPLORE ETHAN</span><h2>100 Free Digital Courses</h2><p>Choose a course to open its study notes, manuals and practical learning resources.</p></div><div class="student-catalogue-tools"><input id="insideCourseSearch" placeholder="Search digital courses..."/></div></div>
 <div id="insideCourseGrid" class="inside-catalogue-grid">${ETHAN_PUBLIC_COURSES.slice(0,12).map(lockedCatalogueCard).join("")}</div><div class="student-catalogue-more"><button class="secondary-btn" id="showAllInsideCourses">View All 100 Free Courses</button></div></section>
 <section class="student-section student-quick-links"><div class="student-section-head"><div><span class="eyebrow">LEARNING PORTAL</span><h2>Quick Access</h2></div></div><div class="quick-access-grid">
 <button onclick="navigate('lms')"><strong>Learning Area</strong><span>Open your study classroom</span></button><button onclick="navigate('assignments')"><strong>Assignments</strong><span>View practical tasks</span></button><button onclick="navigate('quizzes')"><strong>Quizzes & Exams</strong><span>Practise and assess learning</span></button><button onclick="navigate('certificates')"><strong>Certificates</strong><span>View earned certificates</span></button></div></section>`;
 const search=$("#insideCourseSearch"),grid=$("#insideCourseGrid"),showAll=$("#showAllInsideCourses");let showingAll=false;
 function repaint(){const q=(search?.value||"").trim().toLowerCase(),source=showingAll||q?ETHAN_PUBLIC_COURSES:ETHAN_PUBLIC_COURSES.slice(0,12),rows=source.filter(c=>!q||`${c.name} ${c.brief}`.toLowerCase().includes(q));grid.innerHTML=rows.map(lockedCatalogueCard).join("")||`<div class="student-empty-panel"><div><h3>No matching course</h3><p>Try another course name or keyword.</p></div></div>`;}
 if(search)search.oninput=repaint;
 if(showAll)showAll.onclick=()=>{showingAll=!showingAll;showAll.textContent=showingAll?"Show Fewer Courses":"View All 100 Free Courses";repaint();};
}


function renderDashboard(){
  if(currentUser?.role==="student"){ renderStudentHome(); return; }
  renderDashboardLegacy();
  if(isSuperAdmin()){
    const host=$("#content");
    if(host){
      host.insertAdjacentHTML("afterbegin",`<section class="superadmin-academic-panel">
        <div>
          <span class="eyebrow">SUPER ADMIN ACADEMIC CONTROL</span>
          <h2>Full Course & Learning Access</h2>
          <p>Access every course, open complete study materials, export PDF/Word copies and create new courses.</p>
        </div>
        <div class="superadmin-actions">
          <button class="primary-btn" onclick="navigate('lms')">Open All Courses</button>
          <button class="secondary-btn" onclick="openCreateCourseForm()">Create Course</button>
        </div>
      </section>`);
    }
  }
}
function renderDashboardLegacy(){
 const role=currentUser.role;
 if(role==="student"){
   const courses=studentCourses();
   if(!courses.length){
     $("#content").innerHTML=`
       <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">WELCOME TO ETHAN DIGITAL ACADEMY</span><h1>Welcome, ${currentUser.firstName}</h1><p>Your account is ready. You have not been allocated any course yet.</p></div><button class="secondary-btn" onclick="navigate('payments')">Payment Status</button></div>
       <div class="stats-grid">${stat("My Courses","0","Awaiting allocation","📚")}${stat("Learning Progress","0%","No course started","📈")}${stat("Assignments","0","No active course","📝")}${stat("Certificates","0","Earn after completion","🎓")}</div>
       ${emptyState("No courses allocated yet","To begin learning, complete the required payment with Ethan Digital Academy. After payment is verified, an Admin will allocate your approved course and its lessons/videos to this account.",`<button class="primary-btn" onclick="navigate('payments')">View Fees & Payment Status</button>`)}
     `;
     return;
   }
   const avg=Math.round(courses.reduce((a,c)=>a+Number(c.progress||0),0)/courses.length);
   $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">MY LEARNING</span><h1>Welcome back, ${currentUser.firstName}</h1><p>All 100 digital courses are available free. Continue learning below.</p></div><button class="secondary-btn" onclick="navigate('lms')">Continue Learning</button></div>
      <div class="stats-grid">${stat("My Courses",String(courses.length),"Allocated by academy","📚")}${stat("Average Progress",avg+"%","Across allocated courses","📈")}${stat("Assignments","0","Shown when assigned","📝")}${stat("Certificates","0","Issued after completion","🎓")}</div>
      <div class="card"><div class="card-head"><h3>My Allocated Courses</h3></div>${courseCards(courses)}</div>`;
   return;
 }
 if(role==="admin" || role==="super_admin"){
   $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">ACADEMY OVERVIEW</span><h1>Welcome back, ${currentUser.firstName}</h1><p>Manage learner records, published courses and academic operations.</p></div><div class="hero-actions"><button class="secondary-btn" onclick="navigate('students')">Manage Students</button><button class="secondary-btn" onclick="navigate('payments')">Verify & Allocate</button></div></div>
      <div class="stats-grid">${stat("Registered Students",data.students.length,"Learner records","👥")}${stat("Course Catalogue",data.courses.length,"Available courses","📚")}${stat("Instructors",data.instructors.length,"Teaching staff","🧑‍🏫")}${stat("Learning Access","Free","All published courses","🔓")}</div>
      <div class="dashboard-grid"><div class="card"><div class="card-head"><h3>Student Status</h3></div>${studentTable(data.students)}</div><div class="card"><div class="card-head"><h3>Admission Flow</h3></div><div class="progress-list"><div class="progress-row"><strong>1. Free Registration</strong><p class="muted">Learners create their own secure account.</p></div><div class="progress-row"><strong>2. Account Setup</strong><p class="muted">A learner profile and student record are created automatically.</p></div><div class="progress-row"><strong>3. Free Course Access</strong><p class="muted">All 100 published courses are available immediately.</p></div><div class="progress-row"><strong>4. Learning Progress</strong><p class="muted">Lessons, practicals and quizzes help learners track their growth.</p></div></div></div></div>`;
   return;
 }
 if(role==="parent"){
   $("#content").innerHTML=`<div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">PARENT PORTAL</span><h1>Welcome, ${currentUser.firstName}</h1><p>Follow linked children's approved learning, attendance, results and fees.</p></div></div>${emptyState("No sample academic records","Only real records linked to your children will appear here.")}`;
   return;
 }
 $("#content").innerHTML=`<div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">INSTRUCTOR PORTAL</span><h1>Welcome, ${currentUser.firstName}</h1><p>Manage only courses and students assigned by the academy.</p></div><button class="secondary-btn" onclick="navigate('lms')">Open Course Builder</button></div><div class="stats-grid">${stat("Assigned Courses","—","From Admin allocations","📚")}${stat("Assigned Students","—","Paid/enrolled learners","👥")}${stat("To Grade","0","Current submissions","📝")}${stat("Today's Classes","—","Check timetable","🕒")}</div>`;
}

function renderCourses(){
 const isStudent=currentUser.role==="student";
 const mine=studentCourses();
 const list=isStudent?(mine.length?mine:ETHAN_PUBLIC_COURSES.map((c,i)=>({id:"free-catalogue-"+(i+1),code:"EDA-"+String(i+1).padStart(3,"0"),title:c.name,description:c.brief,duration:"Self-paced",fee:0,published:true,progress:0,lessons:0,completed:0}))):data.courses;
 const canCreate=["admin","super_admin","instructor"].includes(currentUser.role);
 const add=canCreate?`<button class="primary-btn" id="addCourseBtn">+ Create Course</button>`:"";
 $("#content").innerHTML=pageHead(isStudent?"My Free Courses":"Courses",isStudent?"Explore all 100 free academy courses.":"Manage the academy course catalogue.",add)+
   (list.length?courseCards(list):emptyState("No courses created yet","Create the first course when you are ready."));
 if($("#addCourseBtn")) $("#addCourseBtn").onclick=()=>showModal("Create Course","Add a course to the Academy catalogue.",`
  <label>Course title<input id="courseTitle"></label>
  <div class="grid-2"><label>Category / level<input id="courseCat" placeholder="Beginner"></label><label>Duration<input id="courseDur" placeholder="6 weeks"></label></div>
 `,async()=>{
  const t=$("#courseTitle").value.trim(),cat=$("#courseCat").value.trim(),dur=$("#courseDur").value.trim();
  if(!t||!cat||!dur)return alert("Complete all fields.");
  const code=`EDA-CRS-${Date.now().toString().slice(-6)}`;
  try{
    if(window.ETHAN_BACKEND?.ready){
      const c=await window.ETHAN_BACKEND.createCourse({code,title:t,difficulty:cat,duration:dur,published:false,created_by:currentUser.id});
      data.courses.unshift({id:c.id,code:c.code,title:c.title,category:c.difficulty||cat,instructor:currentUser.name,duration:c.duration||dur,progress:0,lessons:0,completed:0,fee:Number(c.fee||0),published:c.published});
    }else{
      data.courses.unshift({code,title:t,category:cat,instructor:currentUser.name,duration:dur,progress:0,lessons:0,completed:0,published:false});
      persist();
    }
    closeModal();renderCourses();
  }catch(err){alert(err.message||"Course could not be created.");}
 });
}


function openCreateCourseForm(){
 if(!canCreateCourses()){ alert("You do not have permission to create courses."); return; }
 $("#content").innerHTML=pageHead("Create Course","Add a new Ethan Digital Academy course to the academic catalogue.")+
 `<form id="createCourseForm" class="course-create-form">
   <div class="form-grid">
     <label>Course Code<input id="newCourseCode" required placeholder="e.g. EDA-DMK-301"></label>
     <label>Course Title<input id="newCourseTitle" required placeholder="Enter course title"></label>
     <label>Duration<input id="newCourseDuration" placeholder="e.g. 6 Weeks"></label>
     <label>Difficulty<select id="newCourseDifficulty"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
   </div>
   <label>Course Description<textarea id="newCourseDescription" rows="5" placeholder="Short professional description"></textarea></label>
   <div class="form-actions">
     <button type="button" class="secondary-btn" onclick="navigate('lms')">Cancel</button>
     <button type="submit" class="primary-btn">Create Course</button>
   </div>
 </form>`;
 $("#createCourseForm").onsubmit=async(e)=>{
   e.preventDefault();
   const payload={
     code:$("#newCourseCode").value.trim(),
     title:$("#newCourseTitle").value.trim(),
     duration:$("#newCourseDuration").value.trim()||"Self-paced",
     difficulty:$("#newCourseDifficulty").value,
     description:$("#newCourseDescription").value.trim(),
     published:false,
     created_by:currentUser.id
   };
   if(!payload.code||!payload.title){alert("Course code and title are required.");return;}
   try{
     if(!window.ETHAN_BACKEND?.ready)throw new Error(window.ETHAN_BACKEND?.error||"The secure Neon service is unavailable.");
     const created=await window.ETHAN_BACKEND.createCourse({...payload,fee:0});
     if(created)data.courses=[created,...(data.courses||[])];
     alert("Course created successfully.");
     navigate("lms");
   }catch(err){
     console.error(err);
     alert(err?.message||"Could not create course.");
   }
 };
}

function renderLMS(){
 if(currentUser.role==="student"){
   const courses=studentCourses();
   $("#content").innerHTML=pageHead("Learning Classroom","Choose any of the 100 free courses to begin structured study.")+
     `<div class="learning-course-list">${courses.map(c=>`<button class="learning-course-row" onclick="openCourseStudy('${encodeURIComponent(c.title||"Course")}')"><div><small>${escHtml(c.code||"ALLOCATED COURSE")}</small><strong>${escHtml(c.title)}</strong><span>Introduction, definition, objectives, key concepts, examples, case study, practical activities and assessment.</span></div><b>Open Study Note →</b></button>`).join("")}</div>`;
   return;
 }

 if(canAccessAllCourseMaterials()){
   const list=allAcademyCoursesForStaff();
   const isSA=isSuperAdmin();
   $("#content").innerHTML=pageHead(
     isSA?"Super Admin Course Library":currentUser.role==="instructor"?"Instructor Course Library":"Course Library",
     isSA?"Full academic access to every Ethan Digital Academy course, study material, PDF/Word export and course creation.":"Review and manage available course materials.",
     canCreateCourses()?`<button class="primary-btn" onclick="openCreateCourseForm()">Create Course</button>`:""
   )+
   `<div class="admin-course-summary">
      <div><small>TOTAL COURSE LIBRARY</small><strong>${list.length}</strong></div>
      <div><small>MATERIAL ACCESS</small><strong>Full</strong></div>
      <div><small>WORD / PDF</small><strong>Enabled</strong></div>
      <div><small>CREATE COURSE</small><strong>${canCreateCourses()?"Enabled":"Disabled"}</strong></div>
    </div>`+
   `<div class="learning-course-list">${list.map(c=>`<div class="learning-course-row staff-course-row">
      <div><small>${escHtml(c.code||"COURSE")}</small><strong>${escHtml(c.title)}</strong><span>${c.catalogue?"Ethan Digital Academy catalogue course":"Database course"} • Full study material available</span></div>
      <div class="staff-course-actions">
        <button class="secondary-btn" onclick="openCourseStudy('${encodeURIComponent(c.title||"Course")}')">Open Material</button>
        <button class="primary-btn" onclick="openCourseStudy('${encodeURIComponent(c.title||"Course")}')">PDF / Word</button>
      </div>
    </div>`).join("")}</div>`;
   return;
 }

 $("#content").innerHTML=pageHead("Learning Management","No course access available.");
}

function renderAssignments(){
 if(currentUser.role==="student" && !studentCourses().length){ $("#content").innerHTML=pageHead("Assignments","Assignments appear only for allocated courses.")+emptyState("No assignments","You have no allocated course yet."); return; }
 $("#content").innerHTML=pageHead("Assignments","Assignments for your allocated courses.",currentUser.role==="admin"||currentUser.role==="super_admin"||currentUser.role==="instructor"?`<button class="primary-btn">+ Create Assignment</button>`:"")+emptyState("No current assignments","Assignments will appear here when your instructor publishes them.");
}
function renderQuizzes(){
 if(currentUser.role==="student" && !studentCourses().length){ $("#content").innerHTML=pageHead("Quizzes & Examinations","Assessments are linked to allocated courses.")+emptyState("No assessments","You have no active course assessment yet."); return; }
 $("#content").innerHTML=pageHead("Quizzes & Examinations","Assessments published for allocated courses.")+emptyState("No current assessment","Your instructor will publish quizzes and examinations here.");
}
function renderAttendance(){
 const staff=["admin","super_admin","instructor"].includes(currentUser?.role||"");
 const action=staff&&data.students.length?'<button class="primary-btn" id="markAttendanceBtn">+ Mark attendance</button>':"";
 $("#content").innerHTML=pageHead("Attendance",staff?"Record and review learner attendance.":"Your personal attendance history.",action)+'<div class="card"><p class="muted">Loading attendance records…</p></div>';
 const backend=window.ETHAN_BACKEND;
 if(!backend?.ready){$("#content").innerHTML=pageHead("Attendance","Your attendance workspace.")+emptyState("Learning service unavailable","Reconnect to the LMS database and reload.");return;}
 (async()=>{
  try{
   const rows=await backend.listAttendance();
   const present=rows.filter(x=>x.status==="present").length,absent=rows.filter(x=>x.status==="absent").length,late=rows.filter(x=>x.status==="late").length;
   const summary=staff?'<div class="stats-grid">'+stat("Present",present,"Attendance records","✓")+stat("Absent",absent,"Attendance records","—")+stat("Late",late,"Attendance records","⏱")+stat("Records",rows.length,"All recorded sessions","📅")+'</div>':"";
   const body=rows.map(x=>{
    const learner=[x.student?.profiles?.first_name,x.student?.profiles?.last_name].filter(Boolean).join(" ")||x.student?.student_no||"Learner";
    const status=String(x.status||"recorded").toLowerCase();
    return '<tr><td>'+escHtml(new Date(x.attendance_date+"T00:00:00").toLocaleDateString())+'</td>'+(staff?'<td>'+escHtml(learner)+'</td>':"")+'<td>'+escHtml(x.course?.title||"General attendance")+'</td><td><span class="badge '+(status==="present"?"green":status==="absent"?"gold":"blue")+'">'+escHtml(status)+'</span></td></tr>';
   }).join("");
   $("#content").innerHTML=pageHead("Attendance",staff?"Record and review learner attendance.":"Your personal attendance history.",action)+summary+
    (body?'<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th>'+(staff?'<th>Learner</th>':"")+'<th>Course</th><th>Status</th></tr></thead><tbody>'+body+'</tbody></table></div></div>':emptyState("No attendance recorded yet",staff?"Use Mark attendance to record a class register.":"Your attendance will appear here when your instructor records a session."));
   const mark=$("#markAttendanceBtn");
   if(mark)mark.onclick=()=>{
    const learnerOptions=data.students.map(s=>'<option value="'+escHtml(s.id)+'">'+escHtml(s.name||s.studentNo||"Learner")+'</option>').join("");
    const courseOptions='<option value="">General / not course-specific</option>'+data.courses.map(c=>'<option value="'+escHtml(c.id)+'">'+escHtml(c.code||"")+' — '+escHtml(c.title)+'</option>').join("");
    const now=new Date(),localDate=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    showModal("Mark attendance","Record a learner's attendance for a class or course.",
     '<label>Learner<select id="attendanceStudent" required>'+learnerOptions+'</select></label><label>Course<select id="attendanceCourse">'+courseOptions+'</select></label><div class="grid-2"><label>Date<input id="attendanceDate" type="date" value="'+localDate+'" required></label><label>Status<select id="attendanceStatus"><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></label></div>',
     async()=>{
      const studentId=$("#attendanceStudent").value,date=$("#attendanceDate").value,status=$("#attendanceStatus").value,courseId=$("#attendanceCourse").value||null;
      if(!studentId||!date)return alert("Choose a learner and attendance date.");
      try{await backend.markAttendance({student_id:studentId,course_id:courseId,attendance_date:date,status,marked_by:currentUser.id});closeModal();renderAttendance();}
      catch(error){alert(error.message||"Attendance could not be saved.");}
     });
   };
  }catch(error){$("#content").innerHTML=pageHead("Attendance","Your attendance workspace.")+emptyState("Attendance could not be loaded",error.message||"Refresh and try again.");}
 })();
}
function renderResults(){
 const staff=["admin","super_admin","instructor"].includes(currentUser?.role||""),action=staff?'<button class="primary-btn" id="addResultBtn">+ Publish result</button>':"",backend=window.ETHAN_BACKEND;
 $("#content").innerHTML=pageHead("Results",staff?"Review and publish learner assessment results.":"Your published assessment results.",action)+'<div class="card"><p class="muted">Loading results…</p></div>';
 if(!backend?.ready){$("#content").innerHTML=pageHead("Results","Your academic results.")+emptyState("Learning service unavailable","Reconnect to the LMS database and reload.");return;}
 (async()=>{
  try{
   const rows=await backend.listResults();
   const body=rows.map(r=>{
    const learner=[r.student?.profiles?.first_name,r.student?.profiles?.last_name].filter(Boolean).join(" ")||r.student?.student_no||"Learner";
    return '<tr>'+(staff?'<td>'+escHtml(learner)+'</td>':"")+'<td>'+escHtml(r.course?.title||"Course")+'</td><td>'+escHtml(r.assessment_name||"Assessment")+'</td><td>'+Number(r.score||0)+'%</td><td>'+escHtml(r.grade||"—")+'</td><td><span class="badge '+(String(r.status||"").toLowerCase().includes("pass")?"green":"blue")+'">'+escHtml(r.status||"Published")+'</span></td></tr>';
   }).join("");
   $("#content").innerHTML=pageHead("Results",staff?"Review and publish learner assessment results.":"Your published assessment results.",action)+(body?'<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr>'+(staff?'<th>Learner</th>':"")+'<th>Course</th><th>Assessment</th><th>Score</th><th>Grade</th><th>Status</th></tr></thead><tbody>'+body+'</tbody></table></div></div>':emptyState("No published results yet",staff?"Published assessment outcomes will appear here. Use Publish result to add a verified result.":"Your instructor's published results will appear here."));
   const add=$("#addResultBtn");
   if(add)add.onclick=()=>{
    if(!data.students.length||!data.courses.length)return alert("Refresh the portal so learner and course lists can load.");
    const learners=data.students.map(s=>'<option value="'+escHtml(s.id)+'">'+escHtml(s.name||s.studentNo||"Learner")+'</option>').join("");
    const courses=data.courses.map(c=>'<option value="'+escHtml(c.id)+'">'+escHtml(c.code||"")+' — '+escHtml(c.title)+'</option>').join("");
    showModal("Publish assessment result","Publish a verified result to the learner's portal.",'<label>Learner<select id="resultStudent">'+learners+'</select></label><label>Course<select id="resultCourse">'+courses+'</select></label><label>Assessment name<input id="resultAssessment" required placeholder="e.g. Excel Practical Assessment"></label><div class="grid-2"><label>Score (%)<input id="resultScore" type="number" min="0" max="100" step="0.5" required></label><label>Grade<select id="resultGrade"><option>A</option><option>B</option><option>C</option><option>D</option><option>F</option></select></label></div><label>Status<select id="resultStatus"><option value="Passed">Passed</option><option value="Not passed">Not passed</option><option value="Completed">Completed</option></select></label><label class="checkbox"><input id="resultPublished" type="checkbox" checked> Publish to learner</label>',
     async()=>{
      const studentId=$("#resultStudent").value,courseId=$("#resultCourse").value,assessment=$("#resultAssessment").value.trim(),score=Number($("#resultScore").value),grade=$("#resultGrade").value,status=$("#resultStatus").value;
      if(!studentId||!courseId||!assessment||!Number.isFinite(score)||score<0||score>100)return alert("Complete the learner, course, assessment and valid score.");
      try{await backend.createResult({student_id:studentId,course_id:courseId,assessment_name:assessment,score,grade,status,published:$("#resultPublished").checked});closeModal();renderResults();}
      catch(error){alert(error.message||"The result could not be saved.");}
     });
   };
  }catch(error){$("#content").innerHTML=pageHead("Results","Your academic results.")+emptyState("Results could not be loaded",error.message||"Refresh and try again.");}
 })();
}
function renderCertificates(){
 const admin=["admin","super_admin"].includes(currentUser?.role||""),action=admin?'<button class="primary-btn" id="issueCertificateBtn">+ Issue certificate</button>':"",backend=window.ETHAN_BACKEND;
 if(!admin&&currentUser?.role!=="student"){$("#content").innerHTML=pageHead("Certificates","Certificate access is limited to learners and Academy administrators.")+emptyState("Access restricted","Contact an Academy administrator if you need certificate records.");return;}
 $("#content").innerHTML=pageHead("Certificates",admin?"Issue and manage verified learner certificates.":"Your earned Ethan Digital Academy certificates.",action)+'<div class="card"><p class="muted">Loading certificates…</p></div>';
 if(!backend?.ready){$("#content").innerHTML=pageHead("Certificates","Your certificate wallet.")+emptyState("Learning service unavailable","Reconnect to the LMS database and reload.");return;}
 (async()=>{
  try{
   const rows=await backend.listCertificates(currentUser?.role==="student"?portalState.myStudent?.id:null);
   const body=rows.map(c=>{
    const learner=[c.student?.profiles?.first_name,c.student?.profiles?.last_name].filter(Boolean).join(" ")||c.student?.student_no||"Learner";
    return '<tr><td>'+escHtml(c.certificate_no||"—")+'</td>'+(admin?'<td>'+escHtml(learner)+'</td>':"")+'<td>'+escHtml(c.course?.title||"Course")+'</td><td>'+escHtml(c.issued_at?new Date(c.issued_at).toLocaleDateString():"—")+'</td><td><span class="badge green">'+escHtml(c.status||"valid")+'</span></td><td><code>'+escHtml(c.verification_code||"")+'</code></td></tr>';
   }).join("");
   $("#content").innerHTML=pageHead("Certificates",admin?"Issue and manage verified learner certificates.":"Your earned Ethan Digital Academy certificates.",action)+(body?'<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Certificate ID</th>'+(admin?'<th>Learner</th>':"")+'<th>Course</th><th>Issue date</th><th>Status</th><th>Verification code</th></tr></thead><tbody>'+body+'</tbody></table></div></div>':emptyState("No certificates issued yet",admin?"Certificates you issue will be listed here.":"Complete your course requirements to qualify for a certificate."));
   const issue=$("#issueCertificateBtn");
   if(issue)issue.onclick=()=>{
    if(!data.students.length||!data.courses.length)return alert("Refresh the portal so learner and course lists can load.");
    const learners=data.students.map(s=>'<option value="'+escHtml(s.id)+'">'+escHtml(s.name||s.studentNo||"Learner")+'</option>').join("");
    const courses=data.courses.map(c=>'<option value="'+escHtml(c.id)+'">'+escHtml(c.code||"")+' — '+escHtml(c.title)+'</option>').join("");
    showModal("Issue certificate","Issue a certificate for a completed course.",'<label>Learner<select id="certificateStudent">'+learners+'</select></label><label>Course<select id="certificateCourse">'+courses+'</select></label>',
     async()=>{
      const studentId=$("#certificateStudent").value,courseId=$("#certificateCourse").value;
      if(!studentId||!courseId)return alert("Choose a learner and course.");
      try{await backend.issueCertificate({certificate_no:"EDA-CERT-"+Date.now(),student_id:studentId,course_id:courseId,status:"valid"});closeModal();renderCertificates();}
      catch(error){alert(error.message||"The certificate could not be issued.");}
     });
   };
  }catch(error){$("#content").innerHTML=pageHead("Certificates","Your certificate wallet.")+emptyState("Certificates could not be loaded",error.message||"Refresh and try again.");}
 })();
}

async function allocateAfterPayment(student,course,amount,description){
 if(window.ETHAN_BACKEND?.ready){
   const reference=`EDA-PAY-${Date.now()}`;
   await window.ETHAN_BACKEND.createPayment({reference,student_id:student.id,description:description||course.title,amount,method:"bank_transfer",verified:true,verified_by:currentUser.id});
   await window.ETHAN_BACKEND.createEnrolment({student_id:student.id,course_id:course.id,status:"active"});
   return reference;
 }
 const reference=`EDA-PAY-${1000+data.payments.length+1}`;
 data.payments.unshift({ref:reference,student:student.name,studentId:student.id,description:description||course.title,amount,date:new Date().toISOString().slice(0,10),status:"Confirmed",courseCode:course.code});
 if(!data.enrolments.some(e=>e.studentId===student.id && (e.courseId===(course.id||course.code) || e.courseCode===course.code))){
   data.enrolments.push({studentId:student.id,courseId:course.id||course.code,courseCode:course.code,status:"active",allocatedAt:new Date().toISOString()});
 }
 student.payment="Paid"; student.program=course.title; student.status="Active"; persist(); return reference;
}

function renderPayments(){
 if(currentUser.role==="student"){
   const localPayments=portalState.myPayments?.length ? portalState.myPayments : data.payments.filter(p=>(p.studentId && p.studentId===portalState.myStudent?.id) || (!p.studentId && p.student===currentUser.name));
   const courses=studentCourses();
   $("#content").innerHTML=pageHead("Fees & Payments","Payment must be verified before course access is allocated.")+`
     <div class="stats-grid">${stat("Course Access",courses.length?"Active":"Pending",courses.length?"Course allocated":"Awaiting verified payment","🔐")}${stat("Allocated Courses",String(courses.length),"After payment confirmation","📚")}${stat("Recorded Payments",String(localPayments.length),"Your account","💳")}${stat("Learning Access",courses.length?"Open":"Locked",courses.length?"Enrolled":"No enrolment","▶")}</div>
     ${courses.length?emptyState("Payment verified / course allocated","Your approved course access is active. Open My Courses to start learning.",`<button class="primary-btn" onclick="navigate('courses')">Open My Courses</button>`):emptyState("Payment required before allocation","Registering creates your student account only. Make payment through the Academy's approved payment method. Admin will verify it and allocate the course you paid for; only then will lessons/videos open.")}`;
   return;
 }
 const canVerify=currentUser.role==="admin"||currentUser.role==="super_admin";
 $("#content").innerHTML=pageHead("Fees, Payments & Course Allocation","Verify a learner's payment and allocate exactly the course paid for.",canVerify?`<button class="primary-btn" id="recordPaymentBtn">+ Verify Payment & Allocate Course</button>`:"")+`
   <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Reference</th><th>Student</th><th>Description / Course</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>${data.payments.map(p=>`<tr><td>${p.ref||p.reference||"—"}</td><td>${p.student||"Student"}</td><td>${p.description||"Training Fee"}</td><td>₦${Number(p.amount||0).toLocaleString()}</td><td>${p.date||"—"}</td><td><span class="badge green">${p.status||"Confirmed"}</span></td></tr>`).join("")||`<tr><td colspan="6">No payments recorded yet.</td></tr>`}</tbody></table></div></div>`;
 if($("#recordPaymentBtn")) $("#recordPaymentBtn").onclick=()=>{ if(!data.students.length) return alert("No registered learner is available yet."); if(!data.courses.length) return alert("Create at least one course before allocating payment."); showModal("Verify Payment & Allocate Course","Choose the learner and the exact paid course. Saving confirms payment and creates the enrolment.",`
   <label>Student<select id="payStudent">${data.students.map(s=>`<option value="${s.id}">${s.name} ${s.studentNo?`(${s.studentNo})`:""}</option>`).join("")}</select></label>
   <label>Course<select id="payCourse">${data.courses.map(c=>`<option value="${c.id||c.code}">${c.title}${c.fee?` — ₦${Number(c.fee).toLocaleString()}`:""}</option>`).join("")}</select></label>
   <label>Amount received<input id="payAmount" type="number" min="1" required></label><label>Payment description<input id="payDesc" placeholder="Training fee / bank transfer"></label>
 `,async()=>{const student=data.students.find(s=>s.id===$("#payStudent").value),course=data.courses.find(c=>(c.id||c.code)===$("#payCourse").value),amount=Number($("#payAmount").value);if(!student||!course||!amount)return alert("Select student, course and enter a valid payment amount.");try{const ref=await allocateAfterPayment(student,course,amount,$("#payDesc").value.trim());closeModal();alert(`Payment ${ref} verified. ${course.title} has been allocated to ${student.name}.`);renderPayments();}catch(err){alert(err.message||"Payment could not be verified or course allocated.")}}); };
}

// v7 public header convenience action
window.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-jump-auth]').forEach(btn=>btn.addEventListener('click',()=>{
    const target=btn.dataset.jumpAuth;
    document.querySelector(`.auth-tab[data-auth-tab="${target}"]`)?.click();
    document.querySelector('.professional-card')?.scrollIntoView({behavior:'smooth',block:'center'});
  }));
});




function renderParents(){
  $("#content").innerHTML=pageHead("Parent Accounts","Parent registration is not part of the current public learner model.")+
    emptyState("Parent module not in active use","Current public account categories are Student, Professional and Business Owner.");
}

/* v8.5 production audit overrides */
function renderTimetable(){
  $("#content").innerHTML=pageHead("Timetable","Classes and schedules appear here when they are published.")+
    emptyState("No timetable published yet","There are no scheduled classes to display at the moment.");
}

function renderAnnouncements(){
  const items=Array.isArray(data.announcements)?data.announcements:[];
  const canPost=["admin","super_admin","instructor"].includes(currentUser.role);
  $("#content").innerHTML=pageHead("Announcements","Academy updates and important information.",canPost?`<button class="primary-btn" id="newAnnouncementBtn">+ New Announcement</button>`:"")+
    (items.length?`<div class="progress-list">${items.map(a=>`<div class="section-row"><strong>${a.title}</strong><p>${a.message}</p><small class="muted">${a.date||""}</small></div>`).join("")}</div>`:
    emptyState("No announcements yet","Published Academy announcements will appear here."));
  if($("#newAnnouncementBtn")) $("#newAnnouncementBtn").onclick=()=>showModal("New Announcement","Publish an academy announcement.",
    `<label>Title<input id="annTitle"></label><label>Message<textarea id="annMsg" rows="4"></textarea></label>`,async()=>{
      const title=$("#annTitle").value.trim(), message=$("#annMsg").value.trim();
      if(!title||!message) return alert("Complete title and message.");
      try{
        if(window.ETHAN_BACKEND?.ready){
          const a=await window.ETHAN_BACKEND.createAnnouncement({title,message,audience:"all",created_by:currentUser.id});
          data.announcements.unshift({id:a.id,title:a.title,message:a.message,date:a.created_at?new Date(a.created_at).toLocaleDateString():"Today"});
        }else{
          data.announcements.unshift({title,message,date:new Date().toLocaleDateString()});persist();
        }
        closeModal();renderAnnouncements();
      }catch(err){alert(err.message||"Announcement could not be published.");}
    });
}

function renderReports(){
  if(!["admin","super_admin"].includes(currentUser.role)){
    $("#content").innerHTML=emptyState("Access restricted","Reports are available to Admin and Super Admin.");
    return;
  }
  $("#content").innerHTML=pageHead("Reports","Open live operational areas to review current academy records.")+
  `<div class="module-links">
    <button class="module-link" onclick="navigate('students')"><strong>Learner Records</strong><span>Review registrations and learner status →</span></button>
    <button class="module-link" onclick="navigate('courses')"><strong>Course Catalogue</strong><span>Review courses and publication status →</span></button>
    <button class="module-link" onclick="navigate('payments')"><strong>Payments & Allocations</strong><span>Review verified payments and enrolments →</span></button>
    <button class="module-link" onclick="navigate('attendance')"><strong>Attendance</strong><span>Review attendance when records are available →</span></button>
    <button class="module-link" onclick="navigate('results')"><strong>Results</strong><span>Review published assessment results →</span></button>
    <button class="module-link" onclick="navigate('certificates')"><strong>Certificates</strong><span>Review issued certificates →</span></button>
  </div>`;
}

function renderSettings(){
  if(!["admin","super_admin"].includes(currentUser.role)){
    $("#content").innerHTML=emptyState("Access restricted","Settings are available to Admin and Super Admin.");
    return;
  }
  const connected=Boolean(window.ETHAN_BACKEND?.ready);
  $("#content").innerHTML=pageHead("Settings","Academy identity and platform connection status.")+`
   <div class="settings-layout">
    <div class="settings-section">
      <h3>Academy</h3>
      <label>Academy Name<input id="academyNameSetting" value="Ethan Digital Academy"></label>
      <label>Website<input id="academyWebsiteSetting" value="https://ethandigitalacademy.org"></label>
      <button class="primary-btn" id="saveAcademySettings">Save Settings</button>
    </div>
    <div class="settings-section">
      <h3>Platform Status</h3>
      <p><span class="badge ${connected?"green":"gold"}">${connected?"Neon Connected":"Neon Not Connected"}</span></p>
      <p class="muted">${connected?"Authentication and database services are connected.":"Check the dedicated Neon project and Vercel server environment if the service is unavailable."}</p>
    </div>
   </div>`;
  $("#saveAcademySettings").onclick=()=>{
    localStorage.setItem("ethan_academy_settings",JSON.stringify({
      name:$("#academyNameSetting").value.trim(),
      website:$("#academyWebsiteSetting").value.trim()
    }));
    alert("Settings saved in this browser.");
  };
}

function renderNotifications(){
  const items=Array.isArray(data.notifications)?data.notifications:[];
  $("#notificationList").innerHTML=items.length
    ? items.map(n=>`<div class="notification-item"><strong>${n.title}</strong><div>${n.message}</div><small>${n.time||""}</small></div>`).join("")
    : `<div class="notification-item"><strong>No new notifications</strong><div>Important account and learning updates will appear here.</div></div>`;
}


const ETHAN_FX_RATES={NGN:1,USD:1/1500,GBP:1/2000,EUR:1/1750};
let ethanDisplayCurrency=localStorage.getItem("ethan_display_currency")||"NGN";
function formatCoursePrice(feeNGN,currency=ethanDisplayCurrency){
 const amount=Number(feeNGN||0)*(ETHAN_FX_RATES[currency]||1);
 const rounded=currency==="NGN"?Math.round(amount/1000)*1000:Math.round(amount);
 return new Intl.NumberFormat(currency==="NGN"?"en-NG":"en-GB",{style:"currency",currency,maximumFractionDigits:0}).format(rounded);
}
function updateCatalogueCurrency(currency){
 ethanDisplayCurrency=currency;localStorage.setItem("ethan_display_currency",currency);
 const s=document.getElementById("courseCatalogueSelect"),p=document.getElementById("courseBriefPrice");
 if(s&&s.value!==""&&p){const c=ETHAN_PUBLIC_COURSES[Number(s.value)];if(c)p.textContent="FREE";}
}

const ETHAN_PUBLIC_COURSES = [
  {
    "name": "Computer Appreciation",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Microsoft Word",
    "brief": "Learn to create, format and manage professional documents for academic, office and business use.",
    "feeNGN": 0
  },
  {
    "name": "Microsoft Excel",
    "brief": "Learn practical spreadsheet skills for organizing data, calculations, analysis, reporting and everyday business work.",
    "feeNGN": 0
  },
  {
    "name": "Microsoft PowerPoint",
    "brief": "Learn to design and deliver clear, professional presentations using effective layouts, visuals and presentation tools.",
    "feeNGN": 0
  },
  {
    "name": "Microsoft Access",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Google Workspace",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Internet & Email Skills",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "Typing & Keyboard Mastery",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Computer Hardware Fundamentals",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Computer Maintenance",
    "brief": "Learn safe preventive maintenance, software updates, storage care, backups, performance checks, troubleshooting and maintenance planning.",
    "feeNGN": 0
  },
  {
    "name": "IT Support Fundamentals",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Windows Productivity",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "File Management & Cloud Storage",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Cybersecurity Awareness",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Digital Literacy",
    "brief": "Build confident, critical and responsible digital skills for devices, online research, communication, privacy, security, content creation, cloud collaboration and AI literacy.",
    "feeNGN": 0
  },
  {
    "name": "Canva Graphic Design",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "Advanced Canva Design",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "Adobe Photoshop Basics",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "CorelDRAW Essentials",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "Brand Identity Design",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "Social Media Graphics",
    "brief": "Learn how to use major digital platforms professionally for communication, content, audience growth and business development.",
    "feeNGN": 0
  },
  {
    "name": "Flyer & Poster Design",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "Logo Design Fundamentals",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "UI/UX Design Fundamentals",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "Figma for Beginners",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "CapCut Video Editing",
    "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.",
    "feeNGN": 0
  },
  {
    "name": "Advanced Video Editing",
    "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.",
    "feeNGN": 0
  },
  {
    "name": "Content Creation",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Mobile Photography",
    "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.",
    "feeNGN": 0
  },
  {
    "name": "Digital Storytelling",
    "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.",
    "feeNGN": 0
  },
  {
    "name": "Facebook Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Instagram Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "TikTok Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "YouTube Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "LinkedIn Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "WhatsApp Business Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Social Media Management",
    "brief": "Learn how to use major digital platforms professionally for communication, content, audience growth and business development.",
    "feeNGN": 0
  },
  {
    "name": "Content Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Email Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "SEO Fundamentals",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Advanced SEO",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Search Engine Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Google Ads Fundamentals",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Meta Ads Fundamentals",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Marketing Analytics",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Digital Marketing Strategy",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Influencer Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Affiliate Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Personal Branding",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Online Reputation Management",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Artificial Intelligence Fundamentals",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "AI for Business",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "Prompt Engineering",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "Generative AI Tools",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "ChatGPT for Productivity",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "AI Content Creation",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "AI for Digital Marketing",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "AI for Education",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "AI Automation",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "Responsible AI",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "Web Design Fundamentals",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "HTML & CSS",
    "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.",
    "feeNGN": 0
  },
  {
    "name": "JavaScript Fundamentals",
    "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.",
    "feeNGN": 0
  },
  {
    "name": "WordPress Website Design",
    "brief": "Learn to create, format and manage professional documents for academic, office and business use.",
    "feeNGN": 0
  },
  {
    "name": "No-Code Website Building",
    "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.",
    "feeNGN": 0
  },
  {
    "name": "E-commerce Website Setup",
    "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.",
    "feeNGN": 0
  },
  {
    "name": "Landing Page Design",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "Web Hosting & Domains",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "Website SEO",
    "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.",
    "feeNGN": 0
  },
  {
    "name": "Website Maintenance",
    "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.",
    "feeNGN": 0
  },
  {
    "name": "Python for Beginners",
    "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.",
    "feeNGN": 0
  },
  {
    "name": "JavaScript Programming",
    "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.",
    "feeNGN": 0
  },
  {
    "name": "Database Fundamentals",
    "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.",
    "feeNGN": 0
  },
  {
    "name": "SQL Fundamentals",
    "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.",
    "feeNGN": 0
  },
  {
    "name": "Supabase Fundamentals",
    "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.",
    "feeNGN": 0
  },
  {
    "name": "Git & GitHub",
    "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.",
    "feeNGN": 0
  },
  {
    "name": "Software Development Basics",
    "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.",
    "feeNGN": 0
  },
  {
    "name": "API Fundamentals",
    "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.",
    "feeNGN": 0
  },
  {
    "name": "Automation with No-Code Tools",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "App Development Fundamentals",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Data Analysis Fundamentals",
    "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.",
    "feeNGN": 0
  },
  {
    "name": "Excel Data Analysis",
    "brief": "Learn practical spreadsheet skills for organizing data, calculations, analysis, reporting and everyday business work.",
    "feeNGN": 0
  },
  {
    "name": "Power BI Fundamentals",
    "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.",
    "feeNGN": 0
  },
  {
    "name": "Google Sheets Advanced",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "Data Visualization",
    "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.",
    "feeNGN": 0
  },
  {
    "name": "Business Intelligence",
    "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.",
    "feeNGN": 0
  },
  {
    "name": "Basic Statistics for Data",
    "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.",
    "feeNGN": 0
  },
  {
    "name": "Data Cleaning",
    "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.",
    "feeNGN": 0
  },
  {
    "name": "Dashboard Design",
    "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.",
    "feeNGN": 0
  },
  {
    "name": "Reporting & Analytics",
    "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.",
    "feeNGN": 0
  },
  {
    "name": "Entrepreneurship in the Digital Age",
    "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.",
    "feeNGN": 0
  },
  {
    "name": "Digital Business Fundamentals",
    "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.",
    "feeNGN": 0
  },
  {
    "name": "E-commerce Fundamentals",
    "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.",
    "feeNGN": 0
  },
  {
    "name": "Online Business Setup",
    "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.",
    "feeNGN": 0
  },
  {
    "name": "Freelancing Fundamentals",
    "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.",
    "feeNGN": 0
  },
  {
    "name": "Remote Work Skills",
    "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.",
    "feeNGN": 0
  },
  {
    "name": "Customer Relationship Management",
    "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.",
    "feeNGN": 0
  },
  {
    "name": "ERP Fundamentals",
    "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.",
    "feeNGN": 0
  },
  {
    "name": "CRM Fundamentals",
    "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.",
    "feeNGN": 0
  },
  {
    "name": "Project Management Fundamentals",
    "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.",
    "feeNGN": 0
  }
];


document.addEventListener('DOMContentLoaded', () => {
  const browseBtn = document.getElementById('browseCoursesBtn');
  const wrap = document.getElementById('catalogueDropdownWrap');
  const select = document.getElementById('courseCatalogueSelect');
  const panel = document.getElementById('catalogueBriefPanel');
  const title = document.getElementById('courseBriefTitle');
  const text = document.getElementById('courseBriefText');

  if (!browseBtn || !wrap || !select || !panel || !Array.isArray(ETHAN_PUBLIC_COURSES)) return;

  if (!select.dataset.loaded) {
    ETHAN_PUBLIC_COURSES.forEach((course, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = course.name;
      select.appendChild(option);
    });
    select.dataset.loaded = 'true';
  }

  browseBtn.addEventListener('click', () => {
    wrap.classList.toggle('hidden');
    if (!wrap.classList.contains('hidden')) {
      select.focus();
      browseBtn.textContent = 'Hide Courses';
    } else {
      browseBtn.textContent = 'Browse Courses';
      panel.classList.add('hidden');
      select.value = '';
    }
  });

  select.addEventListener('change', () => {
    const index = Number(select.value);
    if (!Number.isInteger(index) || !ETHAN_PUBLIC_COURSES[index]) {
      panel.classList.add('hidden');
      return;
    }
    const course = ETHAN_PUBLIC_COURSES[index];
    title.textContent = course.name;
    text.textContent = course.brief;
    panel.classList.remove('hidden');
  });
});

window.addEventListener("DOMContentLoaded",()=>{
 const cur=document.getElementById("catalogueCurrencySelect");
 if(cur){cur.value=ethanDisplayCurrency;cur.addEventListener("change",()=>updateCatalogueCurrency(cur.value));}
 const s=document.getElementById("courseCatalogueSelect");
 if(s)s.addEventListener("change",()=>{const c=ETHAN_PUBLIC_COURSES[Number(s.value)],p=document.getElementById("courseBriefPrice");if(c&&p)p.textContent="FREE";});
});

/* v9.1 approved bank payment page */
function renderPayments(){
 if(currentUser.role==="student"){
   const courses=studentCourses();
   $("#content").innerHTML=pageHead("Free Learning Access","Every published Ethan Digital Academy course is included with your free account.")+
     `<div class="stats-grid">${stat("Free Courses","100","Included with registration","📚")}${stat("My Courses",String(courses.length),"Available now","🎓")}${stat("Course Fee","FREE","No payment required","✓")}${stat("Learning Status","Active","Study materials available","▶")}</div>`+
     emptyState("No course payment is required","Continue to My Courses or the Learning Area. Payments do not control your course access.",`<button class="primary-btn" onclick="navigate('courses')">Browse Free Courses</button>`);
   return;
 }
 if(!["admin","super_admin"].includes(currentUser.role)){
   $("#content").innerHTML=pageHead("Payments","Payment information.")+approvedBankPaymentHtml();
   return;
 }
 const rows=(data.payments||[]).map(p=>[
   escHtml(p.student||p.student_name||p.student_id||"Learner"),
   escHtml(String(p.amount||"")),
   statusBadge(p.status||"pending"),
   escHtml(p.description||p.reference||"Course payment")
 ]);
 $("#content").innerHTML=pageHead("Finance Records","Manage optional academy payment records. These records do not control free course access.")+
   approvedBankPaymentHtml()+
   `<section class="payment-history-section"><div class="student-section-head"><div><span class="eyebrow">ADMINISTRATION</span><h2>Payment Records</h2></div></div>
   ${rows.length?table(["Learner","Amount","Status","Description"],rows):emptyState("No payment records","Verified and pending payment records will appear here.")}</section>`;
}


/* ETHAN LEARN learner-experience and assessment release */
function courseCards(list){
  const rows=Array.isArray(list)?list:[];
  return rows.length?'<div class="course-grid">'+rows.map(c=>{
    const title=String(c.title||"Course"),encoded=encodeURIComponent(title);
    const progress=Math.max(0,Math.min(100,Number(c.progress||0)));
    return '<article class="course-card"><div class="course-thumb"><strong>'+escHtml(c.category||"Digital Course")+'</strong></div><div class="course-body"><small class="muted">'+escHtml(c.code||"")+'</small><h3>'+escHtml(title)+'</h3><p class="muted">'+escHtml(c.instructor||"Ethan Digital Academy")+'</p><div class="course-meta"><span>'+escHtml(c.duration||"Self-paced")+'</span><span>'+progress+'%</span></div><div class="progress"><span style="width:'+progress+'%"></span></div><div class="course-card-actions"><button class="primary-btn" onclick="openCourseStudy(\''+encoded+'\')">'+(currentUser?.role==="student"?"Open Study Material":"Preview Course")+'</button><button class="secondary-btn" onclick="navigate(\'lms\')">'+(currentUser?.role==="student"?"Learning Area":"Course Library")+'</button></div></div></article>';
  }).join("")+'</div>':emptyState("No courses to display","Published courses will appear here when they are available.");
}

function renderCourses(){
  const learner=currentUser?.role==="student";
  const rows=learner?studentCourses():(data.courses||[]);
  const canCreate=["admin","super_admin","instructor"].includes(currentUser?.role||"");
  const action=canCreate?'<button class="primary-btn" id="addCourseBtn">+ Create Course</button>':"";
  $("#content").innerHTML=pageHead(learner?"My Courses":"Course Library",learner?"Your included digital courses and study materials.":"Manage the Academy course catalogue.",action)+
    (rows.length?courseCards(rows):emptyState(learner?"Your courses are being prepared":"No courses available","Published Academy courses will appear here."));
  const add=$("#addCourseBtn");
  if(add)add.onclick=()=>showModal("Create a course","Add a course to the ETHAN LEARN catalogue.",`
    <label>Course title<input id="courseTitle" required></label>
    <div class="grid-2"><label>Category<input id="courseCat" required></label><label>Duration<input id="courseDur" placeholder="Self-paced or 6 weeks"></label></div>
    <label>Course description<textarea id="courseDescription" rows="3"></textarea></label>
  `,async()=>{
    const title=$("#courseTitle").value.trim(),category=$("#courseCat").value.trim(),duration=$("#courseDur").value.trim(),description=$("#courseDescription").value.trim();
    if(!title||!category)return alert("Enter a course title and category.");
    try{
      if(!window.ETHAN_BACKEND?.ready)throw new Error("The learning database is unavailable. Try again after reconnecting.");
      const code="EDA-CRS-"+Date.now().toString().slice(-8);
      const created=await window.ETHAN_BACKEND.createCourse({code,title,description,duration:duration||"Self-paced",difficulty:category,published:false,created_by:currentUser.id});
      data.courses.unshift({id:created.id,code:created.code,title:created.title,category:created.difficulty||category,duration:created.duration||"Self-paced",progress:0,lessons:0,completed:0,published:created.published});
      closeModal();renderCourses();
    }catch(error){alert(error.message||"The course could not be saved.");}
  });
}

function renderDashboardLegacy(){
  const role=currentUser?.role||"student";
  if(role==="parent"){
    $("#content").innerHTML=pageHead("Parent access","Parent and guardian accounts are not enabled in this LMS release.")+
      emptyState("Parent portal not yet enabled","Learner accounts, course study and instructor assessment are the active learning journeys. No sample child or attendance information is shown.");
    return;
  }
  if(role==="instructor"){
    $("#content").innerHTML=`
      <section class="hero-card"><div><span class="eyebrow">INSTRUCTOR WORKSPACE</span><h1>Welcome, ${escHtml(currentUser.firstName||"Instructor")}</h1><p>Manage course content and support learners with published assignments and assessments.</p></div><div class="hero-actions"><button class="secondary-btn" onclick="navigate('courses')">Course Library</button><button class="secondary-btn" onclick="navigate('assignments')">Assignments</button></div></section>
      <div class="stats-grid">${stat("Course Library",(data.courses||[]).length,"Courses available","📚")}${stat("Learner Records",(data.students||[]).length,"Live database records","👥")}${stat("Assignments","Open module","Current submissions","📝")}${stat("Quizzes","Open module","Published assessments","✅")}</div>
      <div class="dashboard-grid"><div class="card"><div class="card-head"><h3>Teaching tools</h3></div><div class="quick-grid"><button class="quick-card" onclick="navigate('assignments')"><strong>Assignments</strong><p class="muted">Create tasks and grade submissions</p></button><button class="quick-card" onclick="navigate('quizzes')"><strong>Quizzes & exams</strong><p class="muted">Create assessments and view results</p></button><button class="quick-card" onclick="navigate('courses')"><strong>Course materials</strong><p class="muted">Review the digital course library</p></button></div></div></div>`;
    return;
  }
  const students=(data.students||[]).length;
  const courses=(data.courses||[]).filter(c=>c.published!==false).length;
  const instructors=(data.instructors||[]).length;
  const verified=(data.payments||[]).filter(p=>p.verified||String(p.status||"").toLowerCase()==="verified"||String(p.status||"").toLowerCase()==="confirmed");
  const revenue=verified.reduce((sum,p)=>sum+Number(p.amount||0),0);
  const money=new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(revenue);
  $("#content").innerHTML=`
    <section class="hero-card"><div><span class="eyebrow">ACADEMY LEARNING OPERATIONS</span><h1>Welcome back, ${escHtml(currentUser.firstName||"Administrator")}</h1><p>Oversee the learning catalogue, learner records, instruction and assessment activity.</p></div><div class="hero-actions"><button class="secondary-btn" onclick="navigate('students')">Learners</button><button class="secondary-btn" onclick="navigate('courses')">Courses</button></div></section>
    <div class="stats-grid">${stat("Learners",students,"Registered learner records","👥")}${stat("Published Courses",courses,"Live course catalogue","📚")}${stat("Instructors",instructors,"Registered teaching staff","🧑‍🏫")}${stat("Recorded Payments",money,"Verified payment records","💳")}</div>
    <div class="dashboard-grid"><div class="card"><div class="card-head"><h3>Learning administration</h3></div><div class="quick-grid"><button class="quick-card" onclick="navigate('students')"><strong>Learners</strong><p class="muted">Review learner accounts</p></button><button class="quick-card" onclick="navigate('courses')"><strong>Courses</strong><p class="muted">Manage course catalogue</p></button><button class="quick-card" onclick="navigate('assignments')"><strong>Assignments</strong><p class="muted">Review submissions</p></button><button class="quick-card" onclick="navigate('quizzes')"><strong>Quizzes</strong><p class="muted">Manage assessments</p></button></div></div><div class="card"><div class="card-head"><h3>Platform data</h3></div><p class="muted">Dashboard figures are based on records currently returned by the LMS database. Empty records are shown as zero rather than example data.</p><p><strong>${students}</strong> learner profiles currently loaded.</p><p><strong>${courses}</strong> published courses currently loaded.</p></div></div>`;
}

function renderAssignments(){
  const staff=["admin","super_admin","instructor"].includes(currentUser?.role||"");
  const backend=window.ETHAN_BACKEND;
  $("#content").innerHTML=pageHead("Assignments",staff?"Create practical tasks and review learner submissions.":"Complete practical tasks and review instructor feedback.",staff?'<button class="primary-btn" id="createAssignmentBtn">+ Create Assignment</button>':"")+
    '<div class="card"><p class="muted">Loading assignments…</p></div>';
  if(!backend?.ready){$("#content").innerHTML=pageHead("Assignments","Your assignment workspace.")+emptyState("Learning service unavailable","Reconnect to the LMS database and reload this page.");return;}
  (async()=>{
    try{
      const [assignments,submissions]=await Promise.all([backend.listAssignments(),backend.listAssignmentSubmissions()]);
      if(currentUser.role==="student"){
        const own=submissions||[];
        const cards=(assignments||[]).map(a=>{
          const submission=own.find(s=>s.assignment_id===a.id);
          const submitted=submission?'<span class="badge green">Submitted</span>': '<span class="badge gold">Not submitted</span>';
          const course=a.course?.title||"Course";
          const due=a.due_at?new Date(a.due_at).toLocaleString():"No deadline set";
          return '<article class="card assignment-card"><div class="card-head"><div><small class="eyebrow">'+escHtml(course)+'</small><h3>'+escHtml(a.title)+'</h3></div>'+submitted+'</div><p>'+escHtml(a.instructions||"Complete the practical task and submit your work.")+'</p><div class="course-meta"><span>Maximum marks: '+Number(a.max_marks||100)+'</span><span>Due: '+escHtml(due)+'</span></div>'+(submission?'<p class="muted">Submitted: '+escHtml(new Date(submission.submitted_at).toLocaleString())+'</p>'+(submission.score!==null&&submission.score!==undefined?'<p><strong>Score: '+Number(submission.score)+' / '+Number(a.max_marks||100)+'</strong></p><p>'+escHtml(submission.feedback||"No feedback added yet.")+'</p>':'<p class="muted">Your submission is awaiting review.</p>'):'<button class="primary-btn" data-submit-assignment="'+a.id+'">Submit assignment</button>')+'</article>';
        }).join("");
        $("#content").innerHTML=pageHead("Assignments","Practical activities linked to your courses.")+(cards?'<div class="dashboard-grid">'+cards+'</div>':emptyState("No assignments published","Your instructor's assignments will appear here when they are published."));
        $$("[data-submit-assignment]").forEach(btn=>btn.onclick=()=>openStudentAssignment(btn.dataset.submitAssignment,assignments));
      }else{
        const assignmentCards=(assignments||[]).map(a=>'<article class="card"><div class="card-head"><div><small class="eyebrow">'+escHtml(a.course?.title||"Course")+'</small><h3>'+escHtml(a.title)+'</h3></div><span class="badge blue">'+Number(a.max_marks||100)+' marks</span></div><p>'+escHtml(a.instructions||"No instructions added.")+'</p><small class="muted">Due: '+(a.due_at?escHtml(new Date(a.due_at).toLocaleString()):"No deadline")+'</small></article>').join("");
        const submissionRows=(submissions||[]).map(s=>{
          const name=[s.student?.profiles?.first_name,s.student?.profiles?.last_name].filter(Boolean).join(" ")||s.student?.student_no||"Learner";
          return '<tr><td>'+escHtml(name)+'</td><td>'+escHtml(s.assignment?.title||"Assignment")+'</td><td>'+escHtml(new Date(s.submitted_at).toLocaleString())+'</td><td>'+(s.score===null||s.score===undefined?"Pending":Number(s.score))+'</td><td><button class="secondary-btn" data-grade-assignment="'+s.id+'">Grade</button></td></tr>';
        }).join("");
        $("#content").innerHTML=pageHead("Assignments","Create and manage practical tasks.")+
          '<div class="student-section"><div class="student-section-head"><div><h2>Published & draft assignments</h2></div></div>'+(assignmentCards?'<div class="dashboard-grid">'+assignmentCards+'</div>':emptyState("No assignments created","Create an assignment to give learners a practical task."))+'</div>'+
          '<div class="student-section"><div class="student-section-head"><div><h2>Learner submissions</h2></div></div>'+(submissionRows?'<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Learner</th><th>Assignment</th><th>Submitted</th><th>Score</th><th>Action</th></tr></thead><tbody>'+submissionRows+'</tbody></table></div></div>':emptyState("No submissions yet","Learner submissions will appear here."))+'</div>';
        const create=$("#createAssignmentBtn");if(create)create.onclick=()=>openCreateAssignment(assignments);
        $$("[data-grade-assignment]").forEach(btn=>btn.onclick=()=>openGradeAssignment(btn.dataset.gradeAssignment,submissions));
      }
    }catch(error){
      $("#content").innerHTML=pageHead("Assignments","Your learning assessment workspace.")+emptyState("Assignments could not be loaded",error.message||"Refresh the page and try again.");
    }
  })();
}

function openCreateAssignment(){
  const options=(data.courses||[]).filter(c=>c.id).map(c=>'<option value="'+escHtml(c.id)+'">'+escHtml(c.code+" — "+c.title)+'</option>').join("");
  if(!options)return alert("No database courses are available. Refresh the course catalogue first.");
  showModal("Create assignment","Publish a practical task for learners.",`
    <label>Course<select id="assignmentCourse">${options}</select></label>
    <label>Assignment title<input id="assignmentTitle" required></label>
    <label>Instructions<textarea id="assignmentInstructions" rows="4" required></textarea></label>
    <div class="grid-2"><label>Maximum marks<input id="assignmentMarks" type="number" min="1" value="100" required></label><label>Due date<input id="assignmentDue" type="datetime-local"></label></div>
  `,async()=>{
    const courseId=$("#assignmentCourse").value,title=$("#assignmentTitle").value.trim(),instructions=$("#assignmentInstructions").value.trim(),maxMarks=Number($("#assignmentMarks").value),due=$("#assignmentDue").value;
    if(!courseId||!title||!instructions||!maxMarks||maxMarks<1)return alert("Complete the course, title, instructions and maximum marks.");
    try{
      await window.ETHAN_BACKEND.createAssignment({course_id:courseId,title,instructions,max_marks:maxMarks,due_at:due?new Date(due).toISOString():null,created_by:currentUser.id});
      closeModal();renderAssignments();
    }catch(error){alert(error.message||"The assignment could not be saved.");}
  });
}

function openStudentAssignment(id,assignments){
  const a=(assignments||[]).find(x=>x.id===id);
  if(!a||!portalState.myStudent?.id)return alert("Your learner record is not ready. Sign out and sign in again.");
  showModal("Submit assignment",a.title,`
    <p class="muted">${escHtml(a.instructions||"Complete the practical task below.")}</p>
    <label>Your answer / practical work<textarea id="assignmentResponse" rows="8" required placeholder="Write your response, steps, findings or practical result…"></textarea></label>
  `,async()=>{
    const response=$("#assignmentResponse").value.trim();
    if(!response)return alert("Enter your assignment response before submitting.");
    try{
      await window.ETHAN_BACKEND.submitAssignment({assignmentId:id,studentId:portalState.myStudent.id,responseText:response});
      closeModal();renderAssignments();
    }catch(error){alert(error.message||"Your assignment could not be submitted.");}
  });
}

function openGradeAssignment(id,submissions){
  const s=(submissions||[]).find(x=>x.id===id);if(!s)return;
  showModal("Grade assignment","Enter the score and constructive feedback.",`
    <p class="muted">${escHtml(s.assignment?.title||"Assignment")}</p>
    <label>Score<input type="number" id="assignmentScore" min="0" max="100" step="0.5" value="${s.score===null||s.score===undefined?"":Number(s.score)}" required></label>
    <label>Feedback<textarea id="assignmentFeedback" rows="4">${escHtml(s.feedback||"")}</textarea></label>
  `,async()=>{
    const score=Number($("#assignmentScore").value),feedback=$("#assignmentFeedback").value.trim();
    if(!Number.isFinite(score)||score<0)return alert("Enter a valid score.");
    try{await window.ETHAN_BACKEND.gradeAssignmentSubmission({submissionId:id,score,feedback});closeModal();renderAssignments();}
    catch(error){alert(error.message||"The submission could not be graded.");}
  });
}

function renderQuizzes(){
  const staff=["admin","super_admin","instructor"].includes(currentUser?.role||"");
  const backend=window.ETHAN_BACKEND;
  $("#content").innerHTML=pageHead("Quizzes & Examinations",staff?"Build quizzes and review learner attempts.":"Practise your knowledge and see your results.",staff?'<button class="primary-btn" id="createQuizBtn">+ Create Quiz</button>':"")+
    '<div class="card"><p class="muted">Loading assessments…</p></div>';
  if(!backend?.ready){$("#content").innerHTML=pageHead("Quizzes & Examinations","Your assessment centre.")+emptyState("Learning service unavailable","Reconnect to the LMS database and reload this page.");return;}
  (async()=>{
    try{
      const quizzes=await backend.listQuizzes();
      if(currentUser.role==="student"){
        const attempts=await backend.listQuizAttempts();
        const cards=(quizzes||[]).map(q=>{
          const own=(attempts||[]).filter(a=>a.quiz_id===q.id);
          const last=own[0];
          return '<article class="card"><div class="card-head"><div><small class="eyebrow">'+escHtml(q.course?.title||"Course")+'</small><h3>'+escHtml(q.title)+'</h3></div><span class="badge '+(last?.passed?"green":"blue")+'">'+(last?(last.passed?"Passed":"Attempted"):"Ready")+'</span></div><p class="muted">Pass mark: '+Number(q.pass_mark||60)+'% · Allowed attempts: '+Number(q.attempts_allowed||1)+'</p>'+(last?'<p>Latest score: <strong>'+Number(last.score||0)+'%</strong></p>':"")+'<button class="primary-btn" data-start-quiz="'+q.id+'">Start quiz</button></article>';
        }).join("");
        $("#content").innerHTML=pageHead("Quizzes & Examinations","Assess your knowledge in published courses.")+(cards?'<div class="dashboard-grid">'+cards+'</div>':emptyState("No quizzes published yet","Published quizzes from your course instructors will appear here."));
        $$("[data-start-quiz]").forEach(btn=>btn.onclick=()=>startEthanQuiz(btn.dataset.startQuiz));
      }else{
        const counts=await Promise.all((quizzes||[]).map(async q=>({id:q.id,count:(await backend.listQuizQuestionsForStaff(q.id)).length})));
        const cards=(quizzes||[]).map(q=>{
          const count=counts.find(x=>x.id===q.id)?.count||0;
          return '<article class="card"><div class="card-head"><div><small class="eyebrow">'+escHtml(q.course?.title||"Course")+'</small><h3>'+escHtml(q.title)+'</h3></div><span class="badge '+(q.published?"green":"gold")+'">'+(q.published?"Published":"Draft")+'</span></div><p class="muted">'+count+' questions · Pass mark '+Number(q.pass_mark||60)+'% · '+Number(q.attempts_allowed||1)+' attempts</p><div class="course-card-actions"><button class="secondary-btn" data-add-quiz-question="'+q.id+'">Add question</button>'+(q.published?"":'<button class="primary-btn" data-publish-quiz="'+q.id+'" '+(count?"":"disabled")+'>Publish quiz</button>')+'</div></article>';
        }).join("");
        $("#content").innerHTML=pageHead("Quizzes & Examinations","Create fair assessments and publish them when the question set is ready.")+(cards?'<div class="dashboard-grid">'+cards+'</div>':emptyState("No quizzes created","Create a quiz, add questions and publish it for learners."));
        const create=$("#createQuizBtn");if(create)create.onclick=()=>openCreateQuiz();
        $$("[data-add-quiz-question]").forEach(btn=>btn.onclick=()=>openAddQuizQuestion(btn.dataset.addQuizQuestion));
        $$("[data-publish-quiz]").forEach(btn=>btn.onclick=()=>publishEthanQuiz(btn.dataset.publishQuiz));
      }
    }catch(error){
      $("#content").innerHTML=pageHead("Quizzes & Examinations","Your assessment centre.")+emptyState("Assessments could not be loaded",error.message||"Refresh the page and try again.");
    }
  })();
}

function quizQuestionFields(){
  return `
    <label>Question<textarea id="newQuizQuestion" rows="3" required></textarea></label>
    <label>Answer options (one per line)<textarea id="newQuizOptions" rows="4" placeholder="Option A&#10;Option B&#10;Option C&#10;Option D" required></textarea></label>
    <label>Correct answer (copy the exact option text)<input id="newQuizCorrect" required></label>
    <label>Marks<input id="newQuizMarks" type="number" min="1" value="1" required></label>
  `;
}
function readQuizQuestionForm(){
  const question=$("#newQuizQuestion").value.trim();
  const options=$("#newQuizOptions").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const correct=$("#newQuizCorrect").value.trim();
  const marks=Number($("#newQuizMarks").value||1);
  if(!question||options.length<2||!correct||!options.includes(correct)||marks<=0)throw new Error("Enter a question, at least two options, and the exact correct option.");
  return {question,options,correct,marks};
}
function openCreateQuiz(){
  const options=(data.courses||[]).filter(c=>c.id).map(c=>'<option value="'+escHtml(c.id)+'">'+escHtml(c.code+" — "+c.title)+'</option>').join("");
  if(!options)return alert("No database courses are available. Refresh the course catalogue first.");
  showModal("Create a quiz","Add the first question; the quiz will publish after it has been saved.",`
    <label>Course<select id="quizCourse">${options}</select></label>
    <label>Quiz title<input id="quizTitle" required></label>
    <div class="grid-2"><label>Pass mark (%)<input id="quizPassMark" type="number" min="1" max="100" value="60"></label><label>Allowed attempts<input id="quizAttempts" type="number" min="1" value="1"></label></div>
    <label>Suggested duration (minutes)<input id="quizDuration" type="number" min="1" value="15"></label>
    <hr><h3>First question</h3>${quizQuestionFields()}
  `,async()=>{
    let q;try{q=readQuizQuestionForm();}catch(error){return alert(error.message);}
    const courseId=$("#quizCourse").value,title=$("#quizTitle").value.trim(),passMark=Number($("#quizPassMark").value),attempts=Number($("#quizAttempts").value),duration=Number($("#quizDuration").value);
    if(!courseId||!title||passMark<1||passMark>100||attempts<1||duration<1)return alert("Complete the quiz details.");
    try{
      const quiz=await window.ETHAN_BACKEND.createQuiz({course_id:courseId,title,pass_mark:passMark,attempts_allowed:attempts,time_limit_minutes:duration,published:false});
      await window.ETHAN_BACKEND.createQuizQuestion({quiz_id:quiz.id,question:q.question,question_type:"mcq",options:q.options,correct_answer:q.correct,marks:q.marks});
      await window.ETHAN_BACKEND.updateQuiz(quiz.id,{published:true});
      closeModal();renderQuizzes();
    }catch(error){alert(error.message||"The quiz was saved as a draft or could not be created. Review it and try again.");}
  });
}
function openAddQuizQuestion(quizId){
  showModal("Add quiz question","Add another question to this assessment.",quizQuestionFields(),async()=>{
    let q;try{q=readQuizQuestionForm();}catch(error){return alert(error.message);}
    try{await window.ETHAN_BACKEND.createQuizQuestion({quiz_id:quizId,question:q.question,question_type:"mcq",options:q.options,correct_answer:q.correct,marks:q.marks});closeModal();renderQuizzes();}
    catch(error){alert(error.message||"The question could not be saved.");}
  });
}
async function publishEthanQuiz(quizId){
  try{
    const questions=await window.ETHAN_BACKEND.listQuizQuestionsForStaff(quizId);
    if(!questions.length)return alert("Add at least one question before publishing.");
    await window.ETHAN_BACKEND.updateQuiz(quizId,{published:true});renderQuizzes();
  }catch(error){alert(error.message||"The quiz could not be published.");}
}
async function startEthanQuiz(quizId){
  const backend=window.ETHAN_BACKEND;
  try{
    const [quizzes,questions]=await Promise.all([backend.listQuizzes(),backend.getPublishedQuizQuestions(quizId)]);
    const quiz=(quizzes||[]).find(q=>q.id===quizId);
    if(!quiz||!questions.length)return alert("This quiz has no published questions yet.");
    const body=questions.map((q,i)=>{
      const options=Array.isArray(q.options)?q.options:[];
      const controls=options.length?options.map((option,j)=>{
        const value=typeof option==="object"&&option!==null?String(option.value??option.label??JSON.stringify(option)):String(option);
        return '<label class="quiz-option"><input type="radio" name="quiz-'+q.id+'" value="'+escHtml(value)+'"><span>'+escHtml(value)+'</span></label>';
      }).join(""):'<input class="quiz-text-answer" id="quiz-answer-'+q.id+'" type="text" placeholder="Enter your answer">';
      return '<section class="card quiz-question"><small class="eyebrow">QUESTION '+(i+1)+' · '+Number(q.marks||1)+' MARKS</small><h3>'+escHtml(q.question)+'</h3><div class="quiz-options">'+controls+'</div></section>';
    }).join("");
    $("#content").innerHTML=pageHead(quiz.title,"Answer each question and submit when you are ready.")+
      '<form id="ethanQuizAttempt"><p class="muted">Pass mark: '+Number(quiz.pass_mark||60)+'% · Suggested duration: '+Number(quiz.time_limit_minutes||0)+' minutes</p>'+body+'<div class="course-card-actions"><button class="secondary-btn" type="button" id="cancelEthanQuiz">Back to quizzes</button><button class="primary-btn" type="submit">Submit answers</button></div></form>';
    $("#cancelEthanQuiz").onclick=()=>renderQuizzes();
    $("#ethanQuizAttempt").onsubmit=async e=>{
      e.preventDefault();
      const answers={};
      for(const q of questions){
        const selected=document.querySelector('input[name="quiz-'+q.id+'"]:checked');
        const typed=document.getElementById("quiz-answer-"+q.id);
        const value=selected?selected.value:(typed?typed.value.trim():"");
        if(!value)return alert("Answer every question before submitting.");
        answers[q.id]=value;
      }
      const submit=e.submitter; if(submit){submit.disabled=true;submit.textContent="Marking quiz…";}
      try{
        const result=await backend.submitQuizAttempt(quizId,answers);
        const score=Number(result?.score||0),passed=Boolean(result?.passed);
        $("#content").innerHTML=pageHead("Quiz result","Your answers have been marked securely.")+
          '<section class="card"><div class="eyebrow">YOUR RESULT</div><h1>'+score.toFixed(2)+'%</h1><p><span class="badge '+(passed?"green":"gold")+'">'+(passed?"Passed":"Not yet passed")+'</span></p><p>You earned '+Number(result?.earned_marks||0)+' out of '+Number(result?.total_marks||0)+' marks.</p><button class="primary-btn" id="backToQuizList">Return to quizzes</button></section>';
        $("#backToQuizList").onclick=()=>renderQuizzes();
      }catch(error){if(submit){submit.disabled=false;submit.textContent="Submit answers";}alert(error.message||"Your quiz could not be submitted.");}
    };
  }catch(error){alert(error.message||"The quiz could not be opened.");}
}

function renderStudentHome(){
  const courses=studentCourses();
  const firstName=escHtml(currentUser.firstName||currentUser.name||"Learner");
  const featured=courses.slice(0,4);
  const catalogue=ETHAN_PUBLIC_COURSES||[];
  const courseCount=catalogue.length||courses.length;
  $("#content").innerHTML=`
    <section class="student-home-hero"><div><span class="eyebrow">ETHAN DIGITAL ACADEMY</span><h1>Welcome, ${firstName}</h1><p>Your learning space for practical digital skills, guided study materials and career development.</p></div><div class="student-home-profile"><small>LEARNER ACCOUNT</small><strong>${escHtml(portalRoleLabel(currentUser))}</strong></div></section>
    <section class="student-home-stats"><div><small>COURSES AVAILABLE</small><strong>${courseCount}</strong></div><div><small>MY COURSES</small><strong>${courses.length}</strong></div><div><small>LEARNING PROGRESS</small><strong>—</strong></div><div><small>COURSE ACCESS</small><strong>ACTIVE</strong></div></section>
    <section class="student-section"><div class="student-section-head"><div><span class="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>My Learning</h2><p>Your enrolled courses and study manuals.</p></div><button class="secondary-btn" onclick="navigate('courses')">View all my courses</button></div>
    ${featured.length?'<div class="learner-course-grid">'+featured.map(learnerCourseCard).join("")+'</div>':emptyState("Your courses are being prepared","Your enrolled courses will appear here after your learner account is ready.")}</section>
    <section class="student-section"><div class="student-section-head"><div><span class="eyebrow">EXPLORE ETHAN</span><h2>Discover Digital Courses</h2><p>Search the course catalogue and open a course to study.</p></div><div class="student-catalogue-tools"><input id="insideCourseSearch" placeholder="Search digital courses…"/></div></div>
    <div id="insideCourseGrid" class="inside-catalogue-grid">${catalogue.slice(0,12).map(lockedCatalogueCard).join("")}</div><div class="student-catalogue-more"><button class="secondary-btn" id="showAllInsideCourses">View all ${courseCount} courses</button></div></section>
    <section class="student-section student-quick-links"><div class="student-section-head"><div><span class="eyebrow">YOUR STUDY TOOLS</span><h2>Learning Shortcuts</h2></div></div><div class="quick-access-grid">
    <button onclick="navigate('lms')"><strong>Learning Area</strong><span>Open study manuals and resources</span></button><button onclick="navigate('assignments')"><strong>Assignments</strong><span>Submit practical work</span></button><button onclick="navigate('quizzes')"><strong>Quizzes & Exams</strong><span>Test your understanding</span></button><button onclick="navigate('certificates')"><strong>Certificates</strong><span>View awarded certificates</span></button></div></section>`;
  const search=$("#insideCourseSearch"),grid=$("#insideCourseGrid"),showAll=$("#showAllInsideCourses");
  let showingAll=false;
  function repaint(){
    const q=(search?.value||"").trim().toLowerCase();
    const source=showingAll||q?catalogue:catalogue.slice(0,12);
    const rows=source.filter(c=>!q||String(c.name+" "+c.brief).toLowerCase().includes(q));
    grid.innerHTML=rows.map(lockedCatalogueCard).join("")||'<div class="student-empty-panel"><div><h3>No matching course</h3><p>Try another course name or keyword.</p></div></div>';
  }
  if(search)search.oninput=repaint;
  if(showAll)showAll.onclick=()=>{showingAll=!showingAll;showAll.textContent=showingAll?"Show fewer courses":"View all "+courseCount+" courses";repaint();};
}

function renderNotifications(){
  const items=Array.isArray(data.notifications)?data.notifications:[];
  $("#notificationList").innerHTML=items.length
    ? items.map(n=>'<div class="notification-item"><strong>'+escHtml(n.title)+'</strong><div>'+escHtml(n.message)+'</div><small>'+escHtml(n.time||"")+'</small></div>').join("")
    : '<div class="notification-item"><strong>You are all caught up</strong><div>Important account and learning updates will appear here.</div></div>';
  const badge=$("#notifBadge");
  if(badge){badge.textContent=String(items.length);badge.hidden=items.length===0;}
}


/* ETHAN LEARN — course-specific classroom and real lesson progress */
function plainLessonHtml(value){
  return String(value||"").split(/\r?\n/).map(line=>line.trim()?'<p>'+escHtml(line)+'</p>':"").join("");
}
function safeLessonHtml(value){
  return String(value||"")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,"")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi,"")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,"")
    .replace(/javascript\s*:/gi,"");
}
async function renderLMS(){
  const staff=["admin","super_admin","instructor"].includes(currentUser?.role||"");
  const backend=window.ETHAN_BACKEND;
  $("#content").innerHTML=pageHead(staff?"Learning Content Studio":"Learning Classroom",
    staff?"Organise course content into modules and lessons.":"Choose a course, study each lesson and track your progress.")+
    '<div class="card"><p class="muted">Loading your course library…</p></div>';
  if(!backend?.ready){
    $("#content").innerHTML=pageHead("Learning Classroom","Your learning space.")+emptyState("Learning service unavailable","Reconnect to the learning database and reload.");
    return;
  }
  try{
    let courses=await backend.listCourses();
    courses=(courses||[]).filter(c=>staff||c.published===true);
    if(currentUser?.role==="student"){
      const enrolledIds=new Set(studentEnrolments().map(e=>e.course?.id).filter(Boolean));
      if(enrolledIds.size)courses=courses.filter(c=>enrolledIds.has(c.id));
    }
    if(!courses.length){
      $("#content").innerHTML=pageHead("Learning Classroom","Your learning space.")+emptyState("No courses are available yet","Published courses will appear here when the Academy releases them.");
      return;
    }
    $("#content").innerHTML=pageHead(staff?"Learning Content Studio":"Learning Classroom",
      staff?"Select a course to manage its modules, lessons and study resources.":"Your free digital courses, study materials and lesson progress.")+
      '<div class="lms-library-tools"><input id="lmsCourseSearch" type="search" placeholder="Search course title or course code…" aria-label="Search courses"><span>'+courses.length+' courses available</span></div>'+
      '<div id="lmsCourseGrid" class="lms-course-grid">'+courses.map(c=>{
        const title=String(c.title||"Course");
        return '<article class="lms-course-card"><div class="lms-course-card-top"><span>'+escHtml(c.code||"ETHAN COURSE")+'</span><span class="lms-free-chip">'+(Number(c.fee||0)===0?"FREE":"PAID")+'</span></div><div class="lms-course-icon">📘</div><h3>'+escHtml(title)+'</h3><p>'+escHtml(c.description||c.learning_objectives||"Practical learning resources from Ethan Digital Academy.")+'</p><div class="lms-course-meta"><span>'+escHtml(c.duration||"Self-paced")+'</span><span>'+escHtml(c.difficulty||"All levels")+'</span></div><div class="lms-course-actions"><button class="primary-btn" data-open-lms-course="'+escHtml(c.id)+'">Open classroom</button>'+(staff?'<button class="secondary-btn" data-open-course-study="'+encodeURIComponent(title)+'">Preview study guide</button>':"")+'</div></article>';
      }).join("")+'</div>';
    const search=$("#lmsCourseSearch"),grid=$("#lmsCourseGrid");
    if(search)search.oninput=()=>{
      const q=search.value.trim().toLowerCase();
      $$("[data-open-lms-course]").forEach(btn=>{
        const card=btn.closest(".lms-course-card");
        if(card)card.hidden=!card.textContent.toLowerCase().includes(q);
      });
    };
    $$("[data-open-lms-course]").forEach(btn=>btn.onclick=()=>{
      const course=courses.find(c=>c.id===btn.dataset.openLmsCourse);
      if(course)openLearningClassroom(course);
    });
    $$("[data-open-course-study]").forEach(btn=>btn.onclick=()=>openCourseStudy(btn.dataset.openCourseStudy));
  }catch(error){
    $("#content").innerHTML=pageHead("Learning Classroom","Your learning space.")+emptyState("Course library could not be loaded",error.message||"Refresh the page and try again.");
  }
}

async function openLearningClassroom(course){
  const backend=window.ETHAN_BACKEND;
  if(!course?.id||!backend?.ready)return;
  $("#content").innerHTML=pageHead("Learning Classroom","Loading "+escHtml(course.title||"course")+"…")+
    '<div class="card"><p class="muted">Preparing course modules and your study progress…</p></div>';
  try{
    const modules=await backend.listCourseModules(course.id);
    let progress=[];
    if(currentUser?.role==="student"&&portalState.myStudent?.id){
      progress=await backend.listMyLessonProgress(portalState.myStudent.id);
    }
    const done=new Set(progress.filter(p=>p.completed).map(p=>p.lesson_id));
    const lessons=modules.flatMap(m=>(m.lessons||[]).filter(l=>currentUser.role!=="student"||l.published).map(l=>({...l,moduleTitle:m.title,modulePosition:m.position})));
    const completed=lessons.filter(l=>done.has(l.id)).length;
    const pct=lessons.length?Math.round(completed/lessons.length*100):0;
    const moduleMarkup=modules.map((m,i)=>{
      const moduleLessons=(m.lessons||[]).filter(l=>currentUser.role!=="student"||l.published);
      const completedInModule=moduleLessons.filter(l=>done.has(l.id)).length;
      const addLesson=staff?'<button class="secondary-btn" data-add-course-lesson="'+escHtml(m.id)+'">+ Add lesson</button>':"";
      const rows=moduleLessons.map(l=>{
        const isDone=done.has(l.id);
        return '<button class="lms-lesson-row" data-open-lesson="'+escHtml(l.id)+'"><span class="lms-lesson-status '+(isDone?"is-done":"")+'">'+(isDone?"✓":"▶")+'</span><span class="lms-lesson-title"><strong>'+escHtml(l.title)+'</strong><small>'+Number(l.estimated_minutes||20)+' min</small></span><span class="lms-lesson-state">'+(isDone?"Completed":"Open lesson")+'</span></button>';
      }).join("");
      return '<section class="lms-module-card"><div class="lms-module-heading"><div><small>MODULE '+String(i+1).padStart(2,"0")+'</small><h3>'+escHtml(m.title)+'</h3><p>'+completedInModule+' of '+moduleLessons.length+' lessons completed</p></div>'+addLesson+'</div><div class="lms-lesson-list">'+(rows||'<p class="muted lms-module-empty">No published lessons in this module yet.</p>')+'</div></section>';
    }).join("");
    $("#content").innerHTML=pageHead("Learning Classroom",escHtml(course.title||"Course"),'<button class="secondary-btn" id="backToLmsLibrary">← Course library</button>')+
      '<section class="lms-classroom-hero"><div><span class="eyebrow">ETHAN DIGITAL ACADEMY · LEARNER CLASSROOM</span><h2>'+escHtml(course.title||"Course")+'</h2><p>'+escHtml(course.description||course.learning_objectives||"Study the course material, practise and build practical skills.")+'</p></div><div class="lms-progress-summary"><strong>'+pct+'%</strong><span>LESSONS COMPLETED</span><div class="lms-progress-track"><i style="width:'+pct+'%"></i></div><small>'+completed+' of '+lessons.length+' completed</small></div></section>'+
      (modules.length?'<div class="lms-classroom-toolbar"><h3>Course curriculum</h3>'+(staff?'<button class="primary-btn" id="addCourseModuleBtn">+ Add module</button>':"")+'</div><div class="lms-module-list">'+moduleMarkup+'</div>':
        '<section class="lms-no-curriculum"><div class="lms-no-curriculum-icon">📚</div><div><h3>Course study material</h3><p>The structured module outline for this course is being prepared. You can still open its available study manual and guided course notes.</p><button class="primary-btn" id="openCourseStudyMaterial">Open course study material</button></div>'+(staff?'<button class="secondary-btn" id="addCourseModuleBtn">Build first module</button>':"")+'</section>');
    $("#backToLmsLibrary").onclick=()=>renderLMS();
    const openStudy=$("#openCourseStudyMaterial");
    if(openStudy)openStudy.onclick=()=>openCourseStudy(encodeURIComponent(course.title));
    $$("[data-open-lesson]").forEach(btn=>btn.onclick=()=>openLmsLesson(course,modules,btn.dataset.openLesson,done));
    $$("[data-add-course-lesson]").forEach(btn=>btn.onclick=()=>openCreateLesson(course,modules.find(m=>m.id===btn.dataset.addCourseLesson)));
    const addModule=$("#addCourseModuleBtn");
    if(addModule)addModule.onclick=()=>openCreateModule(course,modules);
  }catch(error){
    $("#content").innerHTML=pageHead("Learning Classroom",escHtml(course.title||"Course"))+emptyState("Course content could not be loaded",error.message||"Refresh the classroom and try again.");
  }
}

async function openLmsLesson(course,modules,lessonId,doneSet){
  const module=modules.find(m=>(m.lessons||[]).some(l=>l.id===lessonId));
  const lesson=module?.lessons?.find(l=>l.id===lessonId);
  if(!lesson)return;
  const lessons=modules.flatMap(m=>(m.lessons||[]).filter(l=>currentUser.role!=="student"||l.published));
  const index=lessons.findIndex(l=>l.id===lesson.id);
  const previous=lessons[index-1],next=lessons[index+1],complete=doneSet?.has(lesson.id);
  const video=String(lesson.video_url||"").trim();
  const videoMarkup=/^https:\/\//i.test(video)?'<p><a class="lms-video-link" href="'+escHtml(video)+'" target="_blank" rel="noopener noreferrer">▶ Open lesson video in a new tab</a></p>':"";
  $("#content").innerHTML=pageHead("Lesson",escHtml(course.title||"Course"),'<button class="secondary-btn" id="backToCourseClassroom">← Course outline</button>')+
    '<article class="lms-lesson-player"><div class="lms-lesson-breadcrumb">'+escHtml(module.title)+' / '+escHtml(course.title)+'</div><span class="eyebrow">LESSON '+String(index+1).padStart(2,"0")+' OF '+lessons.length+'</span><h1>'+escHtml(lesson.title)+'</h1><p class="lms-lesson-duration">Estimated study time: '+Number(lesson.estimated_minutes||20)+' minutes</p><div class="lms-lesson-content">'+safeLessonHtml(lesson.content_html||"<p>Your instructor has not added lesson notes yet.</p>")+'</div>'+videoMarkup+'<div class="lms-lesson-footer"><span class="lms-lesson-status-text">'+(complete?"Completed":"In progress")+'</span><div class="lms-lesson-nav">'+(previous?'<button class="secondary-btn" id="previousLmsLesson">← Previous lesson</button>':"<span></span>")+(currentUser.role==="student"?'<button class="primary-btn" id="completeLmsLesson">'+(complete?"Completed ✓":"Mark lesson complete")+'</button>':"")+(next?'<button class="secondary-btn" id="nextLmsLesson">Next lesson →</button>':"")+'</div></div></article>';
  $("#backToCourseClassroom").onclick=()=>openLearningClassroom(course);
  const prev=$("#previousLmsLesson"),nxt=$("#nextLmsLesson"),mark=$("#completeLmsLesson");
  if(prev)prev.onclick=()=>openLmsLesson(course,modules,previous.id,doneSet);
  if(nxt)nxt.onclick=()=>openLmsLesson(course,modules,next.id,doneSet);
  if(mark)mark.onclick=async()=>{
    const studentId=portalState.myStudent?.id;
    if(!studentId)return alert("Your learner profile is not ready. Sign out and sign back in.");
    mark.disabled=true;mark.textContent="Saving progress…";
    try{
      await window.ETHAN_BACKEND.setLessonProgress({studentId,lessonId:lesson.id,completed:true});
      doneSet.add(lesson.id);
      mark.textContent="Completed ✓";
      const status=$(".lms-lesson-status-text");if(status)status.textContent="Completed";
    }catch(error){mark.disabled=false;mark.textContent="Mark lesson complete";alert(error.message||"Your progress could not be saved.");}
  };
}

function openCreateModule(course,modules){
  if(!["admin","super_admin","instructor"].includes(currentUser?.role||""))return;
  showModal("Add course module","Create a new section in the course curriculum.",
    '<label>Module title<input id="newLmsModuleTitle" required placeholder="e.g. Module 1 — Foundations"></label>',
    async()=>{
      const title=$("#newLmsModuleTitle").value.trim();
      if(!title)return alert("Enter a module title.");
      try{
        await window.ETHAN_BACKEND.createCourseModule({course_id:course.id,title,position:(modules||[]).length+1});
        closeModal();openLearningClassroom(course);
      }catch(error){alert(error.message||"The module could not be created.");}
    });
}
function openCreateLesson(course,module){
  if(!module||!["admin","super_admin","instructor"].includes(currentUser?.role||""))return;
  showModal("Add lesson","Create lesson notes and publish them to the course classroom.",
    '<label>Lesson title<input id="newLmsLessonTitle" required></label><label>Lesson notes<textarea id="newLmsLessonContent" rows="9" required placeholder="Write the lesson explanation, examples, key points and practical activity…"></textarea></label><div class="grid-2"><label>Study time (minutes)<input id="newLmsLessonMinutes" type="number" min="1" value="20"></label><label>Video link (optional)<input id="newLmsLessonVideo" type="url" placeholder="https://…"></label></div>',
    async()=>{
      const title=$("#newLmsLessonTitle").value.trim(),content=$("#newLmsLessonContent").value.trim();
      const minutes=Math.max(1,Number($("#newLmsLessonMinutes").value||20)),video=$("#newLmsLessonVideo").value.trim();
      if(!title||!content)return alert("Enter the lesson title and notes.");
      if(video&&!/^https:\/\//i.test(video))return alert("Use a secure HTTPS link for the lesson video.");
      try{
        await window.ETHAN_BACKEND.createCourseLesson({module_id:module.id,title,content_html:plainLessonHtml(content),video_url:video||null,estimated_minutes:minutes,position:(module.lessons||[]).length+1,published:true});
        closeModal();openLearningClassroom(course);
      }catch(error){alert(error.message||"The lesson could not be saved.");}
    });
}
