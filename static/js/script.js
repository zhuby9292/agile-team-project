function t(text) {
    if (window.translations && window.translations[text]) {
        return window.translations[text];
    }

    return text;
}

// Checks the sign in form and shows a message to the user.
function loginUser() {
    let userEmail = document.getElementById("user-email").value;
    let userPassword = document.getElementById("user-password").value;

    if (userEmail === "" || userPassword === "") {
        alert(t("Please enter both your email address and password."));
        document.getElementById("signin-output").innerHTML =
            t("Sign in failed. Please complete all fields.");
        console.log("Sign in failed: missing email or password.");
    } else {
        document.getElementById("signin-output").innerHTML =
            t("You have signed in successfully with email:") + " " + userEmail;
        alert(t("Sign in successful."));
        console.log("User signed in with email: " + userEmail);
    }
}

function goToForgotPassword() {
    window.location.href = "/forgot-password";
}

function resetPassword() {
    const recoveryEmail = document.getElementById("recovery-email").value.trim();
    const newPassword = document.getElementById("new-password").value;
    const output = document.getElementById("forgot-output");

    if (recoveryEmail === "" || newPassword === "") {
        output.innerHTML = t("Please complete all fields.");
        return;
    }

    if (newPassword.length < 6) {
        output.innerHTML = t("Password must be at least 6 characters.");
        return;
    }

    output.innerHTML =
        t("Password reset successful for:") + " " + recoveryEmail;
}

let demoVerificationCode = "";

function sendVerificationCode() {
    const email = document.getElementById("recovery-email").value.trim();
    const output = document.getElementById("forgot-output");

    if (email === "") {
        output.innerHTML = t("Please enter your email address.");
        return;
    }

    localStorage.setItem("recoveryEmail", email);
    localStorage.setItem("verificationCode", "1234");

    output.innerHTML = t("Verification code sent. Redirecting...");

    setTimeout(function () {
        window.location.href = "/reset-password";
    }, 600);
}

function resetPasswordWithCode() {
    const verificationCode = getVerificationCodeFromBoxes();
    const newPassword = document.getElementById("new-password").value;
    const output = document.getElementById("reset-output");

    const savedCode = localStorage.getItem("verificationCode");

    if (verificationCode === "" || newPassword === "") {
        output.innerHTML = t("Please enter the verification code and new password.");
        return;
    }

    if (verificationCode !== savedCode) {
        output.innerHTML = t("Invalid verification code. Please try again.");
        return;
    }

    if (newPassword.length < 6) {
        output.innerHTML = t("Password must be at least 6 characters.");
        return;
    }

    output.innerHTML = t("Password reset successful! You can now sign in with your new password.");
    alert(t("Password reset successful! Please sign in again."));

    localStorage.removeItem("verificationCode");
    localStorage.removeItem("recoveryEmail");
}

function getVerificationCodeFromBoxes() {
    const inputs = document.querySelectorAll(".code-input");
    let code = "";

    inputs.forEach(function (input) {
        code += input.value;
    });

    return code;
}

function updateResetFormState() {
    const code = getVerificationCodeFromBoxes();
    const passwordInput = document.getElementById("new-password");
    const resetButton = document.getElementById("reset-password-btn");

    if (!passwordInput || !resetButton) {
        return;
    }

    const isCodeComplete = code.length === 4;

    passwordInput.disabled = !isCodeComplete;
    resetButton.disabled = !isCodeComplete;
}

function handleCodeInput(event) {
    const input = event.target;
    const inputs = Array.from(document.querySelectorAll(".code-input"));

    input.value = input.value.replace(/\D/g, "");

    if (input.value.length === 1) {
        const currentIndex = inputs.indexOf(input);
        const nextInput = inputs[currentIndex + 1];

        if (nextInput) {
            nextInput.focus();
        }
    }

    updateResetFormState();
}

function handleCodeBackspace(event) {
    const input = event.target;
    const inputs = Array.from(document.querySelectorAll(".code-input"));

    if (event.key === "Backspace" && input.value === "") {
        const currentIndex = inputs.indexOf(input);
        const previousInput = inputs[currentIndex - 1];

        if (previousInput) {
            previousInput.focus();
        }
    }

    setTimeout(updateResetFormState, 0);
}

function goToSignUp() {
    window.location.href = "/signup.html";
}

function goToSignIn() {
    window.location.href = "/";
}

function registerUser() {
    let fullName = document.getElementById("full-name").value.trim();
    let signupEmail = document.getElementById("signup-email").value.trim();
    let studentId = document.getElementById("student-id").value.trim();
    let signupPassword = document.getElementById("signup-password").value;
    let confirmPassword = document.getElementById("confirm-password").value;
    let output = document.getElementById("signup-output");

    if (
        fullName === "" ||
        signupEmail === "" ||
        studentId === "" ||
        signupPassword === "" ||
        confirmPassword === ""
    ) {
        alert(t("Please complete all registration fields."));
        output.innerHTML = t("Registration failed. Please complete all fields.");
        return;
    }

    if (signupPassword !== confirmPassword) {
        alert(t("Passwords do not match."));
        output.innerHTML = t("Registration failed. The passwords do not match.");
        return;
    }

    if (signupPassword.length < 6) {
        alert(t("Password must be at least 6 characters long."));
        output.innerHTML = t("Registration failed. Password must contain at least 6 characters.");
        return;
    }

    output.innerHTML =
        t("Account created successfully for") + " " + fullName + " " + t("with email:") + " " + signupEmail;
    alert(t("Registration successful."));
}

function showDashboardMessage(message) {
    const dashboardOutput = document.getElementById("dashboard-output");

    if (dashboardOutput) {
        dashboardOutput.innerHTML = message;
    }

    console.log("Dashboard action clicked: " + message);
}

const SELECTED_COURSES_STORAGE_KEY = "selectedCourses";

let selectedCourses = loadSelectedCourses();

function loadSelectedCourses() {
    const savedCourses = localStorage.getItem(SELECTED_COURSES_STORAGE_KEY);

    if (!savedCourses) {
        return [];
    }

    try {
        return JSON.parse(savedCourses);
    } catch (error) {
        console.log("Selected courses could not be loaded:", error);
        return [];
    }
}

function saveSelectedCourses() {
    localStorage.setItem(
        SELECTED_COURSES_STORAGE_KEY,
        JSON.stringify(selectedCourses)
    );
}

const degreeOptions = {
    bachelor: [
        "Bachelor of Arts",
        "Bachelor of Commerce",
        "Bachelor of Science",
        "Bachelor of Biomedical Science",
        "Bachelor of Engineering"
    ],
    master: [
        "Master of Information Technology",
        "Master of Data Science",
        "Master of Business Analytics",
        "Master of Professional Engineering",
        "Master of Studies"
    ],
    diploma: [
        "Graduate Diploma in Health Professions Education",
        "Graduate Diploma in Infectious Diseases",
        "Graduate Diploma in Environmental Science",
        "Graduate Diploma in Business",
        "Graduate Diploma in Education"
    ]
};

const courseOptions = {
    "Bachelor of Arts": [
        {
            code: "ENGL1401",
            name: "Narratives of Place",
            credits: 6,
            time: "Monday 10:00–12:00",
            stream: "Humanities and communication",
            semester: "semester1"
        },
        {
            code: "HIST1001",
            name: "Making History",
            credits: 6,
            time: "Tuesday 13:00–15:00",
            stream: "History and culture",
            semester: "semester1"
        },
        {
            code: "PHIL1002",
            name: "Introduction to Critical Thinking",
            credits: 6,
            time: "Thursday 11:00–13:00",
            stream: "Philosophy and reasoning",
            semester: "semester2"
        }
    ],

    "Bachelor of Commerce": [
        {
            code: "ACCT1101",
            name: "Financial Accounting",
            credits: 6,
            time: "Monday 09:00–11:00",
            stream: "Accounting",
            semester: "semester1"
        },
        {
            code: "ECON1101",
            name: "Microeconomics",
            credits: 6,
            time: "Wednesday 10:00–12:00",
            stream: "Economics",
            semester: "semester1"
        },
        {
            code: "MGMT1135",
            name: "Organisational Behaviour",
            credits: 6,
            time: "Friday 12:00–14:00",
            stream: "Management",
            semester: "semester1"
        }
    ],

    "Bachelor of Science": [
        {
            code: "SCIE1106",
            name: "Molecular Biology of the Cell",
            credits: 6,
            time: "Monday 14:00–16:00",
            stream: "Science foundation",
            semester: "semester1"
        },
        {
            code: "MATH1011",
            name: "Mathematical Methods",
            credits: 6,
            time: "Tuesday 09:00–11:00",
            stream: "Mathematics",
            semester: "semester1"
        },
        {
            code: "STAT1400",
            name: "Statistics for Science",
            credits: 6,
            time: "Thursday 10:00–12:00",
            stream: "Statistics",
            semester: "semester1"
        }
    ],

    "Bachelor of Biomedical Science": [
        {
            code: "ANHB1101",
            name: "Human Biology I",
            credits: 6,
            time: "Monday 09:00–11:00",
            stream: "Human biology",
            semester: "semester1"
        },
        {
            code: "CHEM1001",
            name: "Chemistry for the Life Sciences",
            credits: 6,
            time: "Tuesday 12:00–14:00",
            stream: "Chemistry",
            semester: "semester1"
        },
        {
            code: "IMED1001",
            name: "Form and Function",
            credits: 6,
            time: "Thursday 14:00–16:00",
            stream: "Biomedical science",
            semester: "semester2"
        }
    ],

    "Bachelor of Engineering": [
        {
            code: "ENGG1100",
            name: "Engineering Design",
            credits: 6,
            time: "Monday 10:00–12:00",
            stream: "Engineering foundation",
            semester: "semester1"
        },
        {
            code: "MATH1012",
            name: "Mathematical Theory and Methods",
            credits: 6,
            time: "Wednesday 09:00–11:00",
            stream: "Mathematics",
            semester: "semester2"
        },
        {
            code: "PHYS1001",
            name: "Physics for Scientists and Engineers",
            credits: 6,
            time: "Friday 10:00–12:00",
            stream: "Physics",
            semester: "semester1"
        }
    ],

    "Master of Information Technology": [
        {
            code: "CITS5505",
            name: "Agile Web Development",
            credits: 6,
            time: "Monday 10:00–12:00",
            stream: "Web development",
            semester: "semester1"
        },
        {
            code: "CITS5504",
            name: "Data Warehousing",
            credits: 6,
            time: "Tuesday 14:00–16:00",
            stream: "Data systems",
            semester: "semester1"
        },
        {
            code: "CITS5508",
            name: "Machine Learning",
            credits: 6,
            time: "Wednesday 09:00–11:00",
            stream: "Artificial intelligence",
            semester: "semester2"
        }
    ],

    "Master of Data Science": [
        {
            code: "CITS5508",
            name: "Machine Learning",
            credits: 6,
            time: "Monday 09:00–11:00",
            stream: "Machine learning",
            semester: "semester1"
        },
        {
            code: "STAT4066",
            name: "Bayesian Computing and Statistics",
            credits: 6,
            time: "Wednesday 13:00–15:00",
            stream: "Statistics",
            semester: "semester1"
        },
        {
            code: "DATA5001",
            name: "Data Science Principles",
            credits: 6,
            time: "Friday 10:00–12:00",
            stream: "Data science",
            semester: "semester2"
        }
    ],

    "Master of Business Analytics": [
        {
            code: "BUSN5001",
            name: "Business Analytics Foundations",
            credits: 6,
            time: "Monday 11:00–13:00",
            stream: "Business analytics",
            semester: "semester1"
        },
        {
            code: "MGMT5504",
            name: "Data Analysis and Decision Making",
            credits: 6,
            time: "Tuesday 14:00–16:00",
            stream: "Decision making",
            semester: "semester2"
        },
        {
            code: "MKTG5502",
            name: "Marketing Analytics",
            credits: 6,
            time: "Thursday 10:00–12:00",
            stream: "Marketing",
            semester: "semester1"
        }
    ],

    "Master of Professional Engineering": [
        {
            code: "GENG5507",
            name: "Risk, Reliability and Safety",
            credits: 6,
            time: "Monday 13:00–15:00",
            stream: "Engineering management",
            semester: "semester1"
        },
        {
            code: "ENGG5501",
            name: "Engineering Practice",
            credits: 6,
            time: "Wednesday 10:00–12:00",
            stream: "Professional practice",
            semester: "semester1"
        },
        {
            code: "CIVL5502",
            name: "Advanced Structural Analysis",
            credits: 6,
            time: "Friday 09:00–11:00",
            stream: "Civil engineering",
            semester: "semester1"
        }
    ],

    "Master of Studies": [
        {
            code: "STUD5001",
            name: "Research Methods",
            credits: 6,
            time: "Monday 10:00–12:00",
            stream: "Research preparation",
            semester: "semester1"
        },
        {
            code: "STUD5002",
            name: "Advanced Academic Practice",
            credits: 6,
            time: "Wednesday 12:00–14:00",
            stream: "Academic development",
            semester: "semester2"
        },
        {
            code: "STUD5003",
            name: "Project Preparation",
            credits: 6,
            time: "Friday 11:00–13:00",
            stream: "Project planning",
            semester: "semester2"
        }
    ],

    "Graduate Diploma in Health Professions Education": [
        {
            code: "HPEA5101",
            name: "Teaching and Learning in Health",
            credits: 6,
            time: "Monday 09:00–11:00",
            stream: "Health education",
            semester: "semester1"
        },
        {
            code: "HPEA5102",
            name: "Assessment in Health Professions",
            credits: 6,
            time: "Wednesday 10:00–12:00",
            stream: "Assessment",
            semester: "semester2"
        },
        {
            code: "HPEA5103",
            name: "Curriculum Design in Health",
            credits: 6,
            time: "Friday 13:00–15:00",
            stream: "Curriculum",
            semester: "semester2"
        }
    ],

    "Graduate Diploma in Infectious Diseases": [
        {
            code: "MICR5001",
            name: "Medical Microbiology",
            credits: 6,
            time: "Monday 11:00–13:00",
            stream: "Microbiology",
            semester: "semester1"
        },
        {
            code: "IDIS5002",
            name: "Principles of Infectious Diseases",
            credits: 6,
            time: "Tuesday 14:00–16:00",
            stream: "Infectious diseases",
            semester: "semester2"
        },
        {
            code: "PUBH5749",
            name: "Foundations of Public Health",
            credits: 6,
            time: "Thursday 09:00–11:00",
            stream: "Public health",
            semester: "semester2"
        }
    ],

    "Graduate Diploma in Environmental Science": [
        {
            code: "ENVT4401",
            name: "Environmental Impact Assessment",
            credits: 6,
            time: "Monday 10:00–12:00",
            stream: "Environmental planning",
            semester: "semester1"
        },
        {
            code: "ENVT5502",
            name: "Climate Change Science",
            credits: 6,
            time: "Wednesday 13:00–15:00",
            stream: "Climate science",
            semester: "semester2"
        },
        {
            code: "ENVT5503",
            name: "Environmental Management",
            credits: 6,
            time: "Friday 10:00–12:00",
            stream: "Management",
            semester: "semester2"
        }
    ],

    "Graduate Diploma in Business": [
        {
            code: "BUSN5101",
            name: "Business Foundations",
            credits: 6,
            time: "Monday 13:00–15:00",
            stream: "Business",
            semester: "semester1"
        },
        {
            code: "MGMT5501",
            name: "Management and Organisations",
            credits: 6,
            time: "Tuesday 10:00–12:00",
            stream: "Management",
            semester: "semester2"
        },
        {
            code: "ECON5503",
            name: "Economic Management",
            credits: 6,
            time: "Thursday 12:00–14:00",
            stream: "Economics",
            semester: "semester1"
        }
    ],

    "Graduate Diploma in Education": [
        {
            code: "EDUC5501",
            name: "Teaching and Learning",
            credits: 6,
            time: "Monday 09:00–11:00",
            stream: "Education",
            semester: "semester1"
        },
        {
            code: "EDUC5502",
            name: "Classroom Practice",
            credits: 6,
            time: "Wednesday 11:00–13:00",
            stream: "Teaching practice",
            semester: "semester2"
        },
        {
            code: "EDUC5503",
            name: "Curriculum and Assessment",
            credits: 6,
            time: "Friday 14:00–16:00",
            stream: "Curriculum",
            semester: "semester1"
        }
    ]
};

function updateDegreeOptions() {
    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");
    const courseMessage = document.getElementById("course-message");
    const degreeSummary = document.getElementById("degree-summary");
    const studyLevelSummary = document.getElementById("study-level-summary");

    if (!studyLevelSelect || !degreeSelect) {
        return;
    }

    const selectedLevel = studyLevelSelect.value;
    const selectedLevelText = studyLevelSelect.options[studyLevelSelect.selectedIndex].text;

    selectedCourses = [];
    saveSelectedCourses();
    displaySelectedCourses();

    displayAvailableCourses("");

    degreeSelect.innerHTML = "";

    if (!selectedLevel) {
        degreeSelect.disabled = true;

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = t("-- Select a study level first --");
        degreeSelect.appendChild(defaultOption);

        if (courseMessage) {
            courseMessage.textContent = t("Please select a study level, then choose a degree before adding courses.");
        }

        if (degreeSummary) {
            degreeSummary.textContent = t("Not selected");
        }

        if (studyLevelSummary) {
            studyLevelSummary.textContent = t("Not selected");
        }

        return;
    }

    degreeSelect.disabled = false;

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = t("-- Select a degree --");
    degreeSelect.appendChild(placeholderOption);

    degreeOptions[selectedLevel].forEach(function (degreeName) {
        const option = document.createElement("option");
        option.value = degreeName;
        option.textContent = t(degreeName);
        degreeSelect.appendChild(option);
    });

    if (courseMessage) {
        courseMessage.textContent =
            t("Now select a degree from the available") + " " + selectedLevelText + " " + t("options.");
    }

    if (degreeSummary) {
        degreeSummary.textContent = t("Not selected");
    }

    if (studyLevelSummary) {
        studyLevelSummary.textContent = selectedLevelText;
    }
}

function selectDegree() {
    const degreeSelect = document.getElementById("degree-select");
    const courseMessage = document.getElementById("course-message");
    const degreeSummary = document.getElementById("degree-summary");

    if (!degreeSelect) {
        return;
    }

    const selectedDegree = degreeSelect.value;

    selectedCourses = [];
    saveSelectedCourses();
    displaySelectedCourses();

    if (!selectedDegree) {
        if (courseMessage) {
            courseMessage.textContent = t("Please choose a degree before adding courses.");
        }

        if (degreeSummary) {
            degreeSummary.textContent = t("Not selected");
        }

        displayAvailableCourses("");
        return;
    }

    if (courseMessage) {
        courseMessage.textContent =
            t(selectedDegree) + " " + t("selected. You can now add courses to your study plan.");
    }

    if (degreeSummary) {
        degreeSummary.textContent = t(selectedDegree);
    }

    displayAvailableCourses(selectedDegree);
}

function displayAvailableCourses(degreeName) {
    const availableCoursesBox = document.getElementById("available-courses");

    if (!availableCoursesBox) {
        return;
    }

    const courses = courseOptions[degreeName];

    if (!courses || courses.length === 0) {
        availableCoursesBox.innerHTML = `
            <div class="empty-course-state">
                <p>${t("Please select a study level and degree to view available courses.")}</p>
            </div>
        `;
        return;
    }

    availableCoursesBox.innerHTML = courses.map(course => {
        return `
            <div class="course-card"
                data-search="${course.code.toLowerCase()} ${course.name.toLowerCase()}"
                data-semester="${course.semester}">

                <div class="course-card-top">
                    <span class="course-code">${course.code}</span>
                    <span class="credit-pill">${course.credits} ${t("credits")}</span>
                </div>

                <h3>${t(course.name)}</h3>

                <div class="course-detail-list">
                    <p>
                        <span class="glyphicon glyphicon-time"></span>
                        ${course.time}
                    </p>
                    <p>
                        <span class="glyphicon glyphicon-map-marker"></span>
                        ${t(course.stream)}
                    </p>
                </div>

                <button type="button" class="btn dashboard-btn-primary" onclick="addCourse('${course.code}', '${course.name}', ${course.credits}, '${course.time}', '${course.stream}', '${course.semester}')">
                    ${t("Add Course")}
                </button>
            </div>
        `;
    }).join("");

    filterCourses();
}

function addCourse(code, name, credits, time, stream, semester) {
    const degreeSelect = document.getElementById("degree-select");
    const message = document.getElementById("course-message");

    if (degreeSelect && degreeSelect.value === "") {
        if (message) {
            message.innerHTML = t("Please select a degree first.");
        }
        return;
    }

    const existingSemester = selectedCourses.length > 0
        ? selectedCourses[0].semester
        : null;

    if (existingSemester && existingSemester !== semester) {
        alert(t("Semester conflict detected. Please select courses from the same semester."));
        return;
    }

    const exists = selectedCourses.some(course => course.code === code);

    if (exists) {
        if (message) {
            message.innerHTML = code + " " + t("has already been added.");
        }
        return;
    }

    selectedCourses.push({
        code: code,
        name: name,
        credits: credits,
        time: time,
        stream: stream,
        semester: semester
    });

    localStorage.setItem("selectedCourses", JSON.stringify(selectedCourses));

    if (message) {
        message.innerHTML = code + " " + t("added successfully.");
    }

    displaySelectedCourses();
}

function displaySelectedCourses() {
    const selectedBox = document.getElementById("selected-courses");
    const creditOutput = document.getElementById("credit-output");
    const creditSummary = document.getElementById("credit-summary");
    const courseCountSummary = document.getElementById("course-count-summary");

    if (!selectedBox || !creditOutput) {
        return;
    }

    if (selectedCourses.length === 0) {
        selectedBox.innerHTML = `<p>${t("No courses selected yet.")}</p>`;
        creditOutput.innerHTML = "0";

        if (creditSummary) {
            creditSummary.textContent = "0";
        }

        if (courseCountSummary) {
            courseCountSummary.textContent = "0";
        }

        return;
    }

    let totalCredits = 0;

    selectedBox.innerHTML = selectedCourses.map(course => {
        totalCredits += course.credits;

        return `
            <div class="selected-course-item">
                <div>
                    <strong>${course.code}</strong>
                    <span>${t(course.name)}</span>
                    <small>${course.credits} ${t("credit points")}</small>
                </div>

                <button class="btn btn-xs btn-danger"
                    onclick="removeCourse('${course.code}')">
                    ${t("Remove")}
                </button>
            </div>
        `;
    }).join("");

    creditOutput.innerHTML = totalCredits;

    if (creditSummary) {
        creditSummary.textContent = totalCredits;
    }

    if (courseCountSummary) {
        courseCountSummary.textContent = selectedCourses.length;
    }
}

function removeCourse(code) {
    selectedCourses = selectedCourses.filter(course => course.code !== code);
    localStorage.setItem("selectedCourses", JSON.stringify(selectedCourses));
    displaySelectedCourses();
}

function filterCourses() {
    const searchInput = document.getElementById("course-search");
    const semesterFilter = document.getElementById("semester-filter");
    const courseCards = document.querySelectorAll(".course-card");

    if (!searchInput || !semesterFilter) {
        return;
    }

    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedSemester = semesterFilter.value;

    courseCards.forEach(function (card) {
        const searchData = card.dataset.search;
        const semesterData = card.dataset.semester;

        const matchesSearch = searchTerm === "" || searchData.includes(searchTerm);

        const matchesSemester =
            selectedSemester === "all" ||
            semesterData === selectedSemester;

        if (matchesSearch && matchesSemester) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem("coursePlannerTheme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
        updateThemeToggleLabel("Light");
    } else {
        document.body.classList.remove("dark-mode");
        updateThemeToggleLabel("Dark");
    }
}

function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");

    if (document.body.classList.contains("dark-mode")) {
        localStorage.setItem("coursePlannerTheme", "dark");
        updateThemeToggleLabel("Light");
    } else {
        localStorage.setItem("coursePlannerTheme", "light");
        updateThemeToggleLabel("Dark");
    }
}

function updateThemeToggleLabel(labelText) {
    const themeButtons = document.querySelectorAll(".theme-toggle");

    themeButtons.forEach(function (button) {
        const label = button.querySelector(".theme-toggle-label");

        if (label) {
            label.textContent = t(labelText);
        }

        if (labelText === "Light") {
            button.setAttribute("aria-pressed", "true");
        } else {
            button.setAttribute("aria-pressed", "false");
        }
    });
}

function loadTimetablePage() {
    const savedCourses = JSON.parse(localStorage.getItem("selectedCourses")) || [];
    const courseList = document.getElementById("timetable-course-list");
    const status = document.getElementById("timetable-status");
    const output = document.getElementById("timetable-output");
    const courseCount = document.getElementById("timetable-course-count");
    const creditTotal = document.getElementById("timetable-credit-total");

    if (!courseList) {
        return;
    }

    if (savedCourses.length === 0) {
        courseList.innerHTML = `<p>${t("No courses selected yet.")}</p>`;

        if (status) {
            status.innerHTML = t("Not generated");
        }

        if (output) {
            output.innerHTML = t("Please select courses before generating a timetable.");
        }

        if (courseCount) {
            courseCount.textContent = "0";
        }

        if (creditTotal) {
            creditTotal.textContent = "0";
        }

        renderEmptyWeeklyCalendar();
        return;
    }

    let totalCredits = 0;

    courseList.innerHTML = savedCourses.map(function (course) {
        totalCredits += course.credits;

        return `
            <div class="timetable-course-item">
                <strong>${course.code}</strong>
                <span>${t(course.name)}</span>
                <small>${course.time} · ${course.credits} ${t("credits")}</small>
            </div>
        `;
    }).join("");

    if (status) {
        status.innerHTML = t("Ready");
    }

    if (courseCount) {
        courseCount.innerHTML = savedCourses.length;
    }

    if (creditTotal) {
        creditTotal.innerHTML = totalCredits;
    }

    renderEmptyWeeklyCalendar();
}

function renderEmptyWeeklyCalendar() {
    const calendar = document.getElementById("weekly-calendar");

    if (!calendar) {
        return;
    }

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const times = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

    let html = `<div class="calendar-time-header"></div>`;

    days.forEach(function (day) {
        html += `<div class="calendar-day-header">${t(day)}</div>`;
    });

    times.forEach(function (time) {
        html += `<div class="calendar-time">${time}</div>`;

        days.forEach(function (day) {
            html += `<div class="calendar-cell" data-day="${day}" data-time="${time}"></div>`;
        });
    });

    calendar.innerHTML = html;
}

function generateTimetable() {
    const savedCourses = JSON.parse(localStorage.getItem("selectedCourses")) || [];
    const status = document.getElementById("timetable-status");
    const output = document.getElementById("timetable-output");

    if (savedCourses.length === 0) {
        if (output) {
            output.innerHTML = t("Please select courses before generating a timetable.");
        }
        return;
    }

    const semesters = savedCourses.map(course => course.semester);
    const uniqueSemesters = [...new Set(semesters)];

    if (uniqueSemesters.length > 1) {
        if (status) {
            status.innerHTML = t("Conflict");
        }

        if (output) {
            output.innerHTML = t("You selected courses from different semesters. Please choose courses from one semester before generating a timetable.");
        }

        renderEmptyWeeklyCalendar();
        return;
    }

    renderEmptyWeeklyCalendar();

    savedCourses.forEach(function (course) {
        const day = getCourseDay(course.time);
        const startTime = getCourseStartTime(course.time);

        const cell = document.querySelector(
            `.calendar-cell[data-day="${day}"][data-time="${startTime}"]`
        );

        if (cell) {
            cell.classList.add("course-block");
            cell.innerHTML = `
                <strong>${course.code}</strong>
                <span>${t(course.name)}</span>
                <small>${course.time}</small>
            `;
        }
    });

    if (status) {
        status.innerHTML = t("Generated");
    }

    if (output) {
        output.innerHTML = t("The weekly timetable has been generated successfully.");
    }
}

function clearTimetable() {
    renderEmptyWeeklyCalendar();

    const status = document.getElementById("timetable-status");
    const output = document.getElementById("timetable-output");

    if (status) {
        status.innerHTML = t("Not generated");
    }

    if (output) {
        output.innerHTML = t("The timetable has been cleared.");
    }
}

function getCourseDay(timeText) {
    return timeText.split(" ")[0];
}

function getCourseStartTime(timeText) {
    const timePart = timeText.split(" ")[1];
    return timePart.split("–")[0];
}

function shareTimetable() {
    const output = document.getElementById("timetable-output");

    if (output) {
        output.innerHTML =
            t("Your timetable has been shared successfully. Other users can now view it from the shared timetables page.");
    }
}

document.addEventListener("DOMContentLoaded", function () {
    applySavedTheme();
    loadTimetablePage();
});