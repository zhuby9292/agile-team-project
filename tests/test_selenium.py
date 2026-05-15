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

from app import app, db, User, Course


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
    app.config["ADMIN_EMAILS"] = "admin@example.com"

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

        admin = User(
            full_name="Selenium Admin",
            email="admin@example.com",
            student_id="99999998",
            password_hash=generate_password_hash("admin123"),
        )

        course = Course(
            code="CITS5505",
            name="Agile Web Development",
            credits=6,
            time="Monday 10:00–12:00",
            semester="semester1",
            degree="Master of Information Technology",
        )

        db.session.add_all([student, admin, course])
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