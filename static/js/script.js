function t(text) {
    if (window.translations && window.translations[text]) {
        return window.translations[text];
    }
    return text;
}

// ---------------------------------------------------------------------------
// Auth / password helpers (unchanged)
// ---------------------------------------------------------------------------

function loginUser() {
    let userEmail = document.getElementById("user-email").value;
    let userPassword = document.getElementById("user-password").value;

    if (userEmail === "" || userPassword === "") {
        alert(t("Please enter both your email address and password."));
        document.getElementById("signin-output").innerHTML =
            t("Sign in failed. Please complete all fields.");
    } else {
        document.getElementById("signin-output").innerHTML =
            t("You have signed in successfully with email:") + " " + userEmail;
        alert(t("Sign in successful."));
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
    output.innerHTML = t("Password reset successful for:") + " " + recoveryEmail;
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
    inputs.forEach(function (input) { code += input.value; });
    return code;
}

function updateResetFormState() {
    const code = getVerificationCodeFromBoxes();
    const passwordInput = document.getElementById("new-password");
    const resetButton = document.getElementById("reset-password-btn");
    if (!passwordInput || !resetButton) return;
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
        if (nextInput) nextInput.focus();
    }
    updateResetFormState();
}

function handleCodeBackspace(event) {
    const input = event.target;
    const inputs = Array.from(document.querySelectorAll(".code-input"));
    if (event.key === "Backspace" && input.value === "") {
        const currentIndex = inputs.indexOf(input);
        const previousInput = inputs[currentIndex - 1];
        if (previousInput) previousInput.focus();
    }
    setTimeout(updateResetFormState, 0);
}

function goToSignUp() { window.location.href = "/signup.html"; }
function goToSignIn() { window.location.href = "/"; }

function registerUser() {
    let fullName = document.getElementById("full-name").value.trim();
    let signupEmail = document.getElementById("signup-email").value.trim();
    let studentId = document.getElementById("student-id").value.trim();
    let signupPassword = document.getElementById("signup-password").value;
    let confirmPassword = document.getElementById("confirm-password").value;
    let output = document.getElementById("signup-output");

    if (!fullName || !signupEmail || !studentId || !signupPassword || !confirmPassword) {
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
    if (dashboardOutput) dashboardOutput.innerHTML = message;
}

// ---------------------------------------------------------------------------
// Enrollment state
// ---------------------------------------------------------------------------

/**
 * enrollmentStatus mirrors the server-side User.enrollment_status:
 *   'planning'         — student is still freely selecting courses
 *   'enrolled'         — selection is locked; changes need admin approval
 *   'change_requested' — a change request is pending admin review
 *
 * isEditingChangeRequest is true only when the student has clicked
 * "Request Change" and is drafting new course selections.  In this mode
 * the UI is temporarily unlocked but changes go to /api/request-change,
 * not /api/save-selection.
 */
let enrollmentStatus = "planning";
let isEditingChangeRequest = false;

// Snapshot of the enrolled selection so we can cancel a change draft.
let enrolledCoursesSnapshot = [];
let enrolledDegreeSnapshot = "";

// ---------------------------------------------------------------------------
// Course selection state
// ---------------------------------------------------------------------------

const SELECTED_COURSES_STORAGE_KEY = "selectedCourses";
let selectedCourses = [];

function loadSelectedCourses() {
    const saved = localStorage.getItem(SELECTED_COURSES_STORAGE_KEY);
    if (!saved) return [];
    try { return JSON.parse(saved); }
    catch (e) { return []; }
}

function saveSelectedCourses() {
    localStorage.setItem(SELECTED_COURSES_STORAGE_KEY, JSON.stringify(selectedCourses));
}

// ---------------------------------------------------------------------------
// Backend sync — draft save (planning only)
// ---------------------------------------------------------------------------

function saveSelectedCoursesToBackend() {
    // Never auto-save if locked and not in a change-request draft.
    if ((enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested")
        && !isEditingChangeRequest) {
        return;
    }

    const degree = localStorage.getItem("selectedDegree") || "";
    const courseCodes = selectedCourses.map(c => c.code);

    fetch("/api/save-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses: courseCodes, degree: degree }),
    })
        .then(function (response) {
            if (!response.ok) {
                return response.json().then(function (d) {
                    throw new Error(d.error || "Save failed.");
                });
            }
            return response.json();
        })
        .then(function (data) {
            console.log("Draft saved:", data.message);
        })
        .catch(function (error) {
            console.log("Save failed:", error);
        });
}

// ---------------------------------------------------------------------------
// Backend sync — load selected courses + enrollment status
// ---------------------------------------------------------------------------

function loadSelectedCoursesFromBackend() {
    fetch("/api/selected-courses")
        .then(r => r.json())
        .then(function (data) {
            enrollmentStatus = data.enrollment_status || "planning";
            selectedCourses = data.courses || [];

            localStorage.setItem(SELECTED_COURSES_STORAGE_KEY, JSON.stringify(selectedCourses));

            if (selectedCourses.length > 0 && data.degree) {
                const studyLevel = getStudyLevelByDegree(data.degree);
                localStorage.setItem("selectedDegree", data.degree);
                localStorage.setItem("selectedStudyLevel", studyLevel);

                const studyLevelSelect = document.getElementById("study-level-select");
                const degreeSelect = document.getElementById("degree-select");

                if (studyLevelSelect && degreeSelect) {
                    studyLevelSelect.value = studyLevel;
                    updateDegreeOptions(false);
                    degreeSelect.value = data.degree;
                    selectDegree(false);
                }
            } else {
                localStorage.removeItem("selectedDegree");
                localStorage.removeItem("selectedStudyLevel");
                localStorage.setItem("timetableGenerated", "false");
            }

            displaySelectedCourses();
            loadDashboardStats();
            loadTimetablePage();

            // Lock the UI if the student is already enrolled or has a pending request.
            if (enrollmentStatus !== "planning") {
                lockEnrollmentUI(enrollmentStatus);
            } else {
                // Make sure the confirm button is visible in planning mode.
                const confirmBtn = document.getElementById("confirm-enrollment-btn");
                if (confirmBtn) confirmBtn.style.display = "block";
            }
        })
        .catch(function (error) {
            console.log("Could not load selected courses:", error);
        });
}

// ---------------------------------------------------------------------------
// Load course catalogue
// ---------------------------------------------------------------------------

function loadCoursesFromBackend() {
    fetch("/api/courses")
        .then(r => r.json())
        .then(function (data) {
            courseOptions = {};
            data.courses.forEach(function (course) {
                if (!courseOptions[course.degree]) courseOptions[course.degree] = [];
                courseOptions[course.degree].push({
                    code: course.code,
                    name: course.name,
                    credits: course.credits,
                    time: course.time,
                    stream: course.degree,
                    degree: course.degree,
                    semester: course.semester,
                });
            });
            restoreCourseSelectionForm();
        })
        .catch(err => console.log("Courses could not be loaded:", err));
}

// ---------------------------------------------------------------------------
// Degree / study-level data
// ---------------------------------------------------------------------------

let courseOptions = {};

const degreeOptions = {
    bachelor: [
        "Bachelor of Arts",
        "Bachelor of Commerce",
        "Bachelor of Science",
        "Bachelor of Biomedical Science",
        "Bachelor of Engineering",
    ],
    master: [
        "Master of Information Technology",
        "Master of Data Science",
        "Master of Business Analytics",
        "Master of Professional Engineering",
        "Master of Studies",
    ],
    diploma: [
        "Graduate Diploma in Health Professions Education",
        "Graduate Diploma in Infectious Diseases",
        "Graduate Diploma in Environmental Science",
        "Graduate Diploma in Business",
        "Graduate Diploma in Education",
    ],
};

function getStudyLevelByDegree(degreeName) {
    for (const level in degreeOptions) {
        if (degreeOptions[level].includes(degreeName)) return level;
    }
    return "";
}

// ---------------------------------------------------------------------------
// Enrollment UI lock / unlock
// ---------------------------------------------------------------------------

/**
 * Locks all editable UI elements and shows the appropriate status banner.
 * Called when enrollmentStatus is 'enrolled' or 'change_requested'.
 */
function lockEnrollmentUI(status) {
    // Disable degree / study-level selects
    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");
    if (studyLevelSelect) studyLevelSelect.disabled = true;
    if (degreeSelect) degreeSelect.disabled = true;

    // Disable all Add buttons in the course table
    document.querySelectorAll("[data-course-code]").forEach(function (btn) {
        btn.disabled = true;
        btn.textContent = "Added";
        btn.classList.add("added-course-btn");
    });

    // Show enrollment status banner
    const banner = document.getElementById("enrollment-status-banner");
    if (banner) {
        banner.style.display = "flex";
        if (status === "enrolled") {
            banner.className = "enrollment-banner enrollment-banner--enrolled";
            banner.innerHTML =
                '<span class="enrollment-banner__icon">✓</span>' +
                '<span>' + t("You are enrolled. To make changes to your degree or courses, use the Request Change button below.") + '</span>';
        } else if (status === "change_requested") {
            banner.className = "enrollment-banner enrollment-banner--pending";
            banner.innerHTML =
                '<span class="enrollment-banner__icon">⏳</span>' +
                '<span>' + t("Your change request is pending admin approval. Your current enrollment remains active.") + '</span>';
        }
    }

    // Toggle sidebar action buttons
    const confirmBtn = document.getElementById("confirm-enrollment-btn");
    const requestChangeBtn = document.getElementById("request-change-btn");
    const pendingNotice = document.getElementById("pending-change-notice");

    if (confirmBtn) confirmBtn.style.display = "none";

    if (status === "enrolled") {
        if (requestChangeBtn) requestChangeBtn.style.display = "block";
        if (pendingNotice) pendingNotice.style.display = "none";
    } else if (status === "change_requested") {
        if (requestChangeBtn) requestChangeBtn.style.display = "none";
        if (pendingNotice) pendingNotice.style.display = "block";
    }

    // Re-render selected courses (no Remove buttons while locked)
    displaySelectedCourses();
}

/**
 * Unlocks the UI for drafting a change request.
 * Only the course list / degree selects are re-enabled — the state is
 * kept separate from the confirmed enrollment until the request is submitted.
 */
function unlockForChangeRequest() {
    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");
    if (studyLevelSelect) studyLevelSelect.disabled = false;
    if (degreeSelect) degreeSelect.disabled = false;

    // Re-enable Add buttons for the currently displayed degree
    const currentDegree = localStorage.getItem("selectedDegree") || "";
    if (currentDegree) displayAvailableCourses(currentDegree);

    displaySelectedCourses(); // re-renders with Remove buttons
}

// ---------------------------------------------------------------------------
// Confirm enrollment
// ---------------------------------------------------------------------------

function confirmEnrollment() {
    if (selectedCourses.length === 0) {
        alert(t("Please select at least one course before confirming enrollment."));
        return;
    }
    const degree = localStorage.getItem("selectedDegree") || "";
    if (!degree) {
        alert(t("Please select a degree before confirming enrollment."));
        return;
    }
    if (!confirm(t("Confirm your enrollment? After confirming, any changes will require admin approval."))) {
        return;
    }

    // Save the current draft first, then confirm.
    const courseCodes = selectedCourses.map(c => c.code);
    fetch("/api/save-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses: courseCodes, degree: degree }),
    })
        .then(r => r.json())
        .then(function () {
            return fetch("/api/confirm-enrollment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
        })
        .then(r => r.json())
        .then(function (data) {
            if (data.error) {
                alert(data.error);
                return;
            }
            enrollmentStatus = "enrolled";
            lockEnrollmentUI("enrolled");
            alert(t("Enrollment confirmed successfully!"));
        })
        .catch(function (err) {
            console.log("Confirm enrollment failed:", err);
            alert(t("Something went wrong. Please try again."));
        });
}

// ---------------------------------------------------------------------------
// Change request flow
// ---------------------------------------------------------------------------

/**
 * Enters "draft change request" mode:
 *  - Saves a snapshot of the current enrolled selection.
 *  - Unlocks the UI for editing.
 *  - Swaps the status banner to a draft-mode banner with Submit / Cancel.
 */
function requestChange() {
    // Snapshot the enrolled state so Cancel can restore it.
    enrolledCoursesSnapshot = JSON.parse(JSON.stringify(selectedCourses));
    enrolledDegreeSnapshot = localStorage.getItem("selectedDegree") || "";
    isEditingChangeRequest = true;

    unlockForChangeRequest();

    // Update the banner to draft mode
    const banner = document.getElementById("enrollment-status-banner");
    if (banner) {
        banner.style.display = "flex";
        banner.className = "enrollment-banner enrollment-banner--draft";
        banner.innerHTML =
            '<span class="enrollment-banner__icon">✏️</span>' +
            '<span>' + t("You are drafting a change request. Your current enrollment stays active until an admin approves your request.") + '</span>' +
            '<div class="enrollment-banner__actions">' +
            '  <button class="btn dashboard-btn-primary" onclick="submitChangeRequest()">' + t("Submit Request") + '</button>' +
            '  <button class="btn dashboard-btn-secondary" onclick="cancelChangeRequest()">' + t("Cancel") + '</button>' +
            '</div>';
    }

    // Hide the Request Change button while drafting
    const requestChangeBtn = document.getElementById("request-change-btn");
    if (requestChangeBtn) requestChangeBtn.style.display = "none";

    const msg = document.getElementById("course-message");
    if (msg) {
        msg.textContent = t("Select the courses you would like in your updated enrollment, then click Submit Request.");
    }
}

/**
 * Cancels a change request draft and restores the enrolled state.
 */
function cancelChangeRequest() {
    isEditingChangeRequest = false;
    selectedCourses = enrolledCoursesSnapshot;
    localStorage.setItem(SELECTED_COURSES_STORAGE_KEY, JSON.stringify(selectedCourses));
    localStorage.setItem("selectedDegree", enrolledDegreeSnapshot);

    const studyLevel = getStudyLevelByDegree(enrolledDegreeSnapshot);
    localStorage.setItem("selectedStudyLevel", studyLevel);

    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");
    if (studyLevelSelect && degreeSelect) {
        studyLevelSelect.value = studyLevel;
        updateDegreeOptions(false);
        degreeSelect.value = enrolledDegreeSnapshot;
        selectDegree(false);
    }

    enrollmentStatus = "enrolled";
    lockEnrollmentUI("enrolled");
}

/**
 * Submits the drafted changes as an EnrollmentChangeRequest.
 * The student's live enrollment is not changed until the admin approves.
 */
function submitChangeRequest() {
    if (selectedCourses.length === 0) {
        alert(t("Please select at least one course for your change request."));
        return;
    }
    const degree = localStorage.getItem("selectedDegree") || "";
    if (!degree) {
        alert(t("Please select a degree for your change request."));
        return;
    }

    fetch("/api/request-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            degree: degree,
            courses: selectedCourses.map(c => c.code),
        }),
    })
        .then(r => r.json())
        .then(function (data) {
            if (data.error) {
                alert(data.error);
                return;
            }
            // Revert to enrolled snapshot — the change is only pending
            isEditingChangeRequest = false;
            selectedCourses = enrolledCoursesSnapshot;
            localStorage.setItem(SELECTED_COURSES_STORAGE_KEY, JSON.stringify(selectedCourses));

            enrollmentStatus = "change_requested";
            lockEnrollmentUI("change_requested");
            alert(t("Change request submitted! An admin will review your request."));
        })
        .catch(function (err) {
            console.log("Submit change request failed:", err);
            alert(t("Something went wrong. Please try again."));
        });
}

// ---------------------------------------------------------------------------
// Degree / course UI
// ---------------------------------------------------------------------------

function updateDegreeOptions(shouldResetCourses = true) {
    // Locked while enrolled and not in a change-request draft
    if ((enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested")
        && !isEditingChangeRequest) {
        return;
    }

    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");
    const courseMessage = document.getElementById("course-message");
    const degreeSummary = document.getElementById("degree-summary");
    const studyLevelSummary = document.getElementById("study-level-summary");

    if (!studyLevelSelect || !degreeSelect) return;

    const selectedLevel = studyLevelSelect.value;
    const selectedLevelText = studyLevelSelect.options[studyLevelSelect.selectedIndex].text;
    localStorage.setItem("selectedStudyLevel", selectedLevel);

    if (shouldResetCourses) {
        selectedCourses = [];
        saveSelectedCourses();
        localStorage.removeItem("selectedDegree");
        localStorage.setItem("timetableGenerated", "false");
        displaySelectedCourses();
        loadDashboardStats();
    }

    displayAvailableCourses("");
    degreeSelect.innerHTML = "";

    if (!selectedLevel) {
        degreeSelect.disabled = true;
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = t("-- Select a study level first --");
        degreeSelect.appendChild(defaultOption);

        if (courseMessage) courseMessage.textContent = t("Please select a study level, then choose a degree before adding courses.");
        if (degreeSummary) degreeSummary.textContent = t("Not selected");
        if (studyLevelSummary) studyLevelSummary.textContent = t("Not selected");
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

    if (courseMessage) courseMessage.textContent = t("Now select a degree from the available") + " " + selectedLevelText + " " + t("options.");
    if (degreeSummary) degreeSummary.textContent = t("Not selected");
    if (studyLevelSummary) studyLevelSummary.textContent = selectedLevelText;
}

function selectDegree(shouldResetCourses = true) {
    // Locked while enrolled and not in a change-request draft
    if ((enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested")
        && !isEditingChangeRequest) {
        return;
    }

    const degreeSelect = document.getElementById("degree-select");
    const courseMessage = document.getElementById("course-message");
    const degreeSummary = document.getElementById("degree-summary");

    if (!degreeSelect) return;

    const selectedDegree = degreeSelect.value;

    if (!selectedDegree) {
        selectedCourses = [];
        saveSelectedCourses();
        localStorage.removeItem("selectedDegree");
        localStorage.setItem("timetableGenerated", "false");
        displaySelectedCourses();
        loadDashboardStats();
        if (courseMessage) courseMessage.textContent = t("Please choose a degree before adding courses.");
        if (degreeSummary) degreeSummary.textContent = t("Not selected");
        displayAvailableCourses("");
        return;
    }

    localStorage.setItem("selectedDegree", selectedDegree);

    if (shouldResetCourses) {
        selectedCourses = [];
        saveSelectedCourses();
        localStorage.setItem("timetableGenerated", "false");
        displaySelectedCourses();
        loadDashboardStats();
    }

    if (courseMessage) courseMessage.textContent = t(selectedDegree) + " " + t("selected. You can now add courses to your study plan.");
    if (degreeSummary) degreeSummary.textContent = t(selectedDegree);

    displayAvailableCourses(selectedDegree);
}

function displayAvailableCourses(degreeName) {
    const availableCoursesBox = document.getElementById("available-courses");
    if (!availableCoursesBox) return;

    const courses = courseOptions[degreeName];

    if (!courses || courses.length === 0) {
        availableCoursesBox.innerHTML = `
            <div class="empty-course-state">
                <p>${t("Please select a study level and degree to view available courses.")}</p>
            </div>`;
        return;
    }

    const isLocked = (enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested")
        && !isEditingChangeRequest;

    availableCoursesBox.innerHTML = `
        <div class="course-table">
            <div class="course-table-header">
                <span>Code</span>
                <span>Course</span>
                <span>Time</span>
                <span>Credits</span>
                <span></span>
            </div>
            ${courses.map(course => `
                <div class="course-table-row"
                    data-search="${course.code.toLowerCase()} ${course.name.toLowerCase()}"
                    data-semester="${course.semester}">
                    <span class="course-code">${course.code}</span>
                    <span class="course-table-name">${course.name}</span>
                    <span>${course.time}</span>
                    <span>${course.credits} credits</span>
                    <button type="button"
                        class="btn dashboard-btn-primary${isLocked ? ' added-course-btn' : ''}"
                        data-course-code="${course.code}"
                        ${isLocked ? 'disabled' : ''}
                        onclick="addCourse(event,'${course.code}','${course.name}',${course.credits},'${course.time}','${course.degree}','${course.semester}')">
                        Add
                    </button>
                </div>
            `).join("")}
        </div>`;

    filterCourses();
    updateAddButtonStates();
}

function updateAddButtonStates() {
    const isLocked = (enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested")
        && !isEditingChangeRequest;

    document.querySelectorAll("[data-course-code]").forEach(function (button) {
        const courseCode = button.dataset.courseCode;
        const isSelected = selectedCourses.some(c => c.code === courseCode);

        if (isLocked || isSelected) {
            button.textContent = isSelected ? "Added" : "Add";
            button.disabled = true;
            button.classList.add("added-course-btn");
        } else {
            button.textContent = "Add";
            button.disabled = false;
            button.classList.remove("added-course-btn");
        }
    });
}

function addCourse(event, code, name, credits, time, degree, semester) {
    // Block if locked and not in a change-request draft
    if ((enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested")
        && !isEditingChangeRequest) {
        alert(t("You are enrolled. Use the Request Change button to modify your selection."));
        return;
    }

    const degreeSelect = document.getElementById("degree-select");
    const message = document.getElementById("course-message");

    if (degreeSelect && degreeSelect.value === "") {
        if (message) message.innerHTML = t("Please select a degree first.");
        return;
    }

    const existingSemester = selectedCourses.length > 0 ? selectedCourses[0].semester : null;
    if (existingSemester && existingSemester !== semester) {
        alert(t("Semester conflict detected. Please select courses from the same semester."));
        return;
    }

    const timeConflict = selectedCourses.some(c => c.time === time);
    if (timeConflict) {
        alert(t("Time conflict detected. This course overlaps with another selected course."));
        return;
    }

    const exists = selectedCourses.some(c => c.code === code);
    if (exists) {
        if (message) message.innerHTML = code + " " + t("has already been added.");
        return;
    }

    selectedCourses.push({ code, name, credits, time, stream: degree, degree, semester });
    localStorage.setItem("selectedCourses", JSON.stringify(selectedCourses));

    if (message) message.innerHTML = code + " " + t("added successfully.");

    displaySelectedCourses();
    updateAddButtonStates();

    // Only auto-save to backend during planning mode (not during a change-request draft)
    if (!isEditingChangeRequest) {
        saveSelectedCoursesToBackend();
    }
}

function displaySelectedCourses() {
    const selectedBox = document.getElementById("selected-courses");
    const creditOutput = document.getElementById("credit-output");
    const creditSummary = document.getElementById("credit-summary");
    const courseCountSummary = document.getElementById("course-count-summary");

    if (!selectedBox || !creditOutput) return;

    // Remove buttons are only shown while planning or in a change-request draft
    const canRemove = enrollmentStatus === "planning" || isEditingChangeRequest;

    if (selectedCourses.length === 0) {
        selectedBox.innerHTML = `<p>${t("No courses selected yet.")}</p>`;
        creditOutput.innerHTML = "0";
        if (creditSummary) creditSummary.textContent = "0";
        if (courseCountSummary) courseCountSummary.textContent = "0";
        return;
    }

    let totalCredits = 0;
    selectedBox.innerHTML = selectedCourses.map(course => {
        totalCredits += course.credits;
        return `
            <div class="selected-course-item">
                <div class="selected-course-info">
                    <strong>${course.code}</strong>
                    <span>${t(course.name)} · ${course.credits} ${t("credit points")}</span>
                </div>
                ${canRemove
                    ? `<button class="remove-course-btn" onclick="removeCourse('${course.code}')">${t("Remove")}</button>`
                    : ""}
            </div>`;
    }).join("");

    creditOutput.innerHTML = totalCredits;
    if (creditSummary) creditSummary.textContent = totalCredits;
    if (courseCountSummary) courseCountSummary.textContent = selectedCourses.length;
}

function removeCourse(code) {
    // Block if locked
    if ((enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested")
        && !isEditingChangeRequest) {
        return;
    }

    const currentDegree = localStorage.getItem("selectedDegree");
    const message = document.getElementById("course-message");

    selectedCourses = selectedCourses.filter(c => c.code !== code);
    saveSelectedCourses();

    if (selectedCourses.length === 0) {
        localStorage.setItem("timetableGenerated", "false");
    }

    displaySelectedCourses();
    loadTimetablePage();
    loadDashboardStats();

    if (!isEditingChangeRequest) {
        saveSelectedCoursesToBackend();
    }

    if (currentDegree) displayAvailableCourses(currentDegree);
    if (message) message.innerHTML = code + " " + t("removed successfully.");
}

function filterCourses() {
    const searchInput = document.getElementById("course-search");
    const semesterFilter = document.getElementById("semester-filter");
    const courseCards = document.querySelectorAll(".course-table-row");

    if (!searchInput || !semesterFilter) return;

    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedSemester = semesterFilter.value;

    courseCards.forEach(function (card) {
        const matchesSearch = searchTerm === "" || card.dataset.search.includes(searchTerm);
        const matchesSemester = selectedSemester === "all" || card.dataset.semester === selectedSemester;
        card.style.display = (matchesSearch && matchesSemester) ? "grid" : "none";
    });
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

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
        if (label) label.textContent = t(labelText);
        button.setAttribute("aria-pressed", labelText === "Light" ? "true" : "false");
    });
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

function loadTimetablePage() {
    const savedCourses = JSON.parse(localStorage.getItem("selectedCourses")) || [];
    const courseList = document.getElementById("timetable-course-list");
    const status = document.getElementById("timetable-status");
    const output = document.getElementById("timetable-output");
    const courseCount = document.getElementById("timetable-course-count");
    const creditTotal = document.getElementById("timetable-credit-total");

    if (!courseList) return;

    if (savedCourses.length === 0) {
        courseList.innerHTML = `<p>${t("No courses selected yet.")}</p>`;
        if (status) status.innerHTML = t("Not generated");
        if (output) output.innerHTML = t("Please select courses before generating a timetable.");
        if (courseCount) courseCount.textContent = "0";
        if (creditTotal) creditTotal.textContent = "0";
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
            </div>`;
    }).join("");

    if (status) status.innerHTML = t("Ready");
    if (courseCount) courseCount.innerHTML = savedCourses.length;
    if (creditTotal) creditTotal.innerHTML = totalCredits;

    if (localStorage.getItem("timetableGenerated") === "true") {
        generateTimetable();
    } else {
        renderEmptyWeeklyCalendar();
    }
}

function renderEmptyWeeklyCalendar() {
    const calendar = document.getElementById("weekly-calendar");
    if (!calendar) return;

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const times = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

    let html = `<div class="calendar-time-header"></div>`;
    days.forEach(day => { html += `<div class="calendar-day-header">${t(day)}</div>`; });
    times.forEach(function (time) {
        html += `<div class="calendar-time">${time}</div>`;
        days.forEach(day => { html += `<div class="calendar-cell" data-day="${day}" data-time="${time}"></div>`; });
    });
    calendar.innerHTML = html;
}

function generateTimetable() {
    const savedCourses = JSON.parse(localStorage.getItem("selectedCourses")) || [];
    const status = document.getElementById("timetable-status");
    const output = document.getElementById("timetable-output");

    if (savedCourses.length === 0) {
        if (output) output.innerHTML = t("Please select courses before generating a timetable.");
        return;
    }

    const uniqueSemesters = [...new Set(savedCourses.map(c => c.semester))];
    if (uniqueSemesters.length > 1) {
        if (status) status.innerHTML = t("Conflict");
        if (output) output.innerHTML = t("You selected courses from different semesters. Please choose courses from one semester before generating a timetable.");
        renderEmptyWeeklyCalendar();
        return;
    }

    renderEmptyWeeklyCalendar();
    savedCourses.forEach(function (course) {
        const cell = document.querySelector(
            `.calendar-cell[data-day="${getCourseDay(course.time)}"][data-time="${getCourseStartTime(course.time)}"]`
        );
        if (cell) {
            cell.classList.add("course-block");
            cell.innerHTML = `<strong>${course.code}</strong><span>${t(course.name)}</span><small>${course.time}</small>`;
        }
    });

    if (status) status.innerHTML = t("Generated");
    if (output) output.innerHTML = t("The weekly timetable has been generated successfully.");
    localStorage.setItem("timetableGenerated", "true");
}

function clearTimetable() {
    renderEmptyWeeklyCalendar();
    const status = document.getElementById("timetable-status");
    const output = document.getElementById("timetable-output");
    if (status) status.innerHTML = t("Not generated");
    if (output) output.innerHTML = t("The timetable has been cleared.");
    localStorage.setItem("timetableGenerated", "false");
}

function getCourseDay(timeText) { return timeText.split(" ")[0]; }
function getCourseStartTime(timeText) { return timeText.split(" ")[1].split("–")[0]; }

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

function loadDashboardStats() {
    const savedCourses = JSON.parse(localStorage.getItem("selectedCourses")) || [];
    const savedDegree = localStorage.getItem("selectedDegree") || "Not selected";
    let totalCredits = 0;
    savedCourses.forEach(c => { totalCredits += c.credits; });
    const courseCount = savedCourses.length;

    const courseCountTop = document.getElementById("dashboard-course-count");
    const degreeName = document.getElementById("dashboard-degree-name");
    const degreeStatus = document.getElementById("dashboard-degree-status");
    const timetableStatus = document.getElementById("dashboard-timetable-status");
    const selectedCount = document.getElementById("dashboard-selected-count");
    const creditTotal = document.getElementById("dashboard-credit-total");
    const courseProgress = document.getElementById("dashboard-course-progress");
    const timetableProgress = document.getElementById("dashboard-timetable-progress");
    const timetableGenerated = localStorage.getItem("timetableGenerated");

    if (courseCountTop) courseCountTop.innerHTML = courseCount;
    if (degreeName) degreeName.innerHTML = savedDegree;
    if (degreeStatus) degreeStatus.innerHTML = savedDegree !== "Not selected" ? "Yes" : "No";
    if (timetableStatus) timetableStatus.innerHTML = (timetableGenerated === "true" && courseCount > 0) ? "Yes" : "No";
    if (selectedCount) selectedCount.innerHTML = courseCount;
    if (creditTotal) creditTotal.innerHTML = totalCredits;

    if (courseProgress) {
        courseProgress.innerHTML = courseCount > 0 ? "Done" : "Pending";
        courseProgress.className = courseCount > 0 ? "progress-done" : "progress-pending";
    }
    if (timetableProgress) {
        if (timetableGenerated === "true" && courseCount > 0) {
            timetableProgress.innerHTML = "Generated";
            timetableProgress.className = "progress-done";
        } else if (courseCount > 0) {
            timetableProgress.innerHTML = "Ready";
            timetableProgress.className = "progress-active";
        } else {
            timetableProgress.innerHTML = "Pending";
            timetableProgress.className = "progress-pending";
        }
    }
}

// ---------------------------------------------------------------------------
// Restore form on page load
// ---------------------------------------------------------------------------

function restoreCourseSelectionForm() {
    const savedStudyLevel = localStorage.getItem("selectedStudyLevel");
    const savedDegree = localStorage.getItem("selectedDegree");
    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");

    if (!studyLevelSelect || !degreeSelect || !savedStudyLevel) return;

    studyLevelSelect.value = savedStudyLevel;
    updateDegreeOptions(false);

    if (savedDegree) {
        degreeSelect.value = savedDegree;
        const degreeSummary = document.getElementById("degree-summary");
        const courseMessage = document.getElementById("course-message");
        if (degreeSummary) degreeSummary.textContent = savedDegree;
        if (courseMessage) courseMessage.textContent = savedDegree + " selected. You can now add courses to your study plan.";
        displayAvailableCourses(savedDegree);
    }
}

// ---------------------------------------------------------------------------
// Admin — approve / reject change requests
// ---------------------------------------------------------------------------

function approveChange(requestId) {
    if (!confirm(t("Approve this change request? The student's enrollment will be updated immediately."))) return;

    fetch("/api/admin/approve-change/" + requestId, { method: "POST" })
        .then(r => r.json())
        .then(function (data) {
            alert(data.message || "Change approved.");
            location.reload();
        })
        .catch(err => console.log("Approve failed:", err));
}

function rejectChange(requestId) {
    if (!confirm(t("Reject this change request? The student's current enrollment will remain unchanged."))) return;

    fetch("/api/admin/reject-change/" + requestId, { method: "POST" })
        .then(r => r.json())
        .then(function (data) {
            alert(data.message || "Change rejected.");
            location.reload();
        })
        .catch(err => console.log("Reject failed:", err));
}

// ---------------------------------------------------------------------------
// CSV download
// ---------------------------------------------------------------------------

function downloadTimetable() {
    const savedCourses = JSON.parse(localStorage.getItem("selectedCourses")) || [];
    const output = document.getElementById("timetable-output");

    if (savedCourses.length === 0) {
        if (output) output.innerHTML = "Please select courses before downloading a timetable.";
        return;
    }

    let csvContent = "Course Code,Course Name,Credits,Time,Stream,Semester\n";
    savedCourses.forEach(function (course) {
        csvContent += `"${course.code}","${course.name}",${course.credits},"${course.time}","${course.stream}","${course.semester}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv" });
    const downloadLink = document.createElement("a");
    downloadLink.href = window.URL.createObjectURL(blob);
    downloadLink.download = "timetable.csv";
    downloadLink.click();

    if (output) output.innerHTML = "Timetable downloaded successfully.";
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
    applySavedTheme();
    loadCoursesFromBackend();
    loadSelectedCoursesFromBackend();
});