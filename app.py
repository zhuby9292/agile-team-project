from flask import Flask, render_template
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Basic SQLite database configuration.
# The database file will be created inside the instance folder.
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///course_planner.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Creates the SQLAlchemy database object.
db = SQLAlchemy(app)


# User model for storing registered user account details.
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    student_id = db.Column(db.String(30), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/index.html")
def index_html():
    return render_template("index.html")


@app.route("/signup.html")
def signup():
    return render_template("signup.html")


@app.route("/homepage.html")
def homepage():
    return render_template("homepage.html")


@app.route("/course-selection.html")
def course_selection():
    return render_template("course-selection.html")


@app.route("/timetable.html")
def timetable():
    return render_template("timetable.html")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(debug=True)