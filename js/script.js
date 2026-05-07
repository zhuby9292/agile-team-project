// Checks the sign in form and shows a message to the user.
function loginUser() {
    let userEmail = document.getElementById("user-email").value;
    let userPassword = document.getElementById("user-password").value;

    if (userEmail === "" || userPassword === "") {
        alert("Please enter both your email address and password.");
        document.getElementById("signin-output").innerHTML =
            "Sign in failed. Please complete all fields.";
        console.log("Sign in failed: missing email or password.");
    } else {
        document.getElementById("signin-output").innerHTML =
            "You have signed in successfully with email: " + userEmail;
        alert("Sign in successful.");
        console.log("User signed in with email: " + userEmail);
    }
}

// Shows a simple message when the user clicks the forgot password button.
function forgotPassword() {
    alert("Password recovery is not available yet.");
    document.getElementById("signin-output").innerHTML =
        "Forgot password feature will be added later.";
    console.log("Forgot password button clicked.");
}

// Takes the user to the sign up page.
function goToSignUp() {
    window.location.href = "signup.html";
}

// Takes the user back to the sign in page.
function goToSignIn() {
    window.location.href = "index.html";
}

// Checks the sign up form and shows a message to the user.
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
        alert("Please complete all registration fields.");
        output.innerHTML = "Registration failed. Please complete all fields.";
        return;
    }

    if (signupPassword !== confirmPassword) {
        alert("Passwords do not match.");
        output.innerHTML = "Registration failed. The passwords do not match.";
        return;
    }

    if (signupPassword.length < 6) {
        alert("Password must be at least 6 characters long.");
        output.innerHTML = "Registration failed. Password must contain at least 6 characters.";
        return;
    }

    output.innerHTML =
        "Account created successfully for " + fullName + " with email: " + signupEmail;
    alert("Registration successful.");
}

// Shows a dashboard message when the user clicks a dashboard action button.
function showDashboardMessage(message) {
    const dashboardOutput = document.getElementById("dashboard-output");

    if (dashboardOutput) {
        dashboardOutput.innerHTML = message;
    }

    console.log("Dashboard action clicked: " + message);
}

// Stores the courses selected by the user.
let selectedCourses = [];

// Sample UWA-style degree data used for the course selection page.
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

// Sample course data for each degree.
// These are sample frontend/demo values for the prototype.
const courseOptions = {
    "Bachelor of Arts": [
        {
            code: "ENGL1401",
            name: "Narratives of Place",
            credits: 6,
            time: "Monday 10:00–12:00",
            stream: "Humanities and communication"
        },
        {
            code: "HIST1001",
            name: "Making History",
            credits: 6,
            time: "Tuesday 13:00–15:00",
            stream: "History and culture"
        },
        {
            code: "PHIL1002",
            name: "Introduction to Critical Thinking",
            credits: 6,
            time: "Thursday 11:00–13:00",
            stream: "Philosophy and reasoning"
        }
    ],

    "Bachelor of Commerce": [
        {
            code: "ACCT1101",
            name: "Financial Accounting",
            credits: 6,
            time: "Monday 09:00–11:00",
            stream: "Accounting"
        },
        {
            code: "ECON1101",
            name: "Microeconomics",
            credits: 6,
            time: "Wednesday 10:00–12:00",
            stream: "Economics"
        },
        {
            code: "MGMT1135",
            name: "Organisational Behaviour",
            credits: 6,
            time: "Friday 12:00–14:00",
            stream: "Management"
        }
    ],

    "Bachelor of Science": [
        {
            code: "SCIE1106",
            name: "Molecular Biology of the Cell",
            credits: 6,
            time: "Monday 14:00–16:00",
            stream: "Science foundation"
        },
        {
            code: "MATH1011",
            name: "Mathematical Methods",
            credits: 6,
            time: "Tuesday 09:00–11:00",
            stream: "Mathematics"
        },
        {
            code: "STAT1400",
            name: "Statistics for Science",
            credits: 6,
            time: "Thursday 10:00–12:00",
            stream: "Statistics"
        }
    ],

    "Bachelor of Biomedical Science": [
        {
            code: "ANHB1101",
            name: "Human Biology I",
            credits: 6,
            time: "Monday 09:00–11:00",
            stream: "Human biology"
        },
        {
            code: "CHEM1001",
            name: "Chemistry for the Life Sciences",
            credits: 6,
            time: "Tuesday 12:00–14:00",
            stream: "Chemistry"
        },
        {
            code: "IMED1001",
            name: "Form and Function",
            credits: 6,
            time: "Thursday 14:00–16:00",
            stream: "Biomedical science"
        }
    ],

    "Bachelor of Engineering": [
        {
            code: "ENGG1100",
            name: "Engineering Design",
            credits: 6,
            time: "Monday 10:00–12:00",
            stream: "Engineering foundation"
        },
        {
            code: "MATH1012",
            name: "Mathematical Theory and Methods",
            credits: 6,
            time: "Wednesday 09:00–11:00",
            stream: "Mathematics"
        },
        {
            code: "PHYS1001",
            name: "Physics for Scientists and Engineers",
            credits: 6,
            time: "Friday 10:00–12:00",
            stream: "Physics"
        }
    ],

    "Master of Information Technology": [
        {
            code: "CITS5505",
            name: "Agile Web Development",
            credits: 6,
            time: "Monday 10:00–12:00",
            stream: "Web development"
        },
        {
            code: "CITS5504",
            name: "Data Warehousing",
            credits: 6,
            time: "Tuesday 14:00–16:00",
            stream: "Data systems"
        },
        {
            code: "CITS5508",
            name: "Machine Learning",
            credits: 6,
            time: "Wednesday 09:00–11:00",
            stream: "Artificial intelligence"
        }
    ],

    "Master of Data Science": [
        {
            code: "CITS5508",
            name: "Machine Learning",
            credits: 6,
            time: "Monday 09:00–11:00",
            stream: "Machine learning"
        },
        {
            code: "STAT4066",
            name: "Bayesian Computing and Statistics",
            credits: 6,
            time: "Wednesday 13:00–15:00",
            stream: "Statistics"
        },
        {
            code: "DATA5001",
            name: "Data Science Principles",
            credits: 6,
            time: "Friday 10:00–12:00",
            stream: "Data science"
        }
    ],

    "Master of Business Analytics": [
        {
            code: "BUSN5001",
            name: "Business Analytics Foundations",
            credits: 6,
            time: "Monday 11:00–13:00",
            stream: "Business analytics"
        },
        {
            code: "MGMT5504",
            name: "Data Analysis and Decision Making",
            credits: 6,
            time: "Tuesday 14:00–16:00",
            stream: "Decision making"
        },
        {
            code: "MKTG5502",
            name: "Marketing Analytics",
            credits: 6,
            time: "Thursday 10:00–12:00",
            stream: "Marketing"
        }
    ],

    "Master of Professional Engineering": [
        {
            code: "GENG5507",
            name: "Risk, Reliability and Safety",
            credits: 6,
            time: "Monday 13:00–15:00",
            stream: "Engineering management"
        },
        {
            code: "ENGG5501",
            name: "Engineering Practice",
            credits: 6,
            time: "Wednesday 10:00–12:00",
            stream: "Professional practice"
        },
        {
            code: "CIVL5502",
            name: "Advanced Structural Analysis",
            credits: 6,
            time: "Friday 09:00–11:00",
            stream: "Civil engineering"
        }
    ],

    "Master of Studies": [
        {
            code: "STUD5001",
            name: "Research Methods",
            credits: 6,
            time: "Monday 10:00–12:00",
            stream: "Research preparation"
        },
        {
            code: "STUD5002",
            name: "Advanced Academic Practice",
            credits: 6,
            time: "Wednesday 12:00–14:00",
            stream: "Academic development"
        },
        {
            code: "STUD5003",
            name: "Project Preparation",
            credits: 6,
            time: "Friday 11:00–13:00",
            stream: "Project planning"
        }
    ],

    "Graduate Diploma in Health Professions Education": [
        {
            code: "HPEA5101",
            name: "Teaching and Learning in Health",
            credits: 6,
            time: "Monday 09:00–11:00",
            stream: "Health education"
        },
        {
            code: "HPEA5102",
            name: "Assessment in Health Professions",
            credits: 6,
            time: "Wednesday 10:00–12:00",
            stream: "Assessment"
        },
        {
            code: "HPEA5103",
            name: "Curriculum Design in Health",
            credits: 6,
            time: "Friday 13:00–15:00",
            stream: "Curriculum"
        }
    ],

    "Graduate Diploma in Infectious Diseases": [
        {
            code: "MICR5001",
            name: "Medical Microbiology",
            credits: 6,
            time: "Monday 11:00–13:00",
            stream: "Microbiology"
        },
        {
            code: "IDIS5002",
            name: "Principles of Infectious Diseases",
            credits: 6,
            time: "Tuesday 14:00–16:00",
            stream: "Infectious diseases"
        },
        {
            code: "PUBH5749",
            name: "Foundations of Public Health",
            credits: 6,
            time: "Thursday 09:00–11:00",
            stream: "Public health"
        }
    ],

    "Graduate Diploma in Environmental Science": [
        {
            code: "ENVT4401",
            name: "Environmental Impact Assessment",
            credits: 6,
            time: "Monday 10:00–12:00",
            stream: "Environmental planning"
        },
        {
            code: "ENVT5502",
            name: "Climate Change Science",
            credits: 6,
            time: "Wednesday 13:00–15:00",
            stream: "Climate science"
        },
        {
            code: "ENVT5503",
            name: "Environmental Management",
            credits: 6,
            time: "Friday 10:00–12:00",
            stream: "Management"
        }
    ],

    "Graduate Diploma in Business": [
        {
            code: "BUSN5101",
            name: "Business Foundations",
            credits: 6,
            time: "Monday 13:00–15:00",
            stream: "Business"
        },
        {
            code: "MGMT5501",
            name: "Management and Organisations",
            credits: 6,
            time: "Tuesday 10:00–12:00",
            stream: "Management"
        },
        {
            code: "ECON5503",
            name: "Economic Management",
            credits: 6,
            time: "Thursday 12:00–14:00",
            stream: "Economics"
        }
    ],

    "Graduate Diploma in Education": [
        {
            code: "EDUC5501",
            name: "Teaching and Learning",
            credits: 6,
            time: "Monday 09:00–11:00",
            stream: "Education"
        },
        {
            code: "EDUC5502",
            name: "Classroom Practice",
            credits: 6,
            time: "Wednesday 11:00–13:00",
            stream: "Teaching practice"
        },
        {
            code: "EDUC5503",
            name: "Curriculum and Assessment",
            credits: 6,
            time: "Friday 14:00–16:00",
            stream: "Curriculum"
        }
    ]
};

// Updates the degree dropdown after the user selects a study level.
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

    // Reset selected courses whenever the study level changes.
    selectedCourses = [];
    displaySelectedCourses();

    // Clear available courses until a degree is selected.
    displayAvailableCourses("");

    degreeSelect.innerHTML = "";

    if (!selectedLevel) {
        degreeSelect.disabled = true;

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- Select a study level first --";
        degreeSelect.appendChild(defaultOption);

        if (courseMessage) {
            courseMessage.textContent = "Please select a study level, then choose a degree before adding courses.";
        }

        if (degreeSummary) {
            degreeSummary.textContent = "Not selected";
        }

        if (studyLevelSummary) {
            studyLevelSummary.textContent = "Not selected";
        }

        return;
    }

    degreeSelect.disabled = false;

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = "-- Select a degree --";
    degreeSelect.appendChild(placeholderOption);

    degreeOptions[selectedLevel].forEach(function(degreeName) {
        const option = document.createElement("option");
        option.value = degreeName;
        option.textContent = degreeName;
        degreeSelect.appendChild(option);
    });

    if (courseMessage) {
        courseMessage.textContent = "Now select a degree from the available " + selectedLevelText + " options.";
    }

    if (degreeSummary) {
        degreeSummary.textContent = "Not selected";
    }

    if (studyLevelSummary) {
        studyLevelSummary.textContent = selectedLevelText;
    }
}

// Updates the selected degree summary after the user selects a degree.
function selectDegree() {
    const degreeSelect = document.getElementById("degree-select");
    const courseMessage = document.getElementById("course-message");
    const degreeSummary = document.getElementById("degree-summary");

    if (!degreeSelect) {
        return;
    }

    const selectedDegree = degreeSelect.value;

    // Reset selected courses whenever the degree changes.
    selectedCourses = [];
    displaySelectedCourses();

    if (!selectedDegree) {
        if (courseMessage) {
            courseMessage.textContent = "Please choose a degree before adding courses.";
        }

        if (degreeSummary) {
            degreeSummary.textContent = "Not selected";
        }

        displayAvailableCourses("");
        return;
    }

    if (courseMessage) {
        courseMessage.textContent = selectedDegree + " selected. You can now add courses to your study plan.";
    }

    if (degreeSummary) {
        degreeSummary.textContent = selectedDegree;
    }

    displayAvailableCourses(selectedDegree);
}

// Displays course cards based on the selected degree.
function displayAvailableCourses(degreeName) {
    const availableCoursesBox = document.getElementById("available-courses");

    if (!availableCoursesBox) {
        return;
    }

    const courses = courseOptions[degreeName];

    if (!courses || courses.length === 0) {
        availableCoursesBox.innerHTML = `
            <div class="empty-course-state">
                <p>Please select a study level and degree to view available courses.</p>
            </div>
        `;
        return;
    }

    availableCoursesBox.innerHTML = courses.map(course => {
        return `
            <div class="course-card">
                <div class="course-card-top">
                    <span class="course-code">${course.code}</span>
                    <span class="credit-pill">${course.credits} credits</span>
                </div>

                <h3>${course.name}</h3>

                <div class="course-detail-list">
                    <p>
                        <span class="glyphicon glyphicon-time"></span>
                        ${course.time}
                    </p>
                    <p>
                        <span class="glyphicon glyphicon-map-marker"></span>
                        ${course.stream}
                    </p>
                </div>

                <button type="button" class="btn dashboard-btn-primary"
                    onclick="addCourse('${course.code}', '${course.name}', ${course.credits})">
                    Add Course
                </button>
            </div>
        `;
    }).join("");
}

// Adds a selected course to the user's course plan.
function addCourse(code, name, credits) {
    const degreeSelect = document.getElementById("degree-select");
    const message = document.getElementById("course-message");

    if (degreeSelect && degreeSelect.value === "") {
        if (message) {
            message.innerHTML = "Please select a degree first.";
        }
        return;
    }

    const exists = selectedCourses.some(course => course.code === code);

    if (exists) {
        if (message) {
            message.innerHTML = code + " has already been added.";
        }
        return;
    }

    selectedCourses.push({
        code: code,
        name: name,
        credits: credits
    });

    if (message) {
        message.innerHTML = code + " added successfully.";
    }

    displaySelectedCourses();
}

// Displays selected courses and updates credit/course summaries.
function displaySelectedCourses() {
    const selectedBox = document.getElementById("selected-courses");
    const creditOutput = document.getElementById("credit-output");
    const creditSummary = document.getElementById("credit-summary");
    const courseCountSummary = document.getElementById("course-count-summary");

    if (!selectedBox || !creditOutput) {
        return;
    }

    if (selectedCourses.length === 0) {
        selectedBox.innerHTML = "<p>No courses selected yet.</p>";
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
                    <span>${course.name}</span>
                    <small>${course.credits} credit points</small>
                </div>

                <button class="btn btn-xs btn-danger"
                    onclick="removeCourse('${course.code}')">
                    Remove
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

// Removes a selected course from the user's course plan.
function removeCourse(code) {
    selectedCourses = selectedCourses.filter(course => course.code !== code);
    displaySelectedCourses();
}