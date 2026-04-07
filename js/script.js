// Checks the sign in form and shows a simple result.
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

// Shows a simple message for users who do not have an account yet.
function goToSignUp() {
    alert("Sign up page is not created yet.");
    document.getElementById("signin-output").innerHTML =
        "Redirect to sign up page will be added later.";
    console.log("Sign up button clicked.");
}