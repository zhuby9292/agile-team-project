import os

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

    courses = [
    # Bachelor of Arts
    Course(code="ENGL1401", name="Narratives of Place", credits=6, time="Monday 10:00–12:00", semester="semester1", degree="Bachelor of Arts"),
    Course(code="HIST1001", name="Making History", credits=6, time="Tuesday 13:00–15:00", semester="semester1", degree="Bachelor of Arts"),
    Course(code="PHIL1002", name="Introduction to Critical Thinking", credits=6, time="Thursday 11:00–13:00", semester="semester1", degree="Bachelor of Arts"),
    Course(code="LING1001", name="Language and Communication", credits=6, time="Friday 09:00–11:00", semester="semester1", degree="Bachelor of Arts"),

    Course(code="ENGL2402", name="Modern Literature", credits=6, time="Monday 10:00–12:00", semester="semester1", degree="Bachelor of Arts"),
    Course(code="HIST2103", name="Global History", credits=6, time="Tuesday 14:00–16:00", semester="semester2", degree="Bachelor of Arts"),
    Course(code="PHIL2004", name="Ethics and Society", credits=6, time="Thursday 11:00–13:00", semester="semester2", degree="Bachelor of Arts"),
    Course(code="COMM2001", name="Digital Communication", credits=6, time="Friday 13:00–15:00", semester="semester2", degree="Bachelor of Arts"),

    # Bachelor of Commerce
    Course(code="ACCT1101", name="Financial Accounting", credits=6, time="Monday 09:00–11:00", semester="semester1", degree="Bachelor of Commerce"),
    Course(code="ECON1101", name="Microeconomics", credits=6, time="Wednesday 10:00–12:00", semester="semester1", degree="Bachelor of Commerce"),
    Course(code="MGMT1135", name="Organisational Behaviour", credits=6, time="Friday 12:00–14:00", semester="semester1", degree="Bachelor of Commerce"),
    Course(code="FNCE1001", name="Business Finance", credits=6, time="Monday 09:00–11:00", semester="semester1", degree="Bachelor of Commerce"),

    Course(code="ACCT2201", name="Management Accounting", credits=6, time="Tuesday 10:00–12:00", semester="semester2", degree="Bachelor of Commerce"),
    Course(code="ECON2202", name="Macroeconomics", credits=6, time="Wednesday 13:00–15:00", semester="semester2", degree="Bachelor of Commerce"),
    Course(code="MKTG1203", name="Marketing Principles", credits=6, time="Thursday 11:00–13:00", semester="semester2", degree="Bachelor of Commerce"),
    Course(code="MGMT2234", name="Business Strategy", credits=6, time="Tuesday 10:00–12:00", semester="semester2", degree="Bachelor of Commerce"),

    # Bachelor of Science
    Course(code="SCIE1106", name="Molecular Biology of the Cell", credits=6, time="Monday 14:00–16:00", semester="semester1", degree="Bachelor of Science"),
    Course(code="MATH1011", name="Mathematical Methods", credits=6, time="Tuesday 09:00–11:00", semester="semester1", degree="Bachelor of Science"),
    Course(code="STAT1400", name="Statistics for Science", credits=6, time="Thursday 10:00–12:00", semester="semester1", degree="Bachelor of Science"),
    Course(code="CHEM1002", name="Chemistry Foundations", credits=6, time="Monday 14:00–16:00", semester="semester1", degree="Bachelor of Science"),

    Course(code="BIOL2201", name="Genetics", credits=6, time="Tuesday 13:00–15:00", semester="semester2", degree="Bachelor of Science"),
    Course(code="PHYS1101", name="Physics Fundamentals", credits=6, time="Wednesday 09:00–11:00", semester="semester2", degree="Bachelor of Science"),
    Course(code="STAT2401", name="Applied Statistics", credits=6, time="Thursday 14:00–16:00", semester="semester2", degree="Bachelor of Science"),
    Course(code="MATH2202", name="Linear Algebra", credits=6, time="Tuesday 13:00–15:00", semester="semester2", degree="Bachelor of Science"),

    # Bachelor of Biomedical Science
    Course(code="ANHB1101", name="Human Biology I", credits=6, time="Monday 09:00–11:00", semester="semester1", degree="Bachelor of Biomedical Science"),
    Course(code="CHEM1001", name="Chemistry for Life Sciences", credits=6, time="Tuesday 12:00–14:00", semester="semester1", degree="Bachelor of Biomedical Science"),
    Course(code="IMED1001", name="Form and Function", credits=6, time="Thursday 14:00–16:00", semester="semester1", degree="Bachelor of Biomedical Science"),
    Course(code="MICR1101", name="Introduction to Microbiology", credits=6, time="Monday 09:00–11:00", semester="semester1", degree="Bachelor of Biomedical Science"),

    Course(code="PATH2001", name="Pathology Basics", credits=6, time="Tuesday 10:00–12:00", semester="semester2", degree="Bachelor of Biomedical Science"),
    Course(code="PHYL2002", name="Human Physiology", credits=6, time="Wednesday 13:00–15:00", semester="semester2", degree="Bachelor of Biomedical Science"),
    Course(code="ANHB2203", name="Advanced Anatomy", credits=6, time="Thursday 10:00–12:00", semester="semester2", degree="Bachelor of Biomedical Science"),
    Course(code="BIOC2001", name="Biochemistry", credits=6, time="Tuesday 10:00–12:00", semester="semester2", degree="Bachelor of Biomedical Science"),

    # Bachelor of Engineering
    Course(code="ENGG1100", name="Engineering Design", credits=6, time="Monday 10:00–12:00", semester="semester1", degree="Bachelor of Engineering"),
    Course(code="PHYS1001", name="Physics for Engineers", credits=6, time="Wednesday 09:00–11:00", semester="semester1", degree="Bachelor of Engineering"),
    Course(code="MATH1012", name="Engineering Mathematics", credits=6, time="Friday 10:00–12:00", semester="semester1", degree="Bachelor of Engineering"),
    Course(code="CITS1001", name="Programming Fundamentals", credits=6, time="Monday 10:00–12:00", semester="semester1", degree="Bachelor of Engineering"),

    Course(code="ENGG2201", name="Engineering Mechanics", credits=6, time="Thursday 13:00–15:00", semester="semester2", degree="Bachelor of Engineering"),
    Course(code="CIVL1102", name="Structural Engineering Basics", credits=6, time="Monday 10:00–12:00", semester="semester2", degree="Bachelor of Engineering"),
    Course(code="ELEC2203", name="Electrical Systems", credits=6, time="Wednesday 14:00–16:00", semester="semester2", degree="Bachelor of Engineering"),
    Course(code="MECH2201", name="Thermodynamics", credits=6, time="Thursday 13:00–15:00", semester="semester2", degree="Bachelor of Engineering"),

    # Master of Information Technology
    Course(code="CITS5505", name="Agile Web Development", credits=6, time="Monday 10:00–12:00", semester="semester1", degree="Master of Information Technology"),
    Course(code="CITS5504", name="Data Warehousing", credits=6, time="Tuesday 14:00–16:00", semester="semester1", degree="Master of Information Technology"),
    Course(code="CITS5508", name="Machine Learning", credits=6, time="Wednesday 09:00–11:00", semester="semester1", degree="Master of Information Technology"),
    Course(code="CITS5206", name="IT Project Management", credits=6, time="Monday 10:00–12:00", semester="semester1", degree="Master of Information Technology"),

    Course(code="CITS4407", name="Open Source Tools", credits=6, time="Tuesday 10:00–12:00", semester="semester2", degree="Master of Information Technology"),
    Course(code="CITS4012", name="Distributed Computing", credits=6, time="Wednesday 13:00–15:00", semester="semester2", degree="Master of Information Technology"),
    Course(code="CITS3002", name="Networks", credits=6, time="Thursday 10:00–12:00", semester="semester2", degree="Master of Information Technology"),
    Course(code="CITS3003", name="Graphics", credits=6, time="Tuesday 10:00–12:00", semester="semester2", degree="Master of Information Technology"),
    ]

    db.session.add_all(courses)
    db.session.commit()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


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

        login_user(user)
        flash(gettext("Signed in successfully."), "success")
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
@login_required
def homepage():
    return render_template("homepage.html", current_user=current_user)


@app.route("/course-selection.html")
@login_required
def course_selection():
    return render_template("course-selection.html", current_user=current_user)

@app.route("/api/courses")
@login_required
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
@login_required
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
@login_required
def timetable():
    return render_template("timetable.html", current_user=current_user)


@app.route("/admin-dashboard.html")
@login_required
def admin_dashboard():
    return render_template("admin-dashboard.html", current_user=current_user)


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