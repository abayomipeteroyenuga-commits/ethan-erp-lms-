/* ETHAN LEARN — professional digital-skills classroom.
   Loaded after app.js so the learner classroom uses the Neon course, lesson,
   progress and quiz records rather than the old local Cybersecurity demo. */
var ethanLmsSelectedCourseId = null;
var ethanLmsSelectedLessonId = null;
var ethanLmsModules = [];
var ethanLmsQuizzes = [];
var ethanLmsProgress = {};

function ethanLmsEscape(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch];
  });
}

window.openLmsCourse = function (courseId) {
  ethanLmsSelectedCourseId = String(courseId || "");
  ethanLmsSelectedLessonId = null;
  navigate("lms");
};

renderLMS = async function (courseId) {
  var isStudent = currentUser && currentUser.role === "student";
  var catalogue = (isStudent ? studentCourses() : (data.courses || [])).filter(function (course) {
    return course && course.published !== false;
  });
  if (!catalogue.length) {
    document.querySelector("#content").innerHTML = emptyState(
      "No courses approved yet",
      "Your learner account is free. Browse the course catalogue, submit payment details and wait for Superadmin verification before lessons unlock.",
      '<button class="primary-btn" onclick="navigate(\'catalogue\')">Browse Course Catalogue</button>'
    );
    return;
  }

  var selected = catalogue.find(function (course) {
    return String(course.id || course.code) === String(courseId || ethanLmsSelectedCourseId);
  }) || catalogue[0];
  ethanLmsSelectedCourseId = String(selected.id || selected.code || "");

  var options = catalogue.map(function (course) {
    var value = String(course.id || course.code || "");
    return '<option value="' + ethanLmsEscape(value) + '"' +
      (value === ethanLmsSelectedCourseId ? " selected" : "") + ">" +
      ethanLmsEscape(course.title) + "</option>";
  }).join("");

  document.querySelector("#content").innerHTML =
    pageHead("Learning Classroom", "Choose a professional digital course, study its lessons and complete knowledge checks.") +
    '<div class="card" style="margin-bottom:16px"><div class="grid-2" style="align-items:end">' +
    '<label>Choose your course<select id="ethanLmsCourseSelect">' + options + "</select></label>" +
    '<div><strong>' + ethanLmsEscape(selected.code || "") + '</strong><p class="muted" style="margin:6px 0">' +
    ethanLmsEscape(selected.description || "Structured lessons, practical assignments and course assessments.") +
    "</p></div></div></div>" +
    '<div id="ethanLmsCourseContent">' +
    emptyState("Loading course", "Retrieving course modules and your saved progress…") + "</div>";

  var courseSelect = document.querySelector("#ethanLmsCourseSelect");
  courseSelect.addEventListener("change", function (event) {
    ethanLmsSelectedLessonId = null;
    renderLMS(event.target.value);
  });

  if (!selected.id || String(selected.id).indexOf("free-course-") === 0) {
    document.querySelector("#ethanLmsCourseContent").innerHTML = emptyState(
      "Course enrolment is being prepared",
      "Sign out and sign in again to refresh your course enrolments. Your account receives access to all published digital courses."
    );
    return;
  }
  if (!window.ETHAN_BACKEND || !window.ETHAN_BACKEND.ready) {
    document.querySelector("#ethanLmsCourseContent").innerHTML = emptyState(
      "Learning service unavailable",
      "Refresh the page and sign in again to reconnect to the course service."
    );
    return;
  }

  try {
    var requests = [
      window.ETHAN_BACKEND.listCourseModules(selected.id),
      window.ETHAN_BACKEND.listQuizzes()
    ];
    if (isStudent && portalState.myStudent && portalState.myStudent.id) {
      requests.push(window.ETHAN_BACKEND.listMyLessonProgress(portalState.myStudent.id));
    }
    var response = await Promise.all(requests);
    ethanLmsModules = Array.isArray(response[0]) ? response[0] : [];
    ethanLmsQuizzes = (Array.isArray(response[1]) ? response[1] : []).filter(function (quiz) {
      return quiz.course_id === selected.id && quiz.published;
    });
    ethanLmsProgress = {};
    (response[2] || []).forEach(function (item) {
      ethanLmsProgress[item.lesson_id] = Boolean(item.completed);
    });

    var allLessons = [];
    ethanLmsModules.forEach(function (module) {
      (module.lessons || []).forEach(function (lesson) {
        if (lesson.published !== false) allLessons.push(lesson);
      });
    });
    if (!allLessons.length) {
      document.querySelector("#ethanLmsCourseContent").innerHTML = emptyState(
        "Course lessons are being prepared",
        "This course is in the catalogue. Its classroom materials are not available yet."
      );
      return;
    }
    if (!allLessons.some(function (lesson) { return lesson.id === ethanLmsSelectedLessonId; })) {
      ethanLmsSelectedLessonId = allLessons[0].id;
    }
    ethanLmsRenderCourse(selected);
  } catch (error) {
    document.querySelector("#ethanLmsCourseContent").innerHTML = emptyState(
      "Unable to load this classroom",
      ethanLmsEscape(error && error.message ? error.message : "The course content could not be retrieved. Please refresh and try again.")
    );
  }
};

function ethanLmsRenderCourse(course) {
  var panel = document.querySelector("#ethanLmsCourseContent");
  if (!panel) return;

  var lessonRows = [];
  ethanLmsModules.forEach(function (module) {
    (module.lessons || []).forEach(function (lesson) {
      if (lesson.published !== false) {
        lessonRows.push({
          id: lesson.id,
          title: lesson.title,
          content_html: lesson.content_html,
          moduleId: module.id,
          moduleTitle: module.title
        });
      }
    });
  });
  var lesson = lessonRows.find(function (item) { return item.id === ethanLmsSelectedLessonId; }) || lessonRows[0];
  if (!lesson) {
    panel.innerHTML = emptyState("No published lessons", "The course team has not published lessons for this course yet.");
    return;
  }
  ethanLmsSelectedLessonId = lesson.id;

  var completedCount = lessonRows.filter(function (item) { return ethanLmsProgress[item.id]; }).length;
  var percent = lessonRows.length ? Math.round(completedCount / lessonRows.length * 100) : 0;
  var quizTitle = (lesson.moduleTitle + " — " + lesson.title + " Knowledge Check").slice(0, 250);
  var quiz = ethanLmsQuizzes.find(function (item) { return item.title === quizTitle; });

  var moduleMenu = ethanLmsModules.map(function (module) {
    var visibleLessons = (module.lessons || []).filter(function (item) { return item.published !== false; });
    if (!visibleLessons.length) return "";
    var buttons = visibleLessons.map(function (item) {
      var complete = ethanLmsProgress[item.id];
      return '<button type="button" data-ethan-lms-lesson="' + ethanLmsEscape(item.id) + '"' +
        (item.id === lesson.id ? ' class="active"' : "") + ">" +
        (complete ? "✓ " : "") + ethanLmsEscape(item.title) + "</button>";
    }).join("");
    return '<div class="ethan-lms-module"><h4 style="font-size:13px;margin:12px 8px 5px;color:var(--navy)">' +
      ethanLmsEscape(module.title) + "</h4>" + buttons + "</div>";
  }).join("");

  var lessonIndex = lessonRows.findIndex(function (item) { return item.id === lesson.id; });
  var previousDisabled = lessonIndex <= 0 ? " disabled" : "";
  var nextDisabled = lessonIndex >= lessonRows.length - 1 ? " disabled" : "";
  var completionButton = currentUser && currentUser.role === "student"
    ? '<button type="button" class="primary-btn" id="ethanLmsCompleteLesson">' +
      (ethanLmsProgress[lesson.id] ? "Completed ✓" : "Mark Lesson Complete") + "</button>"
    : "";

  panel.innerHTML =
    '<div class="card" style="margin-bottom:16px"><div class="progress-top"><strong>Course progress</strong><span>' +
    completedCount + " of " + lessonRows.length + " lessons · " + percent + '%</span></div>' +
    '<div class="progress"><span style="width:' + percent + '%"></span></div>' +
    '<p class="muted" style="margin:8px 0 0">' + ethanLmsModules.length + " modules · " +
    ethanLmsQuizzes.length + " knowledge checks</p></div>" +
    '<div class="lesson-layout"><aside class="lesson-menu">' + moduleMenu + "</aside>" +
    '<article class="lesson-content"><small class="eyebrow">' + ethanLmsEscape(course.code || "ETHAN LEARN") +
    " · " + ethanLmsEscape(lesson.moduleTitle) + "</small><h1>" + ethanLmsEscape(lesson.title) + "</h1>" +
    '<div class="ethan-course-content">' + (lesson.content_html || "<p>Lesson content is being prepared.</p>") + "</div>" +
    '<div class="lesson-nav" style="gap:10px;flex-wrap:wrap">' +
    '<button type="button" class="secondary-btn" id="ethanLmsPrevious"' + previousDisabled + ">← Previous</button>" +
    completionButton +
    '<button type="button" class="secondary-btn" id="ethanLmsNext"' + nextDisabled + ">Next Lesson →</button></div>" +
    '<div class="card" style="margin-top:20px" id="ethanLmsQuizArea"><div class="card-head"><div>' +
    '<span class="eyebrow">LESSON KNOWLEDGE CHECK</span><h3>' +
    (quiz ? ethanLmsEscape(quiz.title) : "Assessment coming soon") + "</h3><p class=\"muted\">" +
    (quiz ? (Number(quiz.time_limit_minutes || 10) + " minutes · Pass mark " +
      Number(quiz.pass_mark || 60) + "% · Up to " + Number(quiz.attempts_allowed || 1) + " attempts")
      : "No quiz is attached to this lesson yet.") +
    "</p></div></div>" +
    (quiz ? '<button type="button" class="primary-btn" id="ethanLmsStartQuiz">Start Knowledge Check</button>' : "") +
    "</div><div class=\"study-actions\" style=\"margin-top:14px\">" +
    '<button type="button" class="secondary-btn" id="ethanLmsOpenManual">Open Full Course Manual</button></div></article></div>';

  panel.querySelectorAll("[data-ethan-lms-lesson]").forEach(function (button) {
    button.addEventListener("click", function () {
      ethanLmsSelectedLessonId = button.getAttribute("data-ethan-lms-lesson");
      ethanLmsRenderCourse(course);
    });
  });

  var previous = document.querySelector("#ethanLmsPrevious");
  var next = document.querySelector("#ethanLmsNext");
  var complete = document.querySelector("#ethanLmsCompleteLesson");
  var startQuiz = document.querySelector("#ethanLmsStartQuiz");
  var manual = document.querySelector("#ethanLmsOpenManual");

  if (previous) previous.addEventListener("click", function () {
    if (lessonIndex > 0) {
      ethanLmsSelectedLessonId = lessonRows[lessonIndex - 1].id;
      ethanLmsRenderCourse(course);
    }
  });
  if (next) next.addEventListener("click", function () {
    if (lessonIndex < lessonRows.length - 1) {
      ethanLmsSelectedLessonId = lessonRows[lessonIndex + 1].id;
      ethanLmsRenderCourse(course);
    }
  });
  if (complete) complete.addEventListener("click", async function () {
    if (!portalState.myStudent || !portalState.myStudent.id) {
      alert("Your learner profile is not ready. Sign out and sign in again.");
      return;
    }
    complete.disabled = true;
    complete.textContent = "Saving progress…";
    try {
      await window.ETHAN_BACKEND.setLessonProgress({
        studentId: portalState.myStudent.id,
        lessonId: lesson.id,
        completed: true
      });
      ethanLmsProgress[lesson.id] = true;
      ethanLmsRenderCourse(course);
    } catch (error) {
      alert(error && error.message ? error.message : "Your progress could not be saved.");
      complete.disabled = false;
      complete.textContent = "Mark Lesson Complete";
    }
  });
  if (startQuiz) startQuiz.addEventListener("click", function () { ethanLmsStartQuiz(quiz.id); });
  if (manual) manual.addEventListener("click", function () {
    openCourseStudy(encodeURIComponent(course.title || ""));
  });
}

async function ethanLmsStartQuiz(quizId) {
  var area = document.querySelector("#ethanLmsQuizArea");
  if (!area) return;
  area.innerHTML = emptyState("Loading knowledge check", "Retrieving your questions…");
  try {
    var questions = await window.ETHAN_BACKEND.getPublishedQuizQuestions(quizId);
    if (!questions.length) {
      area.innerHTML = emptyState("No questions available", "This knowledge check has not been set up yet.");
      return;
    }
    var questionHtml = questions.map(function (question, index) {
      var choices = (Array.isArray(question.options) ? question.options : []).map(function (option, choiceIndex) {
        return '<label style="display:flex;gap:10px;align-items:flex-start;margin:10px 0">' +
          '<input type="radio" name="ethan-lms-q-' + ethanLmsEscape(question.id) + '" value="' + choiceIndex + '" required>' +
          "<span>" + ethanLmsEscape(option) + "</span></label>";
      }).join("");
      return '<fieldset class="ethan-lms-question" style="border:0;border-top:1px solid var(--line);padding:16px 0">' +
        "<legend><strong>" + (index + 1) + ". " + ethanLmsEscape(question.question) + "</strong></legend>" +
        choices + "</fieldset>";
    }).join("");
    area.innerHTML =
      '<form id="ethanLmsQuizForm"><div class="card-head"><div><span class="eyebrow">ETHAN LEARN ASSESSMENT</span>' +
      "<h3>Answer every question</h3><p class=\"muted\">" + questions.length +
      " questions · Your answers are submitted securely.</p></div></div>" + questionHtml +
      '<button type="submit" class="primary-btn">Submit Knowledge Check</button><p id="ethanLmsQuizStatus" class="form-message"></p></form>';

    document.querySelector("#ethanLmsQuizForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      var answers = {};
      for (var i = 0; i < questions.length; i++) {
        var question = questions[i];
        var selected = document.querySelector(
          '#ethanLmsQuizForm input[name="ethan-lms-q-' + question.id + '"]:checked'
        );
        if (!selected) {
          alert("Please answer every question before submitting.");
          return;
        }
        answers[question.id] = Number(selected.value);
      }
      var button = document.querySelector("#ethanLmsQuizForm button[type='submit']");
      var status = document.querySelector("#ethanLmsQuizStatus");
      button.disabled = true;
      button.textContent = "Submitting securely…";
      try {
        var result = await window.ETHAN_BACKEND.submitQuizAttempt(quizId, answers);
        var passed = Boolean(result.passed);
        area.innerHTML =
          '<div class="card"><span class="eyebrow">ASSESSMENT RESULT</span><h3>' +
          (passed ? "Well done — you passed" : "Keep practising and try again") +
          '</h3><p class="stat-value">' + Number(result.score || 0) + '%</p><p>' +
          Number(result.earned_marks || 0) + " out of " + Number(result.total_marks || 0) +
          ' marks</p><p class="muted">This result has been saved to your learner record.</p></div>';
      } catch (error) {
        status.textContent = error && error.message ? error.message : "Your answers could not be submitted.";
        status.className = "form-message error";
        button.disabled = false;
        button.textContent = "Submit Knowledge Check";
      }
    });
  } catch (error) {
    area.innerHTML = emptyState(
      "Unable to load assessment",
      ethanLmsEscape(error && error.message ? error.message : "Please try again.")
    );
  }
}

courseCards = function (list) {
  return '<div class="course-grid">' + (list || []).map(function (course) {
    var id = ethanLmsEscape(course.id || course.code || "");
    var title = ethanLmsEscape(course.title || "Digital course");
    var encoded = encodeURIComponent(course.title || "");
    var category = ethanLmsEscape(course.category || "Digital Skills");
    var percent = Number(course.progress || 0);
    return '<article class="course-card"><div class="course-thumb"><strong>' + category +
      '</strong></div><div class="course-body"><small class="muted">' +
      ethanLmsEscape(course.code || "") + "</small><h3>" + title + "</h3><p class=\"muted\">" +
      ethanLmsEscape(course.instructor || "Ethan Digital Academy") +
      '</p><div class="course-meta"><span>' + ethanLmsEscape(course.duration || "Self-paced") +
      '</span><span>' + percent + '%</span></div><div class="progress"><span style="width:' +
      percent + '%"></span></div><div class="course-card-actions">' +
      '<button type="button" class="primary-btn" data-course-manual="' + encoded + '">' +
      (currentUser.role === "student" ? "Read Course Note" : "Preview Study Note") +
      '</button><button type="button" class="secondary-btn" data-open-course="' + id + '">' +
      (currentUser.role === "student" ? "Start Learning" : "Open Classroom") +
      "</button></div></div></article>";
  }).join("") + "</div>";
};

/* Learner catalogue: free account, paid course access after manual Superadmin verification. */
renderCourseCatalogue = async function () {
  if (!currentUser || currentUser.role !== "student") {
    if (currentUser && ["admin","super_admin","instructor"].includes(currentUser.role)) return renderCourses();
    return;
  }
  var backend=window.ETHAN_BACKEND;
  document.querySelector("#content").innerHTML=
    pageHead("Course Catalogue","Your Ethan LEARN account is free. Pay only for the professional courses you choose.")+
    emptyState("Loading course catalogue","Retrieving published digital courses and your access requests…");
  if(!backend || !backend.ready || !portalState.myStudent){
    document.querySelector("#content").innerHTML=
      pageHead("Course Catalogue","Your free learner account.")+
      emptyState("Learner profile not ready","Sign out and sign in again to finish preparing your learner profile.");
    return;
  }
  try{
    var [courses,requests]=await Promise.all([
      backend.listCourses(),
      backend.listMyCourseAccessRequests(portalState.myStudent.id)
    ]);
    portalState.myCourseRequests=requests||[];
    var enrolled=new Set(studentCourses().map(function(c){return String(c.id);}));
    var latestByCourse=new Map();
    (requests||[]).forEach(function(r){
      var key=String(r.course_id);
      if(!latestByCourse.has(key))latestByCourse.set(key,r);
    });
    var visible=(courses||[]).filter(function(c){return c.published===true;});
    var cards=visible.map(function(course){
      var id=String(course.id),request=latestByCourse.get(id),isActive=enrolled.has(id);
      var fee=Number(course.fee||0);
      var state=isActive
        ? '<span class="badge green">Approved · Active</span>'
        : request&&request.status==="pending"
          ? '<span class="badge gold">Payment under review</span>'
          : request&&request.status==="rejected"
            ? '<span class="badge red">Request declined</span>'
            : '<span class="badge blue">Not enrolled</span>';
      var action=isActive
        ? '<button type="button" class="secondary-btn" disabled>Already approved</button>'
        : request&&request.status==="pending"
          ? '<button type="button" class="secondary-btn" disabled>Awaiting verification</button>'
          : '<button type="button" class="primary-btn" data-request-course="'+ethanLmsEscape(id)+'">Submit payment details</button>';
      return '<article class="lms-course-card"><div class="lms-course-card-top"><span>'+ethanLmsEscape(course.code||"ETHAN COURSE")+'</span>'+state+'</div><div class="lms-course-icon">📘</div><h3>'+ethanLmsEscape(course.title)+'</h3><p>'+ethanLmsEscape(course.description||course.learning_objectives||"Practical professional digital skills from Ethan Digital Academy.")+'</p><div class="lms-course-meta"><span>'+ethanLmsEscape(course.duration||"Self-paced")+'</span><strong>₦'+fee.toLocaleString("en-NG")+'</strong></div><div class="lms-course-actions">'+action+'</div></article>';
    }).join("");
    document.querySelector("#content").innerHTML=
      pageHead("Course Catalogue","Your learner account is free. Each selected course is unlocked separately after payment verification.")+
      '<div class="lms-library-tools"><input id="courseCatalogueSearch" type="search" placeholder="Search professional courses…" aria-label="Search professional courses"><span>'+visible.length+' courses</span></div>'+
      (cards?'<div id="courseCatalogueGrid" class="lms-course-grid">'+cards+'</div>':emptyState("No published courses","The Academy has not published any courses yet."))+
      '<p class="muted" style="margin-top:18px;font-size:12px">Submitting a transfer reference does not unlock a course. Access is granted only after the Superadmin confirms receipt of the payment.</p>';
    var search=document.querySelector("#courseCatalogueSearch");
    if(search)search.oninput=function(){
      var q=search.value.trim().toLowerCase();
      document.querySelectorAll("#courseCatalogueGrid .lms-course-card").forEach(function(card){
        card.hidden=!card.textContent.toLowerCase().includes(q);
      });
    };
    document.querySelectorAll("[data-request-course]").forEach(function(button){
      button.onclick=function(){
        var course=visible.find(function(c){return String(c.id)===button.dataset.requestCourse;});
        if(course)openLearnerCoursePaymentRequest(course);
      };
    });
  }catch(error){
    document.querySelector("#content").innerHTML=
      pageHead("Course Catalogue","Choose your professional digital course.")+
      emptyState("Catalogue could not be loaded",error.message||"Refresh and try again.");
  }
};

function openLearnerCoursePaymentRequest(course){
  var fee=Number(course.fee||0);
  if(fee<=0)return alert("This course fee has not been configured. Contact the Academy.");
  showModal("Submit course payment details",
    "Free account registration does not include course enrolment. After transferring the exact course fee through the Academy's official payment instructions, enter the transaction details below. A Superadmin will verify the transfer before access is granted.",
    '<div class="card" style="padding:13px;margin-bottom:12px"><strong>'+ethanLmsEscape(course.title)+'</strong><div class="muted" style="font-size:12px">'+ethanLmsEscape(course.code||"")+'</div><h3 style="margin:7px 0;color:#123d80">₦'+fee.toLocaleString("en-NG")+'</h3><small class="muted">Amount due for this course</small></div>'+
    '<label>Bank transfer reference<input id="courseTransferReference" required maxlength="180" placeholder="Enter the transaction reference"></label>'+
    '<div class="grid-2"><label>Payment date<input id="coursePaymentDate" type="date" required value="'+new Date().toISOString().slice(0,10)+'"></label><label>Payment method<select id="coursePaymentMethod"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash paid to Academy</option><option value="pos">POS</option><option value="other">Other approved method</option></select></label></div>'+
    '<label>Additional note (optional)<textarea id="coursePaymentNotes" rows="3" maxlength="500" placeholder="Optional payment note"></textarea></label>',
    async function(){
      var reference=document.querySelector("#courseTransferReference").value.trim();
      var paymentDate=document.querySelector("#coursePaymentDate").value;
      var paymentMethod=document.querySelector("#coursePaymentMethod").value;
      var notes=document.querySelector("#coursePaymentNotes").value.trim();
      if(reference.length<3)return alert("Enter the bank or payment transaction reference.");
      if(!paymentDate)return alert("Select the payment date.");
      try{
        await window.ETHAN_BACKEND.createCourseAccessRequest({
          studentId:portalState.myStudent.id,courseId:course.id,amount:fee,
          paymentReference:reference,paymentDate:paymentDate,paymentMethod:paymentMethod,notes:notes
        });
        closeModal();
        alert("Your course payment details have been submitted. The course will remain locked until the Superadmin verifies the payment.");
        await renderCourseCatalogue();
      }catch(error){
        alert(error.message||"Your payment details could not be submitted. Check the reference or contact the Academy.");
      }
    }
  );
}

renderCourses = function () {
  var isStudent = currentUser.role === "student";
  var list = isStudent ? studentCourses() : data.courses;
  var add = (!isStudent && ["admin", "super_admin", "instructor"].includes(currentUser.role))
    ? '<button class="primary-btn" id="addCourseBtn">+ Create Course</button>' : "";
  var intro = isStudent
    ? "Only courses approved for your learner account appear here."
    : "Browse and manage the Academy digital course catalogue.";
  var body = isStudent && !list.length
    ? emptyState("No courses approved yet", "Your free account is active. Choose a course from the catalogue, make the payment and submit the transfer reference. The Superadmin will unlock the selected course after verification.", '<button class="primary-btn" onclick="navigate(\'catalogue\')">Browse Course Catalogue</button>')
    : courseCards(list);
  document.querySelector("#content").innerHTML =
    pageHead(isStudent ? "My Courses" : "Courses", intro, add) + body;
  document.querySelectorAll("[data-open-course]").forEach(function (button) {
    button.addEventListener("click", function () { window.openLmsCourse(button.getAttribute("data-open-course")); });
  });
  document.querySelectorAll("[data-course-manual]").forEach(function (button) {
    button.addEventListener("click", function () { openCourseStudy(button.getAttribute("data-course-manual")); });
  });
  var addButton = document.querySelector("#addCourseBtn");
  if (addButton) addButton.onclick = function () {
    showModal("Create Course", "Add a course to the catalogue.",
      '<label>Course title<input id="courseTitle"></label><div class="grid-2">' +
      '<label>Category<input id="courseCat"></label><label>Duration<input id="courseDur" placeholder="6 weeks"></label></div>',
      function () {
        var title = document.querySelector("#courseTitle").value.trim();
        var category = document.querySelector("#courseCat").value.trim();
        var duration = document.querySelector("#courseDur").value.trim();
        if (!title || !category || !duration) return alert("Complete all fields.");
        data.courses.push({
          code: "EDA-CRS-" + String(data.courses.length + 1).padStart(3, "0"),
          title: title, category: category, instructor: currentUser.name,
          duration: duration, progress: 0, lessons: 0, completed: 0
        });
        persist();
        closeModal();
        renderCourses();
      }
    );
  };
};

renderQuizzes = async function () {
  var isStudent = currentUser && currentUser.role === "student";
  var catalogue = isStudent ? studentCourses() : (data.courses || []);
  if(isStudent && !catalogue.length){
    document.querySelector("#content").innerHTML =
      pageHead("Quizzes & Knowledge Checks","Assessments are available only for courses approved to your account.")+
      emptyState("No course assessments yet","Choose a course from the catalogue, complete payment and wait for the Superadmin to approve access.",'<button class="primary-btn" onclick="navigate(\'catalogue\')">Browse Course Catalogue</button>');
    return;
  }
  document.querySelector("#content").innerHTML =
    pageHead("Quizzes & Knowledge Checks", "Choose a digital course to take its lesson assessments.") +
    emptyState("Loading assessments", "Retrieving published course knowledge checks…");
  try {
    var quizzes = await window.ETHAN_BACKEND.listQuizzes();
    var counts = {};
    (quizzes || []).forEach(function (quiz) {
      if (quiz.published) counts[quiz.course_id] = (counts[quiz.course_id] || 0) + 1;
    });
    document.querySelector("#content").innerHTML =
      pageHead("Quizzes & Knowledge Checks", "Choose a digital course to take its lesson assessments.") +
      '<div class="course-grid">' + catalogue.map(function (course) {
        var id = ethanLmsEscape(course.id || "");
        return '<article class="course-card"><div class="course-body"><span class="badge blue">Digital course</span><h3>' +
          ethanLmsEscape(course.title) + '</h3><p class="muted">' + (counts[course.id] || 0) +
          ' published lesson checks</p><button type="button" class="primary-btn" data-open-assessments="' +
          id + '">Open Course Assessments</button></div></article>';
      }).join("") + "</div>";
    document.querySelectorAll("[data-open-assessments]").forEach(function (button) {
      button.addEventListener("click", function () {
        window.openLmsCourse(button.getAttribute("data-open-assessments"));
      });
    });
  } catch (error) {
    document.querySelector("#content").innerHTML = emptyState(
      "Assessments unavailable",
      ethanLmsEscape(error && error.message ? error.message : "Please refresh the learning portal.")
    );
  }
};

/* My Courses displays only Superadmin-approved enrolments. */
renderCourses = function () {
  var isStudent = currentUser && currentUser.role === "student";
  var list = isStudent ? studentCourses() : (data.courses || []);
  var add = (!isStudent && ["admin","super_admin","instructor"].includes(currentUser.role))
    ? '<button class="primary-btn" id="addCourseBtn">+ Create Course</button>' : "";
  var body = isStudent && !list.length
    ? emptyState("No courses approved yet","Your account is free. Choose a course from the catalogue, complete payment and submit the transfer reference. The course opens only after Superadmin verification.",'<button class="primary-btn" onclick="navigate(\'catalogue\')">Browse Course Catalogue</button>')
    : courseCards(list);
  document.querySelector("#content").innerHTML =
    pageHead(isStudent ? "My Courses" : "Courses",
      isStudent ? "Only courses approved for your learner account appear here." : "Browse and manage the Academy digital course catalogue.",
      add) + body;
  document.querySelectorAll("[data-open-course]").forEach(function(button){
    button.addEventListener("click",function(){window.openLmsCourse(button.getAttribute("data-open-course"));});
  });
  document.querySelectorAll("[data-course-manual]").forEach(function(button){
    button.addEventListener("click",function(){openCourseStudy(button.getAttribute("data-course-manual"));});
  });
};

/* Superadmin-only payment review. Approval verifies payment and enrols one course atomically. */
renderPayments = async function () {
  var backend=window.ETHAN_BACKEND;
  if(currentUser && currentUser.role==="student"){
    var requests=portalState.myCourseRequests||[];
    try{
      if(backend?.ready && portalState.myStudent){
        requests=await backend.listMyCourseAccessRequests(portalState.myStudent.id);
        portalState.myCourseRequests=requests;
      }
    }catch(error){console.warn("Course payment requests could not be refreshed:",error);}
    var pending=requests.filter(function(r){return r.status==="pending";}).length;
    var approved=requests.filter(function(r){return r.status==="approved";}).length;
    var history=requests.map(function(r){
      var title=r.course?.title||"Selected digital course";
      var status=r.status==="approved"?'Approved — access active':r.status==="rejected"?'Declined':'Awaiting Superadmin verification';
      var badge=r.status==="approved"?"green":r.status==="rejected"?"red":"gold";
      return '<div class="progress-row"><div class="progress-top"><strong>'+ethanLmsEscape(title)+'</strong><span class="badge '+badge+'">'+ethanLmsEscape(status)+'</span></div><small class="muted">₦'+Number(r.amount||0).toLocaleString("en-NG")+' · Transfer ref: '+ethanLmsEscape(r.payment_reference||"—")+' · Submitted '+ethanLmsEscape(r.payment_date||"")+'</small>'+(r.admin_note?'<p class="muted" style="margin:8px 0 0">Academy note: '+ethanLmsEscape(r.admin_note)+'</p>':"")+'</div>';
    }).join("");
    document.querySelector("#content").innerHTML=
      pageHead("Payments & Course Requests","Your account is free. Course access is issued separately after the Academy verifies payment.")+
      '<div class="stats-grid">'+
        stat("Pending review",String(pending),"Transfer details awaiting review","⏳")+
        stat("Approved courses",String(approved),"Course access unlocked","📚")+
        stat("Active enrolments",String(studentCourses().length),"Your approved courses","🎓")+
        stat("Account fee","FREE","Create and keep your learner account","✓")+
      '</div>'+
      (history?'<div class="card"><div class="card-head"><h3>Your course payment requests</h3><button class="secondary-btn" onclick="navigate(\'catalogue\')">Choose another course</button></div><div class="progress-list">'+history+'</div></div>':emptyState("No course payment requests yet","Choose a professional course, pay its listed fee and submit the transfer reference for verification.",'<button class="primary-btn" onclick="navigate(\'catalogue\')">Browse Course Catalogue</button>'));
    return;
  }

  if(!backend?.ready){
    document.querySelector("#content").innerHTML=pageHead("Payments & Course Access","Superadmin course approvals.")+
      emptyState("Payment service unavailable","Reconnect to the learning database and refresh.");
    return;
  }

  if(currentUser.role==="super_admin"){
    document.querySelector("#content").innerHTML=pageHead("Course Payment Approvals","Check the transfer against the Academy bank statement before approving access.")+
      '<div class="card"><p class="muted">Loading payment requests…</p></div>';
    try{
      var requests=await backend.listCourseAccessRequests();
      var pending=requests.filter(function(r){return r.status==="pending";});
      var approved=requests.filter(function(r){return r.status==="approved";});
      var rejected=requests.filter(function(r){return r.status==="rejected";});
      var rows=requests.map(function(r){
        var student=r.student?.profiles||{};
        var studentName=[student.first_name,student.last_name].filter(Boolean).join(" ")||r.student?.student_no||"Learner";
        var courseName=r.course?.title||"Course";
        var status=r.status==="approved"?'Approved':r.status==="rejected"?'Rejected':'Pending verification';
        var badge=r.status==="approved"?"green":r.status==="rejected"?"red":"gold";
        var actions=r.status==="pending"
          ? '<div class="toolbar-right"><button type="button" class="primary-btn" data-approve-course-request="'+ethanLmsEscape(r.id)+'">Verify & unlock</button><button type="button" class="danger-btn" data-reject-course-request="'+ethanLmsEscape(r.id)+'">Reject</button></div>'
          : (r.payment_id?'<small class="muted">Verified payment recorded</small>':(r.admin_note?'<small class="muted">'+ethanLmsEscape(r.admin_note)+'</small>':"—"));
        return '<tr><td><strong>'+ethanLmsEscape(studentName)+'</strong><small class="muted" style="display:block">'+ethanLmsEscape(student.email||"")+'</small></td><td>'+ethanLmsEscape(courseName)+'<small class="muted" style="display:block">'+ethanLmsEscape(r.course?.code||"")+'</small></td><td><strong>₦'+Number(r.amount||0).toLocaleString("en-NG")+'</strong></td><td>'+ethanLmsEscape(r.payment_reference||"")+'</td><td>'+ethanLmsEscape(r.payment_date||"")+'</td><td><span class="badge '+badge+'">'+status+'</span></td><td>'+actions+'</td></tr>';
      }).join("");
      document.querySelector("#content").innerHTML=
        pageHead("Course Payment Approvals","Verify the transaction externally, then approve only the course shown in the request.")+
        '<div class="stats-grid">'+
          stat("Pending",String(pending.length),"Awaiting manual payment check","⏳")+
          stat("Approved",String(approved.length),"Courses unlocked","✓")+
          stat("Rejected",String(rejected.length),"Not approved","—")+
          stat("Requests",String(requests.length),"All course access requests","📋")+
        '</div>'+
        '<div class="card"><div class="card-head"><h3>Transfer verification queue</h3><span class="badge gold">'+pending.length+' pending</span></div>'+
        '<p class="muted" style="font-size:12px">Confirm the transaction reference and amount in the Academy bank records before using Verify & unlock. Approval records a verified payment and activates that course only.</p>'+
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Learner</th><th>Course</th><th>Amount</th><th>Transfer reference</th><th>Payment date</th><th>Status</th><th>Review</th></tr></thead><tbody>'+
        (rows||'<tr><td colspan="7">No course payment requests have been submitted.</td></tr>')+
        '</tbody></table></div></div>';
      document.querySelectorAll("[data-approve-course-request]").forEach(function(button){
        button.onclick=async function(){
          var requestId=button.dataset.approveCourseRequest;
          if(!confirm("Have you checked the bank record and confirmed that the full course fee was received? This will activate the requested course."))return;
          var note=prompt("Optional Superadmin note for the learner:","Payment verified. Course access approved.")||"";
          button.disabled=true;button.textContent="Approving…";
          try{
            await backend.approveCourseAccessRequest(requestId,note);
            alert("Payment verified and the requested course has been unlocked.");
            await renderPayments();
          }catch(error){
            button.disabled=false;button.textContent="Verify & unlock";
            alert(error.message||"The course could not be approved.");
          }
        };
      });
      document.querySelectorAll("[data-reject-course-request]").forEach(function(button){
        button.onclick=async function(){
          var note=prompt("Reason for rejecting this payment request (required):","");
          if(note===null)return;
          if(!note.trim())return alert("Enter a short reason before rejecting the request.");
          button.disabled=true;button.textContent="Rejecting…";
          try{
            await backend.rejectCourseAccessRequest(button.dataset.rejectCourseRequest,note.trim());
            await renderPayments();
          }catch(error){
            button.disabled=false;button.textContent="Reject";
            alert(error.message||"The request could not be rejected.");
          }
        };
      });
    }catch(error){
      document.querySelector("#content").innerHTML=pageHead("Course Payment Approvals","Superadmin review queue.")+
        emptyState("Payment requests could not be loaded",error.message||"Refresh and try again.");
    }
    return;
  }

  var payments=Array.isArray(data.payments)?data.payments:[];
  document.querySelector("#content").innerHTML=
    pageHead("Payments","Verified payment records. Only the Superadmin can approve course access.")+
    '<div class="card"><p class="muted">Course payment requests are reviewed by the Superadmin. You can view verified payment records, but you cannot approve or allocate learner courses.</p>'+
    '<div class="table-wrap"><table class="data-table"><thead><tr><th>Reference</th><th>Learner</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>'+
    (payments.map(function(p){return '<tr><td>'+ethanLmsEscape(p.ref||p.reference||"—")+'</td><td>'+ethanLmsEscape(p.student||"Learner")+'</td><td>'+ethanLmsEscape(p.description||"Course payment")+'</td><td>₦'+Number(p.amount||0).toLocaleString("en-NG")+'</td><td>'+ethanLmsEscape(p.status||"Verified")+'</td></tr>';}).join("")||'<tr><td colspan="5">No payment records yet.</td></tr>')+
    '</tbody></table></div></div>';
};
