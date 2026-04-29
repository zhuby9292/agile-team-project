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

// Shows a simple message when the user clicks the Sign Up button.
function goToSignUp() {
    alert("Sign up page is not created yet.");
    document.getElementById("signin-output").innerHTML =
        "Sign up page will be added later.";
    console.log("Sign up button clicked.");
}
function goToSignUp() {
    window.location.href = "signup.html";
}

function goToSignIn() {
    window.location.href = "index.html";
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

// Shows a dashboard message when the user clicks a dashboard action button.
function showDashboardMessage(message) {
    document.getElementById("dashboard-output").innerHTML = message;
    console.log("Dashboard action clicked: " + message);
}