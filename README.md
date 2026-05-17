# Agile Web Development Team Project

A web-based course planning system developed as part of the CITS5505 Agile Web Development group project at UWA.

The application allows students to explore degrees, manage course enrolments, generate timetables, and track semester progression through an interactive dashboard with multi-language support and administrative management features.

## Features

- User login and logout
- Admin login and admin dashboard
- Course data loaded from JSON into SQLite database
- Course search and semester filtering
- Persistent course selection and enrollment tracking
- Timetable CSV download
- Semester progression workflow with admin approval
- Enrollment overview and change request management
- Admin course management and enrollment monitoring
- English/Chinese language switching
- Dark mode
- Pytest unit testing and Selenium browser testing

## Tech Stack

- HTML
- CSS
- JavaScript
- Bootstrap
- Python
- Flask
- SQLite
- SQLAlchemy
- Flask-Login
- Flask-Babel
- Selenium
- Pytest

## Project Structure

```text
agile-team-project/
├── app.py
├── requirements.txt
├── README.md
├── CheckPoint2.md
├── babel.cfg
├── messages.pot
│
├── data/
│   └── courses.json
│
├── instance/
│   └── course_planner.db
│
├── static/
│   ├── css/
│   │   └── style.css
│   │
│   ├── js/
│   │   └── script.js
│   │
│   ├── images/
│   │
│   └── favicon.svg
│
├── templates/
│   ├── base.html
│   ├── dashboard-base.html
│   ├── index.html
│   ├── signup.html
│   ├── homepage.html
│   ├── course-selection.html
│   ├── timetable.html
│   ├── admin-login.html
│   ├── admin-dashboard.html
│   ├── forgot-password.html
│   └── reset-password.html
│
├── tests/
│   ├── test_app.py
│   └── test_selenium.py
│
└── translations/
    └── zh/
        └── LC_MESSAGES/

```

## Setup

Clone the repository:

```bash
git clone https://github.com/zhuby9292/agile-team-project.git
cd agile-team-project
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate the environment:

### macOS / Linux

```bash
source venv/bin/activate
```

### Windows

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the application:

```bash
python app.py
```

Open in browser:

```text
http://127.0.0.1:5000
```

## Running Tests

Run unit tests:

```bash
pytest tests/test_app.py -v
```

Run selenium tests:

```bash
pytest tests/test_selenium.py -v
```

The Selenium tests run against a live local Flask server.

## Team Member Details

| Name | UWA ID | GitHub Username |
|---|---|---|
| Aneesh Kumar Bandari | 24553634 | wowitsaneesh |
| Biying Zhu | 24208028 | zhuby9292 |
| yonghehu | 24108102 | YongheHu |