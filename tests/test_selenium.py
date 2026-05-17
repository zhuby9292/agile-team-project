import os
import sys
import threading
import time

import pytest
from werkzeug.security import generate_password_hash
from werkzeug.serving import make_server

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Let pytest import app.py from the project root.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app, db, User, Admin, Course


class ServerThread(threading.Thread):
    def __init__(self):
        threading.Thread.__init__(self)
        self.server = make_server("127.0.0.1", 5001, app)
        self.context = app.app_context()
        self.context.push()

    def run(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()


@pytest.fixture(scope="module")
def live_server():
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///test.db"

    test_db_path = os.path.join(app.instance_path, "test.db")

    with app.app_context():
        db.drop_all()
        db.create_all()

        student = User(
            full_name="Selenium Student",
            email="selenium@student.com",
            student_id="30000001",
            password_hash=generate_password_hash("password123"),
        )

        # Admin is its own model — no student_id, no ADMIN_EMAILS config needed.
        admin = Admin(
            full_name="Selenium Admin",
            email="admin@example.com",
            password_hash=generate_password_hash("admin123"),
        )

        # Semester 1 course
        course_sem1 = Course(
            code="CITS5505",
            name="Agile Web Development",
            credits=6,
            time="Monday 10:00–12:00",
            semester="semester1",
            degree="Master of Information Technology",
        )

        # Semester 2 course — used to verify locking behaviour
        course_sem2 = Course(
            code="CITS3003",
            name="Graphics",
            credits=6,
            time="Tuesday 09:00–10:00",
            semester="semester2",
            degree="Master of Information Technology",
        )

        db.session.add_all([student, admin, course_sem1, course_sem2])
        db.session.commit()

    server = ServerThread()
    server.daemon = True
    server.start()

    time.sleep(1)

    yield "http://127.0.0.1:5001"

    server.shutdown()

    with app.app_context():
        db.session.remove()
        db.drop_all()

    if os.path.exists(test_db_path):
        os.remove(test_db_path)


@pytest.fixture
def browser():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1400,1000")

    driver = webdriver.Chrome(options=options)

    yield driver

    driver.quit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def login_student(browser, live_server):
    browser.get(live_server + "/")

    email_input = WebDriverWait(browser, 10).until(
        EC.presence_of_element_located((By.NAME, "email"))
    )
    password_input = browser.find_element(By.NAME, "password")

    email_input.send_keys("selenium@student.com")
    password_input.send_keys("password123")

    browser.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

    WebDriverWait(browser, 10).until(
        EC.url_contains("homepage")
    )


def login_admin(browser, live_server):
    browser.get(live_server + "/admin-login")

    email_input = WebDriverWait(browser, 10).until(
        EC.presence_of_element_located((By.NAME, "email"))
    )
    password_input = browser.find_element(By.NAME, "password")

    email_input.send_keys("admin@example.com")
    password_input.send_keys("admin123")

    browser.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

    WebDriverWait(browser, 10).until(
        EC.url_contains("admin-dashboard")
    )


# ---------------------------------------------------------------------------
# Original selenium tests (1-5) — kept intact, admin fixture now uses Admin model.
# ---------------------------------------------------------------------------

def test_selenium_index_page_loads(browser, live_server):
    browser.get(live_server + "/")

    assert "Course Planner" in browser.page_source


def test_selenium_signup_page_loads(browser, live_server):
    browser.get(live_server + "/signup.html")

    assert "Sign" in browser.page_source or "Account" in browser.page_source


def test_selenium_student_can_login(browser, live_server):
    login_student(browser, live_server)

    assert "homepage" in browser.current_url


def test_selenium_course_selection_page_loads(browser, live_server):
    login_student(browser, live_server)

    browser.get(live_server + "/course-selection.html")

    WebDriverWait(browser, 10).until(
        EC.presence_of_element_located((By.ID, "study-level-select"))
    )

    assert "Available courses" in browser.page_source


def test_selenium_can_select_degree(browser, live_server):
    login_student(browser, live_server)

    browser.get(live_server + "/course-selection.html")

    study_level_select = WebDriverWait(browser, 10).until(
        EC.presence_of_element_located((By.ID, "study-level-select"))
    )

    Select(study_level_select).select_by_value("master")

    degree_select = WebDriverWait(browser, 10).until(
        EC.presence_of_element_located((By.ID, "degree-select"))
    )

    Select(degree_select).select_by_visible_text("Master of Information Technology")

    assert "Master of Information Technology" in browser.page_source


def test_selenium_timetable_page_loads(browser, live_server):
    login_student(browser, live_server)

    browser.get(live_server + "/timetable.html")

    assert "timetable" in browser.page_source.lower()


# ---------------------------------------------------------------------------
# Semester progression selenium test (6)
# ---------------------------------------------------------------------------

def test_selenium_semester_1_courses_addable_semester_2_locked(browser, live_server):
    """
    Verifies that on the course-selection page:
      - Semester 1 courses have an enabled 'Add' button (eligible semester).
      - Semester 2 courses show a '🔒 Locked' disabled button (not yet eligible).

    This confirms the semester enforcement is visible in the UI, not just enforced
    server-side.
    """
    login_student(browser, live_server)

    browser.get(live_server + "/course-selection.html")

    # Select study level = Master
    study_level = WebDriverWait(browser, 10).until(
        EC.presence_of_element_located((By.ID, "study-level-select"))
    )
    Select(study_level).select_by_value("master")

    # Select degree = MIT
    degree_select = WebDriverWait(browser, 10).until(
        EC.presence_of_element_located((By.ID, "degree-select"))
    )
    Select(degree_select).select_by_visible_text("Master of Information Technology")

    # Wait for course rows to render
    WebDriverWait(browser, 10).until(
        EC.presence_of_element_located((By.CLASS_NAME, "course-table-row"))
    )

    # Allow JS to finish rendering locked/eligible states
    time.sleep(1)

    # --- Semester 1 (CITS5505) should have an ENABLED Add button ---
    sem1_add_btn = WebDriverWait(browser, 10).until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, "button[data-course-code='CITS5505']")
        )
    )
    assert not sem1_add_btn.get_attribute("disabled"), (
        "Expected CITS5505 (Semester 1) Add button to be enabled, but it was disabled."
    )
    assert sem1_add_btn.text.strip() in ("Add", "Added"), (
        f"Unexpected button text for CITS5505: '{sem1_add_btn.text.strip()}'"
    )

    # --- Semester 2 (CITS3003) should show a LOCKED button ---
    # Switch the semester filter to show Semester 2 rows
    semester_filter = browser.find_element(By.ID, "semester-filter")
    Select(semester_filter).select_by_value("semester2")

    time.sleep(0.5)

    # The locked button does not carry data-course-code, so find by class
    locked_buttons = browser.find_elements(By.CLASS_NAME, "semester-locked-btn")
    assert len(locked_buttons) > 0, (
        "Expected at least one semester-locked-btn for Semester 2, but found none."
    )

    for btn in locked_buttons:
        assert btn.get_attribute("disabled") is not None, (
            "Locked semester button should be disabled."
        )