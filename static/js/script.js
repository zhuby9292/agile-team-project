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

async function sendVerificationCode() {
    const email = document.getElementById("recovery-email").value.trim();
    const output = document.getElementById("forgot-output");

    if (email === "") {
        output.innerHTML = t("Please enter your email address.");
        return;
    }

    const response = await fetch("/api/send-reset-code", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: email })
    });

    const result = await response.json();

    if (!response.ok) {
        output.innerHTML = t(result.error || "Something went wrong.");
        return;
    }

    localStorage.setItem("recoveryEmail", email);
    output.innerHTML = t(result.message || "Verification code sent. Redirecting...");

    setTimeout(function () {
        window.location.href = result.redirect || "/reset-password";
    }, 600);
}


async function resetPasswordWithCode() {
    const verificationCode = getVerificationCodeFromBoxes();
    const newPassword = document.getElementById("new-password").value;
    const output = document.getElementById("reset-output");
    const email = localStorage.getItem("recoveryEmail");

    if (!email) {
        output.innerHTML = t("Please request a verification code first.");
        return;
    }

    if (verificationCode === "" || newPassword === "") {
        output.innerHTML = t("Please enter the verification code and new password.");
        return;
    }

    if (newPassword.length < 6) {
        output.innerHTML = t("Password must be at least 6 characters.");
        return;
    }

    const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: email,
            code: verificationCode,
            new_password: newPassword
        })
    });

    const result = await response.json();

    if (!response.ok) {
        output.innerHTML = t(result.error || "Something went wrong.");
        return;
    }

    output.innerHTML = t(result.message || "Password reset successful.");
    alert(t("Password reset successful! Please sign in again."));

    localStorage.removeItem("recoveryEmail");

    setTimeout(function () {
        window.location.href = result.redirect || "/";
    }, 800);
}

function handleCodePaste(event) {
    event.preventDefault();

    const pastedText = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    const inputs = Array.from(document.querySelectorAll(".code-input"));

    pastedText.split("").forEach(function (digit, index) {
        if (inputs[index]) {
            inputs[index].value = digit;
        }
    });

    const nextEmptyInput = inputs.find(input => input.value === "");
    if (nextEmptyInput) {
        nextEmptyInput.focus();
    } else if (inputs[inputs.length - 1]) {
        inputs[inputs.length - 1].focus();
    }

    updateResetFormState();
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
    const fullName = document.getElementById("full-name").value.trim();
    const studentId = document.getElementById("student-id").value.trim();
    const signupPassword = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (!fullName || !studentId || !signupPassword || !confirmPassword) {
        alert(t("Please complete all registration fields."));
        return;
    }

    // Student ID: exactly 8 digits, no leading zero
    if (!/^[1-9][0-9]{7}$/.test(studentId)) {
        alert(t("Student ID must be exactly 8 digits and cannot start with zero."));
        return;
    }

    if (signupPassword !== confirmPassword) {
        alert(t("Passwords do not match."));
        return;
    }

    if (signupPassword.length < 6) {
        alert(t("Password must be at least 6 characters long."));
        return;
    }
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
let eligibleSemester = 1;
let passedSemesters = [];
let degreeLocked = false;
let backendStateLoaded = false;
let catalogueLoaded = false;

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
    if ((enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested")
        && !isEditingChangeRequest) {
        return Promise.resolve();
    }

    const degree = localStorage.getItem("selectedDegree") || "";
    const courseCodes = selectedCourses.map(c => c.code);

    return fetch("/api/save-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            courses: courseCodes,
            degree: degree,
        }),
    })
        .then(function (response) {
            return response.json().then(function (data) {
                if (!response.ok) {
                    throw new Error(data.error || "Save failed.");
                }

                return data;
            });
        })
        .then(function (data) {
            if (typeof data.eligible_semester !== "undefined") {
                eligibleSemester = data.eligible_semester;
            }

            if (Array.isArray(data.passed_semesters)) {
                passedSemesters = data.passed_semesters;
            }

            degreeLocked = passedSemesters.length > 0;

            updateSemesterEligibilityBanner();
            applyDegreeLockState();

            console.log("Draft saved:", data.message);

            return data;
        })
        .catch(function (error) {
            console.log("Save failed:", error);

            const msg = document.getElementById("course-message");
            if (msg) msg.textContent = error.message;

            throw error;
        });
}

// ---------------------------------------------------------------------------
// Backend sync — load selected courses + enrollment status
// ---------------------------------------------------------------------------

function loadSelectedCoursesFromBackend() {
    return fetch("/api/selected-courses")
        .then(r => r.json())
        .then(function (data) {
            backendStateLoaded = true;

            enrollmentStatus = data.enrollment_status || "planning";
            selectedCourses = data.courses || [];
            eligibleSemester = data.eligible_semester || 1;
            passedSemesters = data.passed_semesters || [];
            degreeLocked = !!data.degree_locked || passedSemesters.length > 0;

            localStorage.setItem(
                SELECTED_COURSES_STORAGE_KEY,
                JSON.stringify(selectedCourses)
            );

            if (data.degree) {
                const studyLevel = getStudyLevelByDegree(data.degree);

                localStorage.setItem("selectedDegree", data.degree);
                localStorage.setItem("selectedStudyLevel", studyLevel);

                setDegreeControlsFromState(studyLevel, data.degree);
            } else {
                localStorage.removeItem("selectedDegree");
                localStorage.removeItem("selectedStudyLevel");
                localStorage.setItem("timetableGenerated", "false");
            }

            displaySelectedCourses();
            loadDashboardStats();
            loadTimetablePage();
            updateSemesterEligibilityBanner();
            applyDegreeLockState();

            if (enrollmentStatus !== "planning") {
                lockEnrollmentUI(enrollmentStatus);
            } else {
                const confirmBtn = document.getElementById("confirm-enrollment-btn");
                if (confirmBtn) confirmBtn.style.display = "block";
            }

            const currentDegree = localStorage.getItem("selectedDegree") || "";

            if (catalogueLoaded && currentDegree) {
                displayAvailableCourses(currentDegree);
            }

            return data;
        })
        .catch(function (error) {
            console.log("Could not load selected courses:", error);
        });
}

// ---------------------------------------------------------------------------
// Load course catalogue
// ---------------------------------------------------------------------------

function loadCoursesFromBackend() {
    return fetch("/api/courses")
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

            catalogueLoaded = true;
            restoreCourseSelectionForm();
            return data;
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

function setDegreeControlsFromState(studyLevel, degree) {
    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");
    const degreeSummary = document.getElementById("degree-summary");
    const studyLevelSummary = document.getElementById("study-level-summary");
    const courseMessage = document.getElementById("course-message");

    if (!studyLevelSelect || !degreeSelect) return;

    studyLevelSelect.value = studyLevel || "";

    rebuildDegreeOptions(studyLevel || "", degree || "");

    degreeSelect.value = degree || "";

    if (degreeSummary) {
        degreeSummary.textContent = degree || t("Not selected");
    }

    if (studyLevelSummary) {
        const selectedOption = studyLevelSelect.options[studyLevelSelect.selectedIndex];
        studyLevelSummary.textContent = selectedOption
            ? selectedOption.text
            : t("Not selected");
    }

    if (courseMessage && degree) {
        courseMessage.textContent =
            degree + " selected. You can now add courses to your eligible semester.";
    }
}


function rebuildDegreeOptions(selectedLevel, selectedDegree) {
    const degreeSelect = document.getElementById("degree-select");

    if (!degreeSelect) return;

    degreeSelect.innerHTML = "";

    if (!selectedLevel) {
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = t("-- Select a study level first --");

        degreeSelect.appendChild(defaultOption);
        degreeSelect.disabled = true;

        return;
    }

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = t("-- Select a degree --");

    degreeSelect.appendChild(placeholderOption);

    (degreeOptions[selectedLevel] || []).forEach(function (degreeName) {
        const option = document.createElement("option");
        option.value = degreeName;
        option.textContent = t(degreeName);

        degreeSelect.appendChild(option);
    });

    if (selectedDegree) {
        degreeSelect.value = selectedDegree;
    }

    degreeSelect.disabled = false;
}


function applyDegreeLockState() {
    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");

    const shouldLockDegree =
        ((enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested") && !isEditingChangeRequest)
        || (degreeLocked && !isEditingChangeRequest);

    if (studyLevelSelect) {
        studyLevelSelect.disabled = shouldLockDegree;
    }

    if (degreeSelect) {
        degreeSelect.disabled =
            shouldLockDegree
            || !studyLevelSelect
            || !studyLevelSelect.value;
    }
}


function getSemesterNumber(semesterKey) {
    const match = String(semesterKey || "").match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}


function getCourseSemesterState(course) {
    const sem = getSemesterNumber(course.semester);

    if (passedSemesters.includes(sem)) {
        return "passed";
    }

    if (sem !== eligibleSemester) {
        return "locked";
    }

    return "eligible";
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

    // Disable course buttons while keeping selected courses visually different
    updateAddButtonStates();

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
    const currentDegree = localStorage.getItem("selectedDegree") || "";
    const currentStudyLevel =
        localStorage.getItem("selectedStudyLevel") || getStudyLevelByDegree(currentDegree);

    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");

    if (studyLevelSelect) studyLevelSelect.disabled = false;
    if (degreeSelect) degreeSelect.disabled = false;

    if (currentStudyLevel) {
        setDegreeControlsFromState(currentStudyLevel, currentDegree);
    }

    if (currentDegree) {
        displayAvailableCourses(currentDegree);
    }

    displaySelectedCourses();
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

    const invalidCourse = selectedCourses.find(function (course) {
        return getCourseSemesterState(course) !== "eligible";
    });

    if (invalidCourse) {
        alert("You can only confirm Semester " + eligibleSemester + " courses.");
        return;
    }

    if (!confirm(t("Confirm your enrollment? After confirming, any changes will require admin approval."))) {
        return;
    }

    const courseCodes = selectedCourses.map(c => c.code);

    saveSelectedCoursesToBackend()
        .then(function () {
            return fetch("/api/confirm-enrollment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    courses: courseCodes,
                    degree: degree,
                }),
            });
        })
        .then(function (response) {
            return response.json().then(function (data) {
                if (!response.ok) {
                    throw new Error(data.error || "Confirm enrollment failed.");
                }

                return data;
            });
        })
        .then(function (data) {
            enrollmentStatus = "enrolled";

            if (typeof data.eligible_semester !== "undefined") {
                eligibleSemester = data.eligible_semester;
            }

            if (Array.isArray(data.passed_semesters)) {
                passedSemesters = data.passed_semesters;
            }

            degreeLocked = passedSemesters.length > 0;

            lockEnrollmentUI("enrolled");
            updateSemesterEligibilityBanner();

            alert(t("Enrollment confirmed successfully!"));
        })
        .catch(function (err) {
            console.log("Confirm enrollment failed:", err);
            alert(err.message || t("Something went wrong. Please try again."));
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

// Degree / course UI

function updateDegreeOptions(shouldResetCourses = true) {
    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");
    const courseMessage = document.getElementById("course-message");
    const degreeSummary = document.getElementById("degree-summary");
    const studyLevelSummary = document.getElementById("study-level-summary");

    if (!studyLevelSelect || !degreeSelect) return;

    // Locked while enrolled/change-requested OR after any semester has passed.
    // This prevents degree switching after progression.
    if (
        ((enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested") && !isEditingChangeRequest)
        || (degreeLocked && !isEditingChangeRequest)
    ) {
        applyDegreeLockState();
        return;
    }

    const selectedLevel = studyLevelSelect.value;
    const selectedLevelText = studyLevelSelect.options[studyLevelSelect.selectedIndex]
        ? studyLevelSelect.options[studyLevelSelect.selectedIndex].text
        : "";

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

    rebuildDegreeOptions(selectedLevel, "");

    if (!selectedLevel) {
        if (courseMessage) {
            courseMessage.textContent = t("Please select a study level, then choose a degree before adding courses.");
        }

        if (degreeSummary) {
            degreeSummary.textContent = t("Not selected");
        }

        if (studyLevelSummary) {
            studyLevelSummary.textContent = t("Not selected");
        }

        applyDegreeLockState();
        return;
    }

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

    applyDegreeLockState();
}

function selectDegree(shouldResetCourses = true) {
    // Locked while enrolled and not in a change-request draft
    if (
        ((enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested") && !isEditingChangeRequest)
        || (degreeLocked && !isEditingChangeRequest)
    ) {
        applyDegreeLockState();
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
    updateSemesterEligibilityBanner();
    applyDegreeLockState();
}

function updateSemesterFilter(courses) {
    const semesterFilter = document.getElementById("semester-filter");

    if (!semesterFilter) {
        return;
    }

    semesterFilter.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Semesters";
    semesterFilter.appendChild(allOption);

    const semesters = [...new Set(courses.map(function (course) {
        return course.semester;
    }))];

    semesters.sort(function (a, b) {
        const numberA = parseInt(a.replace(/\D/g, ""));
        const numberB = parseInt(b.replace(/\D/g, ""));
        return numberA - numberB;
    });

    semesters.forEach(function (semester) {
        const option = document.createElement("option");
        option.value = semester;
        option.textContent = "Semester " + semester.replace(/\D/g, "");
        semesterFilter.appendChild(option);
    });
}

function displayAvailableCourses(degreeName) {
    const availableCoursesBox = document.getElementById("available-courses");

    if (!availableCoursesBox) return;

    const courses = courseOptions[degreeName];

    if (courses) {
        updateSemesterFilter(courses);
    }

    if (!courses || courses.length === 0) {
        availableCoursesBox.innerHTML = `
            <div class="empty-course-state">
                <p>${t("Please select a study level and degree to view available courses.")}</p>
            </div>`;

        return;
    }

    const isEnrollmentLocked =
        (enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested")
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

            ${courses.map(course => {
                const semesterNumber = getSemesterNumber(course.semester);
                const state = getCourseSemesterState(course);
                const isSelected = selectedCourses.some(c => c.code === course.code);

                const buttonDisabled =
                    isEnrollmentLocked
                    || isSelected
                    || state !== "eligible";

                const buttonLabel =
                    isSelected ? "Added" :
                    state === "passed" ? "✓ Passed" :
                    state === "locked" ? "Locked" :
                    "Add";

                const rowClass =
                    state === "passed" ? " course-table-row--passed" :
                    state === "locked" ? " course-table-row--locked" :
                    "";

                return `
                    <div class="course-table-row${rowClass}"
                        data-search="${course.code.toLowerCase()} ${course.name.toLowerCase()}"
                        data-semester="${course.semester}">

                        <span class="course-code">${course.code}</span>

                        <span class="course-table-name">
                            ${course.name}
                            <small style="display:block;color:#888">
                                Semester ${semesterNumber}
                            </small>
                        </span>

                        <span>${course.time}</span>
                        <span>${course.credits} credits</span>

                        <button type="button"
                            class="btn dashboard-btn-primary ${isSelected ? "added-course-btn" : ""}"
                            data-course-code="${course.code}"
                            data-semester-state="${state}"
                            ${buttonDisabled ? "disabled" : ""}
                            onclick="addCourse(event,'${course.code}','${course.name}',${course.credits},'${course.time}','${course.degree}','${course.semester}')">
                            ${buttonLabel}
                        </button>
                    </div>
                `;
            }).join("")}
        </div>
    `;

    filterCourses();
    updateAddButtonStates();
}

function updateAddButtonStates() {
    const isEnrollmentLocked =
        (enrollmentStatus === "enrolled" || enrollmentStatus === "change_requested")
        && !isEditingChangeRequest;

    document.querySelectorAll("[data-course-code]").forEach(function (button) {
        const courseCode = button.dataset.courseCode;
        const state = button.dataset.semesterState || "eligible";
        const isSelected = selectedCourses.some(c => c.code === courseCode);

        button.classList.toggle("added-course-btn", isSelected);

        if (isSelected) {
            button.textContent = "Added";
            button.disabled = true;
        } else if (state === "passed") {
            button.textContent = "✓ Passed";
            button.disabled = true;
        } else if (state === "locked") {
            button.textContent = "Locked";
            button.disabled = true;
        } else if (isEnrollmentLocked) {
            button.textContent = "Add";
            button.disabled = true;
        } else {
            button.textContent = "Add";
            button.disabled = false;
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

    const semesterNumber = getSemesterNumber(semester);

    if (passedSemesters.includes(semesterNumber)) {
        alert("Semester " + semesterNumber + " has already been passed. You cannot add courses from it.");
        return;
    }

    if (semesterNumber !== eligibleSemester) {
        alert("Semester " + semesterNumber + " is locked. You are currently eligible to enrol in Semester " + eligibleSemester + ".");
        return;
    }

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
        saveSelectedCoursesToBackend().catch(function () {
            loadSelectedCoursesFromBackend();
        });
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

// Theme

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

// Timetable

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

// Dashboard stats

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
    const eligibleTop = document.getElementById("dashboard-current-semester-status");
    const eligibleCard = document.getElementById("dashboard-eligible-semester");
    const passedCount = document.getElementById("dashboard-passed-count");
    const passedList = document.getElementById("semester-progress-list");
    const semesterEnrolStatus = document.getElementById("dashboard-semester-enrol-status");

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
    if (eligibleTop) eligibleTop.innerHTML = eligibleSemester;
    if (eligibleCard) eligibleCard.innerHTML = eligibleSemester;
    if (passedCount) passedCount.innerHTML = passedSemesters.length;
    if (semesterEnrolStatus) semesterEnrolStatus.innerHTML = "Eligible to enrol";

    if (passedList) {
        if (passedSemesters.length === 0) {
            passedList.innerHTML =
                '<div class="progress-item"><span>No semesters completed yet.</span></div>';
        } else {
            passedList.innerHTML =
                passedSemesters.map(function (sem) {
                    return '<div class="progress-item"><span>Semester ' + sem + '</span><span class="progress-done">Passed</span></div>';
                }).join("")
                + '<div class="progress-item"><span>Semester ' + eligibleSemester + '</span><span class="progress-active">Current</span></div>';
        }
    }
}

// Restore form on page load

function updateSemesterEligibilityBanner() {
    const banner = document.getElementById("semester-eligibility-banner");
    if (!banner) return;

    if (enrollmentStatus !== "planning") {
        banner.style.display = "none";
        return;
    }

    let passedText = "";
    if (passedSemesters.length > 0) {
        passedText = " &nbsp;·&nbsp; Passed: " +
            passedSemesters.map(function (s) { return "<strong>Sem " + s + "</strong>"; }).join(", ");
    }

    banner.style.display = "flex";
    banner.innerHTML =
        '<span class="enrollment-banner__icon">📅</span>' +
        '<span>You are eligible to enrol in <strong>Semester ' + eligibleSemester + '</strong> courses.' +
        passedText + '</span>';
}

function restoreCourseSelectionForm() {
    const savedDegree = localStorage.getItem("selectedDegree") || "";
    const savedStudyLevel = localStorage.getItem("selectedStudyLevel") || getStudyLevelByDegree(savedDegree);

    const studyLevelSelect = document.getElementById("study-level-select");
    const degreeSelect = document.getElementById("degree-select");

    if (!studyLevelSelect || !degreeSelect || !savedStudyLevel) return;

    setDegreeControlsFromState(savedStudyLevel, savedDegree || "");

    if (savedDegree) {
        displayAvailableCourses(savedDegree);
    }

    updateSemesterEligibilityBanner();
    applyDegreeLockState();
}

// Admin — approve / reject change requests

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

// CSV download

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

// Admin — mark semester as passed

function markSemesterPassed(userId, semesterNumber, studentName) {
    var nextSem = semesterNumber + 1;
    if (!confirm(
        "Mark Semester " + semesterNumber + " as passed for " + studentName + "?\n\n" +
        "This will:\n" +
        "• Create a pass record for Semester " + semesterNumber + "\n" +
        "• Clear their current course selections\n" +
        "• Allow them to enrol in Semester " + nextSem
    )) return;

    fetch("/api/admin/mark-semester-passed/" + userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semester_number: semesterNumber }),
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.error) {
                alert("Error: " + data.error);
                return;
            }
            alert(data.message);
            loadEnrollmentOverview();
        })
        .catch(function (err) {
            console.log("Mark semester passed failed:", err);
            alert("Something went wrong. Please try again.");
        });
}

// ADMIN — Enrollment Overview

function loadEnrollmentOverview() {
    fetch("/api/admin/enrollments")
        .then(r => r.json())
        .then(function (data) {
            const tbody = document.getElementById("enrollment-table-body");
            if (!tbody) return;

            const enrollments = data.enrollments || [];

            if (enrollments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="admin-empty-row">No students registered yet.</td></tr>';
                return;
            }

            tbody.innerHTML = enrollments.map(function (student) {
                const statusClass =
                    student.enrollment_status === "enrolled" ? "admin-status--enrolled" :
                    student.enrollment_status === "change_requested" ? "admin-status--pending" :
                    "admin-status--planning";

                const statusText =
                    student.enrollment_status === "enrolled" ? "Enrolled" :
                    student.enrollment_status === "change_requested" ? "Change Pending" :
                    "Planning";

                const degreeDisplay = student.selected_degree !== "N/A"
                    ? student.selected_degree
                    : '<span style="color:#aaa;font-style:italic">Not selected</span>';

                const courseCell = student.course_count > 0
                    ? `<button class="btn btn-sm enrollment-expand-btn"
                            onclick="toggleCourseDetails(this)"
                            data-student-id="${student.id}">
                            ${student.course_count} course${student.course_count !== 1 ? "s" : ""}
                            <span class="expand-icon">▼</span>
                       </button>`
                    : `<span style="color:#aaa">No courses</span>`;

                // --- Semester progress cell ---
                const passedList = student.passed_semesters || [];
                const eligibleSem = student.eligible_semester || 1;
                const enrolledSem = student.enrolled_semester || eligibleSem;

                const passedPills = passedList.map(function (sem) {
                    return '<span class="sem-passed-pill">Sem ' + sem + ' ✓</span>';
                }).join(" ");

                const eligiblePill = student.selected_degree !== "N/A"
                    ? '<span class="sem-eligible-pill">→ Sem ' + eligibleSem + '</span>'
                    : "";

                // Mark-as-passed button only shown when student is enrolled
                const markPassedBtn = student.enrollment_status === "enrolled" && student.selected_degree !== "N/A"
                    ? '<br><button class="btn btn-sm admin-mark-passed-btn" style="margin-top:5px;" ' +
                    'onclick="markSemesterPassed(' + student.id + ', ' + enrolledSem + ', \'' + student.full_name.replace(/'/g, "\\'") + '\')">' +
                    'Mark Sem ' + enrolledSem + ' Passed</button>'
                    : "";

                const semesterCell =
                    '<div style="font-size:12px;line-height:1.9;">' +
                    passedPills + (passedPills && eligiblePill ? " " : "") + eligiblePill +
                    markPassedBtn +
                    '</div>';

                // Build course detail rows
                const courseDetailRows = student.courses.map(function (c) {
                    return '<div class="enrollment-course-item">' +
                        '<span class="course-code" style="font-size:11px;padding:3px 8px">' + c.code + '</span>' +
                        '<span class="enrollment-course-name">' + c.name + '</span>' +
                        '<span class="enrollment-course-meta">' + c.semester + ' · ' + c.credits + ' credits · ' + c.time + '</span>' +
                        '</div>';
                }).join("");

                return '<tr data-status="' + student.enrollment_status + '" ' +
                    'data-search="' + student.full_name.toLowerCase() + ' ' + student.student_id.toLowerCase() + '">' +
                    '<td><strong>' + student.full_name + '</strong><br>' +
                    '<small style="color:#888">' + student.email + '</small></td>' +
                    '<td>' + student.student_id + '</td>' +
                    '<td>' + degreeDisplay + '</td>' +
                    '<td>' + courseCell + '</td>' +
                    '<td><span class="admin-status ' + statusClass + '">' + statusText + '</span></td>' +
                    '<td>' + semesterCell + '</td>' +
                    '</tr>' +
                    '<tr class="enrollment-courses-row" style="display:none;">' +
                    '<td colspan="6" style="padding:0">' +
                    '<div class="enrollment-courses-detail">' +
                    '<p class="enrollment-courses-heading">Enrolled courses for <strong>' + student.full_name + '</strong></p>' +
                    (courseDetailRows || '<p style="color:#aaa;margin:0">No courses selected.</p>') +
                    '</div></td></tr>';
            }).join("");
        })
        .catch(function (err) {
            console.log("Failed to load enrollments:", err);
            const tbody = document.getElementById("enrollment-table-body");
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="admin-empty-row">Failed to load enrollment data.</td></tr>';
        });
}

function toggleCourseDetails(btn) {
    const parentRow = btn.closest("tr");
    const detailRow = parentRow.nextElementSibling;
    const icon = btn.querySelector(".expand-icon");

    if (!detailRow || !detailRow.classList.contains("enrollment-courses-row")) return;

    const isVisible = detailRow.style.display !== "none";
    detailRow.style.display = isVisible ? "none" : "table-row";
    icon.textContent = isVisible ? "▼" : "▲";
    btn.classList.toggle("enrollment-expand-btn--active", !isVisible);
}

function filterEnrollmentTable() {
    const search = (document.getElementById("enrollment-search").value || "").toLowerCase();
    const statusFilter = document.getElementById("enrollment-status-filter").value;
    const rows = document.querySelectorAll("#enrollment-table-body tr[data-status]");

    rows.forEach(function (row) {
        const matchesSearch = !search || row.dataset.search.includes(search);
        const matchesStatus = statusFilter === "all" || row.dataset.status === statusFilter;
        row.style.display = (matchesSearch && matchesStatus) ? "" : "none";
    });
}

// ADMIN — Course Management

let allCoursesAdmin = [];
let editingCourseId = null;

function loadCourseManagement() {
    // Preserve current filter selections before reloading
    const degreeFilterEl = document.getElementById("course-degree-filter");
    const semesterFilterEl = document.getElementById("course-semester-filter");
    const currentDegree = degreeFilterEl ? degreeFilterEl.value : "";
    const currentSemester = semesterFilterEl ? semesterFilterEl.value : "";

    fetch("/api/admin/course-stats")
        .then(r => r.json())
        .then(function (data) {
            allCoursesAdmin = data.courses || [];

            // Rebuild degree dropdown, restoring previous selection
            if (degreeFilterEl) {
                const degrees = [...new Set(allCoursesAdmin.map(c => c.degree))].sort();
                degreeFilterEl.innerHTML =
                    '<option value="">All degrees</option>' +
                    degrees.map(d => `<option value="${d}">${d}</option>`).join("");
                degreeFilterEl.value = currentDegree;
            }

            // Rebuild semester dropdown, restoring previous selection
            if (semesterFilterEl) {
                const semesters = [...new Set(allCoursesAdmin.map(c => c.semester))].sort(function(a, b) {
                    return parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, ""));
                });
                semesterFilterEl.innerHTML =
                    '<option value="">All semesters</option>' +
                    semesters.map(s => `<option value="${s}">Semester ${s.replace(/\D/g, "")}</option>`).join("");
                semesterFilterEl.value = currentSemester;
            }

            // Re-apply the current filters — shows updated data in place
            filterCourseTable();
        })
        .catch(function (err) {
            console.log("Failed to load courses:", err);
            const tbody = document.getElementById("course-mgmt-tbody");
            if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="admin-empty-row">Failed to load course data.</td></tr>';
        });
}

function renderCourseTable(courses) {
    const tbody = document.getElementById("course-mgmt-tbody");
    if (!tbody) return;

    // null means no filter selected yet — show placeholder
    if (courses === null) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="admin-empty-row" style="padding: 28px 0;">
                    <span style="font-size:1.5rem">🎓</span><br>
                    Select a degree or semester above to view courses.
                </td>
            </tr>`;
        return;
    }

    if (courses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="admin-empty-row">No courses match your filters.</td></tr>';
        return;
    }

    tbody.innerHTML = courses.map(function (course) {
        const semLabel = "Sem " + course.semester.replace("semester", "");
        return `<tr>
            <td><span class="course-code" style="font-size:12px;padding:4px 10px">${course.code}</span></td>
            <td>${course.name}</td>
            <td><small>${course.degree}</small></td>
            <td>${course.credits}</td>
            <td><small>${course.time}</small></td>
            <td>${semLabel}</td>
            <td><strong>${course.enrollment_count}</strong></td>
            <td class="admin-action-cell">
                <button type="button" class="btn btn-sm dashboard-btn-secondary"
                    onclick="showEditCourse(${course.id})">Edit</button>
                <button type="button" class="btn btn-sm admin-btn-danger"
                    onclick="deleteCourseAdmin(${course.id}, '${course.code}')">Delete</button>
            </td>
        </tr>`;
    }).join("");
}

// It updates the semester dropdown to only show semesters relevant to
// the currently selected degree.

function filterCourseTable() {
    const search = (document.getElementById("course-mgmt-search").value || "").toLowerCase();
    const degreeFilter = document.getElementById("course-degree-filter").value;
    const semesterFilterEl = document.getElementById("course-semester-filter");

    // Rebuild semester options based on the selected degree
    if (semesterFilterEl) {
        const relevantCourses = degreeFilter
            ? allCoursesAdmin.filter(c => c.degree === degreeFilter)
            : allCoursesAdmin;

        const semesters = [...new Set(relevantCourses.map(c => c.semester))].sort(function (a, b) {
            return parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, ""));
        });

        const prevVal = semesterFilterEl.value;
        semesterFilterEl.innerHTML =
            '<option value="">All semesters</option>' +
            semesters.map(s => `<option value="${s}">Semester ${s.replace(/\D/g, "")}</option>`).join("");

        // Restore previous selection if it still applies to the new degree
        if (semesters.includes(prevVal)) {
            semesterFilterEl.value = prevVal;
        }
    }

    const semesterValue = semesterFilterEl ? semesterFilterEl.value : "";

    // Show placeholder if nothing is selected at all
    if (!search && !degreeFilter && !semesterValue) {
        renderCourseTable(null);
        return;
    }

    const filtered = allCoursesAdmin.filter(function (c) {
        const matchesSearch = !search ||
            c.code.toLowerCase().includes(search) ||
            c.name.toLowerCase().includes(search);
        const matchesDegree = !degreeFilter || c.degree === degreeFilter;
        const matchesSemester = !semesterValue || c.semester === semesterValue;
        return matchesSearch && matchesDegree && matchesSemester;
    });

    renderCourseTable(filtered);
}

function toggleAddCourseForm() {
    const form = document.getElementById("add-course-form");
    if (!form) return;

    const isVisible = form.style.display !== "none";
    form.style.display = isVisible ? "none" : "block";

    if (!isVisible) {
        // Clear fields
        ["new-course-code", "new-course-name", "new-course-credits",
         "new-course-time", "new-course-degree"].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });
        const msg = document.getElementById("add-course-message");
        if (msg) { msg.textContent = ""; msg.style.display = "none"; }
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function addCourseAdmin() {
    const code    = (document.getElementById("new-course-code").value || "").trim();
    const name    = (document.getElementById("new-course-name").value || "").trim();
    const credits = (document.getElementById("new-course-credits").value || "").trim();
    const time    = (document.getElementById("new-course-time").value || "").trim();
    const semester = document.getElementById("new-course-semester").value;
    const degree  = (document.getElementById("new-course-degree").value || "").trim();
    const msg     = document.getElementById("add-course-message");

    if (!code || !name || !credits || !time || !degree) {
        showFormMessage(msg, "Please fill in all fields.", "error");
        return;
    }

    fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, credits: parseInt(credits), time, semester, degree }),
    })
        .then(r => r.json())
        .then(function (data) {
            if (data.error) {
                showFormMessage(msg, data.error, "error");
                return;
            }
            showFormMessage(msg, "Course added successfully!", "success");
            loadCourseManagement();
            setTimeout(toggleAddCourseForm, 1500);
        })
        .catch(function () {
            showFormMessage(msg, "Something went wrong. Please try again.", "error");
        });
}

function showEditCourse(courseId) {
    const course = allCoursesAdmin.find(c => c.id === courseId);
    if (!course) return;

    editingCourseId = courseId;

    document.getElementById("edit-course-name").value     = course.name;
    document.getElementById("edit-course-credits").value  = course.credits;
    document.getElementById("edit-course-time").value     = course.time;
    document.getElementById("edit-course-semester").value = course.semester;
    document.getElementById("edit-course-degree").value   = course.degree;
    document.getElementById("edit-course-title").textContent = "Editing: " + course.code;

    const msg = document.getElementById("edit-course-message");
    if (msg) { msg.textContent = ""; msg.style.display = "none"; }

    const form = document.getElementById("edit-course-form");
    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelEditCourse() {
    editingCourseId = null;
    document.getElementById("edit-course-form").style.display = "none";
}

function saveCourseEdit() {
    if (!editingCourseId) return;

    const name     = (document.getElementById("edit-course-name").value || "").trim();
    const credits  = (document.getElementById("edit-course-credits").value || "").trim();
    const time     = (document.getElementById("edit-course-time").value || "").trim();
    const semester = document.getElementById("edit-course-semester").value;
    const degree   = (document.getElementById("edit-course-degree").value || "").trim();
    const msg      = document.getElementById("edit-course-message");

    if (!name || !credits || !time || !degree) {
        showFormMessage(msg, "Please fill in all fields.", "error");
        return;
    }

    fetch("/api/admin/courses/" + editingCourseId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, credits: parseInt(credits), time, semester, degree }),
    })
        .then(r => r.json())
        .then(function (data) {
            if (data.error) {
                showFormMessage(msg, data.error, "error");
                return;
            }
            showFormMessage(msg, "Course updated successfully!", "success");
            loadCourseManagement();
            setTimeout(cancelEditCourse, 1200);
        })
        .catch(function () {
            showFormMessage(msg, "Something went wrong. Please try again.", "error");
        });
}

function deleteCourseAdmin(courseId, courseCode) {
    if (!confirm("Delete " + courseCode + "? This will also remove all student selections for this course.")) return;

    fetch("/api/admin/courses/" + courseId, { method: "DELETE" })
        .then(r => r.json())
        .then(function (data) {
            alert(data.message || "Course deleted.");
            loadCourseManagement();
        })
        .catch(function (err) {
            console.log("Delete failed:", err);
        });
}

// Shared helper for inline form messages
function showFormMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.style.color = type === "error" ? "#d9534f" : "#2f7a47";
    el.style.display = "block";
}

document.addEventListener("DOMContentLoaded", function () {
    applySavedTheme();

    Promise.all([
        loadCoursesFromBackend(),
        loadSelectedCoursesFromBackend(),
    ]).then(function () {
        restoreCourseSelectionForm();
        loadDashboardStats();
        updateSemesterEligibilityBanner();
        applyDegreeLockState();
    });

    if (document.getElementById("enrollment-table-body")) {
        loadEnrollmentOverview();
    }

    if (document.getElementById("course-mgmt-tbody")) {
        loadCourseManagement();
    }
});