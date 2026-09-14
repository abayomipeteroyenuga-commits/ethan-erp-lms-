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
let currentUser = null;
let currentPage = "dashboard";

function getUsers(){ return JSON.parse(localStorage.getItem(STORE.users) || "[]"); }
function saveUsers(users){ localStorage.setItem(STORE.users, JSON.stringify(users)); }
function setSession(user){
  localStorage.setItem(STORE.session, JSON.stringify({email:user.email, ts:Date.now()}));
}
function initials(name){ return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("") || "EU"; }

function ensurePreviewAdmin(){
  const users = getUsers();
  if(!users.some(u=>u.email==="admin@ethandigitalacademy.org")){
    users.push({
      firstName:"Ethan",lastName:"Administrator",name:"Ethan Administrator",
      email:"admin@ethandigitalacademy.org",phone:"",role:"admin",
      password:"EthanAdmin2026!",id:"EDA-ADM-001"
    });
    saveUsers(users);
  }
}
ensurePreviewAdmin();

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
  const role=$("#signupRole").value, password=$("#signupPassword").value, confirm=$("#confirmPassword").value;
  const msg=$("#signupMessage");
  if(password!==confirm){ msg.textContent="Passwords do not match."; msg.className="form-message error"; return; }
  try{
    if(window.ETHAN_BACKEND?.ready){
      await window.ETHAN_BACKEND.signUp({email,password,firstName,lastName,phone,role});
      msg.textContent="Account created. Check your email if confirmation is enabled."; msg.className="form-message success";
    }else{
      if(getUsers().some(u=>u.email===email)){ msg.textContent="An account with this email already exists."; msg.className="form-message error"; return; }
      const users=getUsers();
      const prefix=role==="student"?"EDA-ST":"EDA-PA";
      const user={firstName,lastName,name:`${firstName} ${lastName}`,email,phone,role,password,id:`${prefix}-${String(users.length+1).padStart(4,"0")}`};
      users.push(user); saveUsers(users);
      msg.textContent="Account created successfully in preview mode."; msg.className="form-message success";
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

const navByRole = {
  admin:[
    ["dashboard","▦","Dashboard"],["students","👥","Students"],["parents","👪","Parents"],["instructors","🧑‍🏫","Instructors"],
    ["courses","📚","Courses"],["lms","▶","LMS"],["assignments","📝","Assignments"],["quizzes","✅","Quizzes"],
    ["attendance","📅","Attendance"],["timetable","🕒","Timetable"],["payments","💳","Fees & Payments"],
    ["results","📊","Results"],["certificates","🎓","Certificates"],["announcements","📣","Announcements"],["reports","📈","Reports"],["settings","⚙","Settings"]
  ],
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

function openPortal(user){
  currentUser=user;
  $("#authScreen").classList.add("hidden"); $("#portal").classList.remove("hidden");
  $("#userName").textContent=user.name; $("#userRole").textContent=user.role;
  $("#userAvatar").textContent=initials(user.name);
  renderNav();
  renderNotifications();
  navigate("dashboard");
}
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
  const renderers={dashboard:renderDashboard,students:renderStudents,parents:renderParents,instructors:renderInstructors,courses:renderCourses,lms:renderLMS,assignments:renderAssignments,quizzes:renderQuizzes,attendance:renderAttendance,timetable:renderTimetable,payments:renderPayments,results:renderResults,certificates:renderCertificates,announcements:renderAnnouncements,reports:renderReports,settings:renderSettings,profile:renderProfile};
  (renderers[page]||renderDashboard)();
}

function stat(label,value,sub,icon){return `<div class="stat-card"><div class="stat-icon">${icon}</div><div><small class="stat-label">${label}</small><strong class="stat-value">${value}</strong><span class="stat-sub">${sub}</span></div></div>`}
function pageHead(title,desc,action=""){return `<div class="page-title-block"><div class="toolbar"><div><h1>${title}</h1><p class="muted">${desc}</p></div>${action}</div></div>`}

function renderDashboard(){
  const role=currentUser.role;
  if(role==="admin"){
    $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">ACADEMY OVERVIEW</span><h1>Welcome back, ${currentUser.firstName}</h1><p>Manage learners, courses, finance and academic operations from one place.</p></div><div class="hero-actions"><button class="secondary-btn" onclick="navigate('students')">Manage Students</button><button class="secondary-btn" onclick="navigate('courses')">Manage Courses</button></div></div>
      <div class="stats-grid">${stat("Total Students",data.students.length,"Active learner records","👥")}${stat("Active Courses",data.courses.length,"Published catalogue","📚")}${stat("Instructors",data.instructors.length,"Teaching staff","🧑‍🏫")}${stat("Payments","₦175,000","Recent confirmed","💳")}</div>
      <div class="dashboard-grid">
        <div class="card"><div class="card-head"><h3>Student Progress</h3><button class="text-btn" onclick="navigate('students')">View students</button></div><div class="progress-list">${data.students.map(s=>`<div class="progress-row"><div class="progress-top"><strong>${s.name}</strong><span>${s.progress}%</span></div><small class="muted">${s.program}</small><div class="progress"><span style="width:${s.progress}%"></span></div></div>`).join("")}</div></div>
        <div class="card"><div class="card-head"><h3>Quick Actions</h3></div><div class="quick-grid">${[["Add Student","students"],["Create Course","courses"],["Record Payment","payments"],["Mark Attendance","attendance"],["Publish Result","results"],["Issue Certificate","certificates"]].map(([a,p])=>`<div class="quick-card" onclick="navigate('${p}')"><strong>${a}</strong><p class="muted">Open module</p></div>`).join("")}</div></div>
      </div>`;
  } else if(role==="student"){
    $("#content").innerHTML=`
      <div class="hero-card"><div><span class="eyebrow" style="color:#a9cfff">CONTINUE LEARNING</span><h1>Welcome back, ${currentUser.firstName}</h1><p>Pick up from your latest lesson and keep building your skills.</p></div><button class="secondary-btn" onclick="navigate('lms')">Continue Course</button></div>
      <div class="stats-grid">${stat("My Courses","4","Currently enrolled","📚")}${stat("Average Progress","42%","Across active courses","📈")}${stat("Assignments","3","1 due soon","📝")}${stat("Certificates","1","Available","🎓")}</div>
      <div class="card"><div class="card-head"><h3>My Course Progress</h3></div><div class="progress-list">${data.courses.slice(0,4).map(c=>`<div class="progress-row"><div class="progress-top"><strong>${c.title}</strong><span>${c.progress}%</span></div><small class="muted">${c.completed} of ${c.lessons} lessons completed</small><div class="progress"><span style="width:${c.progress}%"></span></div></div>`).join("")}</div></div>`;
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
  const add = currentUser.role==="admin" ? `<button class="primary-btn" id="addStudentBtn">+ Add Student</button>` : "";
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
function courseCards(list){
 return `<div class="course-grid">${list.map(c=>`<article class="course-card"><div class="course-thumb"><strong>${c.category}</strong></div><div class="course-body"><small class="muted">${c.code}</small><h3>${c.title}</h3><p class="muted">${c.instructor}</p><div class="course-meta"><span>${c.duration}</span><span>${c.progress}%</span></div><div class="progress"><span style="width:${c.progress}%"></span></div><button class="secondary-btn" onclick="navigate('lms')">${currentUser.role==="student"?"Continue Learning":"Open Course"}</button></div></article>`).join("")}</div>`;
}
function renderCourses(){
 const add=(currentUser.role==="admin"||currentUser.role==="instructor")?`<button class="primary-btn" id="addCourseBtn">+ Create Course</button>`:"";
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
