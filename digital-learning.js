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
      "No digital courses are available yet",
      "Published professional courses will appear here when your learner account is enrolled."
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

renderCourses = function () {
  var isStudent = currentUser.role === "student";
  var list = isStudent ? studentCourses() : data.courses;
  var add = (!isStudent && ["admin", "super_admin", "instructor"].includes(currentUser.role))
    ? '<button class="primary-btn" id="addCourseBtn">+ Create Course</button>' : "";
  document.querySelector("#content").innerHTML =
    pageHead(isStudent ? "My Courses" : "Courses", "Browse and manage the Academy digital course catalogue.", add) +
    courseCards(list);
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