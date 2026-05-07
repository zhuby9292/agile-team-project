from flask import Flask, render_template

app = Flask(__name__)


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
    app.run(debug=True)