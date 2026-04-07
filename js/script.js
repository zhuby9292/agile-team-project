function loginUser() {
    let email = document.getElementById("user-email").value;
    let password = document.getElementById("user-password").value;

    if (email === "" || password === "") {
        alert("Please enter both your email address and password.");
        document.getElementById("signin-output").innerHTML =
            "Sign in failed. Please complete all fields.";
    } else {
        alert("Login successful.");
        document.getElementById("signin-output").innerHTML =
            "You have signed in successfully.";
    }
}

function goToSignUp() {
    alert("Sign up page is not created yet.");
    document.getElementById("signin-output").innerHTML =
        "Sign up page will be added later.";
}