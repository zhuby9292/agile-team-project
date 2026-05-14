import json
import os
from functools import wraps

from flask import Flask, flash, redirect, render_template, request, session, url_for
from flask_babel import Babel, gettext
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

app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "temporary-development-secret-key")
app.config["ADMIN_EMAILS"] = os.environ.get("ADMIN_EMAILS", "admin@example.com")

# Basic SQLite database configuration.
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///course_planner.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["BABEL_DEFAULT_LOCALE"] = "en"
app.config["LANGUAGES"] = {
    "en": "English",
    "zh": "中文",
}


def get_locale():
    return session.get("language", "en")


db = SQLAlchemy(app)

babel = Babel(app, locale_selector=get_locale)
app.jinja_env.globals["_"] = gettext

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


class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    credits = db.Column(db.Integer, nullable=False)
    time = db.Column(db.String(80), nullable=False)
    semester = db.Column(db.String(20), nullable=False)
    degree = db.Column(db.String(120), nullable=False)


class Selection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)

    user = db.relationship("User", backref="selections")
    course = db.relationship("Course", backref="selections")


def seed_courses():
    if Course.query.first():
        return

    courses_file = os.path.join(app.root_path, "data", "courses.json")

    with open(courses_file, "r", encoding="utf-8") as file:
        course_data = json.load(file)

    courses = []

    for item in course_data:
        course = Course(
            code=item["code"],
            name=item["name"],
            credits=item["credits"],
            time=item["time"],
            semester=item["semester"],
            degree=item["degree"],
        )

        courses.append(course)

    db.session.add_all(courses)
    db.session.commit()


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


def admin_required(view_function):
    @wraps(view_function)
    @login_required
    def wrapped_view(*args, **kwargs):
        if not is_admin_user(current_user):
            flash(gettext("You do not have permission to access the admin dashboard."), "error")
            return redirect(url_for("homepage"))

        return view_function(*args, **kwargs)

    return wrapped_view


def student_required(view_function):
    @wraps(view_function)
    @login_required
    def wrapped_view(*args, **kwargs):
        if is_admin_user(current_user):
            return redirect(url_for("admin_dashboard"))

        return view_function(*args, **kwargs)

    return wrapped_view


@app.context_processor
def inject_admin_status():
    return {
        "is_admin": current_user.is_authenticated and is_admin_user(current_user)
    }


@app.route("/set-language/<language>")
def set_language(language):
    if language in app.config["LANGUAGES"]:
        session["language"] = language

    return redirect(request.referrer or url_for("index"))


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not email or not password:
            flash(gettext("Please enter both your email address and password."), "error")
            return redirect(url_for("index"))

        user = User.query.filter_by(email=email).first()

        if not user:
            flash(gettext("No account found with this email address."), "error")
            return redirect(url_for("index"))

        if not check_password_hash(user.password_hash, password):
            flash(gettext("Incorrect password. Please try again."), "error")
            return redirect(url_for("index"))

        if is_admin_user(user):
            flash(gettext("Please use the admin login page for administrator access."), "error")
            return redirect(url_for("admin_login"))

        login_user(user)
        flash(gettext("Signed in successfully."), "success")
        return redirect(url_for("homepage"))

    return render_template("index.html")


@app.route("/admin-login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not email or not password:
            flash(gettext("Please enter both your email address and password."), "error")
            return redirect(url_for("admin_login"))

        user = User.query.filter_by(email=email).first()

        if not user:
            flash(gettext("No admin account found with this email address."), "error")
            return redirect(url_for("admin_login"))

        if not check_password_hash(user.password_hash, password):
            flash(gettext("Incorrect admin password. Please try again."), "error")
            return redirect(url_for("admin_login"))

        if not is_admin_user(user):
            flash(gettext("This account does not have administrator access."), "error")
            return redirect(url_for("admin_login"))

        login_user(user)
        flash(gettext("Admin signed in successfully."), "success")
        return redirect(url_for("admin_dashboard"))

    return render_template("admin-login.html")


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
            flash(gettext("Please complete all registration fields."), "error")
            return redirect(url_for("signup"))

        if password != confirm_password:
            flash(gettext("Passwords do not match."), "error")
            return redirect(url_for("signup"))

        if len(password) < 6:
            flash(gettext("Password must be at least 6 characters long."), "error")
            return redirect(url_for("signup"))

        existing_email = User.query.filter_by(email=email).first()
        if existing_email:
            flash(gettext("An account with this email already exists."), "error")
            return redirect(url_for("signup"))

        existing_student_id = User.query.filter_by(student_id=student_id).first()
        if existing_student_id:
            flash(gettext("An account with this student ID already exists."), "error")
            return redirect(url_for("signup"))

        new_user = User(
            full_name=full_name,
            email=email,
            student_id=student_id,
            password_hash=generate_password_hash(password),
        )

        db.session.add(new_user)
        db.session.commit()

        flash(gettext("Account created successfully. Please sign in."), "success")
        return redirect(url_for("index"))

    return render_template("signup.html")


@app.route("/homepage.html")
@student_required
def homepage():
    return render_template("homepage.html", current_user=current_user)


@app.route("/course-selection.html")
@student_required
def course_selection():
    return render_template("course-selection.html", current_user=current_user)


@app.route("/api/courses")
@student_required
def api_courses():
    courses = Course.query.all()

    return {
        "courses": [
            {
                "id": course.id,
                "code": course.code,
                "name": course.name,
                "credits": course.credits,
                "time": course.time,
                "semester": course.semester,
                "degree": course.degree,
            }
            for course in courses
        ]
    }


@app.route("/api/save-selection", methods=["POST"])
@student_required
def save_selection():
    data = request.get_json()
    course_codes = data.get("courses", [])

    Selection.query.filter_by(user_id=current_user.id).delete()

    for course_code in course_codes:
        course = Course.query.filter_by(code=course_code).first()

        if course:
            selection = Selection(
                user_id=current_user.id,
                course_id=course.id
            )
            db.session.add(selection)

    db.session.commit()

    return {"message": "Selections saved successfully"}


@app.route("/timetable.html")
@student_required
def timetable():
    return render_template("timetable.html", current_user=current_user)


@app.route("/admin-dashboard.html")
@admin_required
def admin_dashboard():
    total_users = User.query.count()
    total_courses = Course.query.count()
    total_selections = Selection.query.count()
    timetables_created = db.session.query(Selection.user_id).distinct().count()

    recent_user_records = User.query.order_by(User.id.desc()).limit(5).all()
    recent_users = []

    for user in recent_user_records:
        selected_count = Selection.query.filter_by(user_id=user.id).count()

        recent_users.append({
            "full_name": user.full_name,
            "email": user.email,
            "student_id": user.student_id,
            "selected_count": selected_count,
            "status": "Active" if selected_count > 0 else "No selections",
        })

    popular_courses = (
        db.session.query(
            Course.code,
            Course.name,
            db.func.count(Selection.id).label("selection_count")
        )
        .join(Selection, Selection.course_id == Course.id)
        .group_by(Course.id, Course.code, Course.name)
        .order_by(db.func.count(Selection.id).desc())
        .limit(5)
        .all()
    )

    return render_template(
        "admin-dashboard.html",
        current_user=current_user,
        total_users=total_users,
        total_courses=total_courses,
        total_selections=total_selections,
        timetables_created=timetables_created,
        recent_users=recent_users,
        popular_courses=popular_courses,
    )

@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash(gettext("You have been logged out successfully."), "success")
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
        seed_courses()

    app.run(debug=True)