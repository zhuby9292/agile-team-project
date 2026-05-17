import json
import os
import re
import random
from datetime import datetime, timedelta
from functools import wraps
from flask_mail import Mail, Message
from dotenv import load_dotenv
load_dotenv()

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
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///course_planner.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["BABEL_DEFAULT_LOCALE"] = "en"
app.config["LANGUAGES"] = {
    "en": "English",
    "zh": "中文",
}

app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = 'kumar.aneesh71098@gmail.com'
app.config["MAIL_PASSWORD"] = 'kkna wewv svyg xcwo'
app.config["MAIL_DEFAULT_SENDER"] = "kumar.aneesh71098@gmail.com"

mail = Mail(app)


def get_locale():
    return session.get("language", "en")


db = SQLAlchemy(app)

babel = Babel(app, locale_selector=get_locale)
app.jinja_env.globals["_"] = gettext

login_manager = LoginManager(app)
login_manager.login_view = "index"
login_manager.login_message = "Please sign in to access this page."
login_manager.login_message_category = "error"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Admin(UserMixin, db.Model):
    """Separate admin accounts — completely independent from student User records."""
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    def get_id(self):
        return f"a_{self.id}"


class User(UserMixin, db.Model):
    """Student accounts only."""
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    student_id = db.Column(db.String(30), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    selected_degree = db.Column(db.String(120), nullable=True)
    enrollment_status = db.Column(db.String(20), default="planning")
    # Values: 'planning' | 'enrolled' | 'change_requested'
    reset_code = db.Column(db.String(4), nullable=True)
    reset_code_expires_at = db.Column(db.DateTime, nullable=True)

    def get_id(self):
        return f"u_{self.id}"


class SemesterPass(db.Model):
    """
    Records that a student has passed a specific semester for a degree.
    Created by admin via POST /api/admin/mark-semester-passed/<user_id>.

    Semester 1 is open by default (no pass record needed).
    To enrol in Semester N, the student must have a SemesterPass for Semester N-1.
    """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    degree = db.Column(db.String(120), nullable=False)
    semester_number = db.Column(db.Integer, nullable=False)
    passed_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="semester_passes")


class EnrollmentChangeRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    requested_degree = db.Column(db.String(120), nullable=False)
    requested_course_codes = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default="pending")
    # Values: 'pending' | 'approved' | 'rejected'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", backref="change_requests")


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


# ---------------------------------------------------------------------------
# Semester progression helpers
# ---------------------------------------------------------------------------

def semester_key_to_number(semester_key):
    """Converts values like 'semester1' or 'Semester 1' into integer 1."""
    if semester_key is None:
        return None

    match = re.search(r"\d+", str(semester_key))
    return int(match.group()) if match else None


def get_passed_semester_numbers_for_degree(user, degree):
    """Returns sorted passed semester numbers for this exact user + degree."""
    if not user or not degree:
        return []

    passes = SemesterPass.query.filter_by(
        user_id=user.id,
        degree=degree,
    ).all()

    return sorted({p.semester_number for p in passes})


def get_eligible_semester_number_for_degree(user, degree):
    """
    Returns the semester number the student is eligible to enrol in for the
    requested degree.

    Important:
    We pass degree into this function instead of always using
    user.selected_degree. This prevents students from bypassing semester rules
    by submitting courses for another degree.
    """
    passed = get_passed_semester_numbers_for_degree(user, degree)
    return (max(passed) + 1) if passed else 1


def get_eligible_semester_number(user):
    """Returns eligibility for the user's currently stored selected degree."""
    return get_eligible_semester_number_for_degree(user, user.selected_degree)


def get_passed_semester_numbers(user):
    """Returns passed semesters for the user's currently stored selected degree."""
    return get_passed_semester_numbers_for_degree(user, user.selected_degree)


def validate_semester_selection(
    user,
    requested_degree,
    course_codes,
    allow_empty=False,
    allow_degree_change=False,
):
    """
    Central backend enforcement for semester progression.

    Rules enforced here:
      - degree is required when courses are being saved/confirmed
      - course codes must exist
      - courses must belong to the requested degree
      - all selected courses must be from one semester only
      - selected semester must equal the eligible semester for the requested degree
      - after a pass exists in the current degree, direct degree switching is blocked
    """
    requested_degree = (requested_degree or "").strip()
    course_codes = course_codes or []

    if not requested_degree:
        return None, "Please select a degree before saving courses."

    if not course_codes and not allow_empty:
        return None, "Please select at least one course."

    current_degree = user.selected_degree or ""
    current_degree_passes = get_passed_semester_numbers_for_degree(user, current_degree)

    if (
        current_degree
        and requested_degree != current_degree
        and current_degree_passes
        and not allow_degree_change
    ):
        return None, (
            "Your degree is locked because you have already passed at least one semester. "
            "Please use the change request flow for admin approval."
        )

    eligible_semester = get_eligible_semester_number_for_degree(user, requested_degree)
    passed_semesters = get_passed_semester_numbers_for_degree(user, requested_degree)

    selected_semesters = set()
    valid_courses = []

    for code in course_codes:
        course = Course.query.filter_by(code=code).first()

        if not course:
            return None, f"Course {code} was not found."

        if course.degree != requested_degree:
            return None, f"Course {course.code} does not belong to {requested_degree}."

        semester_number = semester_key_to_number(course.semester)

        if semester_number in passed_semesters:
            return None, f"Semester {semester_number} has already been passed."

        if semester_number != eligible_semester:
            return None, (
                f"Semester {semester_number} is locked. "
                f"You are currently eligible to enrol in Semester {eligible_semester}."
            )

        selected_semesters.add(semester_number)
        valid_courses.append(course)

    if len(selected_semesters) > 1:
        return None, "Please select courses from one semester only."

    return {
        "courses": valid_courses,
        "eligible_semester": eligible_semester,
        "passed_semesters": passed_semesters,
    }, None

# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------

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


def seed_admin():
    if Admin.query.first():
        return

    admin = Admin(
        full_name="System Admin",
        email="admin@uniplanner.com",
        password_hash=generate_password_hash("admin123"),
    )

    db.session.add(admin)
    db.session.commit()
    print("Default admin created: admin@uniplanner.com / admin123")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

@login_manager.user_loader
def load_user(user_id):
    if str(user_id).startswith("a_"):
        return Admin.query.get(int(user_id[2:]))
    if str(user_id).startswith("u_"):
        return User.query.get(int(user_id[2:]))
    return User.query.get(int(user_id))


def is_admin_user(user):
    if not user.is_authenticated:
        return False
    return isinstance(user, Admin)


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


# ---------------------------------------------------------------------------
# Language
# ---------------------------------------------------------------------------

@app.route("/set-language/<language>")
def set_language(language):
    if language in app.config["LANGUAGES"]:
        session["language"] = language
    return redirect(request.referrer or url_for("index"))


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not email or not password:
            flash(gettext("Please enter both your email address and password."), "error")
            return redirect(url_for("index"))

        if Admin.query.filter_by(email=email).first():
            flash(gettext("Please use the admin login page for administrator access."), "error")
            return redirect(url_for("admin_login"))

        user = User.query.filter_by(email=email).first()

        if not user:
            flash(gettext("No account found with this email address."), "error")
            return redirect(url_for("index"))

        if not check_password_hash(user.password_hash, password):
            flash(gettext("Incorrect password. Please try again."), "error")
            return redirect(url_for("index"))

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

        admin = Admin.query.filter_by(email=email).first()

        if not admin:
            flash(gettext("No admin account found with this email address."), "error")
            return redirect(url_for("admin_login"))

        if not check_password_hash(admin.password_hash, password):
            flash(gettext("Incorrect admin password. Please try again."), "error")
            return redirect(url_for("admin_login"))

        login_user(admin)
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

        if not re.match(r"^[1-9][0-9]{7}$", student_id):
            flash(gettext("Student ID must be exactly 8 digits and cannot start with zero."), "error")
            return redirect(url_for("signup"))

        if password != confirm_password:
            flash(gettext("Passwords do not match."), "error")
            return redirect(url_for("signup"))

        if len(password) < 6:
            flash(gettext("Password must be at least 6 characters long."), "error")
            return redirect(url_for("signup"))

        if User.query.filter_by(email=email).first():
            flash(gettext("An account with this email already exists."), "error")
            return redirect(url_for("signup"))

        if User.query.filter_by(student_id=student_id).first():
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


# ---------------------------------------------------------------------------
# Student page routes
# ---------------------------------------------------------------------------

@app.route("/homepage.html")
@student_required
def homepage():
    return render_template("homepage.html", current_user=current_user)


@app.route("/course-selection.html")
@student_required
def course_selection():
    return render_template("course-selection.html", current_user=current_user)


@app.route("/timetable.html")
@student_required
def timetable():
    return render_template("timetable.html", current_user=current_user)


# ---------------------------------------------------------------------------
# Student API
# ---------------------------------------------------------------------------

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


@app.route("/api/selected-courses")
@student_required
def api_selected_courses():
    selections = Selection.query.filter_by(user_id=current_user.id).all()

    selected_degree = current_user.selected_degree or ""

    if not selected_degree and selections:
        selected_degree = selections[0].course.degree

    eligible_semester = get_eligible_semester_number_for_degree(
        current_user,
        selected_degree,
    )

    passed_semesters = get_passed_semester_numbers_for_degree(
        current_user,
        selected_degree,
    )

    return {
        "degree": selected_degree,
        "degree_locked": bool(selected_degree and passed_semesters),
        "enrollment_status": current_user.enrollment_status or "planning",
        "eligible_semester": eligible_semester,
        "passed_semesters": passed_semesters,
        "courses": [
            {
                "code": s.course.code,
                "name": s.course.name,
                "credits": s.course.credits,
                "time": s.course.time,
                "semester": s.course.semester,
                "degree": s.course.degree,
                "stream": s.course.degree,
            }
            for s in selections
        ],
    }


@app.route("/api/save-selection", methods=["POST"])
@student_required
def save_selection():
    if current_user.enrollment_status in ("enrolled", "change_requested"):
        return {"error": "Already enrolled. Submit a change request to make changes."}, 403

    data = request.get_json() or {}

    course_codes = data.get("courses", [])
    requested_degree = data.get("degree", "")

    validation, error = validate_semester_selection(
        current_user,
        requested_degree,
        course_codes,
        allow_empty=True,
        allow_degree_change=False,
    )

    if error:
        return {"error": error}, 403

    Selection.query.filter_by(user_id=current_user.id).delete()

    for course in validation["courses"]:
        db.session.add(
            Selection(
                user_id=current_user.id,
                course_id=course.id,
            )
        )

    current_user.selected_degree = requested_degree

    db.session.commit()

    return {
        "message": "Selection saved.",
        "eligible_semester": validation["eligible_semester"],
        "passed_semesters": validation["passed_semesters"],
    }


@app.route("/api/confirm-enrollment", methods=["POST"])
@student_required
def confirm_enrollment():
    if current_user.enrollment_status == "enrolled":
        return {"error": "Already enrolled."}, 400

    if current_user.enrollment_status == "change_requested":
        return {"error": "A change request is already pending approval."}, 400

    data = request.get_json(silent=True) or {}

    requested_degree = (
        data.get("degree")
        or current_user.selected_degree
        or ""
    ).strip()

    submitted_codes = data.get("courses")

    if submitted_codes is None:
        selections = Selection.query.filter_by(user_id=current_user.id).all()
        submitted_codes = [selection.course.code for selection in selections]

    validation, error = validate_semester_selection(
        current_user,
        requested_degree,
        submitted_codes,
        allow_empty=False,
        allow_degree_change=False,
    )

    if error:
        return {"error": error}, 403

    Selection.query.filter_by(user_id=current_user.id).delete()

    for course in validation["courses"]:
        db.session.add(
            Selection(
                user_id=current_user.id,
                course_id=course.id,
            )
        )

    current_user.selected_degree = requested_degree
    current_user.enrollment_status = "enrolled"

    db.session.commit()

    return {
        "message": "Enrollment confirmed! Changes now require admin approval.",
        "eligible_semester": validation["eligible_semester"],
        "passed_semesters": validation["passed_semesters"],
    }


@app.route("/api/request-change", methods=["POST"])
@student_required
def request_change():
    if current_user.enrollment_status != "enrolled":
        return {"error": "You must be enrolled before submitting a change request."}, 400

    existing_pending = EnrollmentChangeRequest.query.filter_by(
        user_id=current_user.id,
        status="pending",
    ).first()

    if existing_pending:
        return {"error": "You already have a pending change request."}, 400

    data = request.get_json() or {}

    requested_degree = data.get("degree", "")
    requested_courses = data.get("courses", [])

    validation, error = validate_semester_selection(
        current_user,
        requested_degree,
        requested_courses,
        allow_empty=False,
        allow_degree_change=True,
    )

    if error:
        return {"error": error}, 403

    change_req = EnrollmentChangeRequest(
        user_id=current_user.id,
        requested_degree=requested_degree,
        requested_course_codes=json.dumps(
            [course.code for course in validation["courses"]]
        ),
    )

    current_user.enrollment_status = "change_requested"

    db.session.add(change_req)
    db.session.commit()

    return {"message": "Change request submitted. Awaiting admin approval."}


# ---------------------------------------------------------------------------
# Admin API — change requests
# ---------------------------------------------------------------------------

@app.route("/api/admin/approve-change/<int:request_id>", methods=["POST"])
@admin_required
def approve_change(request_id):
    req = EnrollmentChangeRequest.query.get_or_404(request_id)
    user = User.query.get_or_404(req.user_id)

    requested_courses = json.loads(req.requested_course_codes)

    validation, error = validate_semester_selection(
        user,
        req.requested_degree,
        requested_courses,
        allow_empty=False,
        allow_degree_change=True,
    )

    if error:
        return {"error": error}, 403

    Selection.query.filter_by(user_id=user.id).delete()

    for course in validation["courses"]:
        db.session.add(
            Selection(
                user_id=user.id,
                course_id=course.id,
            )
        )

    user.selected_degree = req.requested_degree
    user.enrollment_status = "enrolled"

    req.status = "approved"
    req.reviewed_at = datetime.utcnow()

    db.session.commit()

    return {"message": "Change approved and applied."}


@app.route("/api/admin/reject-change/<int:request_id>", methods=["POST"])
@admin_required
def reject_change(request_id):
    req = EnrollmentChangeRequest.query.get_or_404(request_id)

    req.user.enrollment_status = "enrolled"
    req.status = "rejected"
    req.reviewed_at = datetime.utcnow()

    db.session.commit()
    return {"message": "Change request rejected."}


# ---------------------------------------------------------------------------
# Admin API — semester progression
# ---------------------------------------------------------------------------

@app.route("/api/admin/mark-semester-passed/<int:user_id>", methods=["POST"])
@admin_required
def mark_semester_passed(user_id):
    """
    Admin marks the currently enrolled semester as passed.

    Effects:
      - creates SemesterPass(user_id, degree, semester_number)
      - clears current Selection rows
      - resets enrollment_status to planning
      - preserves selected_degree so the student's degree remains pre-selected
    """
    user = User.query.get_or_404(user_id)

    data = request.get_json() or {}
    semester_number = data.get("semester_number")

    if not user.selected_degree:
        return {"error": "Student has not selected a degree yet."}, 400

    if user.enrollment_status != "enrolled":
        return {
            "error": "Student must be enrolled before a semester can be marked as passed."
        }, 400

    selections = Selection.query.filter_by(user_id=user.id).all()

    if not selections:
        return {"error": "Student has no enrolled course selections to pass."}, 400

    enrolled_semesters = {
        semester_key_to_number(selection.course.semester)
        for selection in selections
    }

    if len(enrolled_semesters) != 1:
        return {
            "error": "Student selections must belong to one semester before marking passed."
        }, 400

    enrolled_semester = enrolled_semesters.pop()

    if semester_number is not None and int(semester_number) != enrolled_semester:
        return {
            "error": f"Student is enrolled in Semester {enrolled_semester}, not Semester {semester_number}."
        }, 400

    existing = SemesterPass.query.filter_by(
        user_id=user.id,
        degree=user.selected_degree,
        semester_number=enrolled_semester,
    ).first()

    if existing:
        return {
            "error": f"Semester {enrolled_semester} is already marked as passed for this student."
        }, 400

    semester_pass = SemesterPass(
        user_id=user.id,
        degree=user.selected_degree,
        semester_number=enrolled_semester,
    )

    db.session.add(semester_pass)

    Selection.query.filter_by(user_id=user.id).delete()

    user.enrollment_status = "planning"

    db.session.commit()

    next_semester = enrolled_semester + 1

    return {
        "message": (
            f"Semester {enrolled_semester} marked as passed for {user.full_name}. "
            f"They are now eligible to enrol in Semester {next_semester}."
        ),
        "passed_semester": enrolled_semester,
        "next_eligible_semester": next_semester,
    }


# ---------------------------------------------------------------------------
# Admin API — enrollment overview
# ---------------------------------------------------------------------------

@app.route("/api/admin/enrollments")
@admin_required
def api_admin_enrollments():
    users = User.query.order_by(User.id.desc()).all()
    result = []

    for user in users:
        selections = Selection.query.filter_by(user_id=user.id).all()
        eligible_semester = get_eligible_semester_number(user)
        passed_semesters = get_passed_semester_numbers(user)

        selected_semesters = sorted({
            semester_key_to_number(s.course.semester)
            for s in selections
        })

        enrolled_semester = selected_semesters[0] if len(selected_semesters) == 1 else None

        result.append({
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "student_id": user.student_id,
            "enrollment_status": user.enrollment_status or "planning",
            "selected_degree": user.selected_degree or "N/A",
            "course_count": len(selections),
            "eligible_semester": eligible_semester,
            "enrolled_semester": enrolled_semester,
            "passed_semesters": passed_semesters,
            "courses": [
                {
                    "code": s.course.code,
                    "name": s.course.name,
                    "semester": s.course.semester.replace("semester", "Semester "),
                    "credits": s.course.credits,
                    "time": s.course.time,
                }
                for s in selections
            ],
        })

    return {"enrollments": result}


# ---------------------------------------------------------------------------
# Admin API — course stats + CRUD
# ---------------------------------------------------------------------------

@app.route("/api/admin/course-stats")
@admin_required
def api_admin_course_stats():
    courses = Course.query.order_by(Course.degree, Course.code).all()
    result = []

    for course in courses:
        count = Selection.query.filter_by(course_id=course.id).count()

        result.append({
            "id": course.id,
            "code": course.code,
            "name": course.name,
            "credits": course.credits,
            "time": course.time,
            "semester": course.semester,
            "degree": course.degree,
            "enrollment_count": count,
        })

    return {"courses": result}


@app.route("/api/admin/courses", methods=["POST"])
@admin_required
def api_admin_add_course():
    data = request.get_json() or {}

    required = ["code", "name", "credits", "time", "semester", "degree"]

    if not all(data.get(f) for f in required):
        return {"error": "All fields are required."}, 400

    if Course.query.filter_by(code=data["code"].upper()).first():
        return {"error": f"Course code {data['code']} already exists."}, 400

    course = Course(
        code=data["code"].upper(),
        name=data["name"],
        credits=int(data["credits"]),
        time=data["time"],
        semester=data["semester"],
        degree=data["degree"],
    )

    db.session.add(course)
    db.session.commit()

    return {"message": "Course added successfully.", "id": course.id}, 201


@app.route("/api/admin/courses/<int:course_id>", methods=["PUT"])
@admin_required
def api_admin_edit_course(course_id):
    course = Course.query.get_or_404(course_id)
    data = request.get_json() or {}

    course.name = data.get("name", course.name)
    course.credits = int(data.get("credits", course.credits))
    course.time = data.get("time", course.time)
    course.semester = data.get("semester", course.semester)
    course.degree = data.get("degree", course.degree)

    db.session.commit()
    return {"message": "Course updated successfully."}


@app.route("/api/admin/courses/<int:course_id>", methods=["DELETE"])
@admin_required
def api_admin_delete_course(course_id):
    course = Course.query.get_or_404(course_id)
    selection_count = Selection.query.filter_by(course_id=course_id).count()

    Selection.query.filter_by(course_id=course_id).delete()

    db.session.delete(course)
    db.session.commit()

    return {"message": f"Course deleted. {selection_count} student selection(s) also removed."}


# ---------------------------------------------------------------------------
# Admin dashboard route
# ---------------------------------------------------------------------------

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
            "enrollment_status": user.enrollment_status or "planning",
            "status": "Active" if selected_count > 0 else "No selections",
        })

    popular_courses = (
        db.session.query(
            Course.code,
            Course.name,
            db.func.count(Selection.id).label("selection_count"),
        )
        .join(Selection, Selection.course_id == Course.id)
        .group_by(Course.id, Course.code, Course.name)
        .order_by(db.func.count(Selection.id).desc())
        .limit(5)
        .all()
    )

    pending_req_records = EnrollmentChangeRequest.query.filter_by(status="pending").all()
    pending_change_count = len(pending_req_records)
    pending_changes = []

    for req in pending_req_records:
        course_codes = json.loads(req.requested_course_codes)

        pending_changes.append({
            "id": req.id,
            "student_name": req.user.full_name,
            "student_id": req.user.student_id,
            "email": req.user.email,
            "current_degree": req.user.selected_degree or "N/A",
            "requested_degree": req.requested_degree,
            "course_count": len(course_codes),
            "requested_courses": course_codes,
            "created_at": req.created_at.strftime("%d %b %Y, %H:%M") if req.created_at else "N/A",
        })

    return render_template(
        "admin-dashboard.html",
        current_user=current_user,
        total_users=total_users,
        total_courses=total_courses,
        total_selections=total_selections,
        timetables_created=timetables_created,
        recent_users=recent_users,
        popular_courses=popular_courses,
        pending_changes=pending_changes,
        pending_change_count=pending_change_count,
    )


# ---------------------------------------------------------------------------
# Password reset routes
# ---------------------------------------------------------------------------

@app.route("/forgot-password")
def forgot_password():
    return render_template("forgot-password.html")


@app.route("/reset-password")
def reset_password():
    return render_template("reset-password.html")


@app.route("/api/send-reset-code", methods=["POST"])
def send_reset_code():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return {"error": "Please enter your email address."}, 400

    user = User.query.filter_by(email=email).first()

    if not user:
        return {"error": "No student account found with this email address."}, 404

    code = str(random.randint(1000, 9999))

    user.reset_code = code
    user.reset_code_expires_at = datetime.utcnow() + timedelta(minutes=30)

    db.session.commit()

    message = Message(
        subject="Your UniPlanner Password Reset Code",
        recipients=[email],
        body=f"Your UniPlanner password reset code is: {code}\n\nThis code will expire in 30 minutes."
    )

    mail.send(message)

    return {
        "message": "Verification code sent successfully.",
        "redirect": url_for("reset_password"),
    }


@app.route("/api/reset-password", methods=["POST"])
def reset_password_with_code():
    data = request.get_json() or {}

    email = data.get("email", "").strip().lower()
    code = data.get("code", "").strip()
    new_password = data.get("new_password", "")

    if not email or not code or not new_password:
        return {"error": "Please complete all fields."}, 400

    if len(new_password) < 6:
        return {"error": "Password must be at least 6 characters long."}, 400

    user = User.query.filter_by(email=email).first()

    if not user:
        return {"error": "No student account found with this email address."}, 404

    if not user.reset_code or not user.reset_code_expires_at:
        return {"error": "Please request a new verification code."}, 400

    if datetime.utcnow() > user.reset_code_expires_at:
        user.reset_code = None
        user.reset_code_expires_at = None
        db.session.commit()
        return {"error": "Verification code expired. Please request a new code."}, 400

    if user.reset_code != code:
        return {"error": "Invalid verification code."}, 400

    user.password_hash = generate_password_hash(new_password)
    user.reset_code = None
    user.reset_code_expires_at = None

    db.session.commit()

    return {
        "message": "Password reset successful.",
        "redirect": url_for("index"),
    }


# ---------------------------------------------------------------------------
# Misc routes
# ---------------------------------------------------------------------------

@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash(gettext("You have been logged out successfully."), "success")
    return redirect(url_for("index"))


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_courses()
        seed_admin()

    app.run(debug=True)