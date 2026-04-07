function loginUser() {
    let email = document.getElementById("user-email").value;
    let password = document.getElementById("user-password").value;

    if (email === "" || password === "") {
        alert("Please enter both your email address and password.");
        document.getElementById("signin-output").innerHTML =
            "Sign in failed. Please complete all fields.";
        console.log("Sign in failed: missing email or password.");
    } else {
        alert("Login successful.");
        document.getElementById("signin-output").innerHTML =
            "You have signed in successfully with email: " + email;
        console.log("User signed in with email: " + email);
    }
}

function goToSignUp() {
    alert("Sign up page is not created yet.");
    document.getElementById("signin-output").innerHTML =
        "Sign up page will be added later.";
    console.log("Sign up button clicked.");
}

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
        alert("Login successful.");
        console.log("User signed in with email: " + userEmail);
    }
}

// Shows a simple message when the user clicks the Sign Up button.
function goToSignUp() {
    alert("Sign up page is not created yet.");
    document.getElementById("signin-output").innerHTML =
        "Sign up page will be added later.";
    console.log("Sign up button clicked.");
}