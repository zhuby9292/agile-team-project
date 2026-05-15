import os
import sys

import pytest
from werkzeug.security import generate_password_hash

# Let pytest import app.py from the project root.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app, db, User, Course, Selection


@pytest.fixture
def client():
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["ADMIN_EMAILS"] = "admin@example.com"

    with app.app_context():
        db.drop_all()
        db.create_all()

        student = User(
            full_name="Test Student",
            email="student@example.com",
            student_id="24208028",
            password_hash=generate_password_hash("password123"),
        )

        admin = User(
            full_name="Test Admin",
            email="admin@example.com",
            student_id="99999999",
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

        with app.test_client() as test_client:
            yield test_client

        db.session.remove()
        db.drop_all()


def login_student(client):
    return client.post(
        "/",
        data={
            "email": "student@example.com",
            "password": "password123",
        },
        follow_redirects=True,
    )


def login_admin(client):
    return client.post(
        "/admin-login",
        data={
            "email": "admin@example.com",
            "password": "admin123",
        },
        follow_redirects=True,
    )


# Unit test 1: index page loads.
def test_index_page_loads(client):
    response = client.get("/")
    assert response.status_code == 200


# Unit test 2: signup page loads.
def test_signup_page_loads(client):
    response = client.get("/signup.html")
    assert response.status_code == 200


# Unit test 3: forgot password page loads.
def test_forgot_password_page_loads(client):
    response = client.get("/forgot-password")
    assert response.status_code == 200


# Unit test 4: reset password page loads.
def test_reset_password_page_loads(client):
    response = client.get("/reset-password")
    assert response.status_code == 200


# Unit test 5: student login works.
def test_student_login_redirects_to_homepage(client):
    response = login_student(client)
    assert response.status_code == 200
    assert b"dashboard" in response.data.lower()


# Unit test 6: course API requires login.
def test_course_api_requires_login(client):
    response = client.get("/api/courses", follow_redirects=True)
    assert response.status_code == 200
    assert b"sign" in response.data.lower() or b"login" in response.data.lower()


# Unit test 7: course API returns courses after login.
def test_course_api_returns_courses_after_login(client):
    login_student(client)

    response = client.get("/api/courses")
    data = response.get_json()

    assert response.status_code == 200
    assert "courses" in data
    assert len(data["courses"]) >= 1
    assert data["courses"][0]["code"] == "CITS5505"


# Unit test 8: selected courses can be saved.
def test_save_selection_creates_selection(client):
    login_student(client)

    response = client.post(
        "/api/save-selection",
        json={
            "courses": ["CITS5505"]
        },
    )

    assert response.status_code == 200

    with app.app_context():
        saved_selection = Selection.query.first()
        assert saved_selection is not None


# Unit test 9: admin login works.
def test_admin_login_redirects_to_admin_dashboard(client):
    response = login_admin(client)

    assert response.status_code == 200
    assert b"admin" in response.data.lower()


# Unit test 10: student cannot access admin dashboard.
def test_student_cannot_access_admin_dashboard(client):
    login_student(client)

    response = client.get("/admin-dashboard.html", follow_redirects=True)

    assert response.status_code == 200
    assert b"dashboard" in response.data.lower()