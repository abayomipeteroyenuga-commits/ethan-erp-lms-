const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const STORE = {
  users: "ethan_users_v1",
  session: "ethan_session_v1",
  data: "ethan_data_v1"
};

const seed = {
  students: [
    {id:"EDA-ST-0001",name:"Amina Yusuf",email:"amina@example.com",program:"Digital Skills",status:"Active",progress:72,payment:"Part Paid"},
    {id:"EDA-ST-0002",name:"David Okoro",email:"david@example.com",program:"AI & Business",status:"Active",progress:58,payment:"Paid"},
    {id:"EDA-ST-0003",name:"Grace Adewale",email:"grace@example.com",program:"Office Productivity",status:"Active",progress:83,payment:"Paid"}
  ],
  instructors: [
    {id:"EDA-IN-001",name:"Samuel Adeyemi",specialization:"Digital Marketing",courses:4,status:"Active"},
    {id:"EDA-IN-002",name:"Mariam Bello",specialization:"Office & Data",courses:3,status:"Active"},
    {id:"EDA-IN-003",name:"Daniel Peter",specialization:"Cybersecurity",courses:2,status:"Active"}
  ],
  courses: [
    {code:"EDA-CYB-101",title:"Cybersecurity Fundamentals",category:"Cybersecurity",instructor:"Daniel Peter",duration:"6 weeks",progress:45,lessons:30,completed:14},
    {code:"EDA-EXC-101",title:"Microsoft Excel Mastery",category:"Microsoft Office",instructor:"Mariam Bello",duration:"5 weeks",progress:68,lessons:28,completed:19},
    {code:"EDA-DMK-201",title:"Advanced Digital Marketing",category:"Digital Marketing",instructor:"Samuel Adeyemi",duration:"8 weeks",progress:36,lessons:40,completed:14},
    {code:"EDA-AIB-101",title:"AI for Business",category:"Artificial Intelligence",instructor:"Samuel Adeyemi",duration:"4 weeks",progress:20,lessons:24,completed:5},
    {code:"EDA-CAN-101",title:"Canva Design Essentials",category:"Graphic Design",instructor:"Mariam Bello",duration:"4 weeks",progress:0,lessons:20,completed:0},
    {code:"EDA-WEB-101",title:"Website Development",category:"Website Development",instructor:"Daniel Peter",duration:"8 weeks",progress:0,lessons:36,completed:0}
  ],
  payments: [
    {ref:"EDA-PAY-1001",student:"Amina Yusuf",description:"Cybersecurity Fundamentals",amount:55000,date:"2026-09-10",status:"Confirmed"},
    {ref:"EDA-PAY-1002",student:"David Okoro",description:"AI for Business",amount:75000,date:"2026-09-11",status:"Confirmed"},
    {ref:"EDA-PAY-1003",student:"Grace Adewale",description:"Office Productivity",amount:45000,date:"2026-09-12",status:"Confirmed"}
  ],
  announcements: [
    {title:"Welcome to ETHAN ERP & LMS",message:"Your unified learning and academy management portal is ready.",date:"Today"},
    {title:"New cybersecurity course",message:"Cybersecurity Fundamentals has been added to the academy catalogue.",date:"Yesterday"}
  ],
  notifications: [
    {title:"Assignment due",message:"Cybersecurity Module 2 practical is due soon.",time:"2 hours ago"},
    {title:"Payment received",message:"Your recent payment has been recorded.",time:"Yesterday"},
    {title:"New announcement",message:"Check the latest academy update.",time:"2 days ago"}
  ]
};

function loadData(){
  const saved = localStorage.getItem(STORE.data);
  if(saved) return JSON.parse(saved);
  localStorage.setItem(STORE.data, JSON.stringify(seed));
  return structuredClone(seed);
}
let data = loadData();
data.enrolments = Array.isArray(data.enrolments) ? data.enrolments : [];
let currentUser = null;
let portalState = { myStudent:null, myEnrolments:[], backendLoaded:false };
let currentPage = "dashboard";

function getUsers(){ return JSON.parse(localStorage.getItem(STORE.users) || "[]"); }
function saveUsers(users){ localStorage.setItem(STORE.users, JSON.stringify(users)); }
function setSession(user){
  localStorage.setItem(STORE.session, JSON.stringify({email:user.email, ts:Date.now()}));
}
function initials(name){ return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("") || "EU"; }

// Staff accounts are created securely through Supabase Staff Management.


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

$("#signupForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const firstName=$("#firstName").value.trim(), lastName=$("#lastName").value.trim();
  const email=$("#signupEmail").value.trim().toLowerCase(), phone=$("#signupPhone").value.trim();
  const learnerType=$("#signupRole").value, role="student", password=$("#signupPassword").value, confirm=$("#confirmPassword").value;
  const msg=$("#signupMessage");
  if(password!==confirm){ msg.textContent="Passwords do not match."; msg.className="form-message error"; return; }
  try{
    if(window.ETHAN_BACKEND?.ready){
      await window.ETHAN_BACKEND.signUp({email,password,firstName,lastName,phone,role,learnerType});
      msg.textContent="Account created. Check your email if confirmation is enabled."; msg.className="form-message success";
    }else{
      if(getUsers().some(u=>u.email===email)){ msg.textContent="An account with this email already exists."; msg.className="form-message error"; return; }
      const users=getUsers();
      const prefix="EDA-ST";
      const user={firstName,lastName,name:`${firstName} ${lastName}`,email,phone,role,learnerType,password,id:`${prefix}-${String(users.length+1).padStart(4,"0")}`};
      users.push(user); saveUsers(users);
      if(role==="student" && !data.students.some(s=>s.email.toLowerCase()===email)){
        data.students.push({id:user.id,name:user.name,email,program:"Awaiting course allocation",status:"Pending Payment",progress:0,payment:"Unpaid"});
        persist();
      }
      msg.textContent="Account created. Learning access begins after verified payment and course allocation."; msg.className="form-message success";
    }
    $("#signupForm").reset();
    setTimeout(()=>$(".auth-tab[data-auth-tab='signin']").click(),900);
  }catch(err){
    msg.textContent=err.message||"Unable to create account.";msg.className="form-message error";
  }
});

$("#signinForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const email=$("#signinEmail").value.trim().toLowerCase(), password=$("#signinPassword").value;
  const msg=$("#signinMessage");
  try{
    if(window.ETHAN_BACKEND?.ready){
      const result=await window.ETHAN_BACKEND.signIn(email,password);
      const authUser=result.user;
      let profile=null;
      try{ profile=await window.ETHAN_BACKEND.getProfile(authUser.id); }catch(_){}
      const role=profile?.role||authUser.user_metadata?.role||"student";
      const user={
        firstName:profile?.first_name||authUser.user_metadata?.first_name||"Ethan",
        lastName:profile?.last_name||authUser.user_metadata?.last_name||"User",
        name:`${profile?.first_name||authUser.user_metadata?.first_name||"Ethan"} ${profile?.last_name||authUser.user_metadata?.last_name||"User"}`.trim(),
        email:authUser.email, phone:profile?.phone||"", role, id:authUser.id
      };
      currentUser=user; openPortal(user);
    }else{
      const user=getUsers().find(u=>u.email===email && u.password===password);
      if(!user){msg.textContent="Email or password is incorrect.";msg.className="form-message error";return;}
      setSession(user); openPortal(user);
    }
  }catch(err){
    msg.textContent=err.message||"Unable to sign in.";msg.className="form-message error";
  }
});

$("#forgotPasswordBtn").addEventListener("click",()=>{
  showModal("Password reset","Enter your account email and request a reset link.",`
    <label>Email address<input id="resetEmail" type="email" placeholder="you@example.com"></label>
  `,async ()=>{
    const email=$("#resetEmail").value.trim().toLowerCase();
    if(!email) return alert("Enter your email address.");
    if(window.ETHAN_BACKEND?.ready){
      try{ await window.ETHAN_BACKEND.resetPassword(email); closeModal(); alert("Password reset email requested."); }
      catch(err){ alert(err.message||"Unable to request reset."); }
    }else{
      alert("Preview mode: connect Supabase in config.js to send password-reset emails.");
    }
  });
});

$("#logoutBtn").addEventListener("click",async ()=>{
  if(window.ETHAN_BACKEND?.ready){ try{ await window.ETHAN_BACKEND.signOut(); }catch(_){} }
  localStorage.removeItem(STORE.session); currentUser=null; $("#portal").classList.add("hidden"); $("#authScreen").classList.remove("hidden");
});

$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#notificationBtn").addEventListener("click",()=>$("#notificationPanel").classList.toggle("hidden"));
$("#closeNotif").addEventListener("click",()=>$("#notificationPanel").classList.add("hidden"));

$("#globalSearch").addEventListener("input", e=>{
  const q=e.target.value.toLowerCase().trim();
  if(!q) return;
  const match=data.courses.find(c=>c.title.toLowerCase().includes(q)) || data.students.find(s=>s.name.toLowerCase().includes(q));
  if(match && e.key==="Enter") alert(`Found: ${match.title || match.name}`);
});

const adminNav = [
  ["dashboard","▦","Dashboard"],["students","👥","Students"],["parents","👪","Parents"],["instructors","🧑‍🏫","Instructors"],["staff","🛡","Staff Management"],
  ["courses","📚","Courses"],["lms","▶","LMS"],["assignments","📝","Assignments"],["quizzes","✅","Quizzes"],
  ["attendance","📅","Attendance"],["timetable","🕒","Timetable"],["payments","💳","Fees & Payments"],
  ["results","📊","Results"],["certificates","🎓","Certificates"],["announcements","📣","Announcements"],["reports","📈","Reports"],["settings","⚙","Settings"]
];
const navByRole = {
  super_admin: adminNav,
  admin: adminNav,
  student:[
    ["dashboard","▦","Dashboard"],["courses","📚","My Courses"],["lms","▶","Continue Learning"],["assignments","📝","Assignments"],
    ["quizzes","✅","Quizzes & Exams"],["attendance","📅","Attendance"],["payments","💳","Fees & Payments"],
    ["results","📊","Results"],["certificates","🎓","Certificates"],["announcements","📣","Announcements"],["profile","👤","Profile"]
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
  $("#authScreen").classList.add("hidden"); $("#portal").classList.remove("hidden");
  $("#userName").textContent=user.name; $("#userRole").textContent=(user.role||"student").replace("_"," ");
  $("#userAvatar").textContent=initials(user.name);
  await hydratePortalData(user);
  renderNav();
  renderNotifications();
  navigate("dashboard");
}

async function hydratePortalData(user){
  portalState={myStudent:null,myEnrolments:[],backendLoaded:false};
  if(window.ETHAN_BACKEND?.ready){
    try{
      if(user.role==="student"){
        portalState.myStudent=await window.ETHAN_BACKEND.getStudentByUserId(user.id);
        if(portalState.myStudent) portalState.myEnrolments=await window.ETHAN_BACKEND.listStudentEnrolments(portalState.myStudent.id);
      } else if(user.role==="admin" || user.role==="super_admin"){
        const [students,courses]=await Promise.all([window.ETHAN_BACKEND.listStudents(),window.ETHAN_BACKEND.listCourses()]);
        if(Array.isArray(students)) data.students=students.map(s=>({
          id:s.id, studentNo:s.student_no, name:[s.profiles?.first_name,s.profiles?.last_name].filter(Boolean).join(" ")||s.student_no,
          email:s.profiles?.email||"", program:"Awaiting allocation", status:s.status||"Active", progress:0, payment:"Unpaid", userId:s.user_id
        }));
        if(Array.isArray(courses)) data.courses=courses.map(c=>({id:c.id,code:c.code,title:c.title,category:c.difficulty||"Course",instructor:"Assigned by academy",duration:c.duration||"Self-paced",progress:0,lessons:0,completed:0,fee:Number(c.fee||0),published:c.published}));
      }
      portalState.backendLoaded=true;
    }catch(err){ console.warn("Portal data could not be fully loaded",err); }
  }else if(user.role==="student"){
    portalState.myStudent=data.students.find(s=>(s.email||"").toLowerCase()===user.email.toLowerCase())||null;
    const sid=portalState.myStudent?.id;
    portalState.myEnrolments=data.enrolments.filter(e=>e.studentId===sid).map(e=>({ ...e, course:data.courses.find(c=>(c.id||c.code)===e.courseId || c.code===e.courseCode) })).filter(e=>e.course);
  }
}

function studentEnrolments(){ return currentUser?.role==="student" ? (portalState.myEnrolments||[]) : []; }
function studentCourses(){ return studentEnrolments().map(e=>e.course).filter(Boolean); }
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
  $("#pageTitle").textContent=label; $("#pageEyebrow").textContent=currentUser.role.toUpperCase()+" PORTAL";
  const renderers={dashboard:renderDashboard,students:renderStudents,parents:renderParents,instructors:renderInstructors,staff:renderStaff,courses:renderCourses,lms:renderLMS,assignments:renderAssignments,quizzes:renderQuizzes,attendance:renderAttendance,timetable:renderTimetable,payments:renderPayments,results:renderResults,certificates:renderCertificates,announcements:renderAnnouncements,reports:renderReports,settings:renderSettings,profile:renderProfile};
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
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">STUDENT PORTAL</span><h1>Welcome back, ${currentUser.firstName}</h1><p>${courses.length?"Your paid course allocation is active. Continue learning below.":"Your account is ready. Course access opens only after payment is verified and Admin allocates your course."}</p></div><button class="secondary-btn" onclick="navigate('${courses.length?"lms":"payments"}')">${courses.length?"Continue Learning":"View Payment Status"}</button></div>
      <div class="stats-grid">${stat("My Courses",String(courses.length),courses.length?"Allocated courses":"No course allocated yet","📚")}${stat("Average Progress",average+"%",courses.length?"Across allocated courses":"Starts after allocation","📈")}${stat("Assignments","0",courses.length?"Published assignments appear here":"No active course","📝")}${stat("Certificates","0","Issued after successful completion","🎓")}</div>
      ${courses.length?`<div class="card"><div class="card-head"><h3>My Course Progress</h3></div><div class="progress-list">${courses.map(c=>`<div class="progress-row"><div class="progress-top"><strong>${c.title}</strong><span>${Number(c.progress||0)}%</span></div><small class="muted">${c.duration||"Self-paced"}</small><div class="progress"><span style="width:${Number(c.progress||0)}%"></span></div></div>`).join("")}</div></div>`:emptyState("No courses allocated yet","Registration does not automatically enrol you in a course. Once your payment is confirmed, Admin will allocate the exact course you paid for and your lessons/videos will become available.",`<button class="primary-btn" onclick="navigate('payments')">Payment & Course Access</button>`)}`;
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
  const add = (currentUser.role==="admin"||currentUser.role==="super_admin") ? `<button class="primary-btn" id="addStudentBtn">+ Add Student</button>` : "";
  $("#content").innerHTML=pageHead(currentUser.role==="parent"?"My Children":"Students","Manage student profiles, programmes, progress and status.",add)+studentTable(currentUser.role==="parent"?data.students.slice(0,1):data.students);
  if($("#addStudentBtn")) $("#addStudentBtn").onclick=()=>showStudentModal();
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
 $("#content").innerHTML=pageHead("Instructors","Manage teaching staff and course assignments.",`<button class="primary-btn" id="addInstructorBtn">+ Add Instructor</button>`)+`
 <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Name</th><th>Specialization</th><th>Courses</th><th>Status</th></tr></thead><tbody>${data.instructors.map(i=>`<tr><td>${i.id}</td><td><strong>${i.name}</strong></td><td>${i.specialization}</td><td>${i.courses}</td><td><span class="badge green">${i.status}</span></td></tr>`).join("")}</tbody></table></div></div>`;
 $("#addInstructorBtn").onclick=()=>showModal("Add Instructor","Create an instructor profile.",`<label>Full name<input id="insName"></label><label>Specialization<input id="insSpec"></label>`,()=>{
  if(!$("#insName").value.trim()||!$("#insSpec").value.trim()) return alert("Complete all fields.");
  data.instructors.push({id:`EDA-IN-${String(data.instructors.length+1).padStart(3,"0")}`,name:$("#insName").value.trim(),specialization:$("#insSpec").value.trim(),courses:0,status:"Active"});persist();closeModal();renderInstructors();
 });
}
async function renderStaff(){
  if(!["admin","super_admin"].includes(currentUser.role)){
    $("#content").innerHTML=emptyState("Access restricted","Only Admin and Super Admin can manage staff accounts.");
    return;
  }
  let staff=[];
  try{
    if(window.ETHAN_BACKEND?.ready) staff=await window.ETHAN_BACKEND.listStaff();
  }catch(err){ console.warn(err); }
  const allowed=currentUser.role==="super_admin"?["admin","instructor"]:["instructor"];
  $("#content").innerHTML=pageHead("Staff Management","Create secure staff accounts. Staff sign in through the same Sign In form and are routed by role.",`<button class="primary-btn" id="createStaffBtn">+ Create Staff Account</button>`)+`
  <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>${staff.length?staff.map(x=>`<tr><td><strong>${[x.first_name,x.last_name].filter(Boolean).join(" ")||"Staff User"}</strong></td><td>${x.email||"—"}</td><td><span class="badge blue">${String(x.role||"").replace("_"," ")}</span></td><td><span class="badge green">Active</span></td></tr>`).join(""):`<tr><td colspan="4">No staff records loaded yet.</td></tr>`}</tbody></table></div></div>`;
  $("#createStaffBtn").onclick=()=>showModal("Create Staff Account","Create an Admin or Instructor account. A temporary password can be changed later with Forgot Password.",`
    <div class="grid-2"><label>First name<input id="staffFirst" required></label><label>Last name<input id="staffLast" required></label></div>
    <label>Email address<input id="staffEmail" type="email" required></label>
    <label>Phone number<input id="staffPhone" type="tel"></label>
    <label>Role<select id="staffRole">${allowed.map(r=>`<option value="${r}">${r==="admin"?"Admin":"Instructor"}</option>`).join("")}</select></label>
    <label>Temporary password<input id="staffPassword" type="password" minlength="8" required></label>
    <p class="muted">For security, public users cannot register as staff.</p>
  `,async()=>{
    const payload={firstName:$("#staffFirst").value.trim(),lastName:$("#staffLast").value.trim(),email:$("#staffEmail").value.trim().toLowerCase(),phone:$("#staffPhone").value.trim(),role:$("#staffRole").value,password:$("#staffPassword").value};
    if(!payload.firstName||!payload.lastName||!payload.email||payload.password.length<8) return alert("Complete the required fields. Password must be at least 8 characters.");
    try{
      await window.ETHAN_BACKEND.createStaff(payload);
      closeModal(); alert(`${payload.role==="admin"?"Admin":"Instructor"} account created. The staff member can now sign in with the same login page.`); renderStaff();
    }catch(err){ alert(err.message||"Staff account could not be created. Make sure the create-staff Edge Function is deployed."); }
  });
}

function courseCards(list){
 return `<div class="course-grid">${list.map(c=>`<article class="course-card"><div class="course-thumb"><strong>${c.category}</strong></div><div class="course-body"><small class="muted">${c.code}</small><h3>${c.title}</h3><p class="muted">${c.instructor}</p><div class="course-meta"><span>${c.duration}</span><span>${c.progress}%</span></div><div class="progress"><span style="width:${c.progress}%"></span></div><button class="secondary-btn" onclick="navigate('lms')">${currentUser.role==="student"?"Continue Learning":"Open Course"}</button></div></article>`).join("")}</div>`;
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
 <div class="card"><h3>Platform Status</h3><p><span class="badge green">Frontend Ready</span></p><p><span class="badge gold">Backend connection pending</span></p><p class="muted">Add your Supabase project details to config.js to connect production authentication and database services.</p></div>
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
 if(window.ETHAN_BACKEND?.ready){
   try{
     const session=await window.ETHAN_BACKEND.getSession();
     if(session?.user){
       let profile=null; try{profile=await window.ETHAN_BACKEND.getProfile(session.user.id)}catch(_){}
       const user={firstName:profile?.first_name||"Ethan",lastName:profile?.last_name||"User",name:`${profile?.first_name||"Ethan"} ${profile?.last_name||"User"}`,email:session.user.email,phone:profile?.phone||"",role:profile?.role||"student",id:session.user.id};
       openPortal(user); return;
     }
   }catch(_){}
 }
 const s=JSON.parse(localStorage.getItem(STORE.session)||"null"); if(!s)return;
 const user=getUsers().find(u=>u.email===s.email); if(user)openPortal(user);
})();

if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}


/* v5: payment-controlled course allocation */
function renderDashboard(){
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
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">MY LEARNING</span><h1>Welcome back, ${currentUser.firstName}</h1><p>Your allocated courses are ready. Continue from your assigned learning materials.</p></div><button class="secondary-btn" onclick="navigate('lms')">Continue Learning</button></div>
      <div class="stats-grid">${stat("My Courses",String(courses.length),"Allocated by academy","📚")}${stat("Average Progress",avg+"%","Across allocated courses","📈")}${stat("Assignments","0","Shown when assigned","📝")}${stat("Certificates","0","Issued after completion","🎓")}</div>
      <div class="card"><div class="card-head"><h3>My Allocated Courses</h3></div>${courseCards(courses)}</div>`;
   return;
 }
 if(role==="admin" || role==="super_admin"){
   $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">ACADEMY OVERVIEW</span><h1>Welcome back, ${currentUser.firstName}</h1><p>Manage registrations, verify payments and allocate courses before learning access is opened.</p></div><div class="hero-actions"><button class="secondary-btn" onclick="navigate('students')">Manage Students</button><button class="secondary-btn" onclick="navigate('payments')">Verify & Allocate</button></div></div>
      <div class="stats-grid">${stat("Registered Students",data.students.length,"Learner records","👥")}${stat("Course Catalogue",data.courses.length,"Available courses","📚")}${stat("Instructors",data.instructors.length,"Teaching staff","🧑‍🏫")}${stat("Access Rule","Payment","Before allocation","🔐")}</div>
      <div class="dashboard-grid"><div class="card"><div class="card-head"><h3>Student Status</h3></div>${studentTable(data.students)}</div><div class="card"><div class="card-head"><h3>Admission Flow</h3></div><div class="progress-list"><div class="progress-row"><strong>1. Registration</strong><p class="muted">Student creates account with zero courses.</p></div><div class="progress-row"><strong>2. Payment verification</strong><p class="muted">Admin records and confirms payment.</p></div><div class="progress-row"><strong>3. Course allocation</strong><p class="muted">Admin selects the paid course and enrols the student.</p></div><div class="progress-row"><strong>4. Learning access</strong><p class="muted">Lessons and videos become available only for allocated courses.</p></div></div></div></div>`;
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
 const list=isStudent?studentCourses():data.courses;
 const add=(currentUser.role==="admin"||currentUser.role==="super_admin"||currentUser.role==="instructor")?`<button class="primary-btn" id="addCourseBtn">+ Create Course</button>`:"";
 if(isStudent && !list.length){
   $("#content").innerHTML=pageHead("My Courses","Only courses allocated after verified payment appear here.")+emptyState("No courses allocated","Your account has no active enrolment yet. Once payment is confirmed and Admin allocates a course, it will appear here automatically.",`<button class="primary-btn" onclick="navigate('payments')">Check Payment Status</button>`);
   return;
 }
 $("#content").innerHTML=pageHead(isStudent?"My Courses":"Courses",isStudent?"Your approved and allocated learning programmes.":"Manage the academy course catalogue.",add)+courseCards(list);
 if($("#addCourseBtn")) $("#addCourseBtn").onclick=()=>showModal("Create Course","Add a course to the catalogue.",`<label>Course title<input id="courseTitle"></label><div class="grid-2"><label>Category<input id="courseCat"></label><label>Duration<input id="courseDur" placeholder="6 weeks"></label></div>`,()=>{const t=$("#courseTitle").value.trim(),cat=$("#courseCat").value.trim(),dur=$("#courseDur").value.trim();if(!t||!cat||!dur)return alert("Complete all fields.");data.courses.push({code:`EDA-CRS-${String(data.courses.length+1).padStart(3,"0")}`,title:t,category:cat,instructor:currentUser.name,duration:dur,progress:0,lessons:0,completed:0});persist();closeModal();renderCourses();});
}

function renderLMS(){
 if(currentUser.role==="student"){
   const courses=studentCourses();
   if(!courses.length){ $("#content").innerHTML=pageHead("Learning Classroom","Course lessons and videos are protected until enrolment.")+emptyState("Learning access locked","You have not yet been allocated a paid course. Registration alone does not unlock lessons or videos.",`<button class="primary-btn" onclick="navigate('payments')">View Payment Status</button>`); return; }
   const c=courses[0];
   if(!/cyber/i.test(c.title||"")){
     $("#content").innerHTML=pageHead("Learning Classroom","Your allocated course learning area.")+emptyState(`${c.title} is allocated`,`Your enrolment is active. Lessons, videos, assignments and materials published for this course will appear here. No unrelated sample lessons are shown.`); return;
   }
 }
 $("#content").innerHTML=pageHead(currentUser.role==="instructor"?"Course Builder":"Learning Classroom","Study only lessons assigned to this course.")+`<div class="lesson-layout"><aside class="lesson-menu">${cyberLessons.map((l,i)=>`<button data-lesson="${i}" class="${i===lessonIndex?"active":""}">${l.title}</button>`).join("")}</aside><article class="lesson-content"><small class="eyebrow">CYBERSECURITY FUNDAMENTALS</small>${cyberLessons[lessonIndex].body}<h3>Practical activity</h3><p>Review the security settings on one of your own accounts or devices. Record which protections are enabled.</p><div class="lesson-nav"><button class="secondary-btn" id="prevLesson" ${lessonIndex===0?"disabled":""}>← Previous</button><button class="primary-btn" id="completeLesson">${lessonIndex===cyberLessons.length-1?"Complete Lesson":"Mark Complete & Next →"}</button></div></article></div>`;
 $$(".lesson-menu button").forEach(b=>b.onclick=()=>{lessonIndex=+b.dataset.lesson;renderLMS()});
 $("#prevLesson").onclick=()=>{if(lessonIndex>0){lessonIndex--;renderLMS()}};
 $("#completeLesson").onclick=()=>{if(lessonIndex<cyberLessons.length-1){lessonIndex++;renderLMS()}else alert("Lesson completed.")};
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
 if(currentUser.role==="student"){ $("#content").innerHTML=pageHead("Attendance","Your real attendance record.")+emptyState(studentCourses().length?"No attendance recorded yet":"No attendance record","Attendance begins after your course is allocated and classes start."); return; }
 $("#content").innerHTML=pageHead("Attendance","Monitor attendance for enrolled learners.",currentUser.role==="admin"||currentUser.role==="super_admin"||currentUser.role==="instructor"?`<button class="primary-btn">Mark Attendance</button>`:"")+studentTable(data.students);
}
function renderResults(){
 if(currentUser.role==="student"){ $("#content").innerHTML=pageHead("Results","Only your published results are shown.")+emptyState("No results yet",studentCourses().length?"Results will appear after you complete graded assessments.":"Results become available after course allocation and assessment."); return; }
 $("#content").innerHTML=pageHead("Results","Academic assessment results and performance.")+emptyState("No result selected","Published learner results will appear here.");
}
function renderCertificates(){
 if(currentUser.role==="student"){ $("#content").innerHTML=pageHead("Certificates","Certificates are issued after successful course completion.")+emptyState("No certificate yet",studentCourses().length?"Complete the required course and assessments to qualify.":"You need an allocated course before certificate progress can begin."); return; }
 $("#content").innerHTML=pageHead("Certificates","Issue, manage and verify course certificates.",currentUser.role==="admin"||currentUser.role==="super_admin"?`<button class="primary-btn">Issue Certificate</button>`:"")+emptyState("Certificate records","Issued certificates will appear here.");
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
   const localPayments=data.payments.filter(p=>(p.studentId && p.studentId===portalState.myStudent?.id) || (!p.studentId && p.student===currentUser.name));
   const courses=studentCourses();
   $("#content").innerHTML=pageHead("Fees & Payments","Payment must be verified before course access is allocated.")+`
     <div class="stats-grid">${stat("Course Access",courses.length?"Active":"Pending",courses.length?"Course allocated":"Awaiting verified payment","🔐")}${stat("Allocated Courses",String(courses.length),"After payment confirmation","📚")}${stat("Recorded Payments",String(localPayments.length),"Your account","💳")}${stat("Learning Access",courses.length?"Open":"Locked",courses.length?"Enrolled":"No enrolment","▶")}</div>
     ${courses.length?emptyState("Payment verified / course allocated","Your approved course access is active. Open My Courses to start learning.",`<button class="primary-btn" onclick="navigate('courses')">Open My Courses</button>`):emptyState("Payment required before allocation","Registering creates your student account only. Make payment through the Academy's approved payment method. Admin will verify it and allocate the course you paid for; only then will lessons/videos open.")}`;
   return;
 }
 const canVerify=currentUser.role==="admin"||currentUser.role==="super_admin";
 $("#content").innerHTML=pageHead("Fees, Payments & Course Allocation","Verify a learner's payment and allocate exactly the course paid for.",canVerify?`<button class="primary-btn" id="recordPaymentBtn">+ Verify Payment & Allocate Course</button>`:"")+`
   <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Reference</th><th>Student</th><th>Description / Course</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>${data.payments.map(p=>`<tr><td>${p.ref||p.reference||"—"}</td><td>${p.student||"Student"}</td><td>${p.description||"Training Fee"}</td><td>₦${Number(p.amount||0).toLocaleString()}</td><td>${p.date||"—"}</td><td><span class="badge green">${p.status||"Confirmed"}</span></td></tr>`).join("")||`<tr><td colspan="6">No payments recorded yet.</td></tr>`}</tbody></table></div></div>`;
 if($("#recordPaymentBtn")) $("#recordPaymentBtn").onclick=()=>showModal("Verify Payment & Allocate Course","Choose the learner and the exact paid course. Saving confirms payment and creates the enrolment.",`
   <label>Student<select id="payStudent">${data.students.map(s=>`<option value="${s.id}">${s.name} ${s.studentNo?`(${s.studentNo})`:""}</option>`).join("")}</select></label>
   <label>Course<select id="payCourse">${data.courses.map(c=>`<option value="${c.id||c.code}">${c.title}${c.fee?` — ₦${Number(c.fee).toLocaleString()}`:""}</option>`).join("")}</select></label>
   <label>Amount received<input id="payAmount" type="number" min="1" required></label><label>Payment description<input id="payDesc" placeholder="Training fee / bank transfer"></label>
 `,async()=>{const student=data.students.find(s=>s.id===$("#payStudent").value),course=data.courses.find(c=>(c.id||c.code)===$("#payCourse").value),amount=Number($("#payAmount").value);if(!student||!course||!amount)return alert("Select student, course and enter a valid payment amount.");try{const ref=await allocateAfterPayment(student,course,amount,$("#payDesc").value.trim());closeModal();alert(`Payment ${ref} verified. ${course.title} has been allocated to ${student.name}.`);renderPayments();}catch(err){alert(err.message||"Payment could not be verified or course allocated.")}});
}

// v7 public header convenience action
window.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-jump-auth]').forEach(btn=>btn.addEventListener('click',()=>{
    const target=btn.dataset.jumpAuth;
    document.querySelector(`.auth-tab[data-auth-tab="${target}"]`)?.click();
    document.querySelector('.professional-card')?.scrollIntoView({behavior:'smooth',block:'center'});
  }));
});


const ETHAN_PUBLIC_COURSES = [{"name": "Computer Appreciation", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Microsoft Word", "brief": "Learn to create, format and manage professional documents for academic, office and business use."}, {"name": "Microsoft Excel", "brief": "Learn practical spreadsheet skills for organizing data, calculations, analysis, reporting and everyday business work."}, {"name": "Microsoft PowerPoint", "brief": "Learn to design and deliver clear, professional presentations using effective layouts, visuals and presentation tools."}, {"name": "Microsoft Access", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Google Workspace", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Internet & Email Skills", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "Typing & Keyboard Mastery", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Computer Hardware Fundamentals", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Computer Maintenance", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "IT Support Fundamentals", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Windows Productivity", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "File Management & Cloud Storage", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Cybersecurity Awareness", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Digital Literacy", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Canva Graphic Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "Advanced Canva Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "Adobe Photoshop Basics", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "CorelDRAW Essentials", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "Brand Identity Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "Social Media Graphics", "brief": "Learn how to use major digital platforms professionally for communication, content, audience growth and business development."}, {"name": "Flyer & Poster Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "Logo Design Fundamentals", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "UI/UX Design Fundamentals", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "Figma for Beginners", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "CapCut Video Editing", "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects."}, {"name": "Advanced Video Editing", "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects."}, {"name": "Content Creation", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Mobile Photography", "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects."}, {"name": "Digital Storytelling", "brief": "Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects."}, {"name": "Facebook Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Instagram Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "TikTok Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "YouTube Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "LinkedIn Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "WhatsApp Business Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Social Media Management", "brief": "Learn how to use major digital platforms professionally for communication, content, audience growth and business development."}, {"name": "Content Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Email Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "SEO Fundamentals", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Advanced SEO", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Search Engine Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Google Ads Fundamentals", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Meta Ads Fundamentals", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Marketing Analytics", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Digital Marketing Strategy", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Influencer Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Affiliate Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Personal Branding", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Online Reputation Management", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Artificial Intelligence Fundamentals", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "AI for Business", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "Prompt Engineering", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "Generative AI Tools", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "ChatGPT for Productivity", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "AI Content Creation", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "AI for Digital Marketing", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "AI for Education", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "AI Automation", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "Responsible AI", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "Web Design Fundamentals", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "HTML & CSS", "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences."}, {"name": "JavaScript Fundamentals", "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences."}, {"name": "WordPress Website Design", "brief": "Learn to create, format and manage professional documents for academic, office and business use."}, {"name": "No-Code Website Building", "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences."}, {"name": "E-commerce Website Setup", "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences."}, {"name": "Landing Page Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "Web Hosting & Domains", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "Website SEO", "brief": "Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results."}, {"name": "Website Maintenance", "brief": "Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks."}, {"name": "Python for Beginners", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development."}, {"name": "JavaScript Programming", "brief": "Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences."}, {"name": "Database Fundamentals", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development."}, {"name": "SQL Fundamentals", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development."}, {"name": "Supabase Fundamentals", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development."}, {"name": "Git & GitHub", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development."}, {"name": "Software Development Basics", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development."}, {"name": "API Fundamentals", "brief": "Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development."}, {"name": "Automation with No-Code Tools", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "App Development Fundamentals", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Data Analysis Fundamentals", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions."}, {"name": "Excel Data Analysis", "brief": "Learn practical spreadsheet skills for organizing data, calculations, analysis, reporting and everyday business work."}, {"name": "Power BI Fundamentals", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions."}, {"name": "Google Sheets Advanced", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "Data Visualization", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions."}, {"name": "Business Intelligence", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities."}, {"name": "Basic Statistics for Data", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions."}, {"name": "Data Cleaning", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions."}, {"name": "Dashboard Design", "brief": "Build practical visual design skills for creating professional digital content, graphics and user-focused creative work."}, {"name": "Reporting & Analytics", "brief": "Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions."}, {"name": "Entrepreneurship in the Digital Age", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities."}, {"name": "Digital Business Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities."}, {"name": "E-commerce Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities."}, {"name": "Online Business Setup", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities."}, {"name": "Freelancing Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities."}, {"name": "Remote Work Skills", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities."}, {"name": "Customer Relationship Management", "brief": "Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence."}, {"name": "ERP Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities."}, {"name": "CRM Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities."}, {"name": "Project Management Fundamentals", "brief": "Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities."}];


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
