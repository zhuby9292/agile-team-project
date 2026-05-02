from flask import Flask, send_from_directory

app = Flask(__name__)

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/index.html")
def index_html():
    return send_from_directory(".", "index.html")

@app.route("/signup.html")
def signup():
    return send_from_directory(".", "signup.html")

@app.route("/homepage.html")
def homepage():
    return send_from_directory(".", "homepage.html")

@app.route("/course-selection.html")
def courses():
    return send_from_directory(".", "course-selection.html")

@app.route("/timetable.html")
def timetable():
    return send_from_directory(".", "timetable.html")

@app.route('/css/<path:filename>')
def css_files(filename):
    return send_from_directory('css', filename)

@app.route('/js/<path:filename>')
def js_files(filename):
    return send_from_directory('js', filename)

if __name__ == "__main__":
    app.run(debug=True)