import os

from flask import Flask, flash, redirect, render_template, request, url_for
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)

# Secret key is required for flash messages and login sessions.
# It checks the SECRET_KEY environment variable first.
# If it does not exist, it uses a temporary development key.
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "temporary-development-secret-key")
app.config["ADMIN_EMAILS"] = os.environ.get("ADMIN_EMAILS", "admin@example.com")

# Basic SQLite database configuration.
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///course_planner.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

login_manager = LoginManager(app)
login_manager.login_view = "index"
login_manager.login_message = "Please sign in to access this page."
login_manager.login_message_category = "error"


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    student_id = db.Column(db.String(30), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def is_admin_user(user):
    admin_emails = {
        email.strip().lower()
        for email in app.config["ADMIN_EMAILS"].split(",")
        if email.strip()
    }

    return user.is_authenticated and user.email.lower() in admin_emails


@app.context_processor
def inject_admin_status():
    return {
        "is_admin": current_user.is_authenticated and is_admin_user(current_user)
    }


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not email or not password:
            flash("Please enter both your email address and password.", "error")
            return redirect(url_for("index"))

        user = User.query.filter_by(email=email).first()

        if not user:
            flash("No account found with this email address.", "error")
            return redirect(url_for("index"))

        if not check_password_hash(user.password_hash, password):
            flash("Incorrect password. Please try again.", "error")
            return redirect(url_for("index"))

        login_user(user)
        flash("Signed in successfully.", "success")
        return redirect(url_for("homepage"))

    return render_template("index.html")


@app.route("/index.html", methods=["GET", "POST"])
def index_html():
    return index()


@app.route("/signup.html", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").strip().lower()
        student_id = request.form.get("student_id", "").strip()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        if not full_name or not email or not student_id or not password or not confirm_password:
            flash("Please complete all registration fields.", "error")
            return redirect(url_for("signup"))

        if password != confirm_password:
            flash("Passwords do not match.", "error")
            return redirect(url_for("signup"))

        if len(password) < 6:
            flash("Password must be at least 6 characters long.", "error")
            return redirect(url_for("signup"))

        existing_email = User.query.filter_by(email=email).first()
        if existing_email:
            flash("An account with this email already exists.", "error")
            return redirect(url_for("signup"))

        existing_student_id = User.query.filter_by(student_id=student_id).first()
        if existing_student_id:
            flash("An account with this student ID already exists.", "error")
            return redirect(url_for("signup"))

        new_user = User(
            full_name=full_name,
            email=email,
            student_id=student_id,
            password_hash=generate_password_hash(password),
        )

        db.session.add(new_user)
        db.session.commit()

        flash("Account created successfully. Please sign in.", "success")
        return redirect(url_for("index"))

    return render_template("signup.html")


@app.route("/homepage.html")
@login_required
def homepage():
    return render_template("homepage.html", current_user=current_user)


@app.route("/course-selection.html")
@login_required
def course_selection():
    return render_template("course-selection.html", current_user=current_user)


@app.route("/timetable.html")
@login_required
def timetable():
    return render_template("timetable.html", current_user=current_user)


@app.route("/admin-dashboard.html")
@login_required
def admin_dashboard():
    if not is_admin_user(current_user):
        flash("You do not have permission to access the admin dashboard.", "error")
        return redirect(url_for("homepage"))

    return render_template("admin-dashboard.html", current_user=current_user)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out successfully.", "success")
    return redirect(url_for("index"))


@app.route("/forgot-password")
def forgot_password():
    return render_template("forgot-password.html")


@app.route("/reset-password")
def reset_password():
    return render_template("reset-password.html")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(debug=True)