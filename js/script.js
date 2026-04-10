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

// Shows a dashboard message when the user clicks a dashboard action button.
function showDashboardMessage(message) {
    document.getElementById("dashboard-output").innerHTML = message;
    console.log("Dashboard action clicked: " + message);
}